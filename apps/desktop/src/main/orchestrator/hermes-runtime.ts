import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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
