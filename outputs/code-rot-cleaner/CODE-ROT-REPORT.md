# Code Rot Report

> **REPORT READY** — The real project was not changed.

Project: `C:\Users\Administrator\Desktop\work`
Generated: `2026-08-10T16:46:29Z`

## Executive summary

| Result | Candidates | LOC | Size |
|---|---:|---:|---:|
| SAFE TO REMOVE | 0 | 0 | 0 B |
| REVIEW | 63 | 4 | 240 B |
| KEEP | 13 | 2,753 | 94.5 KB |

## Ranked candidates

| ID | Status | Category | Subject | Confidence | Risk | LOC | Proof |
|---|---|---|---|---|---|---:|---|
| CRT-001 | **KEEP** | orphan-file | `extensions/backrooms3d.js` | medium | medium | 598 | TurboWarp extension entry point referenced by README and scripts/generate-sb3.mjs. |
| CRT-002 | **KEEP** | orphan-file | `src/map-preview.js` | medium | medium | 1667 | Development map preview entry point loaded directly by map-preview.html. |
| CRT-003 | **KEEP** | orphan-file | `src/scene/items/firesalt.js` | medium | medium | 206 | Re-exported by src/scene/items/index.js and used by the game item system. |
| CRT-004 | **KEEP** | orphan-file | `src/scene/level-five/textures.js` | medium | medium | 190 | Imported by the playable Level 5 scene. |
| CRT-005 | **KEEP** | orphan-file | `src/scene/level-one/textures.js` | medium | medium | 83 | Imported by the playable Level 1 scene. |
| CRT-006 | **KEEP** | orphan-file | `src/scene/level-seven/layout.js` | medium | medium | 161 | Imported by the playable Level 7 scene and the development map preview. |
| CRT-007 | **KEEP** | orphan-file | `src/scene/level-seven/textures.js` | medium | medium | 107 | Imported by the playable Level 7 scene. |
| CRT-008 | **KEEP** | orphan-file | `src/scene/level-six/textures.js` | medium | medium | 103 | Imported by the playable Level 6 scene. |
| CRT-009 | **KEEP** | orphan-file | `src/scene/level-thirty-seven/textures.js` | medium | medium | 50 | Imported by the playable Level 37 scene. |
| CRT-010 | **KEEP** | orphan-file | `src/scene/level-three/props.js` | medium | medium | 670 | Imported by the playable Level 3 scene. |
| CRT-011 | **KEEP** | orphan-file | `src/scene/level-two/layout.js` | medium | medium | 439 | Imported by the playable Level 2 scene and the development map preview. |
| CRT-012 | **KEEP** | orphan-file | `src/scene/level-two/textures.js` | medium | medium | 149 | Imported by the playable Level 2 scene. |
| CRT-013 | **KEEP** | orphan-file | `src/ui/level-danger.js` | medium | medium | 22 | Imported by src/main.js for level danger UI state. |
| CRT-014 | **REVIEW** | unused-export | `ALLOW_QUERY_DEBUG from src/debug-mode.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-015 | **REVIEW** | unused-export | `createPickupSnapshot from src/save.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-016 | **REVIEW** | unused-export | `snapEntityPosition from src/scene/common/snap.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-017 | **REVIEW** | unused-export | `snapEntityState from src/scene/common/snap.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-018 | **REVIEW** | unused-export | `tileHash from src/scene/common/texture-utils.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-019 | **REVIEW** | unused-export | `createCarpetTexture from src/scene/common/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-020 | **REVIEW** | unused-export | `createCeilingTexture from src/scene/common/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-021 | **REVIEW** | unused-export | `createSignTexture from src/scene/common/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-022 | **REVIEW** | unused-export | `createWallpaperTexture from src/scene/common/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-023 | **REVIEW** | unused-export | `LEVEL_KEY_TARGETS from src/scene/common/world-items.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-024 | **REVIEW** | unused-export | `COMPASS_INSPECT_DISTANCE from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-025 | **REVIEW** | unused-export | `COMPASS_PICKUP_RADIUS from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-026 | **REVIEW** | unused-export | `COMPASS_RESPAWN_MIN from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-027 | **REVIEW** | unused-export | `COMPASS_RESPAWN_VARIANCE from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-028 | **REVIEW** | unused-export | `MAX_POINT_LIGHTS from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-029 | **REVIEW** | unused-export | `MIN_FIXTURE_DISTANCE from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-030 | **REVIEW** | unused-export | `isPlayableLevel from src/scene/constants.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-031 | **REVIEW** | unused-export | `createLevelEightFloorTexture from src/scene/level-eight/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-032 | **REVIEW** | unused-export | `createLevelEightWallTexture from src/scene/level-eight/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-033 | **REVIEW** | unused-export | `LEVEL_ELEVEN_ORIGIN_X from src/scene/level-eleven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-034 | **REVIEW** | unused-export | `LEVEL_ELEVEN_ORIGIN_Z from src/scene/level-eleven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-035 | **REVIEW** | unused-export | `LEVEL_FIVE_EXIT_TRIGGER_RADIUS from src/scene/level-five/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-036 | **REVIEW** | unused-export | `getLevelFiveTargetMount from src/scene/level-five/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-037 | **REVIEW** | unused-export | `isInAnyLevelFiveZone from src/scene/level-five/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-038 | **REVIEW** | unused-export | `addLevelFiveExitDoor from src/scene/level-five/props.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-039 | **REVIEW** | unused-export | `createLevelFiveBoilerWallTexture from src/scene/level-five/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-040 | **REVIEW** | unused-export | `addLevelFourStairDoor from src/scene/level-four/props.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-041 | **REVIEW** | unused-export | `LEVEL_NINE_MAP from src/scene/level-nine/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-042 | **REVIEW** | unused-export | `LEVEL_NINE_ORIGIN_X from src/scene/level-nine/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-043 | **REVIEW** | unused-export | `LEVEL_NINE_ORIGIN_Z from src/scene/level-nine/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-044 | **REVIEW** | unused-export | `LEVEL_NINE_ROADS from src/scene/level-nine/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-045 | **REVIEW** | unused-export | `LEVEL_ONE_EXIT_TRIGGER_RADIUS from src/scene/level-one/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-046 | **REVIEW** | unused-export | `createLevelOneLayout from src/scene/level-one/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-047 | **REVIEW** | unused-export | `addLevelOneElevator from src/scene/level-one/props.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-048 | **REVIEW** | unused-export | `createLevelOneConcreteTexture from src/scene/level-one/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-049 | **REVIEW** | unused-export | `CELL_PLATFORM from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-050 | **REVIEW** | unused-export | `CELL_ROOM from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-051 | **REVIEW** | unused-export | `CELL_WATER from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-052 | **REVIEW** | unused-export | `LEVEL_SEVEN_EXIT_TRIGGER_RADIUS from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-053 | **REVIEW** | unused-export | `LEVEL_SEVEN_MAP from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-054 | **REVIEW** | unused-export | `LEVEL_SEVEN_ORIGIN_X from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-055 | **REVIEW** | unused-export | `LEVEL_SEVEN_ORIGIN_Z from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-056 | **REVIEW** | unused-export | `countLevelSevenOpenNeighbors from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-057 | **REVIEW** | unused-export | `levelSevenCellType from src/scene/level-seven/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-058 | **REVIEW** | unused-export | `CELL_VOID from src/scene/level-six/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-059 | **REVIEW** | unused-export | `LEVEL_SIX_EXIT_TRIGGER_RADIUS from src/scene/level-six/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-060 | **REVIEW** | unused-export | `LEVEL_SIX_MAP from src/scene/level-six/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-061 | **REVIEW** | unused-export | `countLevelSixOpenNeighbors from src/scene/level-six/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-062 | **REVIEW** | unused-export | `levelSixCellType from src/scene/level-six/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-063 | **REVIEW** | unused-export | `LEVEL_TEN_ORIGIN_X from src/scene/level-ten/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-064 | **REVIEW** | unused-export | `LEVEL_TEN_ORIGIN_Z from src/scene/level-ten/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-065 | **REVIEW** | unused-export | `isLevelTenRoadCell from src/scene/level-ten/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-066 | **REVIEW** | unused-export | `LEVEL_THREE_EXIT_TRIGGER_RADIUS from src/scene/level-three/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-067 | **REVIEW** | unused-export | `createLevelThreeLayout from src/scene/level-three/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-068 | **REVIEW** | unused-export | `addLevelThreeBreakerDoor from src/scene/level-three/props.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-069 | **REVIEW** | unused-export | `LEVEL_TWO_EXIT_TRIGGER_RADIUS from src/scene/level-two/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-070 | **REVIEW** | unused-export | `levelTwoCellMeta from src/scene/level-two/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-071 | **REVIEW** | unused-export | `addLevelTwoServiceDoor from src/scene/level-two/props.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-072 | **REVIEW** | unused-export | `createLevelTwoGrimyTexture from src/scene/level-two/textures.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-073 | **REVIEW** | unused-export | `MANILA_ROOM_ENTRANCE from src/scene/level-zero/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-074 | **REVIEW** | unused-export | `createLayout from src/scene/level-zero/layout.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-075 | **REVIEW** | unused-export | `getExitMount from src/scene/level-zero/world.js` | medium | medium | 0 | Not proven in a disposable copy. |
| CRT-076 | **REVIEW** | commented-code | `Comment block in src/scene/level-two/index.js` | low | medium | 4 | Not proven in a disposable copy. |

## Evidence by candidate

### CRT-001 — KEEP

- Location: `extensions/backrooms3d.js`
- Category: `orphan-file`
- Potential size: 598 LOC / 19.6 KB
- Status reason: TurboWarp extension entry point referenced by README and scripts/generate-sb3.mjs.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: backrooms3d, backrooms3d.js, extensions/backrooms3d, extensions/backrooms3d.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-002 — KEEP

- Location: `src/map-preview.js`
- Category: `orphan-file`
- Potential size: 1,667 LOC / 58.4 KB
- Status reason: Development map preview entry point loaded directly by map-preview.html.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: map-preview, map-preview.js, src/map-preview, src/map-preview.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-003 — KEEP

- Location: `src/scene/items/firesalt.js`
- Category: `orphan-file`
- Potential size: 206 LOC / 7.4 KB
- Status reason: Re-exported by src/scene/items/index.js and used by the game item system.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: firesalt, firesalt.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-004 — KEEP

- Location: `src/scene/level-five/textures.js`
- Category: `orphan-file`
- Potential size: 190 LOC / 6.8 KB
- Status reason: Imported by the playable Level 5 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: src/scene/level-five/textures, src/scene/level-five/textures.js, textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-005 — KEEP

- Location: `src/scene/level-one/textures.js`
- Category: `orphan-file`
- Potential size: 83 LOC / 3.3 KB
- Status reason: Imported by the playable Level 1 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-006 — KEEP

- Location: `src/scene/level-seven/layout.js`
- Category: `orphan-file`
- Potential size: 161 LOC / 4.7 KB
- Status reason: Imported by the playable Level 7 scene and the development map preview.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: layout, layout.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-007 — KEEP

- Location: `src/scene/level-seven/textures.js`
- Category: `orphan-file`
- Potential size: 107 LOC / 3.2 KB
- Status reason: Imported by the playable Level 7 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-008 — KEEP

- Location: `src/scene/level-six/textures.js`
- Category: `orphan-file`
- Potential size: 103 LOC / 3.0 KB
- Status reason: Imported by the playable Level 6 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-009 — KEEP

- Location: `src/scene/level-thirty-seven/textures.js`
- Category: `orphan-file`
- Potential size: 50 LOC / 2.3 KB
- Status reason: Imported by the playable Level 37 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-010 — KEEP

- Location: `src/scene/level-three/props.js`
- Category: `orphan-file`
- Potential size: 670 LOC / 21.0 KB
- Status reason: Imported by the playable Level 3 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: props, props.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-011 — KEEP

- Location: `src/scene/level-two/layout.js`
- Category: `orphan-file`
- Potential size: 439 LOC / 14.2 KB
- Status reason: Imported by the playable Level 2 scene and the development map preview.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: layout, layout.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-012 — KEEP

- Location: `src/scene/level-two/textures.js`
- Category: `orphan-file`
- Potential size: 149 LOC / 5.1 KB
- Status reason: Imported by the playable Level 2 scene.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: textures, textures.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-013 — KEEP

- Location: `src/ui/level-danger.js`
- Category: `orphan-file`
- Potential size: 22 LOC / 719 B
- Status reason: Imported by src/main.js for level danger UI state.
- Evidence: No resolved static inbound import was found. The file is not a detected package or conventional entry point. Repository text contains possible string/name references: level-danger, level-danger.js.
- Caveats: Dynamic loading, reflection, external consumers, or incomplete framework detection can hide reachability. Possible string reachability prevents high-confidence deletion.

### CRT-014 — REVIEW

- Location: `src/debug-mode.js:5`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-015 — REVIEW

- Location: `src/save.js:325`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-016 — REVIEW

- Location: `src/scene/common/snap.js:3`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-017 — REVIEW

- Location: `src/scene/common/snap.js:29`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-018 — REVIEW

- Location: `src/scene/common/texture-utils.js:42`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-019 — REVIEW

- Location: `src/scene/common/textures.js:51`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-020 — REVIEW

- Location: `src/scene/common/textures.js:89`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-021 — REVIEW

- Location: `src/scene/common/textures.js:118`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-022 — REVIEW

- Location: `src/scene/common/textures.js:3`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-023 — REVIEW

- Location: `src/scene/common/world-items.js:17`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-024 — REVIEW

- Location: `src/scene/constants.js:29`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-025 — REVIEW

- Location: `src/scene/constants.js:28`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-026 — REVIEW

- Location: `src/scene/constants.js:30`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-027 — REVIEW

- Location: `src/scene/constants.js:31`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-028 — REVIEW

- Location: `src/scene/constants.js:6`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-029 — REVIEW

- Location: `src/scene/constants.js:7`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-030 — REVIEW

- Location: `src/scene/constants.js:99`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-031 — REVIEW

- Location: `src/scene/level-eight/textures.js:24`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-032 — REVIEW

- Location: `src/scene/level-eight/textures.js:25`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-033 — REVIEW

- Location: `src/scene/level-eleven/layout.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-034 — REVIEW

