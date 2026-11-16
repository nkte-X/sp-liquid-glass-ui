// Build and zip only the files the host loads. Vite leaves index.js/index.css
// next to the inlined index.html; they are not served to the iframe, so they
// are left out of the archive.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const FILES = ['manifest.json', 'plugin.js', 'index.html', 'icon.svg'];

execSync('npm run build', { cwd: root, stdio: 'inherit' });

const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
// <id>-<version>.zip: the name the community listing's downloadUrl uses
const outName = `${manifest.id}-${manifest.version}.zip`;
const out = fs.createWriteStream(path.join(root, outName));
const archive = archiver('zip', { zlib: { level: 9 } });

out.on('close', () => {
  console.log(`✔ ${outName} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
});
archive.on('error', (err) => {
  throw err;
});
archive.pipe(out);

for (const name of FILES) {
  const file = path.join(dist, name);
  if (!fs.existsSync(file)) throw new Error(`dist/${name} missing`);
  archive.file(file, { name });
}

await archive.finalize();
