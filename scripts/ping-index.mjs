// Explicit reviewed article changes only. Default dry-run makes no requests.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { KEY_FILE, requireValue } from './indexnow-content.mjs';
import { runIndexNow } from './indexnow-submit.mjs';

try {
  const args = process.argv.slice(2);
  let mode = 'dry-run',
    explicitMode = false,
    file,
    stateDir, deploymentCommit;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--dry-run', '--verify', '--send'].includes(arg)) {
      requireValue(!explicitMode, 'Use one mode');
      explicitMode = true;
      mode = arg.slice(2);
    } else if (arg === '--urls' || arg === '--state-dir' || arg === '--commit') {
      requireValue(
        args[i + 1] && !args[i + 1].startsWith('--'),
        `Missing value for ${arg}`,
      );
      if (arg === '--urls') {
        requireValue(!file, 'Repeated --urls');
        file = args[++i];
      } else if (arg === '--commit') {
        requireValue(!deploymentCommit, 'Repeated --commit');
        deploymentCommit = args[++i];
      } else {
        requireValue(!stateDir, 'Repeated --state-dir');
        stateDir = args[++i];
      }
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  requireValue(
    file,
    'Use --urls reviewed-changes.json [--dry-run | --verify | --send --state-dir DURABLE_DIRECTORY]',
  );
  const root = fileURLToPath(new URL('..', import.meta.url));
  const plan = JSON.parse(await readFile(resolve(file), 'utf8'));
  const key =
    mode === 'dry-run'
      ? undefined
      : (await readFile(join(root, KEY_FILE), 'utf8')).trim();
  const result = await runIndexNow({
    plan: { ...plan, ...(deploymentCommit ? { deploymentCommit } : {}) },
    mode,
    key,
    stateDir: stateDir && resolve(stateDir),
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
