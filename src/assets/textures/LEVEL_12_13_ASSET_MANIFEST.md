# Level 12/13 texture asset manifest

All files are bundled locally and are never fetched at runtime. New source maps were downloaded at the official 1K JPEG size (`1024×1024`) and converted offline to `768×768` JPEG at quality 82. The nine new files total **770,630 bytes (0.735 MiB)**.

| Source asset | Author / provider | License | Source map | Target file | Target size | Bytes | SHA-256 | Runtime use |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
| [Beige Wall 001](https://polyhaven.com/a/beige_wall_001) | Dimitrios Savva; Rico Cilliers | CC0 | Diffuse 1K JPG | `level-twelve-thirteen/beige-wall-001/diffuse.jpg` | 768×768 | 13,171 | `274febeb8b951ebae15cf51ae1e20159ca1f64c09c1fa2601309f71c358ff934` | Level 12 white core walls and Level 13 corridor walls; high and low quality |
| Beige Wall 001 | Dimitrios Savva; Rico Cilliers | CC0 | NormalGL 1K JPG | `level-twelve-thirteen/beige-wall-001/normal.jpg` | 768×768 | 52,849 | `309adbfe5b5c382b17739696b4613181660de93c14c448da741d82b0c27bd3a4` | High quality only |
| Beige Wall 001 | Dimitrios Savva; Rico Cilliers | CC0 | ARM 1K JPG | `level-twelve-thirteen/beige-wall-001/arm.jpg` | 768×768 | 32,000 | `2db7efb8fa86c9b4dad020b4138693a7d1336ad96fc54ed924fdfd2bc6a68191` | High quality only |
| [Carpet 011](https://ambientcg.com/view?id=Carpet011) | ambientCG | CC0 1.0 | NormalGL 1K JPG | `level-twelve-thirteen/carpet-011/normal.jpg` | 768×768 | 230,899 | `11757c85c317e7f537e2465bd28a44979fdad5fe0c0728f4b236620bb238ff5d` | Level 13 carpet fibre normal; high quality only |
| Carpet 011 | ambientCG | CC0 1.0 | Roughness 1K JPG | `level-twelve-thirteen/carpet-011/roughness.jpg` | 768×768 | 80,971 | `4a881be1919b33d9c88e1a12a54747345b6f246899990d4fb3e8799c7d04075c` | High quality only |
| Carpet 011 | ambientCG | CC0 1.0 | AO 1K JPG | `level-twelve-thirteen/carpet-011/ao.jpg` | 768×768 | 230,125 | `b328f7a642c8f004936da462ede90e2dbd6ea0a622bb8bd20d25edd239da0fbc` | High quality only; brown geometric color pattern is generated locally with CanvasTexture |
| [Laminate Floor 03](https://polyhaven.com/a/laminate_floor_03) | Charlotte Baglioni; Dario Barresi | CC0 | Diffuse 1K JPG | `level-twelve-thirteen/laminate-floor-03/diffuse.jpg` | 768×768 | 79,001 | `573e7ddc6d04b9d3cb5d773f2ff95613e86cee1a5ad496212813b91600e3253b` | Level 13 apartment floors; high and low quality |
| Laminate Floor 03 | Charlotte Baglioni; Dario Barresi | CC0 | NormalGL 1K JPG | `level-twelve-thirteen/laminate-floor-03/normal.jpg` | 768×768 | 18,467 | `886f3ba6675e897cbce4fc1f1126a323afda8bfda6712aae4c2403430e077046` | High quality only |
| Laminate Floor 03 | Charlotte Baglioni; Dario Barresi | CC0 | ARM 1K JPG | `level-twelve-thirteen/laminate-floor-03/arm.jpg` | 768×768 | 33,147 | `99831ab78f7f25170d45196c9c7bb33bdeb339f41c16e020b33ce1fa7146a659` | High quality only |

## Existing asset newly integrated

`Level 13` now uses the existing [Rusty Metal 05](https://polyhaven.com/a/rusty_metal_05) maps by Amal Kumar (CC0) for the maintenance-room pipe exit. These files remain unchanged at `1024×1024`:

| Target file | Bytes | SHA-256 |
| --- | ---: | --- |
| `level-five/rusty-metal-05/diffuse.jpg` | 815,155 | `c48e9064ef1a1a1f745c605669adfac9391980c31a68f4f06808a2ab25aeaca8` |
| `level-five/rusty-metal-05/normal.jpg` | 594,099 | `065502cb4ab8f403ac59b42c081a0833277842f71032d692d387f8b3ee21ae97` |
| `level-five/rusty-metal-05/roughness.jpg` | 430,648 | `8b68979e2e2a75fedb366564db09873346895853bc70b0e441757900457c68bf` |

Door numbers, monochrome test bars, carpet color motifs, television noise, blue windows, stains, furniture, lights, Faceling geometry, elevators, and cabinets are original programmatic/local low-poly assets and require no external files. Backrooms Wiki images were visual references only and are not included.
