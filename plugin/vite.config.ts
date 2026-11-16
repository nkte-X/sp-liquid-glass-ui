import fs from 'node:fs';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { superProductivityPlugin } from './tools/sp-vite-plugin';

const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [solidPlugin(), superProductivityPlugin()],
  define: {
    __LGX_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    // plugin.js runs inside `new Function` in the host: keep the syntax
    // conservative and the output readable for debugging on device.
    target: 'es2020',
    minify: false,
    modulePreload: false,
  },
});
