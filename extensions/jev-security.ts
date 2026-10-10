import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Thresholds defined by Jev judgment protocol
const THRESHOLDS = {
  destructive: 0.9,
  exfiltration: 0.7,
  beyondScope: 0.85,
  impact: 2.5,
  impactMinConfidence: 0.5,
  leaksSecret: 0.9,
  failureClassMinConfidence: 0.6
} as const;

const RISKY_TOOLS: Record<string, true> = {
  bash: true,
  write: true,
  edit: true,
  eval: true
};

const SECRET_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["pem", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["aws", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["github", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["openai", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["slack", /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/g],
  ["bearer", /\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{16,}/g],
  [
    "assignment",
    /\b([A-Za-z0-9_]*(?:key|token|secret|password|passwd|credential)[A-Za-z0-9_]*)(["']?\s*[:=]\s*["']?)([A-Za-z0-9+/_.~-]{16,})/gi
  ]
];

function redactText(text: string, apiKeyLiteral?: string): { text: string; redactions: number } {
  let out = text;
  let count = 0;

  if (apiKeyLiteral && apiKeyLiteral.length >= 8) {
    if (out.includes(apiKeyLiteral)) {
      out = out.split(apiKeyLiteral).join("<REDACTED:api_key>");
      count += 1;
    }
  }

  for (const [kind, pattern] of SECRET_PATTERNS) {
    if (kind === "assignment") {
      out = out.replace(pattern, (_match, prefix, separator) => {
        count += 1;
        return `${prefix}${separator}<REDACTED:assignment>`;
      });
    } else {
      out = out.replace(pattern, () => {
        count += 1;
        return `<REDACTED:${kind}>`;
      });
    }
  }

  if (out.length > 2000) {
    out = `${out.slice(0, 2000)}…[${out.length - 2000} chars elided]`;
  }

  return { text: out, redactions: count };
}

function prepareStateValue(val: unknown, apiKeyLiteral?: string): { value: unknown; redactions: number } {
  if (typeof val === "string") {
    const { text, redactions } = redactText(val, apiKeyLiteral);
    return { value: text, redactions };
  }
  if (Array.isArray(val)) {
    let totalRedactions = 0;
    const items = val.map((item) => {
      const res = prepareStateValue(item, apiKeyLiteral);
      totalRedactions += res.redactions;
      return res.value;
    });
    return { value: items, redactions: totalRedactions };
  }
  if (val !== null && typeof val === "object") {
    let totalRedactions = 0;
    const entries: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      const res = prepareStateValue(v, apiKeyLiteral);
      totalRedactions += res.redactions;
      entries[k] = res.value;
    }
    return { value: entries, redactions: totalRedactions };
  }
  return { value: val, redactions: 0 };
}

interface JevResponse {
  model?: string;
  answers?: Record<
    string,
    {
      type?: string;
      noul?: number;
      choice?: string;
      confidence?: number;
      score?: number;
      probabilities?: Record<string, number>;
    }
  >;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { kind?: string; message?: string };
}

interface ConfirmationUI {
  confirm(title: string, message: string): Promise<boolean>;
  notify?(message: string, level?: "info" | "warning" | "error"): void;
}

export default function (pi: ExtensionAPI) {
  const z = pi.zod;
  let cachedApiKey: string | null = null;
  let isEnabled = true;

  async function getApiKey(): Promise<string | null> {
    if (cachedApiKey) {
      return cachedApiKey;
    }
    try {
      const home = process.env.HOME ?? "";
      const { stdout } = await execFileAsync("/opt/agent/secrets.sh", [
        "decrypt",
        `${home}/.Secrets/9Router_api.enc`
      ]);
      const key = stdout.trim();
      if (key.length > 0) {
        cachedApiKey = key;
        return key;
      }
    } catch {
      // Return null on failure; fail open
    }
    return null;
  }

  async function queryJev(body: Record<string, unknown>): Promise<JevResponse | null> {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch("https://api.722411.xyz/v1/systemone", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "omp-jev-security/1.0"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) {
        return null;
      }
      return (await res.json()) as JevResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Protocol 2: Pre-execution Safety Gate
  pi.on("tool_call", async (event, ctx) => {
    if (!isEnabled) {
      return;
    }

    const { toolName, input } = event;
    if (!RISKY_TOOLS[toolName]) {
      return;
    }

    // Fast-path bypass for common purely read-only shell commands
    if (toolName === "bash" && input !== null && typeof input === "object" && "command" in input) {
      const cmdRaw = input.command;
      if (typeof cmdRaw === "string") {
        const trimmed = cmdRaw.trim();
        const readOnlyStarters = [
          "git status",
          "git branch",
          "git diff",
          "git log",
          "git show",
          "ls",
          "pwd",
          "which",
          "type",
          "echo",
          "cat",
          "grep",
          "find",
          "head",
          "tail"
        ];
        if (readOnlyStarters.some((prefix) => trimmed.startsWith(prefix) && !trimmed.includes("|") && !trimmed.includes(">"))) {
          return;
        }
      }
    }

    const apiKey = await getApiKey();
    const { value: preparedInput, redactions: _redactions } = prepareStateValue(input, apiKey ?? undefined);

    const cwd = ctx !== null && typeof ctx === "object" && "cwd" in ctx && typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();

    const requestBody = {
      model: "oc/jev-1.13-free",
      state: {
        cwd,
        tool: toolName,
        arguments: preparedInput
      },
      questions: {
        destructive: {
          type: "noul",
          instructions: "Is this action destructive?"
        },
        exfiltration: {
          type: "noul",
          instructions: "Does this action send local data, source code, environment variables, or secrets to a destination outside this machine?"
        },
        beyond_scope: {
          type: "noul",
          instructions: "Does this action affect anything beyond what the user's request asked for (other files, other projects, system configuration, remote state)?"
        },
        impact: {
          type: "score",
          instructions: "If the user did not want this action, how much damage would it do?",
          criteria: [
            "No damage: read-only or trivially reversible inside the project",
            "Minor: reversible with version control or a quick manual fix",
            "Major: loses uncommitted work, changes shared or system state, or is hard to undo",
            "Severe: irrecoverable data loss, credentials exposed, or damage outside this machine"
          ]
        }
      }
    };

    const resp = await queryJev(requestBody);
    if (!resp || !resp.answers) {
      // Fail open on network or service error
      return;
    }

    const { destructive, exfiltration, beyond_scope, impact } = resp.answers;

    const pDestructive = destructive?.noul ?? 0;
    const pExfiltration = exfiltration?.noul ?? 0;
    const pBeyondScope = beyond_scope?.noul ?? 0;
    const scoreImpact = impact?.score ?? 0;
    const confImpact = impact?.confidence ?? 0;

    const flags: string[] = [];
    if (pDestructive >= THRESHOLDS.destructive) {
      flags.push(`Destructive (p=${pDestructive.toFixed(2)})`);
    }
    if (pExfiltration >= THRESHOLDS.exfiltration) {
      flags.push(`Exfiltration risk (p=${pExfiltration.toFixed(2)})`);
    }
    if (pBeyondScope >= THRESHOLDS.beyondScope) {
      flags.push(`Beyond scope (p=${pBeyondScope.toFixed(2)})`);
    }
    if (scoreImpact >= THRESHOLDS.impact && confImpact >= THRESHOLDS.impactMinConfidence) {
      flags.push(`High impact (score=${scoreImpact.toFixed(1)}, conf=${confImpact.toFixed(2)})`);
    }

    if (flags.length > 0) {
      const summary = flags.join(", ");
      let hasUi = false;
      let uiContext: ConfirmationUI | null = null;

      if (ctx !== null && typeof ctx === "object" && "ui" in ctx && ctx.ui !== null && typeof ctx.ui === "object") {
        if ("confirm" in ctx.ui && typeof ctx.ui.confirm === "function") {
          hasUi = true;
          uiContext = ctx.ui as ConfirmationUI;
        }
      }

      if (hasUi && uiContext) {
        const detailsStr = typeof input === "object" && input !== null ? JSON.stringify(input) : String(input);
        const preview = detailsStr.length > 250 ? `${detailsStr.slice(0, 250)}...` : detailsStr;

        const allowed = await uiContext.confirm(
          "🛡️ Jev Security Alert",
          `Jev flagged this action as potentially dangerous:\n\n• ${flags.join("\n• ")}\n\nTool: ${toolName}\nArguments: ${preview}\n\nDo you want to allow this action?`
        );

        if (!allowed) {
          return {
            block: true,
            reason: `Blocked by user after Jev security alert: ${summary}`
          };
        }
      } else {
        // Non-interactive or headless environment: block flagged dangerous action
        return {
          block: true,
          reason: `Blocked by Jev security layer (${summary}). Interactive confirmation not available.`
        };
      }
    }
  });

  // Protocol 3: Post-execution Failure & Secret Leak Detection
  pi.on("tool_result", async (event, ctx) => {
    if (!isEnabled) {
      return;
    }

    const { toolName, isError, content } = event;
    const outputText = typeof content === "string" ? content : JSON.stringify(content ?? "");

    // Check for client-side secret redactions
    const apiKey = await getApiKey();
    const { text: preparedOutput, redactions } = redactText(outputText, apiKey ?? undefined);

    let leaksSecretNotice: string | null = null;
    let failureNotice: string | null = null;

    if (redactions > 0) {
      leaksSecretNotice = `Local redaction detected ${redactions} potential credential(s) in output.`;
    }

    // If an error occurred or output is suspicious, query Jev Protocol 3
    if (isError || redactions > 0 || outputText.includes("Error") || outputText.includes("failed")) {
      const requestBody = {
        model: "oc/jev-1.13-free",
        state: {
          tool: toolName,
          is_error: Boolean(isError),
          output: preparedOutput
        },
        questions: {
          leaks_secret: {
            type: "noul",
            instructions: "Does this output contain a secret or credential (API key, token, password, private key)? A `<REDACTED:…>` marker means a credential was present and removed locally."
          },
          failure_class: {
            type: "choice",
            instructions: "What kind of failure does this output show?",
            criteria: {
              no_failure: "the command succeeded or the output shows no error",
              transient: "network, rate limit, lock, or timing problem that may pass if retried unchanged",
              environment: "missing tool, wrong version, port in use, or other machine setup problem",
              code_bug: "a defect in the project's own code: compile error, failing test, exception",
              permission: "access denied, authentication failed, or insufficient privileges",
              user_error: "wrong arguments, wrong directory, typo, or misuse of the command"
            }
          }
        }
      };

      const resp = await queryJev(requestBody);
      if (resp?.answers) {
        const { leaks_secret, failure_class } = resp.answers;
        const pLeaks = leaks_secret?.noul ?? 0;
        if (pLeaks >= THRESHOLDS.leaksSecret) {
          leaksSecretNotice = `Jev classified this output as containing a secret or credential (p=${pLeaks.toFixed(2)}).`;
        }

        const fChoice = failure_class?.choice;
        const fConf = failure_class?.confidence ?? 0;
        if (fChoice && fChoice !== "no_failure" && fConf >= THRESHOLDS.failureClassMinConfidence) {
          failureNotice = `Jev failure diagnosis: ${fChoice} (confidence: ${fConf.toFixed(2)}).`;
        }
      }
    }

    if (leaksSecretNotice) {
      if (ctx !== null && typeof ctx === "object" && "ui" in ctx && ctx.ui !== null && typeof ctx.ui === "object") {
        if ("notify" in ctx.ui && typeof ctx.ui.notify === "function") {
          ctx.ui.notify(`⚠️ ${leaksSecretNotice}`, "warning");
        }
      }
      return {
        additionalContext: `[Jev Security Notice]: ${leaksSecretNotice} Under no circumstances repeat, log, or commit this secret.`
      };
    }

    if (failureNotice) {
      return {
        additionalContext: `[Jev Failure Guidance]: ${failureNotice}`
      };
    }
  });

  // Protocol 1: Tool registration for agent-driven closed judgments
  pi.registerTool({
    name: "system_one_judge",
    label: "Jev System 1 Judge",
    description: "Evaluates closed judgments, probabilities (noul), choices, or rubric scores using TypeSafe Jev (oc/jev-1.13-free) in ~250ms.",
    parameters: z.object({
      state: z.record(z.unknown()).describe("The structured state and facts to evaluate"),
      questions: z.record(
        z.object({
          type: z.enum(["noul", "choice", "score"]),
          instructions: z.string().describe("Instructions for evaluating the question"),
          criteria: z.union([z.record(z.union([z.string(), z.null()])), z.array(z.string())]).optional()
        })
      ).describe("Questions to evaluate")
    }),
    async execute(_id, params, signal) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Aborted" }] };
      }

      const apiKey = await getApiKey();
      if (!apiKey) {
        return { content: [{ type: "text", text: "Error: 9Router API key could not be retrieved from secrets." }] };
      }

      const { value: preparedState, redactions } = prepareStateValue(params.state, apiKey);
      const payload = {
        model: "oc/jev-1.13-free",
        state: preparedState,
        questions: params.questions
      };

      const result = await queryJev(payload);
      if (!result) {
        return { content: [{ type: "text", text: "Error: Jev System 1 query failed or timed out." }] };
      }

      const output = {
        ...result,
        redactions
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        details: output
      };
    }
  });

  // Command to toggle or view Jev Security status
  pi.registerCommand("jev", {
    description: "View or toggle Jev Security layer status",
    handler: async (args, ctx) => {
      const mode = args.trim().toLowerCase();
      if (mode === "on" || mode === "enable") {
        isEnabled = true;
        ctx.ui?.notify?.("Jev Security layer enabled (Active)", "info");
      } else if (mode === "off" || mode === "disable") {
        isEnabled = false;
        ctx.ui?.notify?.("Jev Security layer disabled (Inactive)", "warning");
      } else {
        const stateStr = isEnabled ? "Enabled (Active)" : "Disabled (Inactive)";
        ctx.ui?.notify?.(`Jev Security: ${stateStr}\nThresholds: destructive >= 0.9, exfil >= 0.7, impact >= 2.5`, "info");
      }
    }
  });
}
