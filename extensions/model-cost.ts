import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
}

interface ModelStats {
  modelName: string;
  displayName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  cost: number;
  callCount: number;
}

// ANSI Color Palette
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  border: "\x1b[38;2;86;95;137m",
  cyan: "\x1b[38;2;125;207;255m",
  green: "\x1b[38;2;115;218;138m",
  yellow: "\x1b[38;2;224;175;104m",
  purple: "\x1b[38;2;187;154;247m",
  blue: "\x1b[38;2;122;162;247m",
  pillGreen: "\x1b[48;2;25;50;40m\x1b[38;2;115;218;138m",
};

// Model pricing reference per 1,000,000 tokens (USD)
const DEFAULT_MODEL_RATES: Record<string, ModelPricing> = {
  // DeepSeek Family
  "deepseek-v4-flash": { inputPer1M: 0.22, outputPer1M: 0.66, cacheReadPer1M: 0.007 },
  "deepseek-v4-pro": { inputPer1M: 0.66, outputPer1M: 1.98, cacheReadPer1M: 0.022 },
  "deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.10, cacheReadPer1M: 0.07 },
  "deepseek-reasoner": { inputPer1M: 0.55, outputPer1M: 2.19, cacheReadPer1M: 0.14 },

  // Google Gemini Family
  "gemini-3.7-flash": { inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.0375 },
  "gemini-3.1-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.30, cacheReadPer1M: 0.01875 },
  "gemini-2.5-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.30, cacheReadPer1M: 0.01875 },
  "gemini-2.5-flash": { inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.0375 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 5.00, cacheReadPer1M: 0.3125 },

  // OpenAI / Codex Family
  "gpt-5.6-sol": { inputPer1M: 2.50, outputPer1M: 10.00, cacheReadPer1M: 1.25 },
  "gpt-5.6-luna": { inputPer1M: 5.00, outputPer1M: 20.00, cacheReadPer1M: 2.50 },
  "gpt-4o": { inputPer1M: 2.50, outputPer1M: 10.00, cacheReadPer1M: 1.25 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.075 },
  "o3-mini": { inputPer1M: 1.10, outputPer1M: 4.40, cacheReadPer1M: 0.55 },

  // Anthropic Claude Family
  "claude-sonnet-4-5": { inputPer1M: 3.00, outputPer1M: 15.00, cacheReadPer1M: 0.30 },
  "claude-opus-4-5": { inputPer1M: 15.00, outputPer1M: 75.00, cacheReadPer1M: 1.50 },
  "claude-haiku-4-5": { inputPer1M: 0.80, outputPer1M: 4.00, cacheReadPer1M: 0.08 },

  // OpenCode / Kimi / Open Source
  "kimi-k2.7-code": { inputPer1M: 0.40, outputPer1M: 1.60, cacheReadPer1M: 0.10 },
  "qwen-2.5-coder": { inputPer1M: 0.20, outputPer1M: 0.80, cacheReadPer1M: 0.05 },
};

