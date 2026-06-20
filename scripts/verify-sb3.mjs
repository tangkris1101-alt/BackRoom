import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const sb3Path = path.join(ROOT, 'dist', 'app.sb3');
const data = fs.readFileSync(sb3Path);
const zip = await JSZip.loadAsync(data);

console.log('Files in sb3:');
for (const filename of Object.keys(zip.files)) {
  console.log(' -', filename);
}

const projectJson = await zip.file('project.json').async('string');
const project = JSON.parse(projectJson);

console.log('\nProject top-level keys:', Object.keys(project));
console.log('Targets:', project.targets.length, 'stage:', project.targets[0].isStage);
console.log('Stage blocks count:', Object.keys(project.targets[0].blocks).length);
console.log('Variables:', Object.entries(project.targets[0].variables).map(([id, v]) => v[0]).join(', '));
console.log('Monitors:', project.monitors.length);
console.log('Extensions:', project.extensions.length);
console.log('Extension preview:', project.extensions[0].slice(0, 100) + '...');
console.log('Extension total length:', project.extensions[0].length);
console.log('Meta:', project.meta);
