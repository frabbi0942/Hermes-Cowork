// apps/desktop/src/main/orchestrator/acp-bridge.ts
//
// High-level ACP session manager. Owns:
//  - The handshake (initialize → session/new) on session start.
//  - The acp-sessionId ↔ supervisor-handle mapping.
//  - Pending session/request_permission state, so renderer-side approve/deny
//    can be turned into JSON-RPC responses to the original request.
//  - Translation of incoming server-pushed events → semantic AcpServerMessage.
//  - Emitting `'done'` when our session/prompt request gets a response.
//
// Wire format reference: Agent Client Protocol v0.11.2 (see acp-translator).

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AcpSupervisor, AcpEvent } from './acp-supervisor';
import type { AcpServerMessage } from '../../shared/types';
import { translateAcpEvent } from './acp-translator';

const ACP_PROTOCOL_VERSION = 1;

type StartSessionOpts = {
  profile: string;
  cwd: string;
  binaryPath: string;
  hermesHome: string;
};

type PermissionOptionKind = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';

type PermissionOption = {
  optionId: string;
  name: string;
  kind: PermissionOptionKind;
};

type PendingPermission = {
  handle: string;
  requestId: string | number;
  options: PermissionOption[];
};

export class AcpBridge extends EventEmitter {
  private acpToHandle = new Map<string, string>();
  private pendingPermissions = new Map<string, PendingPermission>();

  constructor(private readonly sup: AcpSupervisor) {
    super();
    this.sup.on('event', this.onSupervisorEvent);
  }

  /**
   * Spawn an ACP child and complete the protocol handshake. Returns the real
   * ACP sessionId, which the renderer uses for all subsequent prompts.
   */
  async startSession(opts: StartSessionOpts): Promise<{ sessionId: string }> {
    const handle = randomUUID();
    this.sup.spawn({
      id: handle,
      profile: opts.profile,
      cwd: opts.cwd,
      binaryPath: opts.binaryPath,
      hermesHome: opts.hermesHome,
    });

    try {
      await this.sup.request(handle, 'initialize', {
        protocolVersion: ACP_PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: 'hermes-cowork-desktop', version: '0.1.0' },
      });

      const newSession = (await this.sup.request(handle, 'session/new', {
        cwd: opts.cwd,
        mcpServers: [],
      })) as { sessionId: string };

      if (typeof newSession?.sessionId !== 'string') {
        throw new Error('session/new returned no sessionId');
      }

      this.acpToHandle.set(newSession.sessionId, handle);
      return { sessionId: newSession.sessionId };
    } catch (err) {
      // Handshake failed; tear down the orphan child so it doesn't leak.
      this.sup.shutdown(handle);
      throw err;
    }
  }

  /**
   * Send a user prompt and emit `'done'` when the agent finishes its turn.
   * Throws if Hermes rejects the prompt; caller (IPC handler) surfaces the
   * error to the renderer. `'done'` is emitted in either case so the UI can
   * stop showing a loading indicator.
   */
  async sendPrompt(sessionId: string, text: string): Promise<void> {
    const handle = this.acpToHandle.get(sessionId);
    if (!handle) throw new Error(`unknown ACP session ${sessionId}`);

    try {
      await this.sup.request(handle, 'session/prompt', {
        sessionId,
        prompt: [{ type: 'text', text }],
      });
    } finally {
      this.emit('event', { kind: 'done', sessionId } satisfies AcpServerMessage);
    }
  }

  /**
   * Reply to the most-recent pending session/request_permission for this
   * tool call. Quietly no-ops if there's no pending request (e.g. the user
   * clicks the button twice or after the agent moved on).
   */
  respondToPermission(toolCallId: string, allow: boolean): void {
    const pending = this.pendingPermissions.get(toolCallId);
    if (!pending) return;
    this.pendingPermissions.delete(toolCallId);

    const result = allow
      ? { outcome: { outcome: 'selected', optionId: pickAllowOptionId(pending.options) } }
      : { outcome: { outcome: 'cancelled' } };

    this.sup.send(pending.handle, { jsonrpc: '2.0', id: pending.requestId, result });
  }

  /** Shut down the ACP child for a given session. */
  stopSession(sessionId: string): void {
    const handle = this.acpToHandle.get(sessionId);
    if (!handle) return;
    this.acpToHandle.delete(sessionId);
    for (const [tcId, p] of this.pendingPermissions) {
      if (p.handle === handle) this.pendingPermissions.delete(tcId);
    }
    this.sup.shutdown(handle);
  }

  /** Shut down all sessions (used on profile switch / app quit). */
  stopAll(): void {
    this.acpToHandle.clear();
    this.pendingPermissions.clear();
    this.sup.shutdownAll();
  }

  private onSupervisorEvent = (event: AcpEvent): void => {
    if (event.kind !== 'message') return;

    // Stash session/request_permission so respondToPermission can find it.
    const msg = event.msg;
    if (msg['method'] === 'session/request_permission') {
      const id = msg['id'];
      const params = msg['params'] as Record<string, unknown> | undefined;
      const toolCall = params?.['toolCall'] as Record<string, unknown> | undefined;
      const toolCallId = typeof toolCall?.['toolCallId'] === 'string' ? toolCall['toolCallId'] : '';
      const options = Array.isArray(params?.['options'])
        ? (params!['options'] as PermissionOption[])
        : [];
      if (toolCallId && (typeof id === 'string' || typeof id === 'number')) {
        this.pendingPermissions.set(toolCallId, {
          handle: event.sessionId,
          requestId: id,
          options,
        });
      }
    }

    for (const semantic of translateAcpEvent(event)) {
      this.emit('event', semantic);
    }
  };
}

/**
 * Map our binary `allow: boolean` to a real ACP optionId. The agent decides
 * the menu of options; we prefer "allow_once" so we never accidentally grant
 * persistent permission on the user's behalf.
 */
function pickAllowOptionId(options: PermissionOption[]): string {
  const byKind = (k: PermissionOptionKind) => options.find((o) => o?.kind === k);
  const choice = byKind('allow_once') ?? byKind('allow_always') ?? options[0];
  return choice?.optionId ?? '';
}
