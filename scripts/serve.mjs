import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectRoot } from './build-site.mjs';
import { readConfig, renderSite } from './site-config.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};

export async function createSiteServer({ root, dev = false, base = '/' }) {
  const directory = await realpath(root);
  if (!/^\/(?:[\w-]+\/)*$/.test(base)) throw new Error('Base must be / or a path like /cs-dug/.');
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!pathname.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
      const name = pathname.slice(base.length) || 'index.html';
      const allowed = ['index.html', 'site.webmanifest', 'robots.txt', 'sitemap.xml'].includes(name)
        || (name.startsWith('assets/') && !name.split('/').some(part => part.startsWith('.')));
      if (!allowed || name.includes('\\') || name.includes('\0')) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const path = await realpath(resolve(directory, name));
      if (!path.startsWith(directory + sep) || !(await stat(path)).isFile()) {
        response.writeHead(404); response.end('Not found'); return;
      }
      let data = await readFile(path);
      if (dev && name === 'index.html') {
        const rootUrl = pathToFileURL(directory + sep);
        data = Buffer.from(renderSite(data.toString(), await readConfig(rootUrl)));
      }
      response.writeHead(200, { 'Content-Type': types[extname(name)] || 'application/octet-stream', 'Content-Length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const missing = ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code);
      const status = missing ? 404 : error instanceof URIError ? 400 : 500;
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(status === 500 ? 'Site could not be rendered. Check the terminal and site-content.json.' : 'Not found');
      if (status === 500) console.error(error.message);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  const dev = args.includes('--dev');
  const base = option('--base', '/');
  let port = Number(option('--port', process.env.PORT || '4173'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535.');
  const root = fileURLToPath(dev ? projectRoot : new URL('dist/', projectRoot));
  try { await stat(resolve(root, 'index.html')); }
  catch { throw new Error('Run npm run build before npm run preview.'); }
  const server = await createSiteServer({ root, dev, base });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && port < 65535) { port++; server.listen(port, '127.0.0.1'); }
    else { console.error(error); process.exitCode = 1; }
  });
  server.on('listening', () => console.log(`${dev ? 'Development' : 'Production preview'}: http://127.0.0.1:${port}${base}\n${dev ? 'Refresh the browser after editing source or settings.' : 'Serving dist; rebuild to include source changes.'}\nCtrl+C to stop.`));
  server.listen(port, '127.0.0.1');
}
