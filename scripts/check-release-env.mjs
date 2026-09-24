import { checkReleaseEnvironment } from './release-environment.mjs';

const errors = checkReleaseEnvironment(process.env);
if (errors.length) {
  console.error('Release environment preflight failed (values are intentionally not printed):');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Offline environment preflight passed. This does not verify remote bindings, migrations, provider delivery, payment support, or staging acceptance.');
}
