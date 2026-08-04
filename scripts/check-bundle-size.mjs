import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const assetDirectory = path.resolve('dist/assets');
const budgets = {
  javascript: 120 * 1024,
  css: 40 * 1024,
};

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

const files = await readdir(assetDirectory);
const assetFiles = files.filter((file) => !file.endsWith('.map'));
const totals = { javascript: 0, css: 0 };

for (const file of assetFiles) {
  const extension = path.extname(file);
  if (extension !== '.js' && extension !== '.css') continue;
  const content = await readFile(path.join(assetDirectory, file));
  const compressedSize = gzipSync(content, { level: 9 }).byteLength;
  if (extension === '.js') totals.javascript += compressedSize;
  if (extension === '.css') totals.css += compressedSize;
}

console.log(`Production JavaScript gzip: ${formatKilobytes(totals.javascript)} / ${formatKilobytes(budgets.javascript)}`);
console.log(`Production CSS gzip: ${formatKilobytes(totals.css)} / ${formatKilobytes(budgets.css)}`);

const failures = Object.entries(totals)
  .filter(([type, bytes]) => bytes > budgets[type])
  .map(([type, bytes]) => `${type} is ${formatKilobytes(bytes)}, above the ${formatKilobytes(budgets[type])} budget`);

if (failures.length) {
  console.error('\nBundle budget exceeded:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Bundle budget passed.');
}
