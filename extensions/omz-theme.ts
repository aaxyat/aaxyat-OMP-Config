import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

interface ComposerRenderContext {
  width: number;
  paddingX: number;
  borderColor: (text: string) => string;
  accentColor: (text: string) => string;
  surfaceColor: (text: string) => string;
}

interface ComposerRowContext {
  width: number;
  paddingX: number;
  gutter: string;
  text: string;
  pad: string;
  isLastRow: boolean;
  cursorOverflow: number;
  imeSafeCursorTail: boolean;
  scrollbarThumb: boolean;
}

interface RenderableUI {
  requestRender?(): void;
  setStatus?(key: string, text: string): void;
}

interface BarSegment {
  text: string;
  bg: string;
  fg?: string;
  /** Optional segments are dropped, earliest first, when the bar cannot fit the terminal. */
  optional?: boolean;
}

interface DeepSeekStatus {
  isPeak: boolean;
  /** Countdown to the next pricing-window flip, e.g. "2h14m". */
  nextFlip: string;
}

interface UsageTotals {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

const EMPTY_USAGE: UsageTotals = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
const ANSI_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]/g;
// Powerlevel10k ribbon: rounded caps and the hard separator glyph from the Powerline private-use
// block, drawn as fg on the *next* segment's background so the chips read as one continuous ribbon.
const BAR_CAP_LEFT = "\ue0b6";
const BAR_SEPARATOR = "\ue0b0";
const BAR_BADGE_OPEN = "\ue0b2";
const BAR_BADGE_CLOSE = "\ue0b4";
// Segment palette for a dark terminal: mid-dark chips that stay distinct from one another and hold
// near-white text at 5:1 or better.
const BAR_TEXT = "242;242;242";
const BAR_SLATE = "68;71;90";
const BAR_BLUE = "59;90;128";
const BAR_TEAL = "46;107;87";
const BAR_PLUM = "91;74;128";
const BAR_BRONZE = "122;90;46";
const BAR_GREEN = "46;107;79";
const BAR_RED = "122;59;59";

function visibleWidth(text: string): number {
  let cells = 0;
  for (const _char of text.replace(ANSI_PATTERN, "")) {
    cells += 1;
  }
  return cells;
}

// One continuous Powerlevel10k ribbon: rounded left cap, hard separators, hard right cap.
function powerlineRun(segments: BarSegment[]): string {
  const first = segments[0];
  let out =
    `\x1b[49m\x1b[38;2;${first.bg}m${BAR_CAP_LEFT}` +
    `\x1b[48;2;${first.bg}m\x1b[38;2;${first.fg ?? BAR_TEXT}m${first.text}`;
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    out +=
      `\x1b[48;2;${segment.bg}m\x1b[38;2;${segments[index - 1].bg}m${BAR_SEPARATOR}` +
      `\x1b[38;2;${segment.fg ?? BAR_TEXT}m${segment.text}`;
  }
  const last = segments[segments.length - 1];
  return `${out}\x1b[49m\x1b[38;2;${last.bg}m${BAR_SEPARATOR}\x1b[39m`;
}

// Right-anchored Powerlevel10k chip, rounded on both sides like p10k's right prompt.
function powerlineBadge(text: string, bg: string, fg: string): string {
  return (
    `\x1b[49m\x1b[38;2;${bg}m${BAR_BADGE_OPEN}` +
    `\x1b[48;2;${bg}m\x1b[38;2;${fg}m${text}` +
    `\x1b[49m\x1b[38;2;${bg}m${BAR_BADGE_CLOSE}\x1b[39m`
  );
}

// Drop optional segments, earliest first, until the ribbon fits beside whatever is reserved.
function fitBar(segments: BarSegment[], width: number, reserve: number): BarSegment[] {
  const kept = segments.slice();
  while (kept.length > 0 && visibleWidth(powerlineRun(kept)) + reserve > width) {
    const dropIndex = kept.findIndex((segment) => segment.optional);
    if (dropIndex === -1) {
      break;
    }
    kept.splice(dropIndex, 1);
  }
  return kept;
}

function readUsage(value: unknown): UsageTotals | null {
  if (!value || typeof value !== "object" || !("usage" in value)) {
    return null;
  }
  const usage = value.usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const count = (key: string): number => {
    const raw: unknown = Reflect.get(usage, key);
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  };
  return {
    input: count("input"),
    cacheRead: count("cacheRead"),
    cacheWrite: count("cacheWrite"),
    output: count("output")
  };
}

