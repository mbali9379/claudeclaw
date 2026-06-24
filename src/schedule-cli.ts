#!/usr/bin/env node
/**
 * ClaudeClaw Schedule CLI
 *
 * Used by your Claude assistant via the Bash tool to manage scheduled tasks.
 *
 * Usage:
 *   node dist/schedule-cli.js create "prompt text" "0 9 * * 1"
 *   node dist/schedule-cli.js list
 *   node dist/schedule-cli.js delete <id>
 *   node dist/schedule-cli.js pause <id>
 *   node dist/schedule-cli.js resume <id>
 */

import { randomBytes } from 'crypto';

import {
  initDatabase,
  createScheduledTask,
  getAllScheduledTasks,
  deleteScheduledTask,
  pauseScheduledTask,
  resumeScheduledTask,
  setTaskMaxDelay,
  setTaskDestination,
  logToHiveMind,
  getHiveMindEntries,
  getOtherAgentActivity,
} from './db.js';
import { computeNextRun } from './scheduler.js';

initDatabase();

// Parse --agent flag from anywhere in argv, fall back to CLAUDECLAW_AGENT_ID env var
const agentFlagIdx = process.argv.indexOf('--agent');
const cliAgentId = agentFlagIdx !== -1
  ? process.argv[agentFlagIdx + 1] ?? 'main'
  : process.env.CLAUDECLAW_AGENT_ID ?? 'main';
// Remove --agent and its value from rest args (only filter when flag is present)
const cleanedArgv = agentFlagIdx !== -1
  ? process.argv.filter((_, i) => i !== agentFlagIdx && i !== agentFlagIdx + 1)
  : [...process.argv];
const [, , command, ...rest] = cleanedArgv;