- Location: `src/scene/level-eleven/layout.js:9`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-035 — REVIEW

- Location: `src/scene/level-five/layout.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-036 — REVIEW

- Location: `src/scene/level-five/layout.js:164`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-037 — REVIEW

- Location: `src/scene/level-five/layout.js:151`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-038 — REVIEW

- Location: `src/scene/level-five/props.js:220`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-039 — REVIEW

- Location: `src/scene/level-five/textures.js:161`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-040 — REVIEW

- Location: `src/scene/level-four/props.js:6`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-041 — REVIEW

- Location: `src/scene/level-nine/layout.js:40`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-042 — REVIEW

- Location: `src/scene/level-nine/layout.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-043 — REVIEW

- Location: `src/scene/level-nine/layout.js:9`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-044 — REVIEW

- Location: `src/scene/level-nine/layout.js:41`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-045 — REVIEW

- Location: `src/scene/level-one/layout.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-046 — REVIEW

- Location: `src/scene/level-one/layout.js:39`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-047 — REVIEW

- Location: `src/scene/level-one/props.js:158`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-048 — REVIEW

- Location: `src/scene/level-one/textures.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-049 — REVIEW

- Location: `src/scene/level-seven/layout.js:12`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-050 — REVIEW

- Location: `src/scene/level-seven/layout.js:10`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-051 — REVIEW

