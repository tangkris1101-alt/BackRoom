# External Model Assets

- `fps-arms-para.fbx`: "fps arms (rigged only)" by para, downloaded from OpenGameArt. Licensed under CC0.
  Source: https://opengameart.org/content/fps-arms-rigged-only
- `fps-arm-para-baked.bin` / `fps-arm-para-right-baked.bin` and their `.b64` copies: generated from `fps-arms-para.fbx` with `npm run bake:arms`. Left and right hands are baked separately with distinct relaxed poses, smooth normals, clean glove colour variation, and a per-vertex roughness signal. The game runtime imports the base64 files only, keeping the full FBX parser out of the shipped scene.
