import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

interface TurnMetrics {
  startTime: number;
  firstTokenTime: number | null;
  endTime: number | null;
  charCount: number;
  lastTickTime: number;
  lastTickCharCount: number;
  instantTps: number;
  outputTokens: number;
  inputTokens: number;
  durationMs: number;
  tps: number;
  ttftMs: number | null;
}

interface SessionStats {
  totalOutputTokens: number;
  totalInputTokens: number;
  totalDurationMs: number;
  peakTps: number;
  turnCount: number;
}

export default function tpsExtension(pi: ExtensionAPI) {
  pi.setLabel("Token Speed (TPS)");

  const stats: SessionStats = {
    totalOutputTokens: 0,
    totalInputTokens: 0,
    totalDurationMs: 0,
    peakTps: 0,
    turnCount: 0,
  };

  let currentTurn: TurnMetrics | null = null;
  let lastCompletedTurn: TurnMetrics | null = null;
  let isGenerating = false;

  function renderStatusText(): string {
    if (isGenerating && currentTurn) {
      const now = performance.now();
      const elapsedTotalMs = now - (currentTurn.firstTokenTime || currentTurn.startTime);
      const totalEstimatedTokens = Math.max(1, Math.round(currentTurn.charCount / 3.85));

      if (elapsedTotalMs > 150) {
        const liveTps = totalEstimatedTokens / (elapsedTotalMs / 1000);
        const displayTps = liveTps >= 100 ? Math.round(liveTps).toString() : liveTps.toFixed(1);
        return `󱐋 ${displayTps} tok/s`;
      }
      return "󱐋 ... tok/s";
    }

    if (lastCompletedTurn) {
      const displayTps =
        lastCompletedTurn.tps >= 100
          ? Math.round(lastCompletedTurn.tps).toString()
          : lastCompletedTurn.tps.toFixed(1);
      return `󱐋 ${displayTps} tok/s`;
    }

    return "󱐋 0.0 tok/s";
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("tps", renderStatusText());

    // 1-second background refresh timer
    ctx.setInterval(() => {
      if (currentTurn && isGenerating) {
        const now = performance.now();
        const deltaMs = now - currentTurn.lastTickTime;
        const deltaChars = currentTurn.charCount - currentTurn.lastTickCharCount;

        if (deltaMs >= 500) {
          const deltaTokens = Math.max(0, Math.round(deltaChars / 3.85));
          currentTurn.instantTps = deltaTokens / (deltaMs / 1000);
          currentTurn.lastTickTime = now;
          currentTurn.lastTickCharCount = currentTurn.charCount;
        }
      }

      if (ctx.hasUI) {
        ctx.ui.setStatus("tps", renderStatusText());
      }
    }, 1000);
  });

  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "assistant") return;

    const now = performance.now();
    isGenerating = true;
    currentTurn = {
      startTime: now,
      firstTokenTime: null,
      endTime: null,
      charCount: 0,
      lastTickTime: now,
      lastTickCharCount: 0,
      instantTps: 0,
      outputTokens: 0,
      inputTokens: 0,
      durationMs: 0,
      tps: 0,
      ttftMs: null,
    };

    if (ctx.hasUI) {
      ctx.ui.setStatus("tps", renderStatusText());
    }
  });

  pi.on("message_update", async (event, ctx) => {
    if (!currentTurn) return;

    const now = performance.now();
    const assistantEvent = event.assistantMessageEvent;

    let deltaLen = 0;
    if (assistantEvent.type === "text_delta" && typeof assistantEvent.delta === "string") {
      deltaLen = assistantEvent.delta.length;
    } else if (assistantEvent.type === "thinking_delta" && typeof assistantEvent.delta === "string") {
      deltaLen = assistantEvent.delta.length;
    } else if (assistantEvent.type === "toolcall_delta" && typeof assistantEvent.delta === "string") {
      deltaLen = assistantEvent.delta.length;
    }

    if (deltaLen > 0) {
      if (!currentTurn.firstTokenTime) {
        currentTurn.firstTokenTime = now;
        currentTurn.ttftMs = now - currentTurn.startTime;
        currentTurn.lastTickTime = now;
      }
      currentTurn.charCount += deltaLen;
    }

    if (ctx.hasUI) {
      ctx.ui.setStatus("tps", renderStatusText());
    }
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role !== "assistant" || !currentTurn) return;

    const now = performance.now();
    isGenerating = false;
    currentTurn.endTime = now;

    const durationMs = currentTurn.firstTokenTime
      ? now - currentTurn.firstTokenTime
      : now - currentTurn.startTime;
    currentTurn.durationMs = Math.max(durationMs, 50);

    const msg = event.message;
    if ("usage" in msg && msg.usage && typeof msg.usage === "object") {
      const usage = msg.usage;
      const outTokens = "outputTokens" in usage && typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
      const inTokens = "inputTokens" in usage && typeof usage.inputTokens === "number" ? usage.inputTokens : 0;

      if (outTokens > 0) {
        currentTurn.outputTokens = outTokens;
        currentTurn.inputTokens = inTokens;
      } else {
        currentTurn.outputTokens = Math.max(1, Math.round(currentTurn.charCount / 3.85));
      }
    } else {
      currentTurn.outputTokens = Math.max(1, Math.round(currentTurn.charCount / 3.85));
    }

    currentTurn.tps = currentTurn.outputTokens / (currentTurn.durationMs / 1000);

    stats.totalOutputTokens += currentTurn.outputTokens;
    stats.totalInputTokens += currentTurn.inputTokens;
    stats.totalDurationMs += currentTurn.durationMs;
    stats.turnCount += 1;
    if (currentTurn.tps > stats.peakTps) {
      stats.peakTps = currentTurn.tps;
    }

    lastCompletedTurn = { ...currentTurn };
    currentTurn = null;

    if (ctx.hasUI) {
      ctx.ui.setStatus("tps", renderStatusText());
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    isGenerating = false;
    if (ctx.hasUI) {
      ctx.ui.setStatus("tps", renderStatusText());
    }
  });

  // Slash command: /tps
  pi.registerCommand("tps", {
    description: "Display token generation speed and session statistics",
    handler: async (_args, ctx) => {
      const avgTps =
        stats.totalDurationMs > 0
          ? stats.totalOutputTokens / (stats.totalDurationMs / 1000)
          : 0;

      const modelName = ctx.models.current()?.name || ctx.model?.name || "Current Model";
      const formattedAvg = avgTps >= 100 ? Math.round(avgTps).toString() : avgTps.toFixed(1);
      const formattedPeak = stats.peakTps >= 100 ? Math.round(stats.peakTps).toString() : stats.peakTps.toFixed(1);
      const totalDurSec = (stats.totalDurationMs / 1000).toFixed(2) + "s";

      let report = `### ⚡ Token Generation Speed (TPS)\n\n`;
      report += `**Model:** \`${modelName}\`\n\n`;

      if (lastCompletedTurn) {
        const lastTps =
          lastCompletedTurn.tps >= 100
            ? Math.round(lastCompletedTurn.tps).toString()
            : lastCompletedTurn.tps.toFixed(1);
        const lastDurSec = (lastCompletedTurn.durationMs / 1000).toFixed(2) + "s";
        report += `#### ⏱️ Last Response:\n`;
        report += `- **Speed:** \`${lastTps} tok/s\`\n`;
        report += `- **Output:** \`${lastCompletedTurn.outputTokens} tokens\`\n`;
        if (lastCompletedTurn.inputTokens > 0) {
          report += `- **Input:** \`${lastCompletedTurn.inputTokens} tokens\`\n`;
        }
        report += `- **Generation Time:** \`${lastDurSec}\`\n`;
        if (lastCompletedTurn.ttftMs !== null) {
          report += `- **Time to First Token (TTFT):** \`${Math.round(lastCompletedTurn.ttftMs)}ms\`\n`;
        }
        report += `\n`;
      } else {
        report += `_No assistant response recorded yet in this session._\n\n`;
      }

      report += `#### 📊 Session Totals:\n`;
      report += `- **Total Output:** \`${stats.totalOutputTokens.toLocaleString()} tokens\`\n`;
      if (stats.totalInputTokens > 0) {
        report += `- **Total Input:** \`${stats.totalInputTokens.toLocaleString()} tokens\`\n`;
      }
      report += `- **Average Speed:** \`${formattedAvg} tok/s\`\n`;
      report += `- **Peak Speed:** \`${formattedPeak} tok/s\`\n`;
      report += `- **Total Generation Time:** \`${totalDurSec}\`\n`;
      report += `- **Completed Responses:** \`${stats.turnCount}\`\n`;

      pi.sendMessage(
        {
          customType: "tps-report",
          content: report,
          display: true,
          attribution: "user",
        },
        { triggerTurn: false }
      );
    },
  });

  // Slash command: /tps-reset
  pi.registerCommand("tps-reset", {
    description: "Reset token speed session statistics",
    handler: async (_args, ctx) => {
      stats.totalOutputTokens = 0;
      stats.totalInputTokens = 0;
      stats.totalDurationMs = 0;
      stats.peakTps = 0;
      stats.turnCount = 0;
      lastCompletedTurn = null;
      isGenerating = false;
      ctx.ui.setStatus("tps", "󱐋 0.0 tok/s");
      ctx.ui.notify("Token speed session statistics reset", "info");
    },
  });
}
