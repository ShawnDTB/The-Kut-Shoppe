import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const assets = await readdir('dist/assets');
assert.equal(assets.some((file) => file.endsWith('.map')), false, 'Public source maps must not be published');
const javascript = (await Promise.all(assets.filter((file) => file.endsWith('.js')).map((file) => readFile(`dist/assets/${file}`, 'utf8')))).join('\n');
for (const forbidden of ['KutShoppeOwner!2026', 'kut-shoppe.accounts.v3', 'kut-shoppe.session.v3', 'Local Owner preview', 'AUTH_SECRET', 'scrypt:32768', 'RESEND_API_KEY']) {
  assert.equal(javascript.includes(forbidden), false, `Production contains server or local-preview material: ${forbidden}`);
}
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
for (const route of ['account', 'dashboard', 'staff', 'admin/products', 'admin/orders', 'book/walk-in', 'checkout', 'cart']) {
  const html = await readFile(`dist/${route}/index.html`, 'utf8');
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.equal(sitemap.includes(`.com/${route}</loc>`), false, `${route} must not be in the sitemap`);
}
const booking = await readFile('dist/book/index.html', 'utf8');
assert.match(booking, /href="https:\/\/booksy\.com\//);
assert.match(booking, /href="https:\/\/crownedbysteph\.glossgenius\.com/);
const checkout = await readFile('dist/checkout/index.html', 'utf8');
assert.match(checkout, /Online ordering is not open yet/);
assert.equal(checkout.includes('<form'), false);
assert.match(await readFile('dist/404.html', 'utf8'), /noindex/);
for (const route of ['privacy', 'terms']) assert.match(await readFile(`dist/${route}/index.html`, 'utf8'), /<h1/);
assert.equal((await readFile('dist/_headers', 'utf8')).includes('object-src \'none\''), true);
assert.deepEqual(JSON.parse(await readFile('dist/_routes.json', 'utf8')).include, ['/api/*']);
console.log('Production gates passed: no prototype auth, no server secrets, no public source maps, private-route indexing, external booking, closed checkout, legal pages, and API routing.');
