const fs = require("fs");

const path = "src/scene/common/world-items.js";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(oldStr, newStr, label) {
  const variants = [oldStr, oldStr.replace(/\n/g, "\r\n")];
  for (const variant of variants) {
    if (text.includes(variant)) {
      const usedCrlf = variant.includes("\r\n");
      const replacement = usedCrlf ? newStr.replace(/\n/g, "\r\n") : newStr;
      text = text.replace(variant, replacement);
      console.log(`ok: ${label}`);
      return;
    }
  }
  throw new Error(`not found: ${label}`);
}

// 1. 便签更薄：0.025 -> 0.008，字迹贴合面同步下移
replaceOnce(
  `  } else if (definition.shape === "note") {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.34), material));
    const inkedFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.455, 0.315),
      createNoteFaceMaterial(definition.color),
    );
    inkedFace.rotation.x = -Math.PI / 2;
    inkedFace.position.y = 0.014;`,
  `  } else if (definition.shape === "note") {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.008, 0.34), material));
    const inkedFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.455, 0.315),
      createNoteFaceMaterial(definition.color),
    );
    inkedFace.rotation.x = -Math.PI / 2;
    inkedFace.position.y = 0.0055;`,
  "thinner note geometry",
);

// 2. 便签贴地偏移随厚度下调（badge 保持原值）
replaceOnce(
  `    if (shape === "note" || shape === "badge") return 0.022;`,
  `    if (shape === "note") return 0.01;
    if (shape === "badge") return 0.022;`,
  "note floor offset",
);

// 3. 丢弃倾斜角减小，避免薄纸边角戳进地面
replaceOnce(
  `      tiltX: flat ? 0.05 : 0,
      tiltZ: flat ? -0.035 : 0,`,
  `      tiltX: flat ? 0.035 : 0,
      tiltZ: flat ? -0.025 : 0,`,
  "drop tilt",
);

// 4. 纸面加污渍、杯印、泛黄边缘、脏点
replaceOnce(
  "  context.fillStyle = `#${color.toString(16).padStart(6, \"0\")}`;\n  context.fillRect(0, 0, canvas.width, canvas.height);",
  `  context.fillStyle = \`#\${color.toString(16).padStart(6, "0")}\`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const stain = (x, y, radius, alpha) => {
    const gradient = context.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    gradient.addColorStop(0, \`rgba(112, 86, 48, \${alpha})\`);
    gradient.addColorStop(1, "rgba(112, 86, 48, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  stain(58, 188, 52, 0.2);
  stain(282, 34, 44, 0.16);
  stain(298, 190, 60, 0.14);
  context.strokeStyle = "rgba(96, 70, 38, 0.18)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(250, 162, 26, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "rgba(104, 80, 44, 0.22)";
  context.lineWidth = 10;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = "rgba(80, 62, 36, 0.26)";
  for (let i = 0; i < 90; i += 1) {
    context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.4, 1.4);
  }`,
  "stains and dirt",
);

// 5. 左下角撕破损缺，用 alphaTest 镂空
replaceOnce(
  `  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 });`,
  `  context.restore();

  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.moveTo(0, 224);
  context.lineTo(0, 178);
  context.lineTo(9, 186);
  context.lineTo(17, 176);
  context.lineTo(26, 188);
  context.lineTo(34, 181);
  context.lineTo(46, 196);
  context.lineTo(41, 208);
  context.lineTo(52, 224);
  context.closePath();
  context.fill();
  context.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, alphaTest: 0.5 });`,
  "torn corner",
);

fs.writeFileSync(path, text);
console.log("done");
