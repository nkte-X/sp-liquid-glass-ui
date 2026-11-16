// Release helper: builds the ZIP, prints its SHA-256 and the entry for the
// Super Productivity community listing (src/assets/community-plugins.json).
// Publishing (tag, GitHub release, listing PR) stays a manual, explicit step.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/nkte-X/sp-liquid-glass-ui';

execSync('npm run smoke', { cwd: root, stdio: 'inherit' });
execSync('node scripts/build-plugin.js', { cwd: root, stdio: 'inherit' });

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/manifest.json'), 'utf8'));
if (!/^\d+(\.\d+)*$/.test(manifest.version)) {
  throw new Error(`version must be numeric for the listing: ${manifest.version}`);
}
const zipName = `${manifest.id}-${manifest.version}.zip`;
const zip = fs.readFileSync(path.join(root, zipName));
if (zip.length > 10 * 1024 * 1024) throw new Error('ZIP exceeds the 10 MB listing limit');
const sha256 = crypto.createHash('sha256').update(zip).digest('hex');

const entry = {
  name: manifest.name,
  shortDescription:
    'Liquid Glass look in light and dark mode for Mac, iPhone and more: bundled theme, wallpapers, accent colour, floating tab bar and scroll edge effect. Requires Super Productivity 20.0.0.',
  url: REPO,
  author: manifest.author,
  authorUrl: 'https://github.com/nkte-X',
  id: manifest.id,
  release: {
    version: manifest.version,
    downloadUrl: `${REPO}/releases/download/v${manifest.version}/${zipName}`,
    sha256,
  },
};

console.log(`\n${zipName}  ${(zip.length / 1024).toFixed(1)} KB\nsha256  ${sha256}\n`);
console.log('Next (manual):');
console.log(`  git tag v${manifest.version} && git push origin v${manifest.version}`);
console.log(`  gh release create v${manifest.version} plugin/${zipName} --title "v${manifest.version}"`);
console.log('  then add / bump this entry in super-productivity src/assets/community-plugins.json:\n');
console.log(JSON.stringify(entry, null, 2));
