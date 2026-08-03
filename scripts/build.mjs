import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync('dist', { recursive: true, force: true });
rmSync('dist-ssr', { recursive: true, force: true });
run(['vite', 'build']);
run(['vite', 'build', '--ssr', 'src/entry-server.tsx', '--outDir', 'dist-ssr']);
run(['node', 'scripts/prerender.mjs']);
rmSync('dist-ssr', { recursive: true, force: true });
