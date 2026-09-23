import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readConfig, renderSite, linkKeys } from './site-config.mjs';

const root = new URL('../', import.meta.url);
const config = await readConfig(root, '');
const html = renderSite(await readFile(new URL('index.html', root), 'utf8'), config);
const resources = html.slice(html.indexOf('<section class="section" id="resources">'), html.indexOf('<section class="section" id="team">'));
const groups = [...resources.matchAll(/<article class="resource">([\s\S]*?)<\/article>/g)].map(match => match[1]);
assert.equal(groups.length, 4);
const keys = new Set();
for (const [index, heading] of ['academics', 'career', 'research', 'opportunities'].entries()) {
  assert(groups[index].includes(`&gt; ${heading}</h3>`));
  const links = [...groups[index].matchAll(/<a data-site-link="([A-Za-z]+)" href="([^"]+)">/g)];
  assert.equal(links.length, 6, `${heading} contains six real resource links`);
  for (const [, key, href] of links) {
    assert(linkKeys.includes(key));
    assert(!keys.has(key)); keys.add(key);
    assert.equal(new URL(href).protocol, 'https:');
    assert(!href.includes('utm_'), 'tracking parameters are removed');
  }
}
assert.equal(keys.size, 24);
assert(!resources.includes('aria-disabled="true"'), 'resource links are no longer placeholders');
assert(!resources.includes('href="#"'));
assert(!resources.includes('/partners/partners/'), 'do not reintroduce the dead partner directory');
assert.equal(config.links.taApplications, 'https://cs.brown.edu/courses/ta/hiring/');
assert.equal(config.links.courseCatalog, 'https://cs.brown.edu/courses/');
console.log('ok four resource groups, 24 configured HTTPS links, direct hiring/catalog routes, and no inactive placeholders');
