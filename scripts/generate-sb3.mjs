import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const extPath = path.join(ROOT, 'extensions', 'backrooms3d.js');
const extSource = fs.readFileSync(extPath, 'utf-8');
const extBase64 = Buffer.from(extSource).toString('base64');
const extDataUrl = `data:application/javascript;base64,${extBase64}`;

// Allow override via env var or fallback to file:// for desktop / local server
// - LOAD_MODE=embedded  -> base64 data URL (only works in unsandboxed contexts)
// - LOAD_MODE=file      -> file:// URL (works in TurboWarp desktop)
// - LOAD_MODE=local-http -> http://localhost:PORT/extensions/backrooms3d.js
const loadMode = process.env.LOAD_MODE || 'file';
let extRef;
if (loadMode === 'embedded') {
  extRef = extDataUrl;
} else if (loadMode === 'local-http') {
  const port = process.env.PORT || '8080';
  extRef = `http://localhost:${port}/extensions/backrooms3d.js`;
} else {
  // file:// URL — must be opened from a path that matches the user's actual location
  // Users can edit this URL to point to wherever they saved backrooms3d.js
  const fileUrl = process.env.EXT_FILE_URL
    || `file:///${extPath.replace(/\\/g, '/')}`;
  extRef = fileUrl;
}

const emptyPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000165a4e4b40000000049454e44ae426082',
  'hex',
);
const emptyPngBase64 = emptyPng.toString('base64');

const INPUT_SAME_BLOCK_SHADOW = 1;
const INPUT_BLOCK_NO_SHADOW = 2;
const INPUT_DIFF_BLOCK_SHADOW = 3;
const MATH_NUM_PRIMITIVE = 4;

const VAR_DISTANCE = 'var_distance';
const VAR_SIGNAL = 'var_signal';
const VAR_FLICKER = 'var_flicker';
const VAR_LOCK = 'var_lock';

let counter = 0;
function nextId() {
  counter += 1;
  return 'B' + String(counter).padStart(8, '0');
}

const blocks = {};
function add(id, def) {
  blocks[id] = def;
  return id;
}
function link(prevId, nextId) {
  blocks[prevId].next = nextId;
  if (nextId) blocks[nextId].parent = prevId;
}
const ext = (name) => `backrooms3d_${name}`;

const flagId = add(nextId(), {
  opcode: 'event_whenflagclicked',
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: true,
  x: 80,
  y: 60,
});

