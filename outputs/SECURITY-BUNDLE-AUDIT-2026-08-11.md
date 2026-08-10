# Security and Bundle Audit

> **REPORT READY** — No project source, manifest, lockfile, dependency, or generated build was changed by this audit.

Project: `C:\Users\Administrator\Desktop\work`
Audit date: 2026-08-11 (Asia/Shanghai)

## Scope and working-tree caveat

- Inspected the current package manifest and lockfile, dependency graph, source imports, Vite configuration, existing `dist/` output, and standalone HTML.
- Ran read-only npm registry audit and version queries.
- The worktree contains substantial pre-existing modified and untracked Level 10/11 work. Those files were preserved and no build was rerun during this audit.
- Existing `dist/` is ignored output and is used only as a size snapshot, not as proof that the current dirty worktree builds.

## Security result

`npm audit` reports 10 vulnerable packages: 2 moderate, 5 high, and 3 critical.
`npm audit --omit=dev` reports 8: 2 moderate, 3 high, and 3 critical.

### Dependency groups

| Group | Findings | Runtime reachability | Impact assessment |
|---|---:|---|---|
| `scratch-vm` tool chain | 8 production-classified findings | Used only by local TurboWarp/SB3 scripts; no import from `src/` and no matching library signature in the browser bundle | Low for the deployed static game; moderate for developer tooling; higher only if untrusted SB3/SVG/project data is loaded |
| Vite/PostCSS tool chain | `postcss`, `nanoid` | Build time only | Low for trusted repository input; update recommended |
| `three` | 0 findings | Browser runtime | No npm audit finding |
| `jszip` | 0 direct findings | TurboWarp/SB3 scripts only | No direct npm audit finding |

The three critical aggregate entries come from `scratch-vm -> scratch-render -> hull.js` and the vulnerable `immutable`/`uuid` versions required by `scratch-vm`. The installed `scratch-vm@5.0.300` is also the current published version and npm reports no automatic fix for this critical chain.

The local scripts load the repository's fixed `dist/app.sb3`; they do not currently accept an arbitrary input path. That significantly limits exploitability in the current workflow, but these tools should not process untrusted SB3/SVG data.

### Fixable items

- The current Vite is `8.0.16`; the registry reports `8.2.1`. The newer release depends on a patched PostCSS range.
- npm reports fixes available for `brace-expansion`, `dompurify`, `nanoid`, `postcss`, and `undici` through dependency/lock updates.
- npm reports no automatic fix for the `scratch-vm`, `scratch-render`, `hull.js`, `immutable`, and `uuid` aggregate chain.

## Bundle result

### Existing output snapshot

| Output | Size |
|---|---:|
| Hosted payload excluding duplicate standalone pages | 16.25 MiB |
| Binary assets | 14.65 MiB |
| Main JavaScript | 1.50 MiB raw / about 372.6 KiB gzip |
| Standalone `backrooms.html` | 21.13 MiB |

The standalone file is large mainly because 14.65 MiB of images/audio are Base64-inlined, which adds roughly one third before HTML/JavaScript overhead.

### Largest asset groups

| Asset group | Source size |
|---|---:|
| Level 5 jazz audio | 3.02 MiB |
| Level 5 textures | 3.84 MiB |
| Rock027 textures | 2.05 MiB |
| Long white tile textures | 2.15 MiB |
| Level 10 textures | 1.04 MiB |
| Level 11 textures | 1.75 MiB |

These are active content assets, not proven dead files. Removing them would visibly degrade or remove intended level content.

### Main JavaScript causes

1. `vite.config.js` deliberately sets `inlineDynamicImports: true`. All dynamically loaded level modules are collapsed into one production JavaScript file so the standalone generator can inline one script.
2. `fps-arm-para-baked.bin.b64?raw` embeds a 573.2 KiB Base64 geometry string directly in JavaScript. It is about 105.6 KiB gzip. The equivalent binary is 429.9 KiB raw / 91.5 KiB gzip.
3. Three.js itself is substantial: its packaged minified module is about 356.4 KiB raw / 84.4 KiB gzip before application-specific tree shaking.
4. The current source contains roughly 989 KiB of JavaScript, including about 661 KiB of scene code across many playable levels.

## Candidate decisions

| ID | Status | Candidate | Expected benefit | Main risk |
|---|---|---|---|---|
| SEC-01 | REVIEW | Update Vite and compatible lockfile dependencies | Remove the fixable Vite/PostCSS/Nanoid findings | Requires clean install, checks, build, and browser smoke test |
| SEC-02 | REVIEW | Move `jszip` and `scratch-vm` from runtime dependencies to dev dependencies, or isolate TurboWarp tools into a separate package | Correct production audit scope; isolation reduces normal web-build install surface | Server/CI must still install dev dependencies to build |
| SEC-03 | REVIEW | Apply compatible transitive audit fixes in a disposable copy | May remove `brace-expansion`, `dompurify`, and `undici` findings | Could alter the old Scratch tool chain and needs SB3 validation |
| SEC-04 | KEEP | Keep `scratch-vm` and `jszip` while TurboWarp remains a documented product line | Preserves SB3 generation and validation | Critical audit chain remains in developer tooling |
| BND-01 | REVIEW | Load the baked arm `.bin` as an emitted asset instead of a raw Base64 JavaScript string | Approximately 573 KiB less JavaScript parse payload; modest gzip improvement | Requires asynchronous/preloaded geometry handling and standalone MIME support |
| BND-02 | REVIEW | Produce a code-split hosted build and a separate single-file standalone build | Smaller initial hosted JavaScript and real per-level lazy loading | Build pipeline becomes more complex; standalone behavior must remain intact |
| BND-03 | REVIEW | Re-encode the 3.02 MiB jazz MP3 and selectively optimize PBR textures | Largest direct reduction in hosted and standalone bytes | Audio/visual quality loss requires foreground review |
| CRT files | KEEP | Scanner's 13 apparent orphan files | None | All were confirmed as HTML, TurboWarp, item-registry, UI, or playable-level entries |

No candidate is classified **SAFE TO REMOVE**. Static analysis found 62 possible unused exports, but removing only export modifiers is unlikely to reduce the production bundle because the bundler already tree-shakes unused exports. They remain review-only.

## Recommended order

1. Prove `SEC-01` and compatible parts of `SEC-03` in a disposable copy.
2. Move or isolate the TurboWarp tool dependencies (`SEC-02`) without deleting the product line.
3. Measure a source-map/visualizer build, then prototype `BND-01` in a disposable copy.
4. Consider `BND-02` only if hosted first-load performance is a priority; keep the standalone artifact as a separate deliverable.
5. Optimize audio/textures only after visual and audio comparison.

## Proposed proof commands

These commands have not been run in this audit because they execute package-manager/project code. Run them only in a disposable copy:

```text
npm install --package-lock-only --ignore-scripts
npm audit
npm run check
npm run build
```

For bundle composition, create a disposable source-map build and analyze module contributions without writing into the real worktree.
