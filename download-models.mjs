#!/usr/bin/env node
// Downloads the CC-BY Sketchfab models listed in config.js into assets/models/<key>/.
//   SKETCHFAB_TOKEN=xxxx node download-models.mjs [key ...]
// Get a token at https://sketchfab.com/settings/password  (API token). Downloads need a
// logged-in account – that's why this can't be done without one.
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const token = process.env.SKETCHFAB_TOKEN;
if (!token) { console.error('Set SKETCHFAB_TOKEN (https://sketchfab.com/settings/password → API token).'); process.exit(1); }

// evaluate config.js in a tiny sandbox
const win = {}; new Function('window', readFileSync('config.js', 'utf8'))(win);
const models = win.PANDAL_CONFIG.models || {};
const only = process.argv.slice(2);

for (const [key, cfg] of Object.entries(models)) {
  if (only.length && !only.includes(key)) continue;
  if (!cfg.uid) continue;
  const dir = join('assets/models', key);
  if (existsSync(join(dir, 'model.glb')) || existsSync(join(dir, 'scene.gltf'))) { console.log(`✓ ${key} already present`); continue; }
  process.stdout.write(`↓ ${key} (${cfg.uid}) … `);
  const info = await (await fetch(`https://api.sketchfab.com/v3/models/${cfg.uid}`)).json();
  if (!info.isDownloadable) { console.log(`skipped – not downloadable (buy/download manually into ${dir}/)`); continue; }
  const r = await fetch(`https://api.sketchfab.com/v3/models/${cfg.uid}/download`, { headers: { Authorization: `Token ${token}` } });
  if (!r.ok) { console.log(`failed (${r.status} ${await r.text()})`); continue; }
  const links = await r.json();
  const url = (links.gltf || links.glb || {}).url;
  if (!url) { console.log('no glTF link in response'); continue; }
  mkdirSync(dir, { recursive: true });
  const zip = join(dir, 'model.zip');
  writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  execSync(`unzip -o -q "${zip}" -d "${dir}"`);
  rmSync(zip);
  // some archives nest the files one level down
  if (!existsSync(join(dir, 'scene.gltf'))) {
    const sub = readdirSync(dir).find(f => existsSync(join(dir, f, 'scene.gltf')));
    if (sub) for (const f of readdirSync(join(dir, sub))) renameSync(join(dir, sub, f), join(dir, f));
  }
  const lic = info.license ? `${info.license.label}` : 'unknown';
  console.log(`done – "${info.name}" by ${info.user.username} (${lic}, ${info.faceCount.toLocaleString()} faces)`);
}
console.log('\nModels land in assets/models/<key>/scene.gltf. Now compress them (config points at model.glb):\n  npx @gltf-transform/cli optimize assets/models/<key>/scene.gltf assets/models/<key>/model.glb --compress draco --texture-compress webp --texture-size 1024 --simplify-ratio 0.5 --no-flatten');
