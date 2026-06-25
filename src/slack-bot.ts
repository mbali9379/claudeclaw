import { App } from '@slack/bolt';

import { runAgent, AgentProgressEvent } from './agent.js';
import {
  AGENT_ID,
  AGENT_TIMEOUT_MS,
  STREAM_STRATEGY,
  agentDefaultModel,
  agentSystemPrompt,
  AGENT_COORD_CHANNEL,
  ALLOWED_BOT_IDS,
} from './config.js';
import { clearSession, getSession, setSession } from './db.js';
import { logger } from './logger.js';
import { buildMemoryContext, evaluateMemoryRelevance, saveConversationTurn } from './memory.js';
import { messageQueue } from './message-queue.js';
import {
  checkKillPhrase,
  executeEmergencyKill,
  isLocked,
  unlock,
  touchActivity,
  audit,
} from './security.js';
import { setProcessing, setActiveAbort, abortActiveQuery } from './state.js';
import { downloadSlackFile, transcribeAudio, UPLOADS_DIR } from './voice.js';
import { buildPhotoMessage, buildDocumentMessage } from './media.js';

interface SlackFile {
  id: string;
  name?: string;
  mimetype?: string;
  url_private_download?: string;
}

const STREAM_INTERVAL_MS = 2500;
const WATCHDOG_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const WATCHDOG_MAX_FAILURES = 1; // exit after 1 failure — systemd restarts immediately

function startConnectionWatchdog(app: App): void {
  let failures = 0;
  setInterval(async () => {
    try {
      await app.client.auth.test();
      failures = 0;
    } catch (err) {
      failures++;
      logger.warn({ agentId: AGENT_ID, failures, err }, 'Slack connection watchdog: ping failed');
      if (failures >= WATCHDOG_MAX_FAILURES) {
        logger.error({ agentId: AGENT_ID }, 'Slack connection dead — exiting for systemd restart');
        process.exit(1);
      }
    }
  }, WATCHDOG_INTERVAL_MS);
}

export interface SlackBotOptions {
  botToken: string;
  appToken: string;
  allowedUserId: string;
  // If set, bot listens to this Slack channel ID instead of DMs (channel-mode for feed agents like Radar).
  channelId?: string;
}