function formatDate(unix: number | null): string {
  if (!unix) return 'never';
  return new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

switch (command) {
  case 'create': {
    const prompt = rest[0];
    const cron = rest[1];

    if (!prompt || !cron) {
      console.error('Usage: schedule-cli create "prompt" "cron expression" [--max-delay <minutes>] [--destination <telegram|slack>]');
      console.error('Example: schedule-cli create "Summarise AI news" "0 9 * * 1" --max-delay 90 --destination slack');
      process.exit(1);
    }

    const maxDelayIdx = cleanedArgv.indexOf('--max-delay');
    const maxDelayMinutes = maxDelayIdx !== -1 ? parseInt(cleanedArgv[maxDelayIdx + 1] ?? '', 10) : undefined;

    const destIdx = cleanedArgv.indexOf('--destination');
    const destRaw = destIdx !== -1 ? cleanedArgv[destIdx + 1] : undefined;
    if (destRaw && destRaw !== 'telegram' && destRaw !== 'slack') {
      console.error(`Invalid --destination "${destRaw}". Must be 'telegram' or 'slack'.`);
      process.exit(1);
    }
    const destination = (destRaw as 'telegram' | 'slack' | undefined) ?? 'telegram';

    let nextRun: number;
    try {
      nextRun = computeNextRun(cron);
    } catch {
      console.error(`Invalid cron expression: "${cron}"`);
      console.error('Examples: "0 9 * * 1" (Mon 9am)  "0 8 * * *" (daily 8am)  "0 */4 * * *" (every 4h)');
      process.exit(1);
    }

    const id = randomBytes(4).toString('hex');
    createScheduledTask(id, prompt, cron, nextRun, cliAgentId, maxDelayMinutes, destination);

    console.log(`Task created: ${id}`);
    console.log(`Agent:        ${cliAgentId}`);
    console.log(`Prompt:       ${prompt}`);
    console.log(`Schedule:     ${cron}`);
    console.log(`Next run:     ${formatDate(nextRun)}`);
    console.log(`Destination:  ${destination}`);
    if (maxDelayMinutes) console.log(`Max delay:    ${maxDelayMinutes}m (skip if overdue beyond this)`);
    break;
  }

  case 'set-destination': {
    const [taskId, dest] = rest;
    if (!taskId || (dest !== 'telegram' && dest !== 'slack')) {
      console.error('Usage: schedule-cli set-destination <task-id> <telegram|slack>');
      process.exit(1);
    }
    setTaskDestination(taskId, dest);
    console.log(`Destination for ${taskId} set to ${dest}`);
    break;
  }

  case 'set-max-delay': {
    const [taskId, delayStr] = rest;
    if (!taskId || !delayStr) {
      console.error('Usage: schedule-cli set-max-delay <task-id> <minutes>  (use 0 to clear)');
      process.exit(1);
    }
    const minutes = parseInt(delayStr, 10);
    setTaskMaxDelay(taskId, minutes === 0 ? null : minutes);
    console.log(`Max delay for ${taskId} set to ${minutes === 0 ? 'none (disabled)' : minutes + 'm'}`);
    break;
  }

  case 'list': {
    const tasks = getAllScheduledTasks(cliAgentId === 'main' ? undefined : cliAgentId);
    if (tasks.length === 0) {
      console.log('No scheduled tasks.');
      break;
    }
    console.log(`${tasks.length} scheduled task${tasks.length === 1 ? '' : 's'}:\n`);
    for (const t of tasks) {
      const status = t.status === 'paused' ? ' [PAUSED]' : '';
      console.log(`${t.id}${status}`);
      console.log(`  Prompt:   ${t.prompt}`);
      console.log(`  Schedule: ${t.schedule}`);
      console.log(`  Next run: ${formatDate(t.next_run)}`);
      console.log(`  Last run: ${formatDate(t.last_run)}`);
      console.log();
    }
    break;
  }

  case 'delete': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli delete <id>'); process.exit(1); }
    deleteScheduledTask(id);
    console.log(`Deleted task: ${id}`);
    break;
  }

  case 'pause': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli pause <id>'); process.exit(1); }
    pauseScheduledTask(id);
    console.log(`Paused task: ${id}`);
    break;
  }

  case 'resume': {
    const id = rest[0];
    if (!id) { console.error('Usage: schedule-cli resume <id>'); process.exit(1); }
    resumeScheduledTask(id);
    console.log(`Resumed task: ${id}`);
    break;
  }

  case 'hive-mind': {
    const subcommand = rest[0];

    if (subcommand === 'write') {
      const action = rest[1];
      const summary = rest[2];
      if (!action || !summary) {
        console.error('Usage: schedule-cli hive-mind write "action" "summary" [--artifacts \'{"key":"value"}\']');
        process.exit(1);
      }
      const artifactsIdx = rest.indexOf('--artifacts');
      const artifacts = artifactsIdx !== -1 ? rest[artifactsIdx + 1] : undefined;
      logToHiveMind(cliAgentId, 'scheduler', action, summary, artifacts);
      console.log(`Hive mind entry written: [${cliAgentId}] ${action} — ${summary.slice(0, 80)}`);

    } else if (subcommand === 'read') {
      // Optional flags: --action <type> --hours <N> --limit <N> --exclude-self
      const actionFilterIdx = rest.indexOf('--action');
      const actionFilter = actionFilterIdx !== -1 ? rest[actionFilterIdx + 1] : undefined;
      const hoursIdx = rest.indexOf('--hours');
      const hoursBack = hoursIdx !== -1 ? parseInt(rest[hoursIdx + 1], 10) : 24;
      const limitIdx = rest.indexOf('--limit');
      const limit = limitIdx !== -1 ? parseInt(rest[limitIdx + 1], 10) : 20;
      const excludeSelf = rest.includes('--exclude-self');

      let entries = excludeSelf
        ? getOtherAgentActivity(cliAgentId, hoursBack, limit)
        : getHiveMindEntries(limit);

      if (actionFilter) {
        entries = entries.filter((e) => e.action === actionFilter);
      }

      if (entries.length === 0) {
        console.log('No hive mind entries found.');
      } else {
        for (const e of entries) {
          const ts = new Date(e.created_at * 1000).toISOString();
          console.log(`[${ts}] [${e.agent_id}] ${e.action}`);
          console.log(`  ${e.summary}`);
          if (e.artifacts) console.log(`  artifacts: ${e.artifacts}`);
          console.log();
        }
      }

    } else {
      console.error('Usage: schedule-cli hive-mind write|read [options]');
      console.error('  write "action" "summary" [--artifacts \'{"key":"value"}\']');
      console.error('  read [--action <type>] [--hours <N>] [--limit <N>] [--exclude-self]');
      process.exit(1);
    }
    break;
  }

  default:
    console.error('Commands: create | list | delete | pause | resume | set-max-delay | set-destination | hive-mind');
    process.exit(1);
}