- Location: `src/scene/level-seven/layout.js:11`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-052 — REVIEW

- Location: `src/scene/level-seven/layout.js:7`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-053 — REVIEW

- Location: `src/scene/level-seven/layout.js:87`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-054 — REVIEW

- Location: `src/scene/level-seven/layout.js:88`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-055 — REVIEW

- Location: `src/scene/level-seven/layout.js:89`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-056 — REVIEW

- Location: `src/scene/level-seven/layout.js:105`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-057 — REVIEW

- Location: `src/scene/level-seven/layout.js:95`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-058 — REVIEW

- Location: `src/scene/level-six/layout.js:13`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-059 — REVIEW

- Location: `src/scene/level-six/layout.js:9`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-060 — REVIEW

- Location: `src/scene/level-six/layout.js:96`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-061 — REVIEW

- Location: `src/scene/level-six/layout.js:111`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-062 — REVIEW

- Location: `src/scene/level-six/layout.js:106`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-063 — REVIEW

- Location: `src/scene/level-ten/layout.js:7`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-064 — REVIEW

- Location: `src/scene/level-ten/layout.js:8`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-065 — REVIEW

- Location: `src/scene/level-ten/layout.js:14`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-066 — REVIEW

- Location: `src/scene/level-three/layout.js:9`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-067 — REVIEW

