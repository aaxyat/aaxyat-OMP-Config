import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

interface DeepSeekSchedule {
  isPeak: boolean;
  stateLabel: string;
  shortLabel: string;
  nextState: string;
  nextShortLabel: string;
  nextChangeSeconds: number;
  countdown: string;
  nextChangeDate: Date;
  utcTimeStr: string;
  beijingTimeStr: string;
  localTimeStr: string;
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  if (m > 0) {
    return `${m}m`;
  }
  return "< 1m";
}

function calculateDeepSeekSchedule(now: Date = new Date()): DeepSeekSchedule {
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const currentSeconds = utcHours * 3600 + utcMinutes * 60 + utcSeconds;

  // DeepSeek Peak Windows (UTC):
  // 1) 01:00 - 04:00 UTC (3600s - 14400s) -> 09:00 - 12:00 Beijing (CST)
  // 2) 06:00 - 10:00 UTC (21600s - 36000s) -> 14:00 - 18:00 Beijing (CST)
  const PEAK_1_START = 1 * 3600;
  const PEAK_1_END = 4 * 3600;
  const PEAK_2_START = 6 * 3600;
  const PEAK_2_END = 10 * 3600;
  const DAY_SECONDS = 86400;

  let isPeak = false;
  let nextChangeSeconds = 0;
  let nextState = "";
  let nextShortLabel = "";

  if (currentSeconds < PEAK_1_START) {
    // 00:00 - 01:00 UTC -> Off-Peak
    isPeak = false;
    nextChangeSeconds = PEAK_1_START - currentSeconds;
    nextState = "Peak (2x rate)";
    nextShortLabel = "Peak";
  } else if (currentSeconds < PEAK_1_END) {
    // 01:00 - 04:00 UTC -> Peak 1
    isPeak = true;
    nextChangeSeconds = PEAK_1_END - currentSeconds;
    nextState = "Off-Peak (50% off)";
    nextShortLabel = "Off-Peak";
  } else if (currentSeconds < PEAK_2_START) {
    // 04:00 - 06:00 UTC -> Off-Peak
    isPeak = false;
    nextChangeSeconds = PEAK_2_START - currentSeconds;
    nextState = "Peak (2x rate)";
    nextShortLabel = "Peak";
  } else if (currentSeconds < PEAK_2_END) {
    // 06:00 - 10:00 UTC -> Peak 2
    isPeak = true;
    nextChangeSeconds = PEAK_2_END - currentSeconds;
    nextState = "Off-Peak (50% off)";
    nextShortLabel = "Off-Peak";
  } else {
    // 10:00 - 24:00 UTC -> Off-Peak
    isPeak = false;
    nextChangeSeconds = DAY_SECONDS - currentSeconds + PEAK_1_START;
    nextState = "Peak (2x rate)";
    nextShortLabel = "Peak";
  }

  const countdown = formatCountdown(nextChangeSeconds);
  const nextChangeDate = new Date(now.getTime() + nextChangeSeconds * 1000);

  // Time formatters (hh:mm without seconds)
  const timeFormatter = (timeZone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).format(nextChangeDate);

  return {
    isPeak,
    stateLabel: isPeak ? "☀️ Peak (2x rate)" : "🌙 Off-Peak (50% off)",
    shortLabel: isPeak ? "Peak" : "Off-Peak",
    nextState,
    nextShortLabel,
    nextChangeSeconds,
    countdown,
    nextChangeDate,
    utcTimeStr: `${timeFormatter("UTC")} UTC`,
    beijingTimeStr: `${timeFormatter("Asia/Shanghai")} CST`,
    localTimeStr: `${timeFormatter(Intl.DateTimeFormat().resolvedOptions().timeZone)} Local`,
  };
}

