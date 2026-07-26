# Level 5 external texture assets

These files are prepared for the Level 5 material split. They are **not wired into runtime code yet**.

All files below were downloaded at 1K JPG from Poly Haven and verified against the MD5 value supplied by the Poly Haven API. Poly Haven assets are CC0; attribution is not required, but is retained here for provenance.

| Folder | Intended use | Asset | Source | Files |
| --- | --- | --- | --- | --- |
| `dark-wood` | Main Hall walnut/mahogany floor and furniture accents | Dark Wood | https://polyhaven.com/a/dark_wood | `diffuse.jpg`, `normal.jpg`, `roughness.jpg` |
| `marble-01` | Main Hall clean marble floor patches | Marble 01 | https://polyhaven.com/a/marble_01 | `diffuse.jpg`, `normal.jpg`, `roughness.jpg` |
| `rusty-metal-05` | Boiler Room walls, machinery panels, and pipe props | Rusty Metal 05 | https://polyhaven.com/a/rusty_metal_05 | `diffuse.jpg`, `normal.jpg`, `roughness.jpg` |

## Integration constraints

- Use `nor_gl` as the normal map source (WebGL/OpenGL orientation).
- Keep the 1K variants for the standalone build and mobile texture budget.
- Retain the existing procedural red-and-gold carpet and wallpaper for hotel areas; they better match the Level 5 description than a generic stock carpet or distressed wallpaper.
- Do not use the official Level 5 reference photographs as in-game textures. They are visual references with separate CC-BY credits, not these CC0 runtime assets.
