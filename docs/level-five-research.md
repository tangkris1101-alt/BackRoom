# Level 5 (Terror Hotel) research and asset intake

Prepared: 2026-07-26

## Canon baseline

Primary reference: https://backrooms-wiki.wikidot.com/level-5

The page defines three accessible areas: the Main Hall, The Beverly Room (Eternal Ballroom), and The Boiler Room. The intended implementation baseline is:

- **Main Hall:** mahogany-red, gold-ornate wallpaper; a mix of dark walnut, white marble, and red/gold carpet; dense early-20th-century furniture; antique candle holders/electric lamps; irregular room-number placards; elevator shafts.
- **Beverly Room:** very spacious hub, many doors, a small fanciful central table with drinks and unfinished Mahjong, and a large chandelier.
- **Boiler Room:** old machinery, intertwined industrial pipes, valves, Almond Water leaks, heat, steam, boilers/furnaces, and maintenance elevators.

The wiki credits its three displayed photographs separately. They are useful composition references only and must not be copied into shipped game assets.

## Runtime asset decisions

| Need | Decision | Reason |
| --- | --- | --- |
| Red-and-gold carpet | Retain procedural texture | It is bespoke to the target palette and avoids a generic or visibly dirty stock carpet. |
| Gold-ornate wallpaper | Retain procedural texture; later add a low-frequency face/eye variation | The canon calls for ornate mahogany-red wallpaper, not peeling wallpaper. |
| Dark walnut / mahogany | Poly Haven Dark Wood, 1K JPG PBR | Direct visual match and CC0 license. |
| Clean marble | Poly Haven Marble 01, 1K JPG PBR | Gives a distinct clean surface while fitting the self-maintaining hotel. |
| Boiler metal | Poly Haven Rusty Metal 05, 1K JPG PBR | Separates Boiler Room from the hotel and gives machinery/panels material detail. |
| Smooth-jazz loop | `src/assets/audio/level-five-jazz-improv.mp3` | CC0 reference track selected for a low-volume, positional hotel music source. It is not imported by runtime code yet. |
| Machinery ambience | Procedural Web Audio | Existing audio system can synthesize hum, steam, drips, and distant chatter without adding another large binary asset. |
| Deathmoths | Procedural sprites/instancing, no external art | Keeps the standalone bundle compact and lets mobile use a lower swarm cap. |

## Acquisition record

Textures are stored in `src/assets/textures/level-five/`. Each material includes diffuse, OpenGL normal, and roughness maps, fetched directly from the Poly Haven API and MD5-verified.

Poly Haven license: https://polyhaven.com/license (CC0). Individual asset pages:

- https://polyhaven.com/a/dark_wood
- https://polyhaven.com/a/marble_01
- https://polyhaven.com/a/rusty_metal_05

The prepared jazz loop is `jazz improvisation looped` by Pro Sensory (Alex McCulloch), obtained from https://opengameart.org/content/jazz-improvisation-looped. The page labels it CC0 and asks that the author be credited. Downloaded file: `level-five-jazz-improv.mp3`, 3,168,468 bytes, SHA-256 `0e5cf555963479c60713a5640257fc6d65a272fad3a02113ab6a700e730ad447`.

## Implementation boundary

This intake does not modify Level 5 game code, map topology, audio behavior, or the standalone artifact. Before importing the prepared MP3, add the `audio/mpeg` MIME mapping to the standalone inliner (or transcode the CC0 source to OGG and use the existing OGG path). The next implementation step should import the three PBR sets into `src/scene/level-five/textures.js`, split floor/wall meshes by zone, and retain the existing point-light cap.