export function createSlackBot(opts: SlackBotOptions) {
  const { botToken, appToken, allowedUserId, channelId: channelModeId } = opts;

  if (!allowedUserId) {
    logger.warn('ALLOWED_SLACK_USER_ID not set — bot will reject all messages. Set it in .env and restart.');
  }

  const app = new App({ token: botToken, appToken, socketMode: true });

  async function handleSlackMessage(
    client: InstanceType<typeof App>['client'],
    channelId: string,
    text: string,
    threadTs?: string,
  ): Promise<void> {
    audit({ agentId: AGENT_ID, chatId: channelId, action: 'message', detail: text.slice(0, 200), blocked: false });

    const sessionId = getSession(channelId, AGENT_ID);

    const { contextText: memCtx, surfacedMemoryIds, surfacedMemorySummaries } =
      await buildMemoryContext(channelId, text, AGENT_ID);

    const parts: string[] = [];
    if (agentSystemPrompt && !sessionId) {
      parts.push(`[Agent role — follow these instructions]\n${agentSystemPrompt}\n[End agent role]`);
    }
    if (memCtx) parts.push(memCtx);
    parts.push(text);
    const fullMessage = parts.join('\n\n');

    setProcessing(channelId, true);

    // Streaming state
    let streamTs: string | undefined;
    let lastStreamTime = 0;
    let lastStreamLen = 0;
    const streamingEnabled = STREAM_STRATEGY !== 'off';

    const onStreamText = streamingEnabled
      ? (accumulated: string) => {
          const now = Date.now();
          if (now - lastStreamTime < STREAM_INTERVAL_MS || accumulated.length - lastStreamLen < 20) return;
          lastStreamTime = now;
          lastStreamLen = accumulated.length;

          const displayText = accumulated + ' ▍';

          if (!streamTs) {
            void client.chat.postMessage({ channel: channelId, text: displayText, ...(threadTs ? { thread_ts: threadTs } : {}) })
              .then((res) => { streamTs = res.ts as string; })
              .catch(() => {});
          } else {
            void client.chat.update({ channel: channelId, ts: streamTs, text: displayText }).catch(() => {});
          }
        }
      : undefined;

    // Tool activity notifications — throttled to one message per 30s to avoid spam.
    // task_started / task_completed are always posted. tool_active is throttled.
    let lastToolNotifyTime = 0;
    const TOOL_NOTIFY_INTERVAL_MS = 30_000;
    const onProgress = (event: AgentProgressEvent) => {
      const now = Date.now();
      if (event.type === 'task_started') {
        void client.chat.postMessage({ channel: channelId, text: `🔄 ${event.description}`, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
      } else if (event.type === 'task_completed') {
        void client.chat.postMessage({ channel: channelId, text: `✓ ${event.description}`, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
      } else if (event.type === 'tool_active') {
        if (now - lastToolNotifyTime >= TOOL_NOTIFY_INTERVAL_MS) {
          lastToolNotifyTime = now;
          void client.chat.postMessage({ channel: channelId, text: `⚙️ ${event.description}…`, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
        }
      }
    };

    const abortCtrl = new AbortController();
    setActiveAbort(channelId, abortCtrl);
    const timeoutId = setTimeout(() => {
      logger.warn({ channelId, timeoutMs: AGENT_TIMEOUT_MS }, 'Agent query timed out');
      abortCtrl.abort();
    }, AGENT_TIMEOUT_MS);

    try {
      const result = await runAgent(
        fullMessage,
        sessionId,
        () => {},
        onProgress,
        agentDefaultModel,
        abortCtrl,
        onStreamText,
      );

      clearTimeout(timeoutId);
      setActiveAbort(channelId, null);

      if (result.newSessionId) {
        setSession(channelId, result.newSessionId, AGENT_ID);
      }

      const finalText = result.aborted
        ? (result.text === null
          ? `Timed out after ${Math.round(AGENT_TIMEOUT_MS / 1000)}s. Try breaking the task into smaller steps.`
          : 'Stopped.')
        : (result.text?.trim() || 'Done.');

      if (!result.aborted) {
        saveConversationTurn(channelId, text, finalText, result.newSessionId ?? sessionId, AGENT_ID);
        if (surfacedMemoryIds.length > 0) {
          void evaluateMemoryRelevance(surfacedMemoryIds, surfacedMemorySummaries, text, finalText).catch(() => {});
        }
      }

      if (streamTs) {
        await client.chat.update({ channel: channelId, ts: streamTs, text: finalText });
      } else {
        await client.chat.postMessage({ channel: channelId, text: finalText, ...(threadTs ? { thread_ts: threadTs } : {}) });
      }

    } catch (err) {
      clearTimeout(timeoutId);
      setActiveAbort(channelId, null);
      const errMsg = err instanceof Error ? err.message : String(err);

      // Session too long — auto-clear and retry once with a fresh session.
      if (errMsg.includes('Prompt is too long') && sessionId) {
        logger.warn({ channelId, sessionId }, 'Prompt too long — clearing session and retrying');
        clearSession(channelId, AGENT_ID);
        if (streamTs) {
          await client.chat.update({ channel: channelId, ts: streamTs, text: '_Session too long — starting fresh…_' }).catch(() => {});
        } else {
          await client.chat.postMessage({ channel: channelId, text: '_Session too long — starting fresh…_', ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
        }
        try {
          const retry = await runAgent(fullMessage, undefined, () => {}, onProgress, agentDefaultModel, new AbortController(), undefined);
          if (retry.newSessionId) setSession(channelId, retry.newSessionId, AGENT_ID);
          const retryText = retry.text?.trim() || 'Done.';
          saveConversationTurn(channelId, text, retryText, retry.newSessionId, AGENT_ID);
          if (streamTs) {
            await client.chat.update({ channel: channelId, ts: streamTs, text: retryText }).catch(() => {});
          } else {
            await client.chat.postMessage({ channel: channelId, text: retryText, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
          }
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          logger.error({ err: retryErr, channelId }, 'Slack agent error after session reset');
          await client.chat.postMessage({ channel: channelId, text: `Error after reset: ${retryMsg}`, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
        }
        setProcessing(channelId, false);
        return;
      }

      logger.error({ err, channelId }, 'Slack agent error');
      const errText = `Error: ${errMsg}`;
      if (streamTs) {
        await client.chat.update({ channel: channelId, ts: streamTs, text: errText }).catch(() => {});
      } else {
        await client.chat.postMessage({ channel: channelId, text: errText, ...(threadTs ? { thread_ts: threadTs } : {}) }).catch(() => {});
      }
    } finally {
      setProcessing(channelId, false);
    }
  }

  // ── Channel-mode handler (e.g. Radar #radar-feed) ───────────────────
  // When channelModeId is set, listen to ALL messages in that channel and reply in-thread.
  // Bot must be invited to the channel. DM handler is skipped in this mode.
  if (channelModeId) {
    app.event('message', async ({ event, client }) => {
      const msg = event as { subtype?: string; text?: string; channel: string; user?: string; ts?: string };
      if (msg.channel !== channelModeId) return;
      if (msg.subtype) return; // skip edits, bot messages, etc.
      if (!msg.user || !msg.text?.trim()) return;
      if (allowedUserId && msg.user !== allowedUserId) return;

      const text = msg.text.trim();
      const threadTs = msg.ts;
      touchActivity();
      messageQueue.enqueue(channelModeId, () => handleSlackMessage(client, channelModeId, text, threadTs));
    });
    return {
      async start(): Promise<void> {
        await app.start();
        logger.info({ agentId: AGENT_ID, channelId: channelModeId }, 'Slack bot running (channel mode)');
        console.log(`\n  ClaudeClaw [${AGENT_ID}] on Slack — listening to channel ${channelModeId}.\n`);
        startConnectionWatchdog(app);
      },
      async stop(): Promise<void> {
        await app.stop();
        logger.info({ agentId: AGENT_ID }, 'Slack bot stopped');
      },
      sendMessage: async (userId: string, text: string): Promise<void> => {
        await app.client.chat.postMessage({ channel: userId, text });
      },
    };
  }

  // ── DM message handler ───────────────────────────────────────────────
  // app.message() only fires for messages without a subtype; file_share has a subtype
  // so we use app.event('message') to receive all message events including file uploads.
  app.event('message', async ({ event, client }) => {
    const message = event as { subtype?: string; text?: string; channel: string; user?: string; bot_id?: string; files?: SlackFile[] };

    // ── Agent coordination bridge (command-bus) ────────────────────────
    // Accept a bot_message ONLY when it lands in the coord channel AND comes
    // from an allowlisted bot_id. Such a message is pre-authorised (it carries
    // no `user`), skips the per-user gate, and flows through the SAME
    // kill-phrase + lock + queue path as a normal user message. Our own posts
    // are never in ALLOWED_BOT_IDS, so this cannot self-loop.
    const isCoordBot =
      message.subtype === 'bot_message' &&
      !!AGENT_COORD_CHANNEL &&
      message.channel === AGENT_COORD_CHANNEL &&
      !!message.bot_id &&
      ALLOWED_BOT_IDS.includes(message.bot_id);

    // Allow plain messages, file_share (voice), and coord bot messages. Skip the rest.
    if (!isCoordBot && message.subtype && message.subtype !== 'file_share') return;
    const msg = message;

    // Per-user security gate — does not apply to pre-authorised coord bot messages.
    if (!isCoordBot) {
      if (!msg.user) return;

      if (allowedUserId && msg.user !== allowedUserId) {
        logger.warn({ user: msg.user }, 'Rejected message from unauthorised user');
        return;
      }

      if (!allowedUserId) {
        await client.chat.postMessage({
          channel: msg.channel,
          text: `Your Slack user ID is \`${msg.user}\`.\n\nAdd this to your .env:\n\`ALLOWED_SLACK_USER_ID=${msg.user}\`\n\nThen restart.`,
        });
        return;
      }
    }

    // Voice/audio handling: transcribe and treat as text input (user messages only).
    let text = msg.text?.trim() || '';
    if (!isCoordBot) {
      const audioFile = msg.files?.find((f) => f.mimetype?.startsWith('audio/'));
      if (audioFile?.url_private_download) {
        try {
          const localPath = await downloadSlackFile(botToken, audioFile.url_private_download, UPLOADS_DIR, audioFile.name);
          const transcribed = await transcribeAudio(localPath);
          text = `[Voice transcribed]: ${transcribed}`;
        } catch (err) {
          logger.error({ err, fileId: audioFile.id }, 'Slack voice transcription failed');
          await client.chat.postMessage({ channel: msg.channel, text: 'Could not transcribe voice message. Try again.' });
          return;
        }
      }
    }

    if (!text) return;

    // Tag coord-bot commands so the receiving agent knows the source.
    if (isCoordBot) {
      text = `[Agent message from ${message.bot_id} in #agent-coord]: ${text}`;
    }

    // Kill phrase
    if (checkKillPhrase(text)) {
      audit({ agentId: AGENT_ID, chatId: msg.channel, action: 'kill', detail: 'Emergency kill triggered', blocked: false });
      await client.chat.postMessage({ channel: msg.channel, text: 'EMERGENCY KILL activated. All agents stopping.' });
      executeEmergencyKill();
      return;
    }

    // Lock check — a coord bot cannot unlock the session (only the operator can).
    if (isLocked()) {
      if (!isCoordBot && unlock(text)) {
        audit({ agentId: AGENT_ID, chatId: msg.channel, action: 'unlock', detail: 'PIN accepted', blocked: false });
        await client.chat.postMessage({ channel: msg.channel, text: 'Unlocked. Session active.' });
      } else {
        audit({ agentId: AGENT_ID, chatId: msg.channel, action: 'blocked', detail: 'Session locked', blocked: true });
        await client.chat.postMessage({ channel: msg.channel, text: 'Session locked. Send your PIN to unlock.' });
      }
      return;
    }

    touchActivity();
    messageQueue.enqueue(msg.channel, () => handleSlackMessage(client, msg.channel, text));
  });

  // ── File_shared handler (voice/audio notes) ─────────────────────────
  // message.im does not reliably deliver file_share subtype events in Bolt.
  // file_shared fires separately and gives us file_id + channel_id; we call
  // files.info to get url_private_download, then transcribe if audio.
  app.event('file_shared', async ({ event, client }) => {
    const { file_id, channel_id, user_id } = event as { file_id: string; channel_id: string; user_id: string };

    if (allowedUserId && user_id !== allowedUserId) return;
    if (!allowedUserId) return;

    let fileInfo: { file?: { mimetype?: string; name?: string; url_private_download?: string } };
    try {
      fileInfo = await client.files.info({ file: file_id }) as typeof fileInfo;
    } catch (err) {
      logger.error({ err, file_id }, 'files.info failed');
      return;
    }

    const f = fileInfo.file;
    if (!f?.url_private_download || !f.mimetype) return;

    try {
      const localPath = await downloadSlackFile(botToken, f.url_private_download, UPLOADS_DIR, f.name);
      let text: string;
      if (f.mimetype.startsWith('audio/')) {
        const transcribed = await transcribeAudio(localPath);
        text = `[Voice transcribed]: ${transcribed}`;
      } else if (f.mimetype.startsWith('image/')) {
        text = buildPhotoMessage(localPath, f.name);
      } else {
        text = buildDocumentMessage(localPath, f.name ?? 'file', undefined);
      }
      touchActivity();
      messageQueue.enqueue(channel_id, () => handleSlackMessage(client, channel_id, text));
    } catch (err) {
      logger.error({ err, file_id }, 'Slack file handling failed');
      await client.chat.postMessage({ channel: channel_id, text: 'Could not process that file. Try again.' });
    }
  });

  // Slash commands are namespaced per agent (e.g. /bridge-newchat, /scout-stop)
  // because Slack treats slash commands as workspace-global — last app installed
  // wins on collisions. Namespacing avoids cross-agent overrides.
  app.command(`/${AGENT_ID}-newchat`, async ({ ack, respond, command }) => {
    await ack();
    if (allowedUserId && command.user_id !== allowedUserId) return;
    clearSession(command.channel_id, AGENT_ID);
    await respond('Session cleared. Starting fresh.');
  });

  app.command(`/${AGENT_ID}-stop`, async ({ ack, respond, command }) => {
    await ack();
    if (allowedUserId && command.user_id !== allowedUserId) return;
    abortActiveQuery(command.channel_id);
    await respond('Stopping current query.');
  });

  app.error(async (error) => {
    logger.error({ err: error }, 'Slack bot error');
  });

  return {
    async start(): Promise<void> {
      await app.start();
      logger.info({ agentId: AGENT_ID }, 'Slack bot running');
      console.log(`\n  ClaudeClaw [${AGENT_ID}] on Slack — send a DM to start.\n`);
      startConnectionWatchdog(app);
    },
    async stop(): Promise<void> {
      await app.stop();
    },
    async sendMessage(userId: string, text: string): Promise<void> {
      try {
        const dm = await app.client.conversations.open({ users: userId });
        const channelId = dm.channel?.id;
        if (channelId) {
          await app.client.chat.postMessage({ channel: channelId, text });
        }
      } catch (err) {
        logger.error({ err }, 'Failed to send Slack message');
      }
    },
  };
}
