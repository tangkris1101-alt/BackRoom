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
  `  context.font = "italic 600 20px \\"Segoe Print\\", \\"Comic Sans MS\\", cursive";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.save();
  context.translate(160, 118);
  context.rotate(-0.03);
  context.fillText("if you're reading this,", -138, -48);
  context.fillText("don't stop. keep moving.", -138, -12);
  context.fillText("the hum is not the lights.", -138, 24);
  context.font = "italic 600 18px \\"Segoe Print\\", \\"Comic Sans MS\\", cursive";
  context.fillText("- R.", 62, 58);
  context.restore();`,
  "note face text resize",
);

fs.writeFileSync(path, text);
console.log("done");
