// `pnpm oracle`: set up the Python venv, regenerate hands, run the TS parity test.
// Usage: pnpm oracle [--seed N] [--scale X]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const isWin = process.platform === 'win32';
const venvPython = join(here, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');

const run = (cmd, args, opts = {}) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  // pnpm is a .cmd shim on Windows, which needs a shell; pass one command string.
  const r =
    isWin && cmd === 'pnpm'
      ? spawnSync([cmd, ...args].join(' '), { stdio: 'inherit', shell: true, ...opts })
      : spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(venvPython)) {
  const sysPython = isWin ? 'python' : 'python3';
  run(sysPython, ['-m', 'venv', join(here, '.venv')]);
}
run(venvPython, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '-r', join(here, 'requirements.txt')]);
run(venvPython, [join(here, 'gen.py'), '--out', join(here, 'hands.jsonl'), ...process.argv.slice(2)]);
run(venvPython, [join(here, 'props.py'), join(here, 'hands.jsonl')]);
run('pnpm', ['--filter', '@mahjong/engine', 'test:oracle'], { cwd: root });