- Location: `src/scene/level-three/layout.js:40`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-068 — REVIEW

- Location: `src/scene/level-three/props.js:120`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-069 — REVIEW

- Location: `src/scene/level-two/layout.js:7`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-070 — REVIEW

- Location: `src/scene/level-two/layout.js:217`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-071 — REVIEW

- Location: `src/scene/level-two/props.js:462`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-072 — REVIEW

- Location: `src/scene/level-two/textures.js:3`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-073 — REVIEW

- Location: `src/scene/level-zero/layout.js:7`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-074 — REVIEW

- Location: `src/scene/level-zero/layout.js:9`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-075 — REVIEW

- Location: `src/scene/level-zero/world.js:199`
- Category: `unused-export`
- Potential size: 0 LOC / 0 B
- Status reason: Not proven in a disposable copy.
- Evidence: No reference to the exported symbol was found outside its defining file.
- Caveats: Public APIs, re-export patterns, generated declarations, templates, or external consumers may use it.

### CRT-076 — REVIEW

- Location: `src/scene/level-two/index.js:381`
- Category: `commented-code`
- Potential size: 4 LOC / 240 B
- Status reason: Not proven in a disposable copy.
- Evidence: A block of four or more code-like line comments was found.
- Caveats: The block may be documentation, an example, a protocol, or an intentional workaround.

## Cleanup approval checklist

No cleanup has been applied. To continue, select exact candidate IDs and review their paths, evidence, proof, and residual risk. Manifest or lockfile changes require separate explicit approval.

```text
Approved candidate IDs: ____________________
Approved files / manifest entries: __________
Approved verification commands: _____________
```

## Scope and limitations

- Scanned 110 source files, 29,171 LOC, 1.0 MB.
- Static analysis cannot prove absence of dynamic, reflective, operational, platform-specific, or external use.
- JavaScript/TypeScript and Python import resolution is intentionally conservative and does not implement every alias or framework convention.
- Unused dependencies and exports are leads only until project-native tooling and focused proof support removal.
- No project code, package command, or dependency was executed by this scanner.