function usageKey(message: unknown, fallback: string): string {
  if (message && typeof message === "object") {
    const id =
      "responseId" in message
        ? message.responseId
        : "completedAt" in message
          ? message.completedAt
          : "timestamp" in message
            ? message.timestamp
            : undefined;
    if (typeof id === "string" || typeof id === "number") {
      // Identity-first: a branch rebuild and a live re-delivery of the same message must land on
      // the same ledger key, or resumed history double-counts.
      return String(id);
    }
  }
  return fallback;
}

function addUsage(total: UsageTotals, next: UsageTotals): UsageTotals {
  return {
    input: total.input + next.input,
    cacheRead: total.cacheRead + next.cacheRead,
    cacheWrite: total.cacheWrite + next.cacheWrite,
    output: total.output + next.output
  };
}

function diffUsage(next: UsageTotals, previous: UsageTotals): UsageTotals {
  return {
    input: next.input - previous.input,
    cacheRead: next.cacheRead - previous.cacheRead,
    cacheWrite: next.cacheWrite - previous.cacheWrite,
    output: next.output - previous.output
  };
}

// Prompt tokens are everything the model read: fresh input, cache hits, and non-cached writes.
function cacheHitRate(usage: UsageTotals): string {
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
  if (prompt <= 0) {
    return "0.0%";
  }
  return `${((usage.cacheRead / prompt) * 100).toFixed(1)}%`;
}

function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}

// Generation throughput excludes time-to-first-token, so a long warm-up does not deflate tok/s.
function messageTokRate(message: unknown): number | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const usage = readUsage(message);
  const duration = "duration" in message && typeof message.duration === "number" ? message.duration : 0;
  if (!usage || usage.output <= 0 || duration <= 0) {
    return null;
  }
  const ttft = "ttft" in message && typeof message.ttft === "number" ? message.ttft : 0;
  const generation = duration - ttft;
  // A two-token answer finishing 1 ms after its first token would report thousands of tok/s.
  // Below a useful sample, average over the whole request instead of the generation window.
  const window = usage.output >= 5 && generation >= 400 ? generation : duration;
  return (usage.output / Math.max(1, window)) * 1000;
}

// Measured over 371 persisted assistant messages: ~2.9 streamed characters per output token
// (median). Streaming estimates use it so the live counters track the real total closely.
const CHARS_PER_OUTPUT_TOKEN = 2.9;

// Display name for a session model: the descriptor's pretty name when present, else its bare id.
function modelLabel(model: unknown): string | null {
  if (!model || typeof model !== "object") {
    return null;
  }
  if ("name" in model && typeof model.name === "string" && model.name.length > 0) {
    return model.name;
  }
  if ("id" in model && typeof model.id === "string" && model.id.length > 0) {
    const slash = model.id.lastIndexOf("/");
    return slash === -1 ? model.id : model.id.slice(slash + 1);
  }
  return null;
}

