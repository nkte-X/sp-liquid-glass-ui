// The host runs plugin.js as the body of `new Function(...)` (see
// src/app/plugins/plugin-runner.ts in the app), so it must be a plain
// script: no import/export statements, no top-level await. Rollup emits
// imports as soon as plugin.ts shares a runtime module with the iframe UI.
// Compile it exactly the way the host does and fail the build if it can't.
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('dist/plugin.js');
const code = fs.readFileSync(file, 'utf8');

try {
  // Same parameter list and wrapper as PluginRunner._executePlugin. Only
  // compiled, never called.
  new Function(
    'plugin',
    'PluginAPI',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    `'use strict';\ntry {\n${code}\n} catch (error) { throw error; }`,
  );
} catch (e) {
  console.error(`✖ dist/plugin.js does not compile as a host plugin: ${e.message}`);
  console.error('  Likely an import/export or top-level await. Do not import runtime');
  console.error('  code from src/app/** into src/plugin.ts / src/host/**.');
  process.exit(1);
}

console.log(`✔ dist/plugin.js compiles as a host plugin (${(code.length / 1024).toFixed(1)} KB)`);
