import { CronExpressionParser } from 'cron-parser';

import { AGENT_ID, ALLOWED_CHAT_ID } from './config.js';
import {
  getDueTasks,
  getSession,
  logConversationTurn,
  markTaskRunning,
  updateTaskAfterRun,
  resetStuckTasks,
  claimNextMissionTask,
  completeMissionTask,
  resetStuckMissionTasks,
  updateIssueCost,
  getMissionTask,
  pausePipeline,
} from './db.js';
import { logger } from './logger.js';
import { ingestConversationTurn } from './memory-ingest.js';
import { messageQueue } from './message-queue.js';
import { runAgent } from './agent.js';
import { formatForTelegram, splitMessage } from './bot.js';
import { tryPipelineHandoff } from './orchestrator.js';
import { emitChatEvent } from './state.js';

type Sender = (text: string) => Promise<void>;

/** Max time (ms) a scheduled task can run before being killed. */
const TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let sender: Sender;

/**
 * In-memory set of task IDs currently being executed.
 * Acts as a fast-path guard alongside the DB-level lock in markTaskRunning.
 */
const runningTaskIds = new Set<string>();

/**
 * Initialise the scheduler. Call once after the Telegram bot is ready.
 * @param send  Function that sends a message to the user's Telegram chat.
 */
let schedulerAgentId = 'main';

export function initScheduler(send: Sender, agentId = 'main'): void {
  if (!ALLOWED_CHAT_ID) {
    logger.warn('ALLOWED_CHAT_ID not set — scheduler will not send results');
  }
  sender = send;
  schedulerAgentId = agentId;

  // Recover tasks stuck in 'running' from a previous crash
  const recovered = resetStuckTasks(agentId);
  if (recovered > 0) {
    logger.warn({ recovered, agentId }, 'Reset stuck tasks from previous crash');
  }
  const recoveredMission = resetStuckMissionTasks(agentId);
  if (recoveredMission > 0) {
    logger.warn({ recovered: recoveredMission, agentId }, 'Reset stuck mission tasks from previous crash');
  }

  setInterval(() => void runDueTasks(), 60_000);
  logger.info({ agentId }, 'Scheduler started (checking every 60s)');
}

async function runDueTasks(): Promise<void> {
  const tasks = getDueTasks(schedulerAgentId);

  if (tasks.length > 0) {
    logger.info({ count: tasks.length }, 'Running due scheduled tasks');
  }

  for (const task of tasks) {
    // In-memory guard: skip if already running in this process
    if (runningTaskIds.has(task.id)) {
      logger.warn({ taskId: task.id }, 'Task already running, skipping duplicate fire');
      continue;
    }

    // Compute next occurrence BEFORE executing so we can lock the task
    // in the DB immediately, preventing re-fire on subsequent ticks.
    const nextRun = computeNextRun(task.schedule);
    runningTaskIds.add(task.id);
    markTaskRunning(task.id, nextRun);

    logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 60) }, 'Firing task');

    // Route through the message queue so scheduled tasks wait for any
    // in-flight user message to finish before running. This prevents
    // two Claude processes from hitting the same session simultaneously.
    const chatId = ALLOWED_CHAT_ID || 'scheduler';
    messageQueue.enqueue(chatId, async () => {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

      try {
        await sender(`Scheduled task running: "${task.prompt.slice(0, 80)}${task.prompt.length > 80 ? '...' : ''}"`);

        // Run as a fresh agent call (no session — scheduled tasks are autonomous)
        const result = await runAgent(task.prompt, undefined, () => {}, undefined, undefined, abortController);
        clearTimeout(timeout);

        if (result.aborted) {
          updateTaskAfterRun(task.id, nextRun, 'Timed out after 10 minutes', 'timeout');
          await sender(`⏱ Task timed out after 10m: "${task.prompt.slice(0, 60)}..." — killed.`);
          logger.warn({ taskId: task.id }, 'Task timed out');
          return;
        }

        const text = result.text?.trim() || 'Task completed with no output.';
        for (const chunk of splitMessage(formatForTelegram(text))) {
          await sender(chunk);
        }

        // Log truncated task output to conversation_log (dashboard chat history depends on this)
        // Full output lives in scheduled_tasks.last_result via updateTaskAfterRun below.
        if (ALLOWED_CHAT_ID) {
          const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
          const truncated = text.length > 500
            ? text.slice(0, 500) + '\n\n[...truncated — full output in scheduled_tasks table]'
            : text;
          logConversationTurn(ALLOWED_CHAT_ID, 'user', `[Scheduled task]: ${task.prompt}`, activeSession ?? undefined, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'assistant', truncated, activeSession ?? undefined, schedulerAgentId);
        }

        // Extract structured memories from task output (fire-and-forget)
        void ingestConversationTurn(
          ALLOWED_CHAT_ID || 'scheduler',
          `[Scheduled task]: ${task.prompt}`,
          text,
          schedulerAgentId,
        ).catch(() => {});

        updateTaskAfterRun(task.id, nextRun, text, 'success');

        logger.info({ taskId: task.id, nextRun }, 'Task complete, next run scheduled');
      } catch (err) {
        clearTimeout(timeout);
        const errMsg = err instanceof Error ? err.message : String(err);
        updateTaskAfterRun(task.id, nextRun, errMsg.slice(0, 500), 'failed');

        logger.error({ err, taskId: task.id }, 'Scheduled task failed');
        try {
          await sender(`❌ Task failed: "${task.prompt.slice(0, 60)}..." — ${errMsg.slice(0, 200)}`);
        } catch {
          // ignore send failure
        }
      } finally {
        runningTaskIds.delete(task.id);
      }
    });
  }

  // Also check for queued mission tasks (one-shot async tasks from Mission Control)
  await runDueMissionTasks();
}

