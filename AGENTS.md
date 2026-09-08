# Repository Agent Instructions

## GitHub Actions cost control

These rules apply to every automated agent, chat, or coding assistant working in this repository.

- Treat GitHub Actions minutes as a constrained production resource and minimize unnecessary CI usage.
- Before adding or changing a workflow, inspect existing workflows and reuse them where possible instead of creating overlapping jobs.
- Use `paths` / `paths-ignore` filters whenever technically appropriate so workflows only run for files that can affect the job.
- For push-driven development workflows, add an appropriate `concurrency` group with `cancel-in-progress: true` whenever superseded runs do not need to finish.
- Do not trigger expensive Android, desktop, packaging, store, release, or full production builds for ordinary source commits unless they are actually required.
- Prefer release tags, dedicated release branches, or `workflow_dispatch` for expensive artifact builds when automatic execution is not necessary.
- Avoid rebuilding multiple equivalent artifacts in one run unless each artifact is needed.
- Use dependency/build caching when safe and useful, and avoid unconditional clean installs or clean builds when they materially increase runtime without benefit.
- Keep validation targeted: run the smallest test/build set that safely verifies the changed area.
- Never weaken security checks, required release validation, or correctness solely to save minutes. Optimize triggers and redundant work first.
- When several commits arrive in quick succession, prefer keeping only the newest relevant CI run active.
- Any new workflow must be reviewed for expected run frequency and cost before being committed.

Goal: preserve reliable testing and deployments while keeping GitHub Actions usage and monthly cost as low as reasonably possible.
