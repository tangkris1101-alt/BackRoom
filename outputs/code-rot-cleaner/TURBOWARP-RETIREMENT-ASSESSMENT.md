# TurboWarp Test-Line Retirement Assessment

> **CLEANUP APPLIED AND BUILD-VERIFIED** — The approved retirement batch is applied to the real project. Validation that could rewrite generated files was run in a disposable copy.

Project scope after retirement: Three.js Web game only (`app.html`, `backrooms.html`, `src/`).

## Outcome

- Direct Web dependencies to keep: `three`, `vite`.
- Direct deprecated-tool dependencies to remove: `scratch-vm`, `jszip`.
- `scratch-render` is not a direct dependency; it will disappear with the `scratch-vm` dependency graph.
- Static dependency-graph simulation estimates that removing `scratch-vm` eliminates about 177 installed package entries and 138 MiB from the current `node_modules`; removing `jszip` eliminates about 13 more entries and 1.7 MiB. Actual installed size varies by npm version and deduplication.
- The browser source and built JavaScript do not import `scratch-vm`, `scratch-render`, or `jszip`.

## Proposed cleanup

| ID | Status | File or dependency | Evidence | Expected result | Risk |
|---|---|---|---|---|---|
| RET-001 | REMOVED | Remove direct dependency `scratch-vm` | Imported only by `scripts/check-vm.mjs` and `scripts/test-load.mjs`; no Web source import | Removed the critical `scratch-render` / `hull.js` / `immutable` / `uuid` audit chain and most deprecated-tool packages | low |
| RET-002 | REMOVED | Remove direct dependency `jszip` | Imported only by SB3 generation/inspection/verification scripts | Removed the remaining SB3 archive tool graph; no Web runtime effect | low |
| RET-003 | REMOVED | Delete six SB3-only scripts | Every script read, generated, validated, inspected, or loaded `dist/app.sb3` | Removed 403 LOC / 11,684 bytes of retired tooling | low |
| RET-004 | REMOVED | Delete `extensions/backrooms3d.js` | Standalone TurboWarp extension, not imported by the Web game | Removed 598 tracked lines / 20,031 bytes | low given confirmed product retirement |
| RET-005 | APPLIED | Remove TurboWarp/SB3 sections from `README.md` | Documentation advertised two active product lines | Prevents users from following retired instructions | low |

The five candidates form one causal retirement batch and were proved together.

## Proof results

Before application, candidate-scoped files were verified identical to `HEAD`, so the removal proof used two fresh copies of that commit. After application, a fresh disposable copy of the current working tree installed and built successfully without writing generated artifacts back into the real working tree.

| Check | Untouched HEAD baseline | Retirement candidate |
|---|---:|---:|
| Installed packages reported by `npm ci` | 231 | 16 |
| Full npm audit | 10 vulnerabilities: 2 moderate, 5 high, 3 critical | 2 high: `postcss`, `nanoid` |
| Production npm audit | 8 vulnerabilities | 0 |
| `npm run check` | passed | passed |
| `npm run build` | passed | passed |
| Standalone build ID | `62ecba821c7a` | `62ecba821c7a` |
| `backrooms.html` SHA-256 | `7F76BAA21241FA53E42A47A21C10E406461728F1B98AB9A72A54C470FE60C171` | identical |
| `dist/app.html` SHA-256 | `17E23DF6E4492C3D614C55460AEB71CE5344C6D12146C6BD9B5922FE16097F12` | identical |
| `node_modules` disk size | 211.56 MiB | 70.68 MiB |

The removal saved 140.88 MiB in the disposable installation and left the generated Web artifacts byte-identical.

## Post-application verification

- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Full `npm audit`: only 2 high-severity build-tool findings remain (`postcss`, `nanoid` under Vite); both are outside the removed production dependency graph.
- Fresh install in the current-worktree disposable copy: 16 packages, 70.68 MiB.
- Production build in the disposable copy: passed; 165 modules transformed and standalone build `ef99868bf2a5` generated.
- Retired-reference scan across active source, scripts, package manifests, README, and generated disposable artifacts: clean.
- Encoding, material quality, platform collision, and item ground-shadow checks: passed.
- The aggregate `npm run check` now passes in the combined working tree. An earlier run stopped in the separately modified `scripts/check-content-expansion.mjs` because a new Level 11 target constant was referenced under the wrong name; that independent issue has since been corrected and does not affect the retirement proof.
- The real workspace's first `npm ci` could not unlink the Rolldown native binding because the project's existing Vite dev server is using it. The server was left running. `npm ls --depth=0` confirms the required `three` and `vite` packages are present, and the retired `scratch-vm`, `scratch-render`, and `jszip` directories are absent. npm left a 22.38 MiB hidden Rolldown backup directory while that native module remains locked; fresh installs are unaffected and reach the verified 70.68 MiB size.

## Exact file scope

Delete:

- `extensions/backrooms3d.js`
- `scripts/check-vm.mjs`
- `scripts/generate-sb3.mjs`
- `scripts/inspect.mjs`
- `scripts/test-load.mjs`
- `scripts/validate-sb3.mjs`
- `scripts/verify-sb3.mjs`

Edit:

- `package.json`: remove `scratch-vm` and `jszip`
- `package-lock.json`: regenerate after dependency removal
- `README.md`: change the product description to Three.js Web only; remove the extension tree entry, TurboWarp instructions, and Scratch/TurboWarp technology bullets

Generated artifact:

- `dist/app.sb3` is currently absent. `dist/` is ignored, so there is no tracked generated SB3 artifact to delete.

## Files and dependencies to keep

| Item | Reason |
|---|---|
| `three` | Imported throughout the WebGL game runtime |
| `vite` | Required by development, production build, preview, and the new CI workflow |
| `scripts/make-standalone.mjs` | Builds the supported standalone Web artifact |
| `scripts/bake-fps-arms.mjs` | Generates the Web game's first-person arm geometry |
| `src/map-preview.js` / `map-preview.html` | Development map tool for the Three.js levels, unrelated to TurboWarp |
| Existing check scripts | Used by `npm run check` and CI |

## Expected security result

- The eight production-classified findings from the Scratch tool chain should disappear.
- `npm audit --omit=dev` should then have no findings because the remaining runtime dependency is `three`, which currently has no npm audit advisory.
- Full `npm audit` may still report the two Vite/PostCSS/Nanoid build-tool findings until Vite and the lockfile are upgraded separately.

## Reproduction commands

Run the exact retirement batch in a disposable copy, then execute:

```text
npm ci
npm audit --omit=dev
npm audit
npm run check
npm run build
```

The Web build must still generate `dist/app.html` and `backrooms.html`, and the final bundle must contain no references to removed Scratch/TurboWarp packages or files.

## Residual risk

The main residual risk is documentation or an external workflow depending on the old SB3 generator outside this repository. The user has confirmed the test line is deprecated, and no current package script, Web source import, CI step, or tracked deployment configuration invokes it.
