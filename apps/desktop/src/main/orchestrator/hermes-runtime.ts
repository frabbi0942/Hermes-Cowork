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