// Streamed assistant text that counts as output tokens: visible text, thinking, and tool arguments.
function streamedOutputChars(message: unknown): number {
  if (!message || typeof message !== "object" || !("content" in message) || !Array.isArray(message.content)) {
    return 0;
  }
  let chars = 0;
  for (const part of message.content) {
    if (!part || typeof part !== "object") {
      continue;
    }
    if ("thinking" in part && typeof part.thinking === "string") {
      chars += part.thinking.length;
    }
    if ("text" in part && typeof part.text === "string") {
      chars += part.text.length;
    }
    if ("partialArgs" in part && typeof part.partialArgs === "string") {
      chars += part.partialArgs.length;
    }
  }
  return chars;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining < 10 ? "0" : ""}${remaining}s`;
}

function getDeepSeekStatus(now = new Date()): DeepSeekStatus {
  const utcDay = now.getUTCDay(); // 0: Sun, 1-5: Mon-Fri, 6: Sat
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const curMinutes = utcHours * 60 + utcMinutes;

  // Monday–Friday, 01:00–04:00 and 06:00–10:00 UTC
  const isWeekday = utcDay >= 1 && utcDay <= 5;
  const inP1 = isWeekday && curMinutes >= 60 && curMinutes < 240;
  const inP2 = isWeekday && curMinutes >= 360 && curMinutes < 600;
  const isPeak = inP1 || inP2;

  let nextTransition: Date | null = null;
  const targetIsPeak = !isPeak;

  for (let d = 0; d < 8; d++) {
    const candidateDay = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + d
    ));
    const candDayOfWeek = candidateDay.getUTCDay();

    if (candDayOfWeek >= 1 && candDayOfWeek <= 5) {
      const transitions = [
        { h: 1, m: 0, becomesPeak: true },
        { h: 4, m: 0, becomesPeak: false },
        { h: 6, m: 0, becomesPeak: true },
        { h: 10, m: 0, becomesPeak: false }
      ];

      for (const t of transitions) {
        if (t.becomesPeak === targetIsPeak) {
          const tDate = new Date(Date.UTC(
            candidateDay.getUTCFullYear(),
            candidateDay.getUTCMonth(),
            candidateDay.getUTCDate(),
            t.h,
            t.m
          ));
          if (tDate.getTime() > now.getTime()) {
            if (!nextTransition || tDate.getTime() < nextTransition.getTime()) {
              nextTransition = tDate;
            }
          }
        }
      }
    }
    if (nextTransition) {
      break;
    }
  }

  let nextFlip = "--";
  if (nextTransition) {
    const diffMs = nextTransition.getTime() - now.getTime();
    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    nextFlip = hours > 0 ? `${hours}h${String(mins).padStart(2, "0")}m` : `${mins}m`;
  }

  return { isPeak, nextFlip };
}

export default function (pi: ExtensionAPI) {
  // Filled from the live session API on session/agent/turn start; empty until then.
  let currentModel = "";
  let currentThinking = "";
  let promptStartTime = 0;
  let streamStartTime = 0;
  let isExecuting = false;
  let currentDuration = "0s";
  let currentTokRate = "0.0 tok/s";
  let activeUi: RenderableUI | null = null;
  // Cumulative session usage. The per-message ledger keeps counting idempotent: a streaming
  // partial update and the finalized message for the same response correct the totals instead
  // of adding twice.
  let ledgerTotals: UsageTotals = EMPTY_USAGE;
  // Counters are cumulative, so a reset rebases the display instead of clearing the ledger:
  // replayed or rebuilt history must never be counted twice.
  let displayBaseline: UsageTotals = EMPTY_USAGE;
  const perMessageUsage = new Map<string, UsageTotals>();
  // The panel must not depend on event payloads alone: when usage is missing from an event, or an
  // event is missed, this reconciliation re-reads persisted history. Re-merging is idempotent
  // because ledger keys are message identities.
  let activeCtx: unknown = null;
  let ticks = 0;
  // Display-only output estimate for the in-flight message, replaced by real usage when it lands.
  let liveOutputTokens = 0;
  // True between the first and last row of one render pass, so the padding row goes above the
  // typing area once per frame rather than above every wrapped line.
  let rowPassOpen = false;

  // Model and thinking level come from the live session API, not from the host's status string, so
  // they stay correct when the model or reasoning level changes mid-session.
  const refreshModelInfo = (ctx: unknown): void => {
    const models = ctx && typeof ctx === "object" && "models" in ctx ? ctx.models : undefined;
    const current = models && typeof models === "object" && "current" in models && typeof models.current === "function"
      ? models.current()
      : undefined;
    const label = modelLabel(current);
    if (label) {
      currentModel = label;
    }
    const level = pi.getThinkingLevel();
    if (typeof level === "string" && level.length > 0) {
      currentThinking = level;
    }
  };

  const recordUsage = (key: string, usage: UsageTotals | null): void => {
    if (!usage) {
      return;
    }
    const previous = perMessageUsage.get(key);
    perMessageUsage.set(key, usage);
    ledgerTotals = previous ? addUsage(ledgerTotals, diffUsage(usage, previous)) : addUsage(ledgerTotals, usage);
  };

  const mergeBranchUsage = (): void => {
    const manager = activeCtx && typeof activeCtx === "object" && "sessionManager" in activeCtx ? activeCtx.sessionManager : undefined;
    if (!manager || typeof manager !== "object" || !("getBranch" in manager)) {
      return;
    }
    const getBranch = manager.getBranch;
    if (typeof getBranch !== "function") {
      return;
    }
    const branch = getBranch.call(manager);
    if (!Array.isArray(branch)) {
      return;
    }
    branch.forEach((entry, index) => {
      if (entry && typeof entry === "object" && "type" in entry && entry.type === "message" && "message" in entry) {
        recordUsage(usageKey(entry.message, `branch-${index}`), readUsage(entry.message));
      }
    });
  };

  const resetUsageFromBranch = (ctx: unknown): void => {
    activeCtx = ctx;
    perMessageUsage.clear();
    ledgerTotals = EMPTY_USAGE;
    displayBaseline = EMPTY_USAGE;
    liveOutputTokens = 0;
    mergeBranchUsage();
  };

  // Session counters are cumulative, so /reset-tokens rebases the panel rather than wiping the
  // ledger: already-counted messages stay counted, and the next turn starts the display at zero.
  pi.registerCommand("reset-tokens", {
    description: "Reset the composer token counters to zero",
    handler: async (_args, ctx) => {
      displayBaseline = ledgerTotals;
      activeUi?.requestRender?.();
      ctx.ui?.notify?.("Token counters reset", "info");
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    promptStartTime = 0;
    streamStartTime = 0;
    isExecuting = false;
    currentDuration = "0s";
    currentTokRate = "0.0 tok/s";
    refreshModelInfo(ctx);
    resetUsageFromBranch(ctx);
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  // A branch or tree switch swaps the visible conversation, so the ledger must follow it.
  pi.on("session_branch", async (_event, ctx) => {
    resetUsageFromBranch(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    resetUsageFromBranch(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    promptStartTime = Date.now();
    streamStartTime = 0;
    isExecuting = true;
    currentDuration = "0s";
    currentTokRate = "0.0 tok/s";
    refreshModelInfo(ctx);
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    if (!isExecuting || promptStartTime === 0) {
      promptStartTime = Date.now();
      isExecuting = true;
      currentDuration = "0s";
    }
    streamStartTime = Date.now();
    currentTokRate = "0.0 tok/s";
    liveOutputTokens = 0;
    refreshModelInfo(ctx);
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("message_update", async (event, ctx) => {
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
    if (!isExecuting) {
      isExecuting = true;
    }
    if (streamStartTime === 0) {
      streamStartTime = Date.now();
    }

    if (event && typeof event === "object" && "message" in event && event.message) {
      const msg = event.message;
      // The streamed message is cumulative, so its size is the in-flight output so far. Thinking
      // and tool-argument text count as output tokens too; providers report no usable usage until
      // the message ends, so this is what makes the counters move during a turn.
      const streamedChars = streamedOutputChars(msg);
      if (streamedChars > 0) {
        liveOutputTokens = Math.max(1, Math.round(streamedChars / CHARS_PER_OUTPUT_TOKEN));
        // Floor the window so the first chunk does not read as thousands of tok/s.
        const liveSeconds = Math.max(0.5, (Date.now() - streamStartTime) / 1000);
        currentTokRate = `${(liveOutputTokens / liveSeconds).toFixed(1)} tok/s`;
      }

      // A provider may also push partial usage; only real numbers count, and they retire the
      // estimate for this message.
      const usage = readUsage(msg);
      const realTokens = usage ? usage.input + usage.cacheRead + usage.cacheWrite + usage.output : 0;
      if (usage && realTokens > 0) {
        recordUsage(usageKey(msg, "live"), usage);
        liveOutputTokens = 0;
        if (usage.output > 0 && streamStartTime > 0) {
          const liveSeconds = Math.max(0.5, (Date.now() - streamStartTime) / 1000);
          currentTokRate = `${(usage.output / liveSeconds).toFixed(1)} tok/s`;
        }
      }
    }
  });

  pi.on("message_end", async (event, ctx) => {
    liveOutputTokens = 0;
    if (event && typeof event === "object" && "message" in event) {
      const message = event.message;
      recordUsage(usageKey(message, "live"), readUsage(message));
      const rate = messageTokRate(message);
      if (rate !== null) {
        currentTokRate = `${rate.toFixed(1)} tok/s`;
      }
    }
    // Persistence precedes message_end, so the finalized message is already in the branch here.
    mergeBranchUsage();
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    liveOutputTokens = 0;
    mergeBranchUsage();
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    isExecuting = false;
    liveOutputTokens = 0;
    mergeBranchUsage();
    if (promptStartTime > 0) {
      const elapsed = Math.max(1, Math.floor((Date.now() - promptStartTime) / 1000));
      currentDuration = formatDuration(elapsed);
    }
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  // Repaint several times a second while a turn is live so the counters and tok/s move smoothly;
  // an idle session only needs the 1 Hz baseline the panel had before.
  const TICK_MS = 250;
  const IDLE_TICKS_PER_REPAINT = 4;
  setInterval(() => {
    ticks += 1;
    if (isExecuting && promptStartTime > 0) {
      const elapsed = Math.max(0, Math.floor((Date.now() - promptStartTime) / 1000));
      currentDuration = formatDuration(elapsed);
    }
    // Reconcile with persisted history every few seconds so a missed or usage-less event cannot
    // leave the panel frozen.
    if (ticks % 20 === 0) {
      mergeBranchUsage();
    }
    if (!activeUi) {
      return;
    }
    if (!isExecuting && ticks % IDLE_TICKS_PER_REPAINT !== 0) {
      return;
    }
    if ("requestRender" in activeUi && typeof activeUi.requestRender === "function") {
      activeUi.requestRender();
    } else if ("setStatus" in activeUi && typeof activeUi.setStatus === "function") {
      activeUi.setStatus("ticker", String(Date.now()));
    }
  }, TICK_MS);

  pi.registerComposerShape({
    label: "Powerlevel10k Rainbow",
    description: "Powerlevel10k rainbow colored status bar with Oh My Zsh prompt",
    style: {
      id: "omz",
      sideBorders: false,
      verticalChrome: 2,
      statusAttachment: "top-band",
      bottomBar: "none",
      bottomBarGap: false,
      defaultPromptGutter: "\x1b[38;2;16;185;129m❯\x1b[39m ",
      defaultPaddingX: () => 0,
      sideChromeWidth: () => 0,
      renderTop: (ctx: ComposerRenderContext) => {
        const home = process.env.HOME ?? "";
        const cwd = process.cwd();
        const shortPath = home.length > 0 && cwd.startsWith(home)
          ? `~${cwd.slice(home.length)}`
          : cwd;
        const ds = getDeepSeekStatus();

        // Powerlevel10k ribbon for a dark terminal: elapsed, directory, pricing window (muted green
        // off-peak, muted red in peak), then the model that is answering.
        const segments: BarSegment[] = [
          { text: ` ${currentDuration} `, bg: BAR_SLATE, optional: true },
          { text: ` ${shortPath} `, bg: BAR_BLUE, optional: true },
          {
            text: ` ${ds.isPeak ? `peak ends in ${ds.nextFlip}` : `peak in ${ds.nextFlip}`} `,
            bg: ds.isPeak ? BAR_RED : BAR_GREEN,
            optional: true
          },
          ...(currentModel.length > 0
            ? [{ text: ` ${currentModel}${currentThinking.length > 0 ? ` · ${currentThinking}` : ""} `, bg: BAR_PLUM }]
            : [])
        ];

        const kept = fitBar(segments, ctx.width, 0);
        if (kept.length === 0) {
          return "";
        }
        const run = powerlineRun(kept);
        return run + " ".repeat(Math.max(0, ctx.width - visibleWidth(run)));
      },
      renderRow: (ctx: ComposerRowContext) => {
        const arrow = "\x1b[38;2;16;185;129m❯\x1b[39m ";
        const trimmed = ctx.gutter.trim();
        const gutter = trimmed === "╰─" || trimmed === "❯" || ctx.gutter.length === 0
          ? arrow
          : ctx.gutter;

        // Breathing room above and below the typing area. renderRow may return several rows, and the
        // host paints one frame per pass, so the first row of a pass is the one that carries the top
        // padding while isLastRow carries the bottom.
        const isFirstRow = !rowPassOpen;
        rowPassOpen = !ctx.isLastRow;

        const rows = [gutter + ctx.text + ctx.pad];
        if (isFirstRow) {
          rows.unshift("");
        }
        if (ctx.isLastRow) {
          rows.push("");
        }
        return rows;
      },
      renderBottom: (ctx: ComposerRenderContext) => {
        // Powerlevel10k ribbon for a dark terminal: one chip per counter on the left, and the live
        // rate as a right-anchored badge, the way p10k hangs its right prompt.
        const shown = diffUsage(ledgerTotals, displayBaseline);
        const badge = powerlineBadge(` ${currentTokRate} `, BAR_BRONZE, BAR_TEXT);
        const badgeWidth = visibleWidth(badge);
        const segments: BarSegment[] = [
          { text: ` in ${formatTokens(shown.input)} `, bg: BAR_BLUE, optional: true },
          { text: ` cached ${formatTokens(shown.cacheRead)} ${cacheHitRate(shown)} `, bg: BAR_TEAL, optional: true },
          { text: ` out ${formatTokens(shown.output + liveOutputTokens)} `, bg: BAR_PLUM, optional: true }
        ];

        const kept = fitBar(segments, ctx.width, badgeWidth + 1);
        if (kept.length > 0) {
          const run = powerlineRun(kept);
          const gap = Math.max(0, ctx.width - visibleWidth(run) - badgeWidth);
          if (visibleWidth(run) + gap + badgeWidth <= ctx.width) {
            return run + " ".repeat(gap) + badge;
          }
        }
        if (badgeWidth <= ctx.width) {
          // Not even one chip fits beside the rate: keep the rate, which is the live signal.
          return " ".repeat(ctx.width - badgeWidth) + badge;
        }
        // Last resort: no room for caps, so emit the bare rate as plain text.
        return Array.from(currentTokRate).slice(0, ctx.width).join("");
      }
    }
  });
}
