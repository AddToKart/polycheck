# PolyCheck Repository Remediation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Everything below was verified against the working tree on branch `fix/cross-browser-runtime-compat` @ `ddeda57` on 2026-11-04. Do not re-derive findings — execute them.

**Goal:** Take PolyCheck from 2,221 green tests but a 99-for-99 red CI history and 4 critical CVEs, to a repo where CI passes on push, every dependency critical is patched, both test suites stop flaking, the bundle loses its heaviest passenger, and the coverage gate means something.

**Architecture:** No structural changes. Every fix is config, dependency bump, or one-file refactor. The codebase is good — verified 8.5/10 architecture, 0 `@ts-ignore`, 0 TODO, 0 `console.log`, 11 real `any` in source. We are fixing the ceiling above the code, not the code.

**Tech Stack:** pnpm 11.18 workspace (shared/frontend/android/backend via turbo), Next.js 16.4.0, NestJS (jest), vitest 4.1.11, Prisma 6 (`prisma-client` generator, output to `backend/src/generated/prisma` — gitignored, not committed), Better Auth 1.6.25, Node 22.

**Verified repo state (do not re-verify):**

| Finding | Proof |
|---|---|
| 99 CI runs, 99 failures, 0 ever passed | `gh run list --workflow CI --limit 300` — all `failure`, oldest 2026-07-17 |
| PRs #85 and #107 merged with `verify` and `web-e2e` both failing | `gh pr view 107 --json statusCheckRollup` |
| `pnpm audit --prod --audit-level high` exits 1 | 57 prod vulns: 4 critical / 21 high / 21 moderate / 11 low |
| next 16.4.0 is vulnerable to 2 RCEs, patched in 16.4.1 | audit JSON: `>=16.0.0 <=16.4.0`, patched `>=16.4.1` |
| better-auth 1.6.25: OAuth state magic-link bypass, patched 1.7.7 | audit JSON: `>=1.4.0-beta.18 <1.7.7` |
| @sentry/nextjs: middleware tunnel bypass, patched 10.75.2 | audit JSON: `<10.75.2` |
| Frontend vitest: same commit scored 7 → 23 → 18 → 3 → 0 failures across five runs | Every failure was `Test timed out in 5000ms` |
| Same "failing" files pass 46/46 in 4.09s at `--testTimeout=30000` | `npx vitest run src/lib/api-client.test.ts src/lib/offline/sync-engine.test.ts "src/app/faculty/sessions/[id]/page.test.tsx" --testTimeout=30000` |
| Backend jest OOMs 27/82 suites at default workers | "Jest worker ran out of memory"; `--runInBand` = 82/82 green in 217s |
| Frontend coverage: 35.37% stmts / 30.86% branches / 31.84% funcs / 36.88% lines | `npx vitest run --coverage` final table |
| Frontend coverage thresholds are 15/10/10/15 | `frontend/vitest.config.ts` — gate can never fail |
| Backend coverage: 72.85% stmts / 62.11% branches / 71.18% funcs / 74.74% lines; thresholds 70/60/72/70 | `backend/jest.config.ts:22` — **branches is already below its own gate** |
| `backend/src/generated/prisma` is NOT committed | `git ls-files backend/src/generated` → 0 files; `.gitignore:55` |
| 51,554 generated .ts lines under `backend/src/generated` | `find backend/src/generated -name '*.ts' \| xargs wc -l` |
| ESLint lints the generated dir | `backend/eslint.config.mjs:58` ignores only `dist/**` and `node_modules/**` |
| Jest instruments the generated dir | `backend/jest.config.ts:12` `collectCoverageFrom: 'src/**/*.ts'` with no generated exclusion |
| `api-client.ts` is 2,132 lines | largest handwritten source file in the repo |
| Exactly 1 `dynamic()` call in all of `frontend/src` | `grep -rn "dynamic(" frontend/src --include='*.tsx' \| wc -l` |
| `ui/map.tsx:4-6` statically imports `maplibre-gl` + its CSS | `import * as MapLibreGL from "maplibre-gl"` etc. |
| `shared/src/utils/calendar.test.ts` has a live tsc error (`Session.mode` optional-vs-required) | `npx tsc --noEmit` in `shared/` — TS2322 |
| `shared/package.json` has **no `typecheck` script** and CI's `shared test` step doesn't typecheck tests | scripts: `build/dev/clean/test` only |
| 7 frontend eslint warnings (0 errors) | unused `PaginationBar` imports ×3, unused state ×2, react-hooks/exhaustive-deps ×2 |
| 58 `for...of` loops in backend, zero `await prisma` inside them | no N+1 fire found — leave alone |
| 64 `@@index` across a 606-line Prisma schema | DB layer is dense and healthy — leave alone |

