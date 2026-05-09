export type ProfileSummary = {
  name: string;
  active: boolean;
  hermesHome: string;
};

export type StatusSnapshot = {
  hermesVersion: string;
  dashboardPort: number;
  gateway: { running: boolean; platforms: string[] };
};

export type AcpClientMessage =
  | { kind: 'prompt'; sessionId: string; text: string }
  | { kind: 'approve'; sessionId: string; toolCallId: string; allow: boolean };

export type AcpServerMessage =
  | { kind: 'token'; sessionId: string; text: string }
  | { kind: 'tool-call'; sessionId: string; toolCallId: string; name: string; args: unknown }
  | { kind: 'tool-result'; sessionId: string; toolCallId: string; result: unknown }
  | { kind: 'approval-request'; sessionId: string; toolCallId: string; description: string }
  | { kind: 'done'; sessionId: string };