async function runDueMissionTasks(): Promise<void> {
  const mission = claimNextMissionTask(schedulerAgentId);
  if (!mission) return;

  const missionKey = 'mission-' + mission.id;
  if (runningTaskIds.has(missionKey)) return;
  runningTaskIds.add(missionKey);

  logger.info({ missionId: mission.id, title: mission.title }, 'Running mission task');

  const chatId = ALLOWED_CHAT_ID || 'mission';
  messageQueue.enqueue(chatId, async () => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), TASK_TIMEOUT_MS);

    try {
      const result = await runAgent(mission.prompt, undefined, () => {}, undefined, undefined, abortController);
      clearTimeout(timeout);

      if (result.aborted) {
        completeMissionTask(mission.id, null, 'failed', 'Timed out after 10 minutes');
        logger.warn({ missionId: mission.id }, 'Mission task timed out');
        try { await sender('Mission task timed out: "' + mission.title + '"'); } catch {}
      } else {
        const text = result.text?.trim() || 'Task completed with no output.';
        completeMissionTask(mission.id, text, 'completed');

        // Track cost data against the issue
        if (result.usage) {
          const totalTokens = result.usage.inputTokens + result.usage.outputTokens;
          const costEur = result.usage.totalCostUsd * 0.92; // USD to EUR approximate
          updateIssueCost(mission.id, 'claude', totalTokens, costEur);
        }

        logger.info({ missionId: mission.id }, 'Mission task completed');

        // Check for pipeline handoff
        const handedOff = await tryPipelineHandoff(mission.id, text, chatId, async (msg) => {
          try { await sender(msg); } catch {}
        });
        if (handedOff) {
          // Pipeline continues -- don't send full result to Telegram, just a status update
          try { await sender('Pipeline step done for "' + mission.title + '" -- handing off to next agent'); } catch {}
          emitChatEvent({
            type: 'mission_update' as 'progress',
            chatId,
            content: JSON.stringify({ id: mission.id, status: 'pipeline_handoff', title: mission.title }),
          });
          return;
        }

        // Send result to Telegram
        for (const chunk of splitMessage(formatForTelegram(text))) {
          await sender(chunk);
        }

        // Log truncated mission output to conversation_log (dashboard needs this)
        if (ALLOWED_CHAT_ID) {
          const activeSession = getSession(ALLOWED_CHAT_ID, schedulerAgentId);
          const truncated = text.length > 500
            ? text.slice(0, 500) + '\n\n[...truncated — full output in mission_tasks table]'
            : text;
          logConversationTurn(ALLOWED_CHAT_ID, 'user', '[Mission task: ' + mission.title + ']: ' + mission.prompt, activeSession ?? undefined, schedulerAgentId);
          logConversationTurn(ALLOWED_CHAT_ID, 'assistant', truncated, activeSession ?? undefined, schedulerAgentId);
        }

        // Extract structured memories from mission output (fire-and-forget)
        void ingestConversationTurn(
          ALLOWED_CHAT_ID || 'mission',
          `[Mission task: ${mission.title}]: ${mission.prompt}`,
          text,
          schedulerAgentId,
        ).catch(() => {});
      }

      emitChatEvent({
        type: 'mission_update' as 'progress',
        chatId,
        content: JSON.stringify({
          id: mission.id,
          status: result.aborted ? 'failed' : 'completed',
          title: mission.title,
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = err instanceof Error ? err.message : String(err);
      // If this is a pipeline task, pause the pipeline instead of just failing
      const currentTask = getMissionTask(mission.id);
      if (currentTask?.handoff_chain) {
        pausePipeline(mission.id, errMsg.slice(0, 500));
        try { await sender('Pipeline paused: "' + mission.title + '" failed -- ' + errMsg.slice(0, 100)); } catch {}
      } else {
        completeMissionTask(mission.id, null, 'failed', errMsg.slice(0, 500));
      }
      logger.error({ err, missionId: mission.id }, 'Mission task failed');
    } finally {
      runningTaskIds.delete(missionKey);
    }
  });
}

export function computeNextRun(cronExpression: string): number {
  const interval = CronExpressionParser.parse(cronExpression);
  return Math.floor(interval.next().getTime() / 1000);
}