function getModelPricing(modelName: string): ModelPricing {
  const norm = modelName.toLowerCase();
  for (const [key, pricing] of Object.entries(DEFAULT_MODEL_RATES)) {
    if (norm.includes(key)) {
      return pricing;
    }
  }
  return { inputPer1M: 0.20, outputPer1M: 0.80, cacheReadPer1M: 0.05 };
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.0000";
  if (cost < 0.0001) return "<$0.0001";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function simplifyModelName(modelName: string): string {
  const parts = modelName.split("/");
  const base = parts[parts.length - 1] || modelName;
  return base.split(":")[0].replace(/^deepseek-/, "DeepSeek-").replace(/^gemini-/, "Gemini-").replace(/^claude-/, "Claude-");
}

export default function modelCostExtension(pi: ExtensionAPI) {
  const z = pi.zod;
  pi.setLabel("Model & Cost Tracker");

  const modelUsageMap = new Map<string, ModelStats>();
  let cardEnabled = true;
  let lastRenderKey = "";

  function getOrCreateModelStats(modelName: string): ModelStats {
    let stats = modelUsageMap.get(modelName);
    if (!stats) {
      stats = {
        modelName,
        displayName: simplifyModelName(modelName),
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        cost: 0,
        callCount: 0,
      };
      modelUsageMap.set(modelName, stats);
    }
    return stats;
  }

  function recordUsage(modelName: string, usageData: unknown) {
    if (!modelName || !usageData || typeof usageData !== "object") return;

    const u = usageData as Record<string, unknown>;
    const input = typeof u.input === "number" ? u.input : typeof u.inputTokens === "number" ? u.inputTokens : 0;
    const output = typeof u.output === "number" ? u.output : typeof u.outputTokens === "number" ? u.outputTokens : 0;
    const cacheRead = typeof u.cacheRead === "number" ? u.cacheRead : typeof u.cacheReadTokens === "number" ? u.cacheReadTokens : 0;

    let computedCost = 0;
    if (u.cost && typeof u.cost === "object") {
      const c = u.cost as Record<string, unknown>;
      if (typeof c.total === "number" && c.total > 0) {
        computedCost = c.total;
      }
    }

    if (computedCost === 0 && (input > 0 || output > 0)) {
      const pricing = getModelPricing(modelName);
      computedCost =
        (input * pricing.inputPer1M) / 1_000_000 +
        (output * pricing.outputPer1M) / 1_000_000 +
        (cacheRead * pricing.cacheReadPer1M) / 1_000_000;
    }

    const stats = getOrCreateModelStats(modelName);
    stats.inputTokens += input;
    stats.outputTokens += output;
    stats.cacheReadTokens += cacheRead;
    stats.totalTokens += input + output;
    stats.cost += computedCost;
    stats.callCount += 1;
  }

  function getTotalSessionCost(): number {
    let total = 0;
    for (const stats of modelUsageMap.values()) {
      total += stats.cost;
    }
    return total;
  }

  function getTotalSessionTokens(): number {
    let total = 0;
    for (const stats of modelUsageMap.values()) {
      total += stats.totalTokens;
    }
    return total;
  }

  // Modernized list card layout showing each model row + total
  function renderListCard(currentModelName: string): string[] {
    const activeDisplay = simplifyModelName(currentModelName || "Unknown");
    const totalCost = getTotalSessionCost();
    const totalTokens = getTotalSessionTokens();

    const usedModels = Array.from(modelUsageMap.values()).filter((s) => s.totalTokens > 0);

    const lines: string[] = [];
    lines.push(`${C.border}╭─ ${C.cyan}${C.bold} Active Models & Incurred Cost${C.reset} ${C.border}───────────────────────────────────╮${C.reset}`);

    if (usedModels.length === 0) {
      lines.push(`${C.border}│${C.reset}  ${C.purple}●${C.reset} ${C.bold}${activeDisplay}${C.reset} ${C.dim}(Active)${C.reset}   ${C.blue}0 tokens${C.reset}                                 ${C.green}${C.bold}$0.0000${C.reset} ${C.border}│${C.reset}`);
      lines.push(`${C.border}╰────────────────────────────────────────────────────────────────────────╯${C.reset}`);
      return lines;
    }

    // Render each model as an itemized row
    for (const stats of usedModels) {
      const isCurrent = stats.modelName === currentModelName || stats.displayName === activeDisplay;
      const bullet = isCurrent ? `${C.green}●${C.reset}` : `${C.purple}●${C.reset}`;
      const nameCol = `${C.bold}${stats.displayName.slice(0, 18).padEnd(18)}${C.reset}`;
      const tokenCol = `${C.blue}${formatTokens(stats.totalTokens).padStart(6)} tok${C.reset} ${C.dim}(${formatTokens(stats.inputTokens)} in / ${formatTokens(stats.outputTokens)} out)${C.reset}`;
      const costCol = `${C.green}${C.bold}${formatCost(stats.cost).padStart(8)}${C.reset}`;

      lines.push(`${C.border}│${C.reset}  ${bullet} ${nameCol} ${tokenCol}   ${costCol} ${C.border}│${C.reset}`);
    }

    // Add session aggregate summary footer if multiple models or significant usage
    if (usedModels.length > 1) {
      lines.push(`${C.border}├────────────────────────────────────────────────────────────────────────┤${C.reset}`);
      lines.push(`${C.border}│${C.reset}  ${C.bold} Total Session:${C.reset} ${C.blue}${C.bold}${formatTokens(totalTokens)} tokens${C.reset}                            ${C.green}${C.bold}💵 ${formatCost(totalCost)}${C.reset} ${C.border}│${C.reset}`);
    }

    lines.push(`${C.border}╰────────────────────────────────────────────────────────────────────────╯${C.reset}`);
    return lines;
  }

  function updateUI(ctx: ExtensionContext) {
    if (!ctx.hasUI) return;

    const currentModelName = ctx.models.current()?.name || ctx.model?.name || "current-model";
    const totalCost = getTotalSessionCost();
    const totalTokens = getTotalSessionTokens();
    const modelCount = modelUsageMap.size;

    const currentKey = `${currentModelName}-${totalCost.toFixed(5)}-${totalTokens}-${modelCount}-${cardEnabled}`;

    if (currentKey !== lastRenderKey) {
      lastRenderKey = currentKey;

      if (cardEnabled) {
        ctx.ui.setWidget("model-cost-card", renderListCard(currentModelName), { placement: "aboveEditor" });
      } else {
        ctx.ui.setWidget("model-cost-card", null, { placement: "aboveEditor" });
      }
    }
  }

  // Hydrate historical session messages on startup
  pi.on("session_start", async (_event, ctx) => {
    try {
      const branch = ctx.sessionManager.getBranch();
      for (const entry of branch) {
        if (entry.type === "message" && "message" in entry && entry.message) {
          const msg = entry.message as Record<string, unknown>;
          if (msg.role === "assistant" && typeof msg.model === "string" && msg.usage) {
            recordUsage(msg.model, msg.usage);
          }
        }
      }
    } catch {
      // Ignore rehydration failures
    }

    updateUI(ctx);

    // Non-blocking 15-second background interval
    ctx.setInterval(() => {
      updateUI(ctx);
    }, 15000);
  });

  // Track live assistant message completions
  pi.on("message_end", async (event, ctx) => {
    const msg = event.message;
    if (msg.role === "assistant") {
      const modelName = msg.model || ctx.models.current()?.name || ctx.model?.name || "active-model";
      if ("usage" in msg && msg.usage) {
        recordUsage(modelName, msg.usage);
      }
      updateUI(ctx);
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    updateUI(ctx);
  });

  // Slash Command: /cost-card (Toggle list widget above editor)
  pi.registerCommand("cost-card", {
    description: "Toggle Model Token & Cost list card above editor",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      cardEnabled = !cardEnabled;
      lastRenderKey = "";
      updateUI(ctx);
      ctx.ui.notify(
        cardEnabled ? "Model & Cost list card enabled (above editor)" : "Model & Cost list card hidden",
        "info"
      );
    },
  });

  // Slash Command: /cost (or /models-cost)
  const costReportHandler = async (_args: string, ctx: ExtensionCommandContext) => {
    const activeModel = ctx.models.current()?.name || ctx.model?.name || "Unknown";
    const totalCost = getTotalSessionCost();
    const totalTokens = getTotalSessionTokens();

    let report = `###  Model Token Usage & Incurred Cost Breakdown\n\n`;
    report += `| Summary Metric | Value |\n`;
    report += `| :--- | :--- |\n`;
    report += `| **Active Session Model** | \`${activeModel}\` |\n`;
    report += `| **Total Incurred Cost** | **\`${formatCost(totalCost)}\`** |\n`;
    report += `| **Total Billed Tokens** | \`${totalTokens.toLocaleString()} tokens\` |\n\n`;

    const usedModels = Array.from(modelUsageMap.values());
    if (usedModels.length === 0) {
      report += `_No assistant token usage recorded yet in this session._\n`;
    } else {
      report += `#### 📊 Itemized Model Consumption Table:\n`;
      report += `| Model | Calls | Input Tokens | Output Tokens | Cache Read Tokens | Incurred Cost |\n`;
      report += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      for (const stats of usedModels) {
        report += `| **${stats.displayName}** (\`${stats.modelName}\`) | \`${stats.callCount}\` | \`${stats.inputTokens.toLocaleString()}\` | \`${stats.outputTokens.toLocaleString()}\` | \`${stats.cacheReadTokens.toLocaleString()}\` | **\`${formatCost(stats.cost)}\`** |\n`;
      }
    }

    pi.sendMessage(
      {
        customType: "model-cost-report",
        content: report,
        display: true,
        attribution: "user",
      },
      { triggerTurn: false }
    );
  };

  pi.registerCommand("cost", {
    description: "Show itemized token usage and cost breakdown for all models used in session",
    handler: costReportHandler,
  });

  pi.registerCommand("models-cost", {
    description: "Alias for /cost",
    handler: costReportHandler,
  });

  // Slash Command: /cost-reset
  pi.registerCommand("cost-reset", {
    description: "Reset session model token usage and cost statistics",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      modelUsageMap.clear();
      lastRenderKey = "";
      updateUI(ctx);
      ctx.ui.notify("Session model cost and token statistics reset", "info");
    },
  });

  // Model-callable tool for agents/subagents to check token expenditure
  pi.registerTool({
    name: "session_cost_breakdown",
    label: "Session Cost Breakdown",
    description: "Get dynamic token counts and cost incurred for each model invoked during the current session.",
    parameters: z.object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const activeModel = ctx.models.current()?.name || ctx.model?.name || "Unknown";
      const totalCost = getTotalSessionCost();
      const totalTokens = getTotalSessionTokens();
      const models = Array.from(modelUsageMap.values());

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                activeModel,
                totalCost: formatCost(totalCost),
                totalCostUSD: totalCost,
                totalTokens,
                modelsBreakdown: models,
              },
              null,
              2
            ),
          },
        ],
        details: { activeModel, totalCost, totalTokens, models },
      };
    },
  });
}
