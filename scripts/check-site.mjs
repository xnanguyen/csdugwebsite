import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from 'node:url';
import { launchWarnings, readConfig, renderSite } from './site-config.mjs';

const root = new URL('../', import.meta.url);
process.chdir(fileURLToPath(root));

const requiredFiles = [
  "index.html",
  "README.md",
  "package.json",
  "netlify.toml",
  "vercel.json",
  "robots.txt",
  "site.webmanifest",
  "assets/images/csdug-logo.svg",
  "assets/images/social-preview.svg",
  "assets/data/site-content.json",
  "docs/content-checklist.md",
  "docs/asset-notices.md",
  "assets/js/tetris-engine.LICENSE.txt",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml"
];

let failures = 0;

for (const file of requiredFiles) {
  try {
    await stat(file);
    console.log(`ok ${file}`);
  } catch {
    failures += 1;
    console.error(`missing ${file}`);
  }
}

const source = await readFile("index.html", "utf8");
const config = await readConfig(root);
const html = renderSite(source, config);
const localLinks = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(link => !link.startsWith("#"))
  .filter(link => !link.startsWith("mailto:"))
  .filter(link => !link.startsWith("http"))
  .filter(link => !link.startsWith("data:"));

const socialImage = html.match(/property="og:image"\s+content="([^"]+)"/);
if (socialImage && !socialImage[1].startsWith('https://')) {
  localLinks.push(socialImage[1]);
}

// Includes URLs used by CSS backgrounds, canvas image loading, and member photos.
for (const match of source.matchAll(/["'](assets\/[^"'\s]+)["']/g)) localLinks.push(match[1]);
const manifest = JSON.parse(await readFile('site.webmanifest', 'utf8'));
localLinks.push(...manifest.icons.map(icon => icon.src));
if (manifest.start_url !== './' || manifest.scope !== './') {
  failures++;
  console.error('Manifest must use relative paths for GitHub project Pages.');
}
for (const link of new Set(localLinks)) {
  try {
    if (!link.startsWith('assets/') && !['site.webmanifest'].includes(link)) throw new Error('unexpected local link');
    let parent = '.';
    for (const part of link.split('/')) {
      if (!(await readdir(parent)).includes(part)) throw new Error('missing or wrong filename case');
      parent += `/${part}`;
    }
    if (!(await stat(link)).isFile()) throw new Error('not a file');
    console.log(`ok linked asset ${link}`);
  } catch {
    failures += 1;
    console.error(`broken linked asset ${link}`);
  }
}

for (const match of html.matchAll(/href="#([^"]*)"/g)) {
  if (!match[1] || !html.includes(`id="${match[1]}"`)) {
    failures++; console.error(`Broken section link: #${match[1]}`);
  }
}
if (/(?:file:\/\/|\/Users\/|https?:\/\/(?:localhost|127\.0\.0\.1))/.test(source)) {
  failures++; console.error('Machine-local path found in the website.');
}
async function checkAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) { failures++; console.error(`Asset must be a real local file, not a symlink: ${path}`); }
    else if (entry.isDirectory()) await checkAssets(path);
    else if (entry.name.endsWith('.js')) {
      const js = await readFile(path, 'utf8');
      for (const match of js.matchAll(/["'](assets\/[^"'\s]+)["']/g)) {
        try { await stat(match[1]); } catch { failures++; console.error(`Missing JS asset: ${match[1]}`); }
      }
    }
  }
}
await checkAssets('assets');
const warnings = launchWarnings(config, source);
if (process.argv.includes('--launch')) {
  for (const warning of warnings) console.error(`launch: ${warning}`);
  failures += warnings.length;
} else if (warnings.length) console.warn(`${warnings.length} launch items remain. Run npm run check:launch for details.`);

if (failures > 0) {
  console.error(`site check failed with ${failures} issue(s)`);
  process.exit(1);
}

console.log("site check passed");