export default function deepseekHoursExtension(pi: ExtensionAPI) {
  const z = pi.zod;
  pi.setLabel("DeepSeek Peak Tracker");

  let cardEnabled = true;
  let lastRenderedKey = "";
  let lastKnownPeakState: boolean | null = null;

  function renderStatusWidget(): string {
    const info = calculateDeepSeekSchedule();
    const icon = info.isPeak ? "☀️" : "🌙";
    const nextIcon = info.isPeak ? "🌙" : "☀️";
    return `${icon} DS: ${info.shortLabel} ➔ ${nextIcon} ${info.nextShortLabel} in ${info.countdown}`;
  }

  function renderTopCard(): string[] {
    const info = calculateDeepSeekSchedule();
    const currentIcon = info.isPeak ? "☀️" : "🌙";
    const targetIcon = info.isPeak ? "🌙" : "☀️";
    const rateBadge = info.isPeak ? "2x Surge" : "50% Off";

    return [
      `╭─ 🐳 DeepSeek Schedule ───────────────────────────────────────────────╮`,
      `│  Status: ${currentIcon} ${info.shortLabel.padEnd(8)} (${rateBadge})   │  Next: ${targetIcon} ${info.nextShortLabel} in ${info.countdown.padEnd(8)} │`,
      `│  Switch: ${info.utcTimeStr.padEnd(10)} (${info.beijingTimeStr} / ${info.localTimeStr})`.padEnd(71) + `│`,
      `╰──────────────────────────────────────────────────────────────────────╯`,
    ];
  }

  function updateUI(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;

    const info = calculateDeepSeekSchedule();
    const currentKey = `${info.isPeak}-${info.countdown}-${info.utcTimeStr}-${cardEnabled}`;
    if (currentKey !== lastRenderedKey) {
      lastRenderedKey = currentKey;
      ctx.ui.setStatus("deepseek-hours", renderStatusWidget());

      if (cardEnabled) {
        ctx.ui.setWidget("deepseek-card", renderTopCard(), { placement: "aboveEditor" });
      } else {
        ctx.ui.setWidget("deepseek-card", null, { placement: "aboveEditor" });
      }
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    updateUI(ctx);

    // Non-blocking 15-second background interval (no seconds ticking)
    ctx.setInterval(() => {
      const info = calculateDeepSeekSchedule();

      // Notify on state transition
      if (lastKnownPeakState !== null && lastKnownPeakState !== info.isPeak) {
        const msg = info.isPeak
          ? "⚠️ DeepSeek entered PEAK hours (2x pricing active)"
          : "🎉 DeepSeek entered OFF-PEAK hours (50% discount active)";
        ctx.ui.notify(msg, info.isPeak ? "warning" : "info");
      }
      lastKnownPeakState = info.isPeak;

      updateUI(ctx);
    }, 15000);
  });

  // Slash Command: /deepseek-card (Toggle top card widget on/off)
  pi.registerCommand("deepseek-card", {
    description: "Toggle DeepSeek schedule card above editor",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      cardEnabled = !cardEnabled;
      lastRenderedKey = "";
      updateUI(ctx);
      ctx.ui.notify(
        cardEnabled ? "DeepSeek card widget enabled (above editor)" : "DeepSeek card widget hidden",
        "info"
      );
    },
  });

  // Slash Command: /deepseek-hours (or /deepseek)
  const commandHandler = async (_args: string, _ctx: ExtensionCommandContext) => {
    const info = calculateDeepSeekSchedule();
    const currentUtc = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const currentBeijing = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());

    let report = `### 🐳 DeepSeek API Peak & Off-Peak Tracker\n\n`;
    report += `**Current Status:** \`${info.stateLabel}\`\n`;
    report += `**Current Time:** \`${currentUtc} UTC\` | \`${currentBeijing} Beijing (CST)\`\n\n`;

    report += `#### ⏱️ Next Window Transition:\n`;
    report += `- **Switching to:** \`${info.nextState}\`\n`;
    report += `- **Time Remaining:** \`${info.countdown}\`\n`;
    report += `- **Transition At:**\n`;
    report += `  - **Local:** \`${info.localTimeStr}\`\n`;
    report += `  - **UTC:** \`${info.utcTimeStr}\`\n`;
    report += `  - **Beijing (CST):** \`${info.beijingTimeStr}\`\n\n`;

    report += `#### 📅 Daily DeepSeek Window Schedule (UTC):\n`;
    report += `| Period | UTC Window | Beijing Time (CST) | Rate Multiplier |\n`;
    report += `| :--- | :--- | :--- | :--- |\n`;
    report += `| 🌙 **Off-Peak** | \`00:00 – 01:00 UTC\` | \`08:00 – 09:00 CST\` | **Standard / 50% Off** |\n`;
    report += `| ☀️ **Peak #1** | \`01:00 – 04:00 UTC\` | \`09:00 – 12:00 CST\` | **2x Surge Rate** |\n`;
    report += `| 🌙 **Off-Peak** | \`04:00 – 06:00 UTC\` | \`12:00 – 14:00 CST\` | **Standard / 50% Off** |\n`;
    report += `| ☀️ **Peak #2** | \`06:00 – 10:00 UTC\` | \`14:00 – 18:00 CST\` | **2x Surge Rate** |\n`;
    report += `| 🌙 **Off-Peak** | \`10:00 – 24:00 UTC\` | \`18:00 – 08:00 CST\` | **Standard / 50% Off** |\n\n`;

    report += `#### 💰 Current Pricing Reference (per 1M Tokens):\n`;
    report += `| Model | Period | Input (Cache Hit) | Input (Cache Miss) | Output |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- |\n`;
    report += `| **DeepSeek-V4-Flash** | **Off-Peak** | \`$0.007\` | \`$0.22\` | \`$0.66\` |\n`;
    report += `| | **Peak** | \`$0.014\` | \`$0.44\` | \`$1.32\` |\n`;
    report += `| **DeepSeek-V4-Pro** | **Off-Peak** | \`$0.022\` | \`$0.66\` | \`$1.98\` |\n`;
    report += `| | **Peak** | \`$0.044\` | \`$1.32\` | \`$3.96\` |\n`;

    pi.sendMessage(
      {
        customType: "deepseek-hours-report",
        content: report,
        display: true,
        attribution: "user",
      },
      { triggerTurn: false }
    );
  };

  pi.registerCommand("deepseek-hours", {
    description: "Show DeepSeek API peak and off-peak hours",
    handler: commandHandler,
  });

  pi.registerCommand("deepseek", {
    description: "Alias for /deepseek-hours",
    handler: commandHandler,
  });

  // Model-callable tool for automated decision making
  pi.registerTool({
    name: "deepseek_pricing_status",
    label: "DeepSeek Pricing Status",
    description: "Check whether DeepSeek is currently in Peak (2x rate) or Off-Peak (50% discount) hours and get the time remaining until the next pricing transition.",
    parameters: z.object({}),
    async execute() {
      const info = calculateDeepSeekSchedule();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                isPeak: info.isPeak,
                status: info.stateLabel,
                nextState: info.nextState,
                timeRemaining: info.countdown,
                secondsRemaining: info.nextChangeSeconds,
                nextChangeUTC: info.utcTimeStr,
                nextChangeBeijing: info.beijingTimeStr,
                nextChangeLocal: info.localTimeStr,
              },
              null,
              2
            ),
          },
        ],
        details: info,
      };
    },
  });
}
