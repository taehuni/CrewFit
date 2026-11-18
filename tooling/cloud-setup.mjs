// Cross-platform install command for an isolated Codex Cloud checkout.
// Does not read .env, contact application APIs, or mutate a database.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 19)) {
  console.error('CrewFit requires Node.js 22.19+; select Node 22 in the environment.');
  process.exit(1);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
for (const directory of ['server', 'client']) {
  console.log(`${directory}: npm ci --include=dev${dryRun ? ' (dry run)' : ''}`);
  if (dryRun) continue;
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['ci', '--include=dev'], {
      cwd: path.join(root, directory),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
