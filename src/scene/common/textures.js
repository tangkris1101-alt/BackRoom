import { makeTexture } from "./texture-utils.js";
export function createWallpaperTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Flat mono-yellow base 鈥?the documented "iconic" Level 0 wall yellow.
      context.fillStyle = "#c8b46b";
      context.fillRect(0, 0, size, size);

      // Faint vertical wallpaper seams (where strips of paper meet).
      for (let x = 0; x <= size; x += 64) {
        context.fillStyle = "rgba(150,134,62,0.14)";
        context.fillRect(x - 1, 0, 2, size);
        context.fillStyle = "rgba(222,208,128,0.10)";
        context.fillRect(x + 2, 0, 1, size);
      }

      // Very subtle diamond damask motif, barely visible like the real paper.
      context.strokeStyle = "rgba(150,135,66,0.08)";
      context.lineWidth = 1.5;
      const step = 64;
      for (let y = -step; y < size + step; y += step) {
        for (let x = -step; x < size + step; x += step) {
          context.beginPath();
          context.moveTo(x + step / 2, y);
          context.lineTo(x + step, y + step / 2);
          context.lineTo(x + step / 2, y + step);
          context.lineTo(x, y + step / 2);
          context.closePath();
          context.stroke();
        }
      }

      // Damp staining drifting up from the baseboard.
      const damp = context.createLinearGradient(0, size, 0, size * 0.55);
      damp.addColorStop(0, "rgba(96,84,40,0.22)");
      damp.addColorStop(1, "rgba(96,84,40,0)");
      context.fillStyle = damp;
      context.fillRect(0, size * 0.55, size, size * 0.45);

      // Aged grime and a few lighter bleached flecks.
      drawSpeckles(context, size, 300, 0.1, "84,72,30");
      drawSpeckles(context, size, 60, 0.1, "190,172,98");
    },
    1.5,
    1.15,
  );
}

export function createCarpetTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Moist olive-yellow carpet 鈥?same family as the walls but darker/greener.
      context.fillStyle = "#9f9048";
      context.fillRect(0, 0, size, size);

      // Soft mottled damp patches so the floor looks moist and uneven.
      for (let i = 0; i < 46; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 64 + 26;
        const dark = Math.random() > 0.5;
        const grd = context.createRadialGradient(x, y, 0, x, y, radius);
        grd.addColorStop(0, dark ? "rgba(64,56,26,0.16)" : "rgba(198,178,96,0.12)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = grd;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      // Very faint directional pile lines (low-pile commercial carpet).
      for (let y = 0; y < size; y += 6) {
        context.fillStyle = "rgba(60,52,24,0.05)";
        context.fillRect(0, y, size, 2);
      }

      // Fine fibre grain.
      drawSpeckles(context, size, 2600, 0.1, "44,38,18");
      drawSpeckles(context, size, 1200, 0.07, "206,186,102");
    },
    12,
    12,
  );
}

export function createCeilingTexture() {
  return makeTexture(
    512,
    (context, size) => {
      // Pale goldenrod-cream acoustic tile (documented Level 0 ceiling tone).
      context.fillStyle = "#d4cfa5";
      context.fillRect(0, 0, size, size);

      // Slight inward shading so each tile reads as a recessed panel.
      const shade = context.createLinearGradient(0, 0, size, size);
      shade.addColorStop(0, "rgba(255,250,224,0.10)");
      shade.addColorStop(1, "rgba(96,92,64,0.12)");
      context.fillStyle = shade;
      context.fillRect(0, 0, size, size);

      // The metal T-bar grid framing each tile.
      context.strokeStyle = "rgba(58,56,40,0.42)";
      context.lineWidth = 7;
      context.strokeRect(0, 0, size, size);

      // Pin-hole acoustic speckle.
      drawSpeckles(context, size, 1600, 0.1, "104,100,72");
      drawSpeckles(context, size, 280, 0.06, "238,232,198");
    },
    21,
    19,
  );
}

export function createSignTexture(label, background, foreground) {
  return makeTexture(
    512,
    (context, size) => {
      context.fillStyle = background;
      context.fillRect(0, 0, size, size * 0.42);
      context.fillStyle = foreground;
      context.font = "bold 136px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, size / 2, size * 0.21);
      context.strokeStyle = "rgba(0,0,0,0.34)";
      context.lineWidth = 10;
      context.strokeRect(6, 6, size - 12, size * 0.42 - 12);
    },
    1,
    1,
  );
}
export function createWideSignTexture(label, background, foreground) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 410;
  const context = canvas.getContext("2d");

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  const maxTextWidth = canvas.width * 0.82;
  let fontSize = 220;
  do {
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    fontSize -= 8;
  } while (context.measureText(label).width > maxTextWidth && fontSize > 78);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 8);
  context.strokeStyle = "rgba(0,0,0,0.24)";
  context.lineWidth = 20;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 6;
  return texture;
}
