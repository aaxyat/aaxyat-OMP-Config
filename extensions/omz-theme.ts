import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

interface ComposerRenderContext {
  width: number;
  paddingX: number;
  box: {
    horizontal: string;
    vertical: string;
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
  borderColor: (text: string) => string;
  accentColor: (text: string) => string;
  surfaceColor: (text: string) => string;
  topBorder?: {
    content: string;
    width: number;
  };
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

interface DeepSeekStatus {
  isPeak: boolean;
  label: string;
  visibleCells: number;
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

  let timeStr = "0s";
  if (nextTransition) {
    const diffMs = nextTransition.getTime() - now.getTime();
    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    const mStr = mins < 10 ? `0${mins}` : `${mins}`;
    const sStr = secs < 10 ? `0${secs}` : `${secs}`;
    timeStr = `${hStr}:${mStr}:${sStr}`;
  }

  const modeStr = isPeak ? "(peak)" : "(off)";
  return {
    isPeak,
    label: ` 🐳 ${modeStr} ${timeStr} `,
    visibleCells: 1 + 2 + 1 + modeStr.length + 1 + timeStr.length + 1
  };
}

export default function (pi: ExtensionAPI) {
  let currentModel = "gemini-3.8-flash";
  let currentThinking = "high";
  let promptStartTime = 0;
  let streamStartTime = 0;
  let isExecuting = false;
  let currentDuration = "0s";
  let currentTokRate = "0.0 tok/s";
  let activeUi: RenderableUI | null = null;

  pi.on("session_start", async (_event, ctx) => {
    promptStartTime = 0;
    streamStartTime = 0;
    isExecuting = false;
    currentDuration = "0s";
    currentTokRate = "0.0 tok/s";
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    promptStartTime = Date.now();
    streamStartTime = 0;
    isExecuting = true;
    currentDuration = "0s";
    currentTokRate = "0.0 tok/s";
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
      const msg = event.message as { content?: Array<{ type?: string; text?: string }> };
      if (Array.isArray(msg.content)) {
        let totalChars = 0;
        for (const part of msg.content) {
          if (part && part.type === "text" && typeof part.text === "string") {
            totalChars += part.text.length;
          }
        }
        const elapsedSec = Math.max(0.1, (Date.now() - streamStartTime) / 1000);
        const estimatedTokens = Math.max(1, Math.round(totalChars / 3.8));
        const rate = (estimatedTokens / elapsedSec).toFixed(1);
        currentTokRate = `${rate} tok/s`;
      }
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    currentTokRate = "0.0 tok/s";
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    isExecuting = false;
    if (promptStartTime > 0) {
      const elapsed = Math.max(1, Math.floor((Date.now() - promptStartTime) / 1000));
      currentDuration = formatDuration(elapsed);
    }
    currentTokRate = "0.0 tok/s";
    if (ctx.ui) {
      activeUi = ctx.ui as RenderableUI;
    }
  });

  // Continuous real-time UI refresh every 1000ms
  setInterval(() => {
    if (isExecuting && promptStartTime > 0) {
      const elapsed = Math.max(0, Math.floor((Date.now() - promptStartTime) / 1000));
      currentDuration = formatDuration(elapsed);
    }
    if (activeUi) {
      if ("requestRender" in activeUi && typeof activeUi.requestRender === "function") {
        activeUi.requestRender();
      } else if ("setStatus" in activeUi && typeof activeUi.setStatus === "function") {
        activeUi.setStatus("ticker", String(Date.now()));
      }
    }
  }, 1000);

  pi.registerComposerShape({
    label: "Powerlevel10k Rainbow",
    description: "Powerlevel10k rainbow colored status bar with Oh My Zsh prompt",
    style: {
      id: "omz",
      sideBorders: false,
      verticalChrome: 1,
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

        let displayModel = currentModel;
        let displayThinking = currentThinking;

        if (ctx.topBorder && ctx.topBorder.content.length > 0) {
          const raw = ctx.topBorder.content.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

          if (isExecuting) {
            const tokMatch = raw.match(/([0-9.]+)\s*tok\/s/);
            if (tokMatch && tokMatch[1]) {
              currentTokRate = `${tokMatch[1]} tok/s`;
            }
          }

          const modelMatch = raw.match(/\s*([^·]+)(?:·\s*󰪣?\s*([a-zA-Z0-9_-]+))?/);
          if (modelMatch && modelMatch[1]) {
            displayModel = modelMatch[1].trim();
            if (modelMatch[2]) {
              displayThinking = modelMatch[2].trim();
            }
          }
        }

        const slashIndex = displayModel.lastIndexOf("/");
        if (slashIndex !== -1) {
          displayModel = displayModel.slice(slashIndex + 1);
        }

        // DeepSeek status calculation with seconds countdown
        const ds = getDeepSeekStatus();

        // Vibrant Powerlevel10k colors
        const cAmber = "230;140;30";    // Timer: Warm vibrant amber
        const cBlue = "45;115;235";     // Directory: Royal sapphire blue
        const cDSBg = ds.isPeak ? "220;38;38" : "22;163;74"; // DeepSeek: Red (peak) / Green (off-peak)
        const cPurple = "128;65;235";   // Model: Royal violet
        const cGreen = "16;185;129";    // Tok/sec: Crisp emerald
        const cWhite = "255;255;255";

        const segTimer = `  ${currentDuration} `;
        const segPath = `  ${shortPath} `;
        const segModel = `  ${displayModel} · 󰪣 ${displayThinking} `;

        // Left order: Timer -> Directory -> DeepSeek (with seconds countdown) -> Model
        const left =
          `\x1b[38;2;${cAmber}m` +
          `\x1b[48;2;${cAmber}m\x1b[38;2;${cWhite}m\x1b[1m${segTimer}\x1b[22m` +
          `\x1b[48;2;${cBlue}m\x1b[38;2;${cAmber}m` +
          `\x1b[48;2;${cBlue}m\x1b[38;2;${cWhite}m\x1b[1m${segPath}\x1b[22m` +
          `\x1b[48;2;${cDSBg}m\x1b[38;2;${cBlue}m` +
          `\x1b[48;2;${cDSBg}m\x1b[38;2;${cWhite}m\x1b[1m${ds.label}\x1b[22m` +
          `\x1b[48;2;${cPurple}m\x1b[38;2;${cDSBg}m` +
          `\x1b[48;2;${cPurple}m\x1b[38;2;${cWhite}m\x1b[1m${segModel}\x1b[22m` +
          `\x1b[49m\x1b[38;2;${cPurple}m\x1b[39m`;

        // Right side: Tok/sec badge
        const segTok = `  ${currentTokRate} `;
        const right =
          `\x1b[49m\x1b[38;2;${cGreen}m` +
          `\x1b[48;2;${cGreen}m\x1b[38;2;${cWhite}m\x1b[1m${segTok}\x1b[22m` +
          `\x1b[49m\x1b[38;2;${cGreen}m\x1b[39m`;

        const leftLen = 1 + segTimer.length + 1 + segPath.length + 1 + ds.visibleCells + 1 + segModel.length + 1;
        const rightLen = 1 + segTok.length + 1;
        const availableWidth = Math.max(1, ctx.width - leftLen - rightLen);
        const spacer = " ".repeat(availableWidth);

        return `${left}${spacer}${right}`;
      },
      renderRow: (ctx: ComposerRowContext) => {
        const arrow = "\x1b[38;2;16;185;129m❯\x1b[39m ";
        const trimmed = ctx.gutter.trim();
        const gutter = trimmed === "╰─" || trimmed === "❯" || ctx.gutter.length === 0
          ? arrow
          : ctx.gutter;
        return [gutter + ctx.text + ctx.pad];
      },
      renderBottom: () => undefined
    }
  });
}
