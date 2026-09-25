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

replaceOnce(
  `"zh-CN": { name: "皱折便签", effect: "墨迹已经无法辨认", action: "F / 按钮拾取" },`,
  `"zh-CN": { name: "皱折便签", effect: "上面潦草地写着几句警告", action: "F / 按钮拾取" },`,
  "i18n zh-CN effect",
);

replaceOnce(
  `en: { name: "CRUMPLED NOTE", effect: "THE INK IS NO LONGER LEGIBLE", action: "F / BUTTON PICK UP" },`,
  `en: { name: "CRUMPLED NOTE", effect: "A HASTILY SCRAWLED WARNING", action: "F / BUTTON PICK UP" },`,
  "i18n en effect",
);

replaceOnce(
  `  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(54, 91);
  context.quadraticCurveTo(77, 77, 101, 89);
  context.quadraticCurveTo(119, 98, 140, 85);
  context.moveTo(51, 117);
  context.quadraticCurveTo(76, 104, 102, 116);
  context.quadraticCurveTo(120, 124, 147, 108);
  context.moveTo(182, 133);
  context.quadraticCurveTo(205, 112, 225, 129);
  context.quadraticCurveTo(242, 143, 266, 123);
  context.stroke();
  context.fillStyle = "rgba(37, 42, 68, 0.72)";
  context.font = "italic 22px serif";
  context.fillText("...keep moving", 164, 82);`,
  `  context.font = "italic 600 25px \\"Segoe Print\\", \\"Comic Sans MS\\", cursive";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.save();
  context.translate(160, 118);
  context.rotate(-0.03);
  context.fillText("if you're reading this,", -116, -44);
  context.fillText("don't stop. keep moving.", -124, -8);
  context.fillText("the hum is not the lights.", -108, 28);
  context.font = "italic 600 22px \\"Segoe Print\\", \\"Comic Sans MS\\", cursive";
  context.fillText("- R.", 78, 64);
  context.restore();`,
  "note face text",
);

replaceOnce(
  `  function getFloorOffset(shape) {
    if (shape === "token") return 0.028;
    if (shape === "note" || shape === "badge") return 0.022;
    if (shape === "file") return 0.028;
    return 0;
  }`,
  `  function getFloorOffset(shape) {
    if (shape === "token") return 0.028;
    if (shape === "note" || shape === "badge") return 0.022;
    if (shape === "file") return 0.028;
    if (shape === "key" || shape === "level-key") return 0.02;
    if (shape === "can") return 0.2;
    if (shape === "spool") return 0.26;
    if (shape === "shell") return 0.13;
    return 0;
  }`,
  "getFloorOffset",
);

replaceOnce(
  `  function drop(id, position, yaw = 0, data = null) {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    return addItem({
      id,
      active: true,
      position: { x: position.x + forwardX * 1.15, y: 0, z: position.z + forwardZ * 1.15 },
      rotation: yaw + Math.PI * 0.5,
      tiltX: 0.12,
      tiltZ: -0.08,
      data,
    });
  }`,
  `  function drop(id, position, yaw = 0, data = null) {
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const groundable = Boolean(DECORATIVE_ITEM_DEFS[id]) || isLevelKeyId(id);
    const shape = getItemDefinition(id).shape;
    const flat = shape === "note" || shape === "badge" || shape === "file" ||
      shape === "key" || shape === "level-key" || shape === "token";
    return addItem({
      id,
      active: true,
      grounded: groundable,
      position: { x: position.x + forwardX * 1.15, y: 0, z: position.z + forwardZ * 1.15 },
      rotation: yaw + Math.PI * 0.5,
      tiltX: flat ? 0.05 : 0,
      tiltZ: flat ? -0.035 : 0,
      data,
    });
  }`,
  "drop",
);

fs.writeFileSync(path, text);
console.log("done");
