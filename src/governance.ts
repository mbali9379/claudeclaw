/**
 * Governance Middleware Integration
 *
 * Routes Claude Code tool calls through the Agent Daemon's constraint layer
 * (localhost:3004) before execution. The daemon checks zone, blast radius,
 * and governance rules, then approves or blocks.
 *
 * This file provides SDK hook callbacks for PreToolUse and PostToolUse.
 *
 * Decision Journal refs:
 *   2026-03-18 — ClaudeClaw bypass permissions: discovery and remediation plan
 *   2026-03-18 — Channel-adaptive governance
 */

import type {
  HookInput,
  HookJSONOutput,
  PreToolUseHookInput,
  PostToolUseHookInput,
  HookCallbackMatcher,
} from '@anthropic-ai/claude-agent-sdk';

import { logger } from './logger.js';

const GOVERNANCE_URL =
  process.env.GOVERNANCE_URL || 'http://127.0.0.1:3004';

const GOVERNANCE_TIMEOUT = 5000; // 5s timeout

/**
 * Check if the governance daemon is reachable.
 * If not, tools execute ungoverned (fail-open, not fail-closed).
 * This prevents ClaudeClaw from breaking if the daemon isn't running.
 */
async function isDaemonAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${GOVERNANCE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * PreToolUse hook: asks the daemon whether this tool call is allowed.
 *
 * Returns:
 *   - { decision: 'approve' } if the daemon says ALLOWED
 *   - { decision: 'block', reason } if the daemon says BLOCKED
 *   - { decision: 'approve' } if the daemon is unreachable (fail-open)
 *
 * For ESCALATED results (terminal channel), the daemon would normally wait
 * for approval. But since ClaudeClaw is always the telegram channel,
 * Tier 2 actions are auto-approved by the daemon. If future channels
 * are added, escalation handling will need to be implemented here.
 */
async function preToolUseHook(
  input: HookInput,
  _toolUseId: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookJSONOutput> {
  const hookInput = input as PreToolUseHookInput;
  const toolName = hookInput.tool_name;
  const toolInput = hookInput.tool_input as Record<string, unknown>;

  // Check if daemon is running
  const available = await isDaemonAvailable();
  if (!available) {
    logger.warn(
      { tool: toolName },
      'Governance daemon not available, executing ungoverned',
    );
    return { decision: 'approve', reason: 'Daemon unavailable (fail-open)' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOVERNANCE_TIMEOUT);

    const res = await fetch(`${GOVERNANCE_URL}/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: toolName,
        params: toolInput,
        channel: `claudeclaw-${hookInput.session_id}`,
        channelType: 'telegram',
        requestId: hookInput.tool_use_id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      logger.error(
        { tool: toolName, status: res.status },
        'Governance daemon returned error, executing ungoverned',
      );
      return { decision: 'approve', reason: 'Daemon error (fail-open)' };
    }

    const result = (await res.json()) as {
      status: string;
      reason?: string;
      result?: { success: boolean; output: string };
    };

    if (result.status === 'blocked') {
      logger.info(
        { tool: toolName, reason: result.reason },
        'Tool call BLOCKED by governance',
      );
      return {
        decision: 'block',
        reason: result.reason || 'Blocked by governance middleware',
      };
    }

    if (result.status === 'checkpoint') {
      // Checkpoint on telegram = log it, don't block
      logger.info(
        { tool: toolName, reason: result.reason },
        'Governance checkpoint reached',
      );
      return { decision: 'approve', reason: result.reason };
    }

    // 'executed' or 'escalated' (telegram auto-approves Tier 2)
    logger.debug({ tool: toolName, status: result.status }, 'Tool call approved');
    return { decision: 'approve' };
  } catch (err) {
    const error = err as Error;
    logger.error(
      { tool: toolName, error: error.message },
      'Governance check failed, executing ungoverned',
    );
    return { decision: 'approve', reason: 'Governance check failed (fail-open)' };
  }
}

/**
 * PostToolUse hook: logs the tool result to the daemon's audit trail.
 * Non-blocking. If the daemon is unavailable, silently skips.
 */
async function postToolUseHook(
  input: HookInput,
  _toolUseId: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookJSONOutput> {
  // PostToolUse is fire-and-forget logging. Always continue.
  const hookInput = input as PostToolUseHookInput;

  // Don't block on this. Just fire and forget.
  try {
    const available = await isDaemonAvailable();
    if (available) {
      logger.debug(
        { tool: hookInput.tool_name },
        'PostToolUse logged to governance daemon',
      );
    }
  } catch {
    // Silent fail. Audit logging is best-effort from PostToolUse.
  }

  return { continue: true };
}

/**
 * Build the hooks config object to pass to the SDK query options.
 */
export function buildGovernanceHooks(): Partial<
  Record<string, HookCallbackMatcher[]>
> {
  return {
    PreToolUse: [
      {
        hooks: [preToolUseHook],
        timeout: 10,
      },
    ],
    PostToolUse: [
      {
        hooks: [postToolUseHook],
        timeout: 5,
      },
    ],
  };
}
