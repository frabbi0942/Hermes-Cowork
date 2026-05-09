import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';

export type HermesRuntime = {
  binaryPath: string;
  version: string;
  meetsMinimum: boolean;
};

export type RuntimeProbeError =
  | { kind: 'not-found'; searched: string[] }
  | { kind: 'version-failed'; binaryPath: string; stderr: string }
  | { kind: 'too-old'; binaryPath: string; version: string; min: string };

export const MIN_HERMES_VERSION = '0.13.0';

type FindResult =
  | { kind: 'found'; path: string }
  | { kind: 'not-found'; searched: string[] };

type FindOptions = {
  home: string;
  pathDirs: string[];
};

export function findHermesBinary(opts: FindOptions = {
  home: homedir(),
  pathDirs: (process.env['PATH'] ?? '').split(':').filter(Boolean),
}): FindResult {
  const candidates = [
    join(opts.home, '.local', 'bin', 'hermes'),
    '/opt/homebrew/bin/hermes',
    '/usr/local/bin/hermes',
    ...opts.pathDirs.map((d) => join(d, 'hermes')),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return { kind: 'found', path: c };
  }
  return { kind: 'not-found', searched: candidates };
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export async function verifyHermesVersion(binaryPath: string): Promise<
  | { kind: 'ok'; version: string }
  | RuntimeProbeError
> {
  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(binaryPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) =>
      resolve({ kind: 'version-failed', binaryPath, stderr: err.message }),
    );
    proc.on('close', (code) => {
      if (code !== 0) {
        return resolve({ kind: 'version-failed', binaryPath, stderr });
      }
      // hermes --version output looks like: "hermes-agent 0.13.4"
      const match = stdout.match(/(\d+\.\d+\.\d+)/);
      if (!match) {
        return resolve({ kind: 'version-failed', binaryPath, stderr: stdout });
      }
      const version = match[1]!;
      const cmp = compareSemver(version, MIN_HERMES_VERSION);
      if (cmp < 0) {
        return resolve({ kind: 'too-old', binaryPath, version, min: MIN_HERMES_VERSION });
      }
      resolve({ kind: 'ok', version });
    });
  });
}
