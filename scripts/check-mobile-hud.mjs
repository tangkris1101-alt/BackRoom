import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Mobile HUD regressions are invisible from Node: the layout is CSS, and the
// pick-up button is wired through DOM listeners. These checks pin the few
// structural facts that the phone layout depends on, so a later edit cannot
// quietly put the item description back over the crosshair or drop the health
// meter out of the row it has to line up with.

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const text = await readFile(new URL("../src/ui/text.js", import.meta.url), "utf8");

// 1. Every mobile meter rule has to include the health meter, or its bar starts
// at a different x from the stamina bar's. The desktop template below only
// covers the meters that carry a readout column, so the scan is scoped to the
// touch-layout blocks.
function mediaBlocks(css, needle) {
  const blocks = [];
  let index = css.indexOf(needle);
  while (index !== -1) {
    const open = css.indexOf("{", index);
    let depth = 0;
    let cursor = open;
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === "{") depth += 1;
      else if (css[cursor] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.push(css.slice(open + 1, cursor));
    index = css.indexOf(needle, cursor);
  }
  return blocks;
}

const touchBlocks = mediaBlocks(styles, "@media (pointer: coarse)");
assert.ok(touchBlocks.length >= 2, "the touch-layout media queries are present");
let meterRuleCount = 0;
for (const block of touchBlocks) {
  for (const [, selectorRest, body] of block.matchAll(/\.stamina-meter,([^{]*)\{([^}]*)\}/g)) {
    meterRuleCount += 1;
    const selector = `.stamina-meter,${selectorRest}`;
    assert.ok(
      selector.includes(".health-meter"),
      `a meter rule reshapes the stamina bar without the health bar: ${selector.replace(/\s+/g, " ").trim()}`,
    );
    assert.match(body, /grid-template-columns:/, "every meter rule sets the shared column template");
  }
}
assert.ok(meterRuleCount >= 2, "both touch-layout meter rules are still there");

// 1b. The desktop rules have to agree too: `auto` on its own sizes each label
// column to its own word, which pushed the health bar a few pixels sideways
// (STAMINA and HEALTH differ by more than 体力 and 生命 do).
const sharedMeters = styles.match(/\.stamina-meter,\s*\n\.health-meter \{\s*\n\s*grid-template-columns:\s*([^;]+);/);
assert.ok(sharedMeters, "the two left-column meters no longer share one column template");
const sharedTemplate = sharedMeters[1].trim();
const healthMeterRule = styles.match(/\.health-meter \{[^}]*grid-template-columns:\s*([^;]+);/);
assert.ok(healthMeterRule, "the health meter has no column template of its own");
assert.equal(
  healthMeterRule[1].trim(),
  sharedTemplate,
  "the health meter uses a different column template from the stamina meter",
);
assert.ok(
  !/^auto\s/.test(sharedTemplate),
  "the label column is content-sized, so the two bars drift apart",
);

// 2. The fixed F button is shown on touch layouts, and its row position differs
// from the desktop-only default: it sat at the drop button's spot otherwise.
const useButtonMobile = styles.match(/\.use-button \{[^}]*\}/g) ?? [];
assert.ok(
  useButtonMobile.some((rule) => /display:\s*grid/.test(rule)),
  "the fixed F button is hidden on touch layouts",
);
assert.ok(
  /\.use-button \{[^}]*opacity:\s*0?\.\d/.test(styles),
  "the fixed F button has no dim idle state",
);
assert.match(
  styles,
  /@media \(orientation: landscape\)[^{]*\{[^@]*?\.use-button \{/,
  "the fixed F button keeps its portrait position in landscape",
);

// 3. The item card and the inventory bar stay off the middle of a phone screen.
assert.match(
  styles,
  /\.item-info \{[^}]*top:\s*max\(/,
  "the item card is not pinned to the top on touch layouts",
);
assert.ok(
  !/\.item-info \{[^}]*bottom:\s*max\(272px/.test(styles),
  "the item card is back at the 272px bottom offset that parked it mid-screen",
);
assert.match(
  styles,
  /\.inventory-bar\.is-visible \{[^}]*bottom:\s*max\(1[0-9]px/,
  "the inventory bar does not drop to the bottom strip in landscape",
);

// 4. The button and the on-screen prompts hand F to the sweep on touch layouts.
assert.match(
  main,
  /useButton\?\.addEventListener\("pointerdown",[\s\S]*?usePickup\(\{ grabAll: isTouchLayout\(\) \}\);/,
  "the fixed F button does not sweep what is in reach",
);
const promptWiring = main.match(/\[pickupPrompt, doorPrompt\]\.forEach[\s\S]*?\n\}\);/);
assert.ok(promptWiring, "the prompt taps are still wired");
assert.match(
  promptWiring[0],
  /usePickup\(\{ grabAll: isTouchLayout\(\) \}\)/,
  "the prompt taps do not sweep what is in reach",
);
assert.match(
  main,
  /const canUseInReach = isTouchLayout\(\)/,
  "the fixed F button does not light up for items that are merely in reach",
);
assert.match(
  main,
  /function grabEverythingInReach\(\)/,
  "the sweep helper is missing",
);
assert.equal(
  (main.match(/PICKUP_SWEEP_LIMIT/g) ?? []).length >= 3,
  true,
  "the sweep loop is not bounded",
);

// 5. The sweep reports itself in both languages, with the count in it.
const sweepEntries = [...text.matchAll(/pickupSweep: "([^"]*)"/g)].map(([, value]) => value);
assert.equal(sweepEntries.length, 2, "the sweep status text is missing from one language");
for (const value of sweepEntries) {
  assert.match(value, /\{count\}/, "the sweep message does not report how many items it took");
}

console.log("mobile HUD checks passed");
