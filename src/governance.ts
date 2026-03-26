/**
 * Governance Middleware Integration
 *
 * Routes Claude Code tool calls through the Agent Daemon's constraint layer
 * (localhost:3004) before execution. The daemon checks zone, blast radius,
 * and governance rules, then approves or blocks.
 *
 * IMPORTANT: Claude Code tools (Read, Write, Edit, Bash, Glob, Grep, etc.)
 * are different from the daemon's internal tools (read_file, write_file, etc.).
 * This hook maps Claude Code tool names to the daemon's tool names and extracts
 * the target path from the tool input.
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

const GOVERNANCE_TIMEOUT = 5000;

/**
 * Map Claude Code tool names to daemon tool names.
 * Tools not in this map are allowed by default (fail-open for unknown tools).
 */
const TOOL_MAP: Record<string, string> = {
  // Read operations
  'Read': 'read_file',
  'Glob': 'search_files',
  'Grep': 'search_files',
  'WebFetch': 'read_file',
  'WebSearch': 'read_file',

  // Write operations
  'Write': 'write_file',
  'Edit': 'write_file',
  'NotebookEdit': 'write_file',

  // Shell
  'Bash': 'shell',

  // Agent/Task (pass through, no file path to check)
  'Agent': 'agent',
  'Task': 'agent',
  'TaskCreate': 'agent',
  'TaskUpdate': 'agent',
  'TodoWrite': 'agent',
};

/**
 * Extract the target file path from Claude Code tool input.
 */
function extractPath(toolName: string, toolInput: Record<string, unknown>): string | undefined {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return toolInput.file_path as string | undefined;
    case 'Glob':
      return toolInput.path as string | undefined;
    case 'Grep':
      return toolInput.path as string | undefined;
    case 'Bash':
      // For shell commands, use cwd or try to extract path from command
      return toolInput.cwd as string | undefined;
    default:
      return undefined;
  }
}

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
 */
async function preToolUseHook(
  input: HookInput,
  _toolUseId: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookJSONOutput> {
  const hookInput = input as PreToolUseHookInput;
  const toolName = hookInput.tool_name;
  const toolInput = hookInput.tool_input as Record<string, unknown>;

  // Map to daemon tool name. Unknown tools pass through (fail-open).
  const daemonTool = TOOL_MAP[toolName];
  if (!daemonTool) {
    logger.debug({ tool: toolName }, 'Tool not in governance map, allowing');
    return { decision: 'approve' };
  }

  // Agent/Task tools have no file path to check. Allow them.
  if (daemonTool === 'agent') {
    return { decision: 'approve' };
  }

  // Extract target path
  const targetPath = extractPath(toolName, toolInput);

  // No path to check (e.g., Bash without cwd). Allow.
  if (!targetPath && daemonTool !== 'shell') {
    return { decision: 'approve' };
  }

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

    const params: Record<string, unknown> = { ...toolInput };
    if (targetPath) {
      params.path = targetPath;
    }
    // For Bash, pass the command for safety checking
    if (toolName === 'Bash') {
      params.command = toolInput.command;
    }

    const res = await fetch(`${GOVERNANCE_URL}/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: daemonTool,
        params,
        channel: `claudeclaw-${hookInput.session_id}`,
        channelType: 'telegram',
        requestId: hookInput.tool_use_id,
        checkOnly: true,  // Don't execute, just evaluate constraints
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
 * PostToolUse hook: non-blocking audit logging.
 */
async function postToolUseHook(
  input: HookInput,
  _toolUseId: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookJSONOutput> {
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
