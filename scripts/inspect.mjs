import JSZip from 'jszip';
import fs from 'node:fs';

const zip = await JSZip.loadAsync(fs.readFileSync('dist/app.sb3'));
const p = JSON.parse(await zip.file('project.json').async('string'));
const ext = p.extensions[0];
const b64 = ext.split('base64,')[1];
const src = Buffer.from(b64, 'base64').toString('utf-8');
console.log('First 600 chars of decoded extension:');
console.log(src.slice(0, 600));
console.log('\n--- Extracted blocks in project.json ---');
const stage = p.targets[0];
for (const [id, b] of Object.entries(stage.blocks)) {
  console.log(id, '=>', b.opcode, b.topLevel ? '[topLevel]' : '', b.fields ? JSON.stringify(b.fields) : '');
}
