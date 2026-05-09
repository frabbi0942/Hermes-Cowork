// apps/desktop/src/main/orchestrator/acp-translator.ts
//
// Translates raw supervisor events (JSON-RPC frames + lifecycle signals) into
// the semantic AcpServerMessage shape the renderer consumes. Lives at the IPC
// seam so the renderer never has to know about the wire format.
//
// Wire format reference: Agent Client Protocol v0.11.2 (ACP). The Hermes
// `acp_adapter/` Python package wraps the `acp` library, which sends client
// methods like `session/update` and `session/request_permission` to us
// (we are the "client" in ACP terms; Hermes is the "agent").

import type { AcpEvent } from './acp-supervisor';
import type { AcpServerMessage } from '../../shared/types';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

function isJsonRpcRequest(msg: unknown): msg is JsonRpcRequest {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as { method?: unknown }).method === 'string'
  );
}

/**
 * Translate one supervisor event into zero-or-more semantic events.
 *
 *  - 'message'  → inspect the JSON-RPC method, map ACP client methods to
 *                 semantic UI events; ignore JSON-RPC responses (those are
 *                 replies to our outgoing requests, not server-pushed events)
 *  - 'exit'     → currently dropped (TODO: surface to renderer as a system
 *                 note so the user knows the ACP child died?)
 *  - 'error'    → currently dropped (TODO: same question)
 *
 * Returning [] is correct for frames we deliberately don't surface
 * (e.g. JSON-RPC *responses* to our own outgoing prompt/permission requests,
 * or session/update variants we don't render yet like usage_update).
 */
export function translateAcpEvent(event: AcpEvent): AcpServerMessage[] {
  if (event.kind !== 'message') return [];

  const { sessionId: supervisorSessionId, msg } = event;
  if (!isJsonRpcRequest(msg)) return [];

  const params = (msg.params ?? {}) as Record<string, unknown>;

  // ACP carries its own sessionId in params. Prefer that over the supervisor's
  // bookkeeping id, but fall back to the supervisor id if absent.
  const sessionId =
    typeof params['sessionId'] === 'string'
      ? (params['sessionId'] as string)
      : supervisorSessionId;

  switch (msg.method) {
    case 'session/update':
      return translateSessionUpdate(sessionId, params);
    case 'session/request_permission':
      return translateRequestPermission(sessionId, params);
    default:
      // initialize, fs/read_text_file, terminal/*, and any future client
      // methods that don't have a UI surface yet.
      return [];
  }
}

/**
 * `session/update` carries a discriminated union under `params.update`.
 * Discriminator key: `sessionUpdate`. Variants we render:
 *
 *   "agent_message_chunk"   → token (assistant text streaming in)
 *   "agent_thought_chunk"   → token (thinking; folded into the same stream
 *                             for M1 — split later if the UI needs it)
 *   "tool_call"             → tool-call (a tool invocation begins)
 *   "tool_call_update"      → tool-result if status==="completed"; otherwise
 *                             dropped (intermediate progress is not surfaced)
 *
 * Variants we deliberately drop in M1:
 *   user_message_chunk, plan, available_commands_update, current_mode_update,
 *   config_option_update, session_info_update, usage_update.
 */
function translateSessionUpdate(
  sessionId: string,
  params: Record<string, unknown>,
): AcpServerMessage[] {
  const update = params['update'];
  if (typeof update !== 'object' || update === null) return [];

  const u = update as Record<string, unknown>;
  const variant = u['sessionUpdate'];

  switch (variant) {
    case 'agent_message_chunk':
    case 'agent_thought_chunk': {
      const text = extractTextFromContentBlock(u['content']);
      return text ? [{ kind: 'token', sessionId, text }] : [];
    }
    case 'tool_call': {
      const toolCallId = typeof u['toolCallId'] === 'string' ? u['toolCallId'] : '';
      const name = typeof u['title'] === 'string' ? u['title'] : '';
      if (!toolCallId || !name) return [];
      return [{ kind: 'tool-call', sessionId, toolCallId, name, args: u['rawInput'] }];
    }
    case 'tool_call_update': {
      if (u['status'] !== 'completed') return [];
      const toolCallId = typeof u['toolCallId'] === 'string' ? u['toolCallId'] : '';
      if (!toolCallId) return [];
      return [{ kind: 'tool-result', sessionId, toolCallId, result: u['rawOutput'] }];
    }
    default:
      return [];
  }
}

/**
 * `session/request_permission` is a JSON-RPC *request* — the agent is waiting
 * for a response with the chosen option_id. Our renderer's `approval-request`
 * is a notification only; the actual response wiring (matching the request id
 * back to a reply with `{ optionId: ... }`) lives in the IPC handler / send
 * path, not here. This translator just surfaces the prompt to the UI.
 *
 * NOTE: there is a related M1 bug in handlers.ts (the `approve` outgoing
 * path uses a fictitious `tool/respond` method instead of replying to the
 * pending request). Out of scope for this translator; flagged separately.
 */
function translateRequestPermission(
  sessionId: string,
  params: Record<string, unknown>,
): AcpServerMessage[] {
  const toolCall = params['toolCall'];
  if (typeof toolCall !== 'object' || toolCall === null) return [];

  const tc = toolCall as Record<string, unknown>;
  const toolCallId = typeof tc['toolCallId'] === 'string' ? tc['toolCallId'] : '';
  if (!toolCallId) return [];

  const description = typeof tc['title'] === 'string' ? tc['title'] : '';
  return [{ kind: 'approval-request', sessionId, toolCallId, description }];
}

/**
 * `agent_message_chunk` and `agent_thought_chunk` carry a single ContentBlock
 * under `content` (discriminated by `type`). For M1 we only surface text
 * blocks; image/audio/resource blocks are dropped silently.
 */
function extractTextFromContentBlock(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const c = content as Record<string, unknown>;
  if (c['type'] === 'text' && typeof c['text'] === 'string') {
    return c['text'];
  }
  return '';
}
