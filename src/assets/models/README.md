# External Model Assets

- `fps-arms-para.fbx`: "fps arms (rigged only)" by para, downloaded from OpenGameArt. Licensed under CC0.
  Source: https://opengameart.org/content/fps-arms-rigged-only
- `fps-arm-para-baked.bin` / `fps-arm-para-right-baked.bin` and their `.b64` copies: the grip poses, generated from `fps-arms-para.fbx` with `npm run bake:arms`. Left and right hands are baked separately with smooth normals, clean glove colour variation, and a per-vertex roughness signal. The game runtime imports the `.b64` copies only, keeping the full FBX parser out of the shipped scene.
- `fps-arm-para-relaxed-baked.bin` / `fps-arm-para-right-relaxed-baked.bin`: the relaxed (empty-handed) poses for the same rig, written by the same command. The runtime fetches them through `?url`, so Vite emits them as separate assets and the single-file standalone build inlines them.
- `fps-arm-anchors.json`: grip and palm anchors per pose and side (grip/empty x left/right), exported by `npm run bake:arms` and read by the runtime and by `npm run check:hands`.
