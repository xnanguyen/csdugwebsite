import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSite, projectRoot } from './build-site.mjs';
import { createSiteServer } from './serve.mjs';
import { launchWarnings, readConfig, renderSite, validateConfig } from './site-config.mjs';

const config = await readConfig(projectRoot, '');
config.links.discord = '';
config.launchReview.eventDetailsConfirmed = false;
const source = await readFile(new URL('index.html', projectRoot), 'utf8');
const enabled = structuredClone(config);
enabled.siteUrl = 'https://example.test/cs-dug/';
enabled.links.instagram = 'https://example.test/community?a=1&b=2';
const rendered = renderSite(source, enabled);
assert(rendered.includes('href="https://example.test/community?a=1&amp;b=2"'));
assert(rendered.includes('<link rel="canonical" href="https://example.test/cs-dug/">'));
assert(!rendered.includes('href="#"'));
assert(rendered.includes('data-site-link="discord" aria-disabled="true"'));
assert(rendered.includes('(soon)'));
assert(launchWarnings(config, source).length > 0);
for (const value of ['javascript:alert(1)', 'http://example.test', 'file:///tmp/private', 'https://name:secret@example.test']) {
  const invalid = structuredClone(config);
  invalid.links.discord = value;
  assert.throws(() => validateConfig(invalid));
}
for (const value of ['https://example.test/#team', 'https://example.test/?key=secret']) {
  assert.throws(() => validateConfig({ ...config, siteUrl: value }));
}

const directory = await mkdtemp(join(tmpdir(), 'cs-dug-build-'));
const out = pathToFileURL(directory + '/');
let server;
try {
  await buildSite({ out, siteUrl: 'https://example.test/cs-dug/' });
  const output = await readFile(new URL('index.html', out), 'utf8');
  assert(output.includes('https://example.test/cs-dug/assets/images/social-preview.svg'));
  assert((await readFile(new URL('robots.txt', out), 'utf8')).includes('Sitemap: https://example.test/cs-dug/sitemap.xml'));
  assert((await readFile(new URL('sitemap.xml', out), 'utf8')).includes('<loc>https://example.test/cs-dug/</loc>'));
  assert(!(await readdir(out)).includes('scripts'), 'private tooling is not deployed');
  async function compareAssets(relative = 'assets/') {
    for (const entry of await readdir(new URL(relative, projectRoot), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const name = relative + entry.name;
      if (entry.isDirectory()) await compareAssets(name + '/');
      else assert.deepEqual(await readFile(new URL(name, out)), await readFile(new URL(name, projectRoot)), `asset copied intact: ${name}`);
    }
  }
  await compareAssets();
  for (const base of ['/', '/cs-dug/']) {
    server = await createSiteServer({ root: directory, base });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(origin + base);
    assert.equal(page.status, 200);
    const markup = await page.text();
    const assets = new Set([...markup.matchAll(/["'](assets\/[^"'\s]+)["']/g)].map(match => match[1]));
    for (const asset of assets) assert.equal((await fetch(origin + base + asset)).status, 200, asset);
    for (const path of ['missing.png', '.git/config', 'assets/%2e%2e%2fpackage.json', 'assets/%2fetc/passwd']) {
      assert.equal((await fetch(origin + base + path)).status, 404, path);
    }
    assert.equal((await fetch(origin + base, { method: 'POST' })).status, 405);
    const font = await fetch(origin + base + 'assets/fonts/ABCFavoritMono-Bold.otf', { method: 'HEAD' });
    assert.equal(font.headers.get('content-type'), 'font/otf');
    assert.equal((await font.text()).length, 0);
    const manifest = await (await fetch(origin + base + 'site.webmanifest')).json();
    assert.equal(new URL(manifest.start_url, origin + base).pathname, base);
    await new Promise(resolve => server.close(resolve));
    server = null;
  }
  await buildSite({ out, siteUrl: '' });
  await assert.rejects(stat(new URL('sitemap.xml', out)), { code: 'ENOENT' });
  assert(!(await readFile(new URL('robots.txt', out), 'utf8')).includes('example.com'));
  console.log('ok complete asset copies, safe links, optional SEO, root/project-path hosting, MIME types, missing files, and private-path protection');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