**Branch discipline:** Work on a new branch `chore/repo-remediation-2026-11-04` cut from `origin/main` (`5bb0d7a`). Commit after every task. Do NOT touch `fix/cross-browser-runtime-compat` — its 2 unmerged commits (`8dd2a48`, `ddeda57`) are a separate problem; this plan must include rebasing them or opening their PR, one decision Kurt makes at Task 0.5.

---

## Phase 0 — Gates and hygiene (do first, everything else depends on CI)

### Task 0.1: Create remediation branch

**Objective:** Isolate all Plan work from main and from the stuck wow-suite branch.

**Step 1:** In `~/Documents/dev/polycheck`:

```bash
git fetch origin
git switch -c chore/repo-remediation-2026-11-04 origin/main
```

**Step 2: Verify:**

```bash
git status --short        # expect: empty
git log --oneline -1      # expect: 5bb0d7a (Merge pull request #107)
```

### Task 0.2: Decide the fate of the stuck wow-suite branch (needs Kurt)

**Objective:** The two unmerged commits on `fix/cross-browser-runtime-compat` (`8dd2a48` wow suite + `ddeda57` signing-key recovery, 143 files, +25,257/−2,231) have no PR because their original PR (#107) was already merged when they were pushed. They are work-in-progress that silently fell out of the pipeline.

This is a scope/precedence decision, not a code one. Options:

- **(a)** Rebase `fix/cross-browser-runtime-compat` onto the new remediation branch after Phase 1–3 land, then open a proper PR (recommended — remediation first unblocks CI, so the wow suite PR gets real checks)
- **(b)** Open the wow-suite PR first, remediation rebase on top of it
- **(c)** Stash/archive the branch for after defense

**Step 1:** Ask Kurt which of (a), (b), or (c).
**Step 2:** Record the answer in the remediation branch's final PR description. Do not silently execute any option — remote pushes and PR creation are external actions.

### Task 0.3: Split the security audit out of the CI verification chain

**Objective:** CI has never passed. First step is `pnpm security:audit`, which exits 1 (because of real, not-yet-patched advisories and transitive dependency vulns that have no release available — e.g. node-forge chains under expo). Pinning the 4 criticals (Phase 1) does not make `--audit-level high` go green today; 21 highs are in transitive paths andoverrides can't pin every one. The gate kills everything downstream, so it must stop killing first.

**Files:**
- Modify: `.github/workflows/ci.yml` (the `verify` job's steps)
- Create: `.github/workflows/security.yml`

**Step 1: Create a dedicated security workflow** (still runs, still reports, no longer a fuse):

```yaml
name: Security Audit

on:
  pull_request:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * 1'  # weekly Monday sweep

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.18.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --prod --audit-level critical
```

**Step 2: Remove the audit step from `verify`.** In `ci.yml`, the `verify` job's step order is:

```
pnpm install --frozen-lockfile
pnpm security:audit        ← DELETE this line from verify
pnpm peers check
pnpm --dir android exec expo install --check
... (everything else stays)
```

Keep `pnpm security:audit` in `package.json` as a runnable script — Kurt uses it locally; delete only the CI invocation point. The 4 criticals still hard-fail a PR via `security.yml`; the 21 highs get a weekly report instead of a daily pipeline kill.

**Step 3: Add concurrency control to `ci.yml` top level** (99 runs came partly from redundant pushes to the same branch):

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Step 4: Verify locally by simulating the remaining steps:**

```bash
pnpm peers check                                                # should pass
pnpm --dir android exec expo install --check                    # should pass
pnpm --filter @polycheck/backend prisma:generate                # should pass
pnpm --filter @polycheck/backend prisma:migrate:deploy          # needs CI postgres; skip locally if no DB, defer to push
pnpm --filter @polycheck/backend format:check                   # should pass
pnpm --filter @polycheck/backend lint:check                     # should pass
pnpm --dir frontend lint                                        # expect: 0 errors, 7 warnings
```

**Step 5: Commit:**

```bash
git add .github/workflows/ci.yml .github/workflows/security.yml
git commit -m "ci: move security audit to dedicated weekly job, add run concurrency"
```

---

## Phase 1 — Dependency criticals (smallest diff, biggest risk reduction)

### Task 1.1: Patch the 4 critical production CVEs

**Objective:** Bump the three packages that carry every critical-severity advisory in the prod dependency graph.

**Files:**
- Modify: `frontend/package.json` (next, @sentry/nextjs)
- Modify: `backend/package.json` (better-auth)
- Regen: `pnpm-lock.yaml`

**Step 1:** From repo root:

```bash
pnpm --filter @polycheck/frontend add next@^16.4.1 @sentry/nextjs@^10.75.2
pnpm --filter @polycheck/backend add better-auth@^1.7.7
```

Note exact target versions:
- `next` 16.4.1 (fixes both critical RCEs: Image Optimizer + `use cache`)
- `@sentry/nextjs` 10.75.2 (fixes middleware tunnel bypass)
- `better-auth` 1.7.7 (fixes OAuth state magic-link bypass; two other betas-in-range high bugs also fixed)

**Step 2: Verify installed versions match exactly:**

```bash
node -e "console.log('next:',require('./frontend/node_modules/next/package.json').version)"
node -e "console.log('sentry:',require('./frontend/node_modules/@sentry/nextjs/package.json').version)"
node -e "console.log('better-auth:',require('./backend/node_modules/better-auth/package.json').version)"
```

Expected: `next: 16.4.1` (or higher patch), `sentry: 10.75.2+`, `better-auth: 1.7.7` (or higher patch).

**Step 3: Confirm criticals are gone from the prod graph:**

```bash
pnpm audit --prod --audit-level critical
```

Expected: exit 0. If it still exits 1, list what remains — anything left after these three bumps should only be transitive paths (node-forge under expo, etc.), which are tracked in the weekly audit job and must not block the PR. If a *new* critical appears post-bump (bad lockfile shake), report it; do not paper over it with `overrides` without reading the advisory first.

**Step 4: Smoke the frontend build against the bumped Next:**

```bash
pnpm --dir frontend build
```

Expected: exit 0. If Next 16.4.1 changed any route generation behavior, this is where it shows.

**Step 5: Smoke better-auth against the backend build:**

```bash
pnpm --filter @polycheck/backend build
```

Expected: exit 0. If `1.7.7` changed exported types, `tsc --noEmit` stops here rather than in CI.

**Step 6: Commit:**

```bash
git add frontend/package.json backend/package.json pnpm-lock.yaml
git commit -m "fix(deps): patch 4 critical CVEs — next 16.4.1, better-auth 1.7.7, @sentry/nextjs 10.75.2"
```

### Task 1.2: Triage the 21 highs into actionable and unactionable

**Objective:** The 21 highs break into: (i) direct deps Kurt can bump today (body-parser, multer, zod, undici, vite — check which of these are actually direct vs transitive with `pnpm why`), (ii) transitive-only paths already held at patched versions by `pnpm-workspace.yaml` overrides (deepmerge, qs, etc. — already handled), (iii) transitive paths with no fixed version (node-forge under expo's CLI cert tooling — out of reach).

**Step 1: Enumerate which of the 21 are direct dep bumps:**

```bash
pnpm audit --prod --json > "$LOCALAPPDATA/Temp/pc-audit-after.json"
python -c "
import json,os
d=json.load(open(os.environ['LOCALAPPDATA']+'/Temp/pc-audit-after.json'))
for a in d['advisories'].values():
    f=a['findings'][0]
    print(a['severity'], a['module_name'], '->depth', f['paths'][0].count('>')+1 if f['paths'] else '?')
" | sort -u
```

**Step 2:** For every high whose root cause is a **direct dependency** (depth ≤ 2, i.e. `root > dep`), bump it the same way as Task 1.1. For every high that is transitive-only with an available patched version reachable via `overrides`, add that one override. For everything else, log it in a `docs/SECURITY-KNOWN-ISSUES.md` note with severity, path, and why it's unreachable — that file is what Kurt shows a reviewer instead of an unexplained exit 1.

**Step 3:** Do NOT chase to zero. The target is "every critical patched, every high either patched or documented," not "exit 0 at high." Chasing exit-0-at-high forces `overrides` bloat on packages this app barely uses.

**Step 4: Commit:**

```bash
git add package.json backend/package.json frontend/package.json android/package.json pnpm-workspace.yaml pnpm-lock.yaml docs/SECURITY-KNOWN-ISSUES.md
git commit -m "chore(deps): bump reachable high-severity deps, document unreachable transitive advisories"
```

---

## Phase 2 — Test reliability (stop the suite from lying)

### Task 2.1: Give frontend tests a real timeout

**Objective:** Frontend vitest has been flaky purely from load, not from bugs. Verified: every failure is `Test timed out in 5000ms`, and the whole set of "failing" tests passes at `--testTimeout=30000`. Bump the baseline so 5s is not the cliff.

**Files:**
- Modify: `frontend/vitest.config.ts`

**Step 1:** In the `test:` block, add:

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  restoreMocks: true,
  testTimeout: 20000,
  maxWorkers: 2,
  coverage: { ... unchanged ... },
},
```

Why these exact values: 20s is 4× the observed worst-case single-test time on this machine (5s timeouts were being hit at 4–8s of work; 20s gives headroom without letting genuine hangs run forever). `maxWorkers: 2` fixes the real killer — jsdom `setup` alone consumed 288s of a 46s wall-clock run because default parallelism was thrashing workers. 2 is not a guess: the suite passed clean end-to-end under load when workers were constrained; it broke when they weren't.

**Step 2: Verify:**

```bash
pnpm --dir frontend test
```

Expected: `Tests 398 passed (398)` / `Test Files 59 passed (59)` — zero failures, three consecutive runs. If any test still times out at 20s, it is a genuine bug, not load — read its stack, do not bump the timeout again.

**Step 3: Commit:**

```bash
git add frontend/vitest.config.ts
git commit -m "test: raise frontend test timeout and constrain workers for stable runs"
```

### Task 2.2: Give backend jest a memory ceiling

**Objective:** Backend jest crashed 27/82 suites with "Jest worker ran out of memory" under default workers on the same machine where `--runInBand` runs clean in 217s. Fix worker recycling; do not force `--runInBand` (slower than tuned workers).

**Files:**
- Modify: `backend/jest.config.ts`

**Step 1:** Add to the existing config object:

```ts
workerIdleMemoryLimit: '512MB',
maxWorkers: '50%',
```

Why: `workerIdleMemoryLimit` makes jest recycle workers when a test file's leaks push past the ceiling, instead of queuing intoOOM. `'50%'` of this machine's cores keeps memory pressure below OOM while staying faster than `--runInBand`.

**Step 2: Verify (twice, consecutive runs — this was the flake signature):**

```bash
pnpm --filter @polycheck/backend test
pnpm --filter @polycheck/backend test
```

Expected both times: `Tests: 993 passed, 993 total`, `Test Suites: 82 passed, 82 total`, no OOM lines. If OOM still appears on either run, bump to `workerIdleMemoryLimit: '1GB'` once, then stop — anything further is a memory leak bug to investigate, not a config problem.

**Step 3: Commit:**

```bash
git add backend/jest.config.ts
git commit -m "test: cap jest worker memory to stop OOM suite crashes"
```

### Task 2.3: Make coverage thresholds honest

**Objective:** Both suites have broken gates. Frontend's is decorative (15/10 against actual 35/31). Backend's `branches` gate is already failing invisibly (62.11% actual vs 60 threshold... which passes — but only because the generated Prisma code is dragging the denominator down; once generated code is excluded, real branch coverage will read differently). Fix both by (a) excluding generated code from coverage and (b) gating at numbers that reflect the handwritten code.

**Files:**
- Modify: `frontend/vitest.config.ts` (coverage block)
- Modify: `backend/jest.config.ts` (collectCoverageFrom + coverageThreshold)
- Test: run both suites with coverage

**Step 1: Backend — exclude the generated dir from coverage:**

In `backend/jest.config.ts`, extend `collectCoverageFrom`:

```ts
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/main.ts',
  '!src/**/*.module.ts',
  '!src/**/*.dto.ts',
  '!src/**/*.controller.ts',
  '!src/common/decorators/**',
  '!src/generated/**',          // ← ADD: Prisma codegen, 51,554 lines, ~57% instrumented
  // ... keep every other existing exclusion
],
```

**Step 2: Backend — re-measure, then set thresholds to actual-minus-slack:**

Run coverage once with the exclusion in place. Read the `All files` row. Expected: statements/lines land somewhere in the high 80s–low 90s (72.85% was diluted by 51k generated files at 57%). Whatever it prints, set:

```ts
coverageThreshold: {
  global: {
    branches: <actual_branches_minus_3>,
    functions: <actual_functions_minus_3>,
    lines: <actual_lines_minus_2>,
    statements: <actual_statements_minus_2>,
  },
  // keep coverageThreshold.perFile untouched if present
},
```

Do not set the numbers in advance — this task's job is to make the *gate* reflect the *codebase*, and today's actuals under exclusion are unknown until they're measured. Record them in the commit message, e.g. `backend: 88/74/91/89` style.

**Step 3: Frontend — same treatment, gentler targets:**

Frontend has no generated-code problem, so its honest numbers are already known: 35.37% stmts / 30.86% branches / 31.84% funcs / 36.88% lines. Change thresholds from `15/10/10/15` to `33/28/29/34` — a gate 2 points under reality. It will fail the moment anyone regresses coverage, and can never again be a number nobody notices.

**Step 4: Verify both suites hold their new gates:**

```bash
pnpm --filter @polycheck/backend test:cov
pnpm --dir frontend test:coverage
```

Expected: exit 0 on both, coverage summary prints, no threshold error.

**Step 5: Commit:**

```bash
git add backend/jest.config.ts frontend/vitest.config.ts
git commit -m "test: exclude generated code from backend coverage, raise both focus gates to honest levels"
```

### Task 2.4: Fix frontend lint warnings (trivial, one commit)

**Objective:** 7 warnings, 0 errors — all mechanical.

**Files (all warnings resolved, nothing new added):**
- `frontend/src/app/faculty/reports/page.tsx:6` — remove unused `PaginationBar` import
- `frontend/src/app/faculty/sections/[id]/page.tsx:19` — remove unused `PaginationBar` import
- `frontend/src/app/faculty/subjects/page.tsx:7` — remove unused `PaginationBar` import
- `frontend/src/app/faculty/sections/[id]/page.tsx:51` — remove or use `setSessionPage`
- `frontend/src/app/faculty/subjects/page.tsx:41` — remove or use `setPage`
- `frontend/src/app/faculty/attendance/page.tsx:143` — wrap `summaries` init in own `useMemo` before feeding the caller's `useMemo` deps
- `frontend/src/app/faculty/reports/page.tsx:143` — same for `filteredSummaries`

**Step 1:** Apply each fix. For the two `useMemo` warnings, the shape is:

```tsx
// before
const summaries = rows.flatMap(r => r.sections ?? [])        // or filtered variant
const whatever = useMemo(() => compute(summaries), [summaries])

// after — the Dep object identity becomes stable per-render
const summaries = useMemo(() => rows.flatMap(r => r.sections ?? []), [rows])
const whatever = useMemo(() => compute(summaries), [summaries])
```

**Step 2: Verify:**

```bash
pnpm --dir frontend lint
```

Expected: `✔ No ESLint warnings or errors` (or 0/0). `pnpm --dir frontend test` still exits 0.

**Step 3: Commit:**

```bash
git add frontend/src
git commit -m "lint: clear all 7 frontend eslint warnings (unused imports, stale state, memo deps)"
```

### Task 2.5: Give `shared` a typecheck and fix the live tsc error

**Objective:** `shared/src/utils/calendar.test.ts` currently fails `tsc --noEmit` — TS2322, `Session.mode: SessionMode | undefined` vs required — and nothing catches it because `shared/package.json` has no typecheck script and CI only runs `shared test` (vitest) and `shared build` (tsup, which doesn't typecheck test files). Every other package has a `typecheck: tsc --noEmit` script and a CI step for it; `shared` is the one without.

**Files:**
- Modify: `shared/package.json` (add script)
- Modify: `shared/tsconfig.json` (exclude dist if not already)
- Modify: `.github/workflows/ci.yml` (add CI step)
- Modify: `shared/src/utils/calendar.test.ts:46` (the actual error)
- Possibly: `shared/src/types/session.ts` (if the fix is "mode should be optional on Session" — decide by reading the domain, don't guess)

**Step 1:** Add to `shared/package.json` scripts:

```json
"typecheck": "tsc --noEmit"
```

**Step 2:** In `ci.yml`, inside the `verify` job, immediately after the existing `pnpm --dir shared test` step, add:

```yaml
- run: pnpm --dir shared typecheck
```

**Step 3:** Run it:

```bash
pnpm --dir shared typecheck
```

Expected: the TS2322 error, reproduced. Now decide the *right* fix, by reading the two files involved, not by stuffing `!` in: if `Session.mode` is genuinely always present (server always sets it), fix the test fixture at `calendar.test.ts:46` to include `mode` and assert it; if `mode` is legitimately optional for some session types (e.g. async/online sessions), fix the type at `shared/src/types/session.ts` to make `mode?:` and let the runtime default in the test. Whichever it is, the fixture and the domain must agree — the error currently proves they don't.

**Step 4: Verify:**

```bash
pnpm --dir shared typecheck    # expect: exit 0, no output
pnpm --dir shared test          # expect: 176 passed (unchanged)
pnpm --dir shared build         # expect: exit 0
```

**Step 5: Commit:**

```bash
git add shared/package.json shared/tsconfig.json shared/src/utils/calendar.test.ts shared/src/types/session.ts .github/workflows/ci.yml
git commit -m "fix(shared): add typecheck to CI and resolve Session.mode fixture mismatch"
```

---

## Phase 3 — Frontend performance (bundle)

### Task 3.1: Lazy-load MapLibre off the initial path

**Objective:** `maplibre-gl` and its CSS land in the initial JS for every page route that touches the map, including the kiosk/QR screen faculty actually present on a projector over unreliable wifi — the exact screen where bundle weight hurts most. Only 1 `dynamic()` call exists in all of `frontend/src`; this is the one place it matters.

**Files:**
- Modify: `frontend/src/app/faculty/sessions/[id]/page.tsx:20` (static `CampusMap` import)
- Modify: `frontend/src/app/student/subjects/[id]/create-session/page.tsx` (if it imports map directly — check first)
- Modify: any other page statically importing `CampusMap`, `GeofenceCircle`, or `ui/map.tsx`

**Step 1: Grep the static-import sites first:**

```bash
grep -rn "from '@/components/CampusMap'\|from \"@/components/CampusMap\"\|from '@/components/GeofenceCircle'\|from \"@/components/GeofenceCircle\"\|from '@/components/ui/map'\|from \"@/components/ui/map\"" frontend/src --include='*.tsx' --include='*.ts'
```

Record every hit. These are the pages currently paying maplibre's cost up front.

**Step 2: For each page-level hit, swap the static import for next/dynamic:**

```tsx
// before
import CampusMap from '@/components/CampusMap'

// after
import dynamic from 'next/dynamic'
const CampusMap = dynamic(() => import('@/components/CampusMap'), {
  ssr: false,   // maplibre is WebGL; SSR is meaningless here and the worker URL is set client-side anyway
  loading: () => <div className="h-[420px] animate-pulse rounded-lg bg-muted" />,  // match existing skeleton style
})
```

**Step 3: Do not touch `ui/map.tsx` or `GeofenceCircle.tsx` internals.** They remain plain modules. The code-split line is the page-level `dynamic()` wrapper — splitting there keeps the map component itself testable with a synchronous import in vitest, which matters because testing a lazily-loaded component in jsdom is extra machinery with no upside here.

**Step 4: Handle the test files that import these components statically.** `MapPicker.test.tsx` and `GeofenceRadarModal.test.tsx` may mock `maplibre-gl`. Do not convert tests to dynamic loading; test files are allowed static imports. Only page `tsx` files ( things under `render()` ) change.

**Step 5: Verify:**

```bash
pnpm --dir frontend build        # expect: exit 0, and the route chunks containing session/[id] should shrink
pnpm --dir frontend test         # expect: 398 passed
```

Then compare build output before/after if you want the actual win:

```bash
pnpm --dir frontend build 2>&1 | tail -30
```

Look at the `First Load JS` column for the session `[id]` route specifically — that's the kiosk's parent, the page that matters. Record the before/after delta in the commit message. Note honestly if the number doesn't move: maplibre may already be sitting in a shared chunk; the win only materializes if the import was putting it on the initial route bundle.

**Step 6: Manual smoke (real browser, not jsdom):**

```bash
pnpm --dir frontend dev        # detached, backgrounded
```

Open:
- `http://localhost:3000/faculty/sessions/<any real id>` — map should render (worker URL `/vendor/maplibre/maplibre-gl-worker.mjs` must load; check Network tab for 404s)
- Any student-facing dashboard

Expected: map tiles draw, no console errors, no 404 for the worker bundle. **Do not skip this step for "because tests pass."** Code-splitting touches the rendering path, and jsdom won't catch a WebGL/runtime-only break.

**Step 7: Commit:**

```bash
git add frontend/src
git commit -m "perf(ui): code-split maplibre-gl out of the initial bundle via next/dynamic on map pages"
```

### Task 3.2: Split `api-client.ts` by domain

**Objective:** `frontend/src/lib/api-client.ts` is 2,132 lines and touches every page — it's the only God-object file in the repo, a merge-conflict magnet, and (after Phase 2) the single test file that dominates runtime for the frontend suite. Split into domain modules behind a barrel so no import site changes.

**Files:**
- Split: `frontend/src/lib/api-client.ts` (2,132 lines) into domain modules
- Create/modify: importers across `frontend/src` — **zero** of them should change

**Target structure:**

```
frontend/src/lib/api/
  transport.ts      — shared fetch wrapper, base URL, error shape (what all domains call)
  auth.ts           — login/logout/session/me
  attendance.ts     — sessions, scans, kiosk, QR lifecycle
  students.ts       — student roster, enrollment, at-risk
  faculty.ts        — sections, subjects, class record, moderation
  admin.ts          — super admin console, governance, settings
  reports.ts        — reports, ledger, audit-log reads
  index.ts          — barrel re-exporting the `api` object exactly as today's shape
```

**Step 1: Map the exports first — do not open the file and start moving lines blind:**

```bash
grep -nE "^export |^  [a-zA-Z]+\(" frontend/src/lib/api-client.ts | head -60
```

Plus `grep -rn "from '@/lib/api-client'" frontend/src --include='*.tsx' --include='*.ts' | wc -l` to know exactly how many import sites rely on the barrel staying put.

**Step 2: Move code by cohesive domain, not by line count.** It is acceptable for one domain module to end up at 600 lines (attendance, given the QR lifecycle) while another lands at 120. The rule is cohesion, not symmetry. Shared transport helpers go to `transport.ts` first so domain modules don't cross-import each other.

**Step 3: Rewrite `api-client.ts` as a barrel-only re-export:**

```ts
export * from './api/auth'
export * from './api/attendance'
export * from './api/students'
export * from './api/faculty'
export * from './api/admin'
export * from './api/reports'
export { default } from './api/index'   // if the original had a default export
```

Rule: every single import site in `frontend/src` keeps working untouched. If the detail page files do `import { api } from '@/lib/api-client'`, that name has to keep resolving. Verify with a typecheck: `pnpm --dir frontend typecheck`-equivalent — actually, `frontend/package.json` has no typecheck script; just run `npx tsc --noEmit` in `frontend/` directly, exactly as this plan audited it.

**Step 4: The test file moves too, or gets split alongside.** `api-client.test.ts` is 94 lines changed on the branch and covers login flow, profile persistence, cookie handling. Split it to mirror the domain split — `api/auth.test.ts` etc. — so the mapping is obvious later. Keep all assertions byte-identical.

**Step 5: Verify:**

```bash
cd frontend && npx tsc --noEmit        # expect: exit 0
pnpm --dir frontend test               # expect: 398 passed, same tests, same failures none
pnpm --dir frontend build              # expect: exit 0
pnpm --dir frontend lint               # expect: 0/0
```

**Step 6: Commit:**

```bash
git add frontend/src/lib
git commit -m "refactor(api): split 2,132-line api-client into per-domain modules behind a stable barrel"
```

---

## Phase 4 — CI green (the proof)

### Task 4.1: Ship and watch

**Objective:** This branch's push is the first CI run of the repo's life that has a real shot at passing. Verify it.

**Step 1:**

```bash
git push -u origin chore/repo-remediation-2026-11-04
gh pr create --base main --title "chore: repo remediation — CI, critical CVEs, test reliability, coverage gates" --body "$(cat <<'EOF'
## Why
CI has failed 99/99 runs since 2026-07-17, gated behind a security audit step that exits 1 on unfixable transitive advisories. PRs #85 and #107 merged anyway. This branch separates audit from verification, patches the 4 critical CVEs (next RCE ×2, better-auth OAuth bypass, sentry middleware bypass), stabilizes both test suites, makes coverage gates honest, code-splits maplibre off the kiosk path, and splits the 2,132-line api-client.

## What
- **CI:** audit → own weekly job (critical-level, blocking); `concurrency` cancel-in-progress
- **Deps:** next@16.4.1, better-auth@1.7.7, @sentry/nextjs@10.75.2; reachable highs bumped; unreachable documented in docs/SECURITY-KNOWN-ISSUES.md
- **Tests:** vitest testTimeout 20s + maxWorkers 2; jest workerIdleMemoryLimit 512MB; coverage excludes backend/src/generated/**
- **Coverage gates:** backend re-measured under exclusion and set to actuals−2/−3; frontend 15/10/10/15 → 33/28/29/34
- **Lint:** 7 frontend warnings cleared
- **shared:** typecheck script + CI step + Session.mode fixture fix
- **Perf:** next/dynamic on map-bearing pages
- **Refactor:** api-client → per-domain barrel (zero import-site changes)

## Verified locally before push
- [ ] backend tsc --noEmit clean
- [ ] backend jest 993/993 at tuned workers (2 consecutive runs, no OOM)
- [ ] frontend vitest 398/398 at testTimeout 20s / maxWorkers 2 (should be green now)
- [ ] frontend lint 0 errors 0 warnings
- [ ] shared tsc --noEmit clean (new gate)
- [ ] pnpm audit --prod --audit-level critical exit 0
- [ ] next build exit 0, session-[id] First Load JS delta recorded in commit messages
EOF
)"
```

**Note on the checklist:** the PR body checklist should only be checked off if you actually ran each check locally before pushing. Leave unchecked honestly if not — the point of this PR is to be the first *trustworthy* signal the repo has produced.

**Step 2: Watch the first run end-to-end:**

```bash
gh run watch $(gh run list --branch chore/repo-remediation-2026-11-04 --limit 1 --json databaseId -q '.[0].databaseId')
```

Expected: **conclusion success on both `verify` and `web-e2e`**, `containers` and `mobile-e2e` skip on PR (they're main-branch steps per current config — confirm by reading `ci.yml`'s job conditions during this task, don't assume).

If `verify` or `web-e2e` fails, read the log with `gh run view --log-failed`, fix, push — but the failure modes here should all have been caught locally in Phase 2/3. Anything that only fails on CI runners and not locally is a finding worth documenting, not re-running.

**Step 3: Create the task-complete artifact.** Copy the full CI run output to plan/wow-factor-suite-plan.md's sibling:

```bash
mkdir -p outputs/repo-remediation
gh run view <run-id> --log > outputs/repo-remediation/ci-first-green.log
```

Kurt archives CI logs under `outputs/` elsewhere in this repo (`outputs/` dir already exists and holds runbooks/logs) — it's his preferred durable record for when he returns to the repo after a break.

**Step 4: When both jobs are green, merge immediately (squash or merge — Kurt's call; this repo has used both).** Do not leave the branch open: an open remediation PR is exactly the same trap the wow-suite branch fell into, where it sat forgotten behind a merged PR number. The wow-suite rebase decision from Task 0.2 then lands on top.

---

## Phase 5 — Out of scope, flagged, not forgotten

Not in this plan's tasks, but worth tracking in Kurt's own kanban/vault when the branch is merged:

| Item | Why deferred |
|---|---|
| Frontend coverage *actual* gaps: `sync.service.ts` 38.8%, `sections.service.ts` 54.5%, `section-roles.service.ts` 55.1%, `proofs.service.ts` 62.5% | CoveragePDOException gate work (Phase 2) makes these visible; writing tests for them is real engineering needing focused sessions — sync.service especially is the offline-first claim's weakest point |
| Remote turbo cache (vercel turbo remote caching or a self-hosted cache server) | CI green is the win; caching is a 1-hr speed jobs optimization best done after CI is trusted |
| Backend composite index on the scan hot path | 64 indexes already exist, no N+1 fire found; DB tuning without a profiling run is guesswork — profile first |
| Docker image size audit (backend runtime copies `src/generated` deliberately) | The copy is intentional and correct; an image-size sweep is a separate initiative |
| The 11 real `any`s in src (2 catch blocks, 3 `Badge variant as any`, 3 `Sidebar user as any`, etc.) | Cosmetic; type-discovery of `BadgeProps['variant']` is a nice-to-have, zero-risk today |
| `plan/wow-factor-suite-plan.md` (426 lines) — the wow-suite branch's own plan doc | Moves with whichever decision Task 0.2 produces — belongs to that branch, not this one |

## Success criteria (checklist for "everything fixed")

1. `pnpm audit --prod --audit-level critical` → exit 0
2. `gh run list --workflow CI --limit 1` on the remediation PR → conclusion success (first green in repo history)
3. 3 consecutive frontend `pnpm test` runs → 398/398 each, zero flake
4. 2 consecutive backend `pnpm test` runs → 993/993 each, zero OOM
5. Frontend coverage thresholds are higher than actual coverage minus 3 points — not lower than it by 20
6. Backend coverage excludes `src/generated/**`; thresholds set to measured actuals (recorded in commit message)
7. `npx tsc --noEmit` exits 0 in backend, frontend, android, **and shared**
8. `session/[id]` route First Load JS measured before and after Task 3.1; delta recorded in the commit message
9. `frontend/src/lib/api-client.ts` ≤ 30 lines (pure barrel); zero import-site changes required
10. `pnpm --dir frontend lint` → 0 errors, 0 warnings
11. The stuck `fix/cross-browser-runtime-compat` branch has an explicit decision recorded (Task 0.2), not a silent status quo
