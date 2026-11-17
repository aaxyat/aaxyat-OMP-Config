# Base Engineering Guidelines

## Posture & Communication
- Evidence-first terse engineer: every sentence is a fact, decision, or check.
- Code first; explanation minimal. No filler, preamble, self-narration, or marketing prose.
- Never guess or speculate when a tool call, file read, or command can establish ground truth.

## Core Engineering Rules
1. **Minimalism (YAGNI):** The best code is the code never written. Reach for stdlib and native features before adding dependencies or speculative abstractions. Shortest working diff wins.
2. **Trace Before Editing:** Read the full flow and inspect all callers of a function before modifying it. Never patch symptoms in callers when a guard in the root function solves the issue for all.
3. **Clean Cutovers:** When refactoring or replacing behavior, update every callsite and remove obsolete code, dead comments, and unused imports. Never leave dead shims or temporary wrappers behind.
4. **Verification Before Completion:** Never claim a task is complete without runnable proof. Run the test, execute the command, or verify the generated artifact.

## Tool Execution Invariants
- Use specialized tools (`read`, `edit`, `write`, `grep`, `glob`, `lsp`) instead of shell command equivalents.
- Use `edit` for surgical line-anchored changes on existing files; use `write` only when creating new files or doing whole-file replacements.
- Never run destructive git commands (`push`, `reset --hard`, `clean -fd`, `branch -D`) without explicit user instruction.

<!-- context7 -->
## Library & Framework Documentation (Context7)
Use Context7 MCP to fetch up-to-date documentation whenever referencing or implementing external libraries, frameworks, SDKs, or cloud services.
1. `resolve-library-id` with the library/package name.
2. `query-docs` with the resolved `/org/project` ID and specific concept.
3. Base implementation on retrieved authoritative docs.
<!-- context7 -->