const initId = add(nextId(), {
  opcode: ext('init'),
  next: null,
  parent: flagId,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
link(flagId, initId);

const foreverId = add(nextId(), {
  opcode: 'control_forever',
  next: null,
  parent: initId,
  inputs: { SUBSTACK: [INPUT_BLOCK_NO_SHADOW, null] },
  fields: {},
  shadow: false,
  topLevel: false,
});
link(initId, foreverId);

const updateId = add(nextId(), {
  opcode: ext('update'),
  next: null,
  parent: foreverId,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});

const distRepId = add(nextId(), {
  opcode: ext('distanceToExit'),
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
const setDistId = add(nextId(), {
  opcode: 'data_setvariableto',
  next: null,
  parent: updateId,
  inputs: { VALUE: [INPUT_BLOCK_NO_SHADOW, distRepId] },
  fields: { VARIABLE: [VAR_DISTANCE, VAR_DISTANCE] },
  shadow: false,
  topLevel: false,
});
link(updateId, setDistId);

const sigRepId = add(nextId(), {
  opcode: ext('signalFound'),
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
const setSigId = add(nextId(), {
  opcode: 'data_setvariableto',
  next: null,
  parent: setDistId,
  inputs: { VALUE: [INPUT_BLOCK_NO_SHADOW, sigRepId] },
  fields: { VARIABLE: [VAR_SIGNAL, VAR_SIGNAL] },
  shadow: false,
  topLevel: false,
});
link(setDistId, setSigId);

const flkRepId = add(nextId(), {
  opcode: ext('flickerValue'),
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
const setFlkId = add(nextId(), {
  opcode: 'data_setvariableto',
  next: null,
  parent: setSigId,
  inputs: { VALUE: [INPUT_BLOCK_NO_SHADOW, flkRepId] },
  fields: { VARIABLE: [VAR_FLICKER, VAR_FLICKER] },
  shadow: false,
  topLevel: false,
});
link(setSigId, setFlkId);

const lockRepId = add(nextId(), {
  opcode: ext('isPointerLocked'),
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
const setLockId = add(nextId(), {
  opcode: 'data_setvariableto',
  next: null,
  parent: setFlkId,
  inputs: { VALUE: [INPUT_BLOCK_NO_SHADOW, lockRepId] },
  fields: { VARIABLE: [VAR_LOCK, VAR_LOCK] },
  shadow: false,
  topLevel: false,
});
link(setFlkId, setLockId);

const waitId = add(nextId(), {
  opcode: 'control_wait',
  next: null,
  parent: setLockId,
  inputs: { DURATION: [INPUT_SAME_BLOCK_SHADOW, [MATH_NUM_PRIMITIVE, 0.02]] },
  fields: {},
  shadow: false,
  topLevel: false,
});
link(setLockId, waitId);

blocks[foreverId].inputs.SUBSTACK = [INPUT_BLOCK_NO_SHADOW, updateId];

const keyLId = add(nextId(), {
  opcode: 'event_whenkeypressed',
  next: null,
  parent: null,
  inputs: {},
  fields: { KEY_OPTION: ['l'] },
  shadow: false,
  topLevel: true,
  x: 80,
  y: 360,
});
const reqLockId = add(nextId(), {
  opcode: ext('requestPointerLock'),
  next: null,
  parent: keyLId,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
});
link(keyLId, reqLockId);

const variables = {
  [VAR_DISTANCE]: ['distance', 0],
  [VAR_SIGNAL]: ['signal', 0],
  [VAR_FLICKER]: ['flicker', 0],
  [VAR_LOCK]: ['lock', 0],
};

const monitors = [
  {
    id: VAR_DISTANCE,
    opcode: 'data_variable',
    params: { VARIABLE: 'distance' },
    mode: 'default',
    spriteName: null,
    isSpriteSpecific: false,
    x: 10,
    y: 10,
    width: 110,
    height: 24,
    visible: true,
    value: 0,
  },
  {
    id: VAR_SIGNAL,
    opcode: 'data_variable',
    params: { VARIABLE: 'signal' },
    mode: 'default',
    spriteName: null,
    isSpriteSpecific: false,
    x: 10,
    y: 38,
    width: 110,
    height: 24,
    visible: true,
    value: 0,
  },
  {
    id: VAR_FLICKER,
    opcode: 'data_variable',
    params: { VARIABLE: 'flicker' },
    mode: 'default',
    spriteName: null,
    isSpriteSpecific: false,
    x: 10,
    y: 66,
    width: 110,
    height: 24,
    visible: true,
    value: 0,
  },
  {
    id: VAR_LOCK,
    opcode: 'data_variable',
    params: { VARIABLE: 'lock' },
    mode: 'default',
    spriteName: null,
    isSpriteSpecific: false,
    x: 10,
    y: 94,
    width: 110,
    height: 24,
    visible: true,
    value: 0,
  },
];

const stage = {
  isStage: true,
  name: 'Stage',
  variables,
  lists: {},
  broadcasts: {},
  blocks,
  comments: {},
  currentCostume: 0,
  costumes: [
    {
      name: 'backdrop1',
      dataFormat: 'png',
      assetId: '00000000000000000000000000000000',
      md5ext: '00000000000000000000000000000000.png',
      rotationCenterX: 0,
      rotationCenterY: 0,
      bitmapResolution: 1,
    },
  ],
  sounds: [],
  volume: 100,
  layerOrder: 0,
  tempo: 60,
  videoTransparency: 50,
  videoState: 'on',
  textToSpeechLanguage: null,
};

const project = {
  targets: [stage],
  monitors,
  extensions: [`tw:custom-extensions[${extRef}]`],
  meta: {
    semver: '3.0.0',
    vm: '0.2.0',
    agent: 'opencode',
  },
};

const zip = new JSZip();
zip.file('project.json', JSON.stringify(project));
zip.file('00000000000000000000000000000000.png', emptyPng);
const out = await zip.generateAsync({ type: 'nodebuffer' });
const outPath = path.join(ROOT, 'dist', 'app.sb3');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

console.log('Generated:', outPath);
console.log('Size:', out.length, 'bytes');
console.log('Blocks:', Object.keys(blocks).length);
