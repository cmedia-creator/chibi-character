import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceDir = path.join(root, 'assets-src', 'rami-v1', 'runtime');
const outputDir = path.join(root, 'public', 'assets', 'rami-v1');
const outputFile = path.join(outputDir, 'rami-v1-atlas.webp');

const chunks = (await readdir(sourceDir))
  .filter((name) => /^atlas\.b64\.\d+$/.test(name))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

if (chunks.length === 0) {
  throw new Error('RAMI v1 atlas source chunks are missing.');
}

const base64 = (await Promise.all(
  chunks.map((name) => readFile(path.join(sourceDir, name), 'utf8')),
)).join('');
const bytes = Buffer.from(base64, 'base64');

if (bytes.length === 0 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF') {
  throw new Error('RAMI v1 atlas decode failed.');
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, bytes);
console.log(`Built RAMI v1 atlas: ${bytes.length} bytes from ${chunks.length} chunk(s).`);
