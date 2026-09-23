import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename } from 'node:path';
import { baseUrl, escapeMarkup, launchWarnings, readConfig, renderSite } from './site-config.mjs';

export const projectRoot = new URL('../', import.meta.url);

export async function buildSite({ root = projectRoot, out = new URL('dist/', root), siteUrl } = {}) {
  const config = await readConfig(root, siteUrl);
  const source = await readFile(new URL('index.html', root), 'utf8');
  const html = renderSite(source, config);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(new URL('assets/', root), new URL('assets/', out), {
    recursive: true,
    filter: path => !basename(path).startsWith('.')
  });
  for (const file of ['site.webmanifest', '.nojekyll']) await cp(new URL(file, root), new URL(file, out));
  await writeFile(new URL('index.html', out), html);
  const url = baseUrl(config);
  let robots = await readFile(new URL('robots.txt', root), 'utf8');
  if (url) {
    robots += `\nSitemap: ${new URL('sitemap.xml', url).href}\n`;
    await writeFile(new URL('sitemap.xml', out),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeMarkup(url)}</loc></url></urlset>\n`);
  }
  await writeFile(new URL('robots.txt', out), robots);
  return { out, warnings: launchWarnings(config, source) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildSite();
  console.log(`Built ${fileURLToPath(result.out)} with all local assets.`);
  if (result.warnings.length) {
    console.warn(`\nBuild succeeded. ${result.warnings.length} content/launch items remain; see npm run check:launch and docs/content-checklist.md.`);
  }
}
