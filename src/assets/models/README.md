# External Model Assets

- `fps-arms-para.fbx`: "fps arms (rigged only)" by para, downloaded from OpenGameArt. Licensed under CC0.
  Source: https://opengameart.org/content/fps-arms-rigged-only
- `fps-arm-para-baked.bin` and `fps-arm-para-baked.bin.b64`: generated from `fps-arms-para.fbx` with `npm run bake:arms`. The game runtime imports the baked base64 file only, keeping the full FBX parser out of the shipped scene.
