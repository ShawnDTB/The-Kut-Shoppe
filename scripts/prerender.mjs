import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
const serverEntry = await import(
  pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href
);

for (const route of serverEntry.staticRoutes) {
  const rendered = serverEntry.render(route.path);
  const html = template
    .replace('<!--app-head-->', rendered.head)
    .replace('<!--app-html-->', rendered.html);
  const output =
    route.path === '/'
      ? path.join(root, 'dist', 'index.html')
      : path.join(root, 'dist', route.path.slice(1), 'index.html');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html, 'utf8');
}

const notFound = serverEntry.render('/404');
await writeFile(
  path.join(root, 'dist', '404.html'),
  template
    .replace('<!--app-head-->', notFound.head)
    .replace('<!--app-html-->', notFound.html),
  'utf8',
);

// robots.txt points crawlers at /sitemap.xml, so keep this file's inclusion
// rule identical to the per-route robots meta logic above ('placeholder'
// routes are noindex and are therefore left out of the sitemap too).
const sitemapUrls = serverEntry.staticRoutes
  .filter((route) => route.status !== 'placeholder')
  .map((route) => `https://www.thekutshoppe.com${route.path === '/' ? '' : route.path}`);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`),
  '</urlset>',
  '',
].join('\n');

await writeFile(path.join(root, 'dist', 'sitemap.xml'), sitemap, 'utf8');
