import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import './check-bundle-size.mjs';

const config = await readFile('wrangler.production.toml', 'utf8');
for (const flag of ['ACCOUNTS_ENABLED', 'CUSTOMER_BOOKING_ENABLED', 'STAFF_OPERATIONS_ENABLED', 'STAFF_SETUP_ENABLED', 'COMMERCE_ENABLED', 'CASH_SALES_ENABLED', 'PAYMENTS_SANDBOX_ENABLED', 'APPOINTMENT_EMAIL_ENABLED']) {
  assert.ok(config.includes(`${flag} = "false"`), `${flag} requires a separate activation review`);
}
for (const [route, copy] of [['book', 'New website booking under construction'], ['shop', 'Online shopping under construction'], ['account', 'Accounts coming soon'], ['checkout', 'Online shopping under construction'], ['cart', 'Online shopping under construction']]) {
  const html = await readFile(`dist/${route}/index.html`, 'utf8');
  assert.ok(html.includes(copy), `${route} must render a holding page without JavaScript`);
  assert.ok(!html.includes('<form'), `${route} must not collect data`);
  assert.match(html, /noindex, nofollow/);
}
const booking = await readFile('dist/book/index.html', 'utf8');
assert.ok(booking.includes('https://booksy.com/') && booking.includes('https://crownedbysteph.glossgenius.com'));
const home = await readFile('dist/index.html', 'utf8');
assert.ok(!home.includes('wp-content/uploads'), 'Release cannot depend on the retired WordPress host');
for (const match of home.matchAll(/src="(\/media\/[^"?]+)"/g)) await access(`dist${match[1]}`);
const scripts = await readdir('dist/assets');
assert.ok(!scripts.some(file => /CustomerAccount|CashCounter|CashRegister|LiveCommerce/.test(file)), 'Unfinished platform screens must stay outside the public bundle');
console.log('Public release verified: holding pages, provider booking, local images, closed feature gates and isolated build.');
