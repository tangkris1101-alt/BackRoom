import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import VM from 'scratch-vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const data = fs.readFileSync(path.join(ROOT, 'dist', 'app.sb3'));
const zip = await JSZip.loadAsync(data);
const project = JSON.parse(await zip.file('project.json').async('string'));

const vm = new VM();
try {
  await vm.loadProject(data);
  console.log('LOAD OK');
  console.log('Targets:', vm.runtime.targets.length);
  const stage = vm.runtime.getTargetForStage();
  console.log('Stage variables:', stage ? Object.keys(stage.variables).length : 0);
} catch (e) {
  console.error('LOAD FAILED type:', typeof e, 'val:', e);
  try { console.error('stringified:', JSON.stringify(e)); } catch (_) { console.error('cannot stringify'); }
  if (e && e.message) console.error('message:', e.message);
  if (e && e.stack) console.error('stack:', e.stack);
}
