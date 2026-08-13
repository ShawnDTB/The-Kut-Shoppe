import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Run each step through the shell as a single command string (rather than
// passing an argv array with shell:true) so Windows can resolve npx's .cmd
// shim without Node's EINVAL on direct .cmd execution, and without
// triggering the DEP0190 array-args-with-shell deprecation warning. All
// arguments here are fixed, developer-controlled strings, not user input.
function run(command) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync('dist', { recursive: true, force: true });
rmSync('dist-ssr', { recursive: true, force: true });
run('npx vite build');
run('npx vite build --ssr src/entry-server.tsx --outDir dist-ssr');
run('node scripts/prerender.mjs');
rmSync('dist-ssr', { recursive: true, force: true });
