import scratchParser from 'scratch-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const data = fs.readFileSync(path.join(ROOT, 'dist', 'app.sb3'));

scratchParser(data, false, (err, res) => {
  if (err) {
    console.error('VALIDATION FAILED');
    console.error(JSON.stringify(err, null, 2));
    process.exit(1);
  } else {
    console.log('VALIDATION OK');
    console.log('Targets:', res[0].targets.length);
    console.log('Extensions:', res[0].extensions);
    console.log('Stage blocks:', Object.keys(res[0].targets[0].blocks).length);
  }
});
