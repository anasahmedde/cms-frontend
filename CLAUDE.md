# cms-frontend — Rules

React 19 (CRA) dashboard for the DIGIX Signage CMS. Deploys via GitHub Actions: push to `staging`/`main` → build → S3 + CloudFront (`staging-cms.wizioners.com` / `cms.wizioners.com`). Navigation is `currentPage` state in `App.js` (no router); design system is inline styles + the BRAND palette/theme objects in `App.js` via ThemeContext (MUI is an unused dependency — don't start using it piecemeal).

## Git flow (server-enforced)

- Never push directly to `staging` or `main` (blocked by rulesets, no admin bypass).
- Flow: `feature/*` | `fix/*` | `chore/*` branch → PR → `staging`; releases: PR `staging → main` (the only head branch main accepts — required `enforce-branch-flow` check).
- Descriptive branch names; never reuse throwaway branches (`temp3`-style is banned); delete after merge. Conventional commits. One logical change per PR; body says what/why/how verified.
- Merging = deploying. Verify on staging before a release PR. Rollback = `git revert` via PR. `[skip ci]` only for CI-only/docs-only commits.

## Engineering rules

- **No silent failures.** Check `res.ok`/status on every call — a failed request must never render as success or as an innocent empty state. Every async action shows all four states: loading, success feedback, error (with what to do next), empty.
- **Never full-replace a collection from possibly-stale client state** (known data-loss bug pattern in group-content save). Fetch-then-diff or send deltas; never save defaults over config you failed to load.
- **Destructive actions need an explicit, accurate confirmation** — never show a success checkmark for an operation that was skipped or failed.
- All API calls go through the shared authenticated axios instance — no raw `axios`/`fetch` without the Authorization header (about a dozen known violations; fix on touch).
- No hardcoded backend URLs; read `REACT_APP_API_BASE_URL` from one config module (the copy-pasted `:8005` fallback is debt — consolidate on touch, don't add instance #7).
- No `alert()`/`window.confirm()` in new code — use the app's toast/modal patterns. No `console.log` in committed code.
- Every new UI works in **both light and dark themes**, is keyboard-reachable, and has labeled controls (`aria-label`, `htmlFor`) — no emoji-only buttons.
- Components stay under ~300 lines — extract before they grow (two known 2,600+-line components: shrink on touch, never extend). Reuse the existing modal/toast/page patterns instead of adding variants (6 duplicate modal implementations exist).
- Don't lose user work: preserve form state on failure; warn before discarding edits.
- Delete dead code in the same PR you touch its area (`App.jsx`, `App-backup-latest.js`, `Linker.js`, committed `build/` are known debt). Never commit `build/`, `.DS_Store`, or editor swap files.
- Wrap page content in an ErrorBoundary (currently missing — one null crash white-screens the app).

## Definition of Done — link the minor features

- [ ] Loading / success / error / empty states for every async path
- [ ] Dark mode + permission gating + list refresh after mutation
- [ ] Group-level vs per-device override semantics respected in config UIs
- [ ] Works against staging end-to-end before any `staging → main` PR
