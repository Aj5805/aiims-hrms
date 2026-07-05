import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function globalSetup() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(here, '../../..');
  const backendDir = path.resolve(frontendDir, '../backend');
  const python = path.join(backendDir, '.venv', 'Scripts', 'python.exe');

  execFileSync(python, ['tools/reset_test_state.py'], {
    cwd: backendDir,
    env: { ...process.env, APP_ENV: 'test' },
    stdio: 'inherit',
  });

  execFileSync(python, ['tools/ensure_e2e_users.py'], {
    cwd: backendDir,
    env: { ...process.env, APP_ENV: 'test' },
    stdio: 'inherit',
  });
}

export default globalSetup;
