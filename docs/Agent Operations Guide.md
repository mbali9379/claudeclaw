# ClaudeClaw Agent Operations Guide

This guide covers how to add, remove, and troubleshoot ClaudeClaw agents. It is split into two tracks:

- **Part 1 (Human Setup)** is a step-by-step walkthrough for a person sitting at the keyboard.
- **Part 2 (AI Agent Setup)** is the minimal-command path for an AI agent that needs to bring a new agent online programmatically.

Both tracks end in the same result: a Telegram bot running 24/7 as a background service.

---

## Part 1: Adding a New Agent (Human Setup)

This is the full manual process. Follow every step in order.

### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. When prompted, give the bot a display name (e.g. "HSTM Ops")
4. When prompted, give the bot a username (must end in `bot`, e.g. `hstm_ops_bot`)
5. BotFather will reply with a token that looks like `1234567890:AAF-xxxxxxxxxxxxxxxxxxxx`
6. Copy that token. You will need it in Step 3.

### Step 2: Create the Agent Directory

Every agent lives in its own folder under `agents/`. Copy the template:

```bash
cd ~/Projects/claudeclaw
cp -r agents/_template agents/myagent
```

Replace `myagent` with your agent's ID (lowercase, no spaces, no hyphens). This ID is used everywhere: folder name, service file, env var prefix, CLI flag.

### Step 3: Configure agent.yaml

Open `agents/myagent/agent.yaml` and fill it in:

```yaml
name: My Agent
description: What this agent does in one sentence.

telegram_bot_token_env: MYAGENT_BOT_TOKEN

model: claude-sonnet-4-6

obsidian:
  vault: /home/junebug/Brain
  folders:
    - 2. Areas/02 HSTM/Operations/MyAgent/
  read_only:
    - 0. Capture/
    - 2. Areas/02 HSTM/Products/
```

Notes:
- `telegram_bot_token_env` is the name of the environment variable (not the token itself). Convention is `UPPERCASE_BOT_TOKEN`.
- `model` options: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`. Users can override per-chat with `/model` in Telegram.
- `folders` are read-write. `read_only` folders are loaded as context but the agent won't write to them.

### Step 4: Configure CLAUDE.md

Open `agents/myagent/CLAUDE.md`. This is the agent's system prompt. Edit the template:

- Replace `[Agent Name]` with the agent's name
- Replace `[Describe what this agent does]` with its role
- Replace `[AGENT_ID]` in the hive mind SQL with the actual agent ID (e.g. `myagent`)
- List the Obsidian folders it owns

Do not remove the Hive Mind, Scheduling, Data Integrity, or Rules sections. These are shared infrastructure that all agents depend on.

### Step 5: Add the Bot Token to .env

Open the `.env` file in the project root:

```bash
nano ~/Projects/claudeclaw/.env
```

Add a line with your token:

```
MYAGENT_BOT_TOKEN=1234567890:AAF-xxxxxxxxxxxxxxxxxxxx
```

The variable name must match exactly what you put in `telegram_bot_token_env` in Step 3.

### Step 6: Rebuild the Project

```bash
cd ~/Projects/claudeclaw && npm run build
```

This compiles TypeScript to `dist/`. If the build fails, fix the errors before continuing.

### Step 7: Test the Agent Manually

Before creating a service file, verify the agent starts:

```bash
cd ~/Projects/claudeclaw && node dist/index.js --agent myagent
```

You should see the ClaudeClaw ASCII banner and a log line confirming the agent is running. Send a test message to the bot in Telegram. If it responds, move on. If it crashes, check the error output before proceeding.

Press `Ctrl+C` to stop the manual test.

### Step 8: Create the systemd Service File

Create a service file so the agent runs in the background and starts on boot:

```bash
cat > ~/.config/systemd/user/claudeclaw-myagent.service << 'EOF'
[Unit]
Description=ClaudeClaw Telegram Bot (myagent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/junebug/Projects/claudeclaw
ExecStart=/home/junebug/.nvm/versions/node/v20.20.0/bin/node dist/index.js --agent myagent
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
```

Replace every instance of `myagent` with your agent ID. The `ExecStart` path must point to the exact Node.js binary. To find yours, run `which node`.

### Step 9: Enable and Start the Service

```bash
systemctl --user daemon-reload
systemctl --user enable claudeclaw-myagent.service
systemctl --user start claudeclaw-myagent.service
```

- `daemon-reload` tells systemd to pick up the new file
- `enable` means it starts automatically on boot
- `start` launches it now

### Step 10: Verify

```bash
systemctl --user status claudeclaw-myagent.service
```

You should see `Active: active (running)`. Send another test message in Telegram to confirm.

---

## Part 2: Adding a New Agent (AI Agent Setup)

This section is for AI agents (Claude Code, etc.) that need to bring a new ClaudeClaw agent online. The goal is the fewest possible commands with no interactive prompts.

### Prerequisites

Before starting, you need:
- The agent ID (lowercase, no spaces, e.g. `ops`)
- A Telegram bot token (the human must create this via @BotFather and provide it)
- The agent's role description and vault folder assignments

AI agents cannot create Telegram bots. A human must do Step 1 from Part 1 and hand you the token.

### The fast path: 4 commands

**Command 1: Create the agent directory and config files.**

```bash
cd ~/Projects/claudeclaw

# Copy template
cp -r agents/_template agents/AGENT_ID

# Write agent.yaml
cat > agents/AGENT_ID/agent.yaml << 'EOF'
name: Agent Name
description: What this agent does.
telegram_bot_token_env: AGENTID_BOT_TOKEN
model: claude-sonnet-4-6
obsidian:
  vault: /home/junebug/Brain
  folders:
    - 2. Areas/02 HSTM/Operations/AgentName/
EOF

# Write CLAUDE.md (copy from template, then edit the placeholders)
# Or write the full file directly -- just preserve the Hive Mind,
# Scheduling, Data Integrity, and Rules sections from the template.
```

**Command 2: Add the bot token to .env.**

```bash
echo 'AGENTID_BOT_TOKEN=token_from_human' >> ~/Projects/claudeclaw/.env
```

**Command 3: Build and install the service.**

```bash
cd ~/Projects/claudeclaw && npm run build && bash scripts/agent-service.sh install AGENT_ID
```

`agent-service.sh` handles everything: creates the systemd service file, runs `daemon-reload`, enables the service, and starts it.

**Command 4: Verify.**

```bash
systemctl --user status claudeclaw-AGENT_ID.service
```

If `Active: active (running)`, the agent is live on Telegram.

### Note on service naming

On Linux, all services use the `claudeclaw-{id}` naming pattern. On macOS, launchd plists use `com.claudeclaw.agent-{id}`. The `agent-service.sh` script handles this automatically based on the OS.

### What AI agents cannot do

- Create Telegram bots (requires human interaction with @BotFather)
- Decide vault folder assignments without context (ask the human or read existing agent configs for patterns)
- Run interactive scripts (`agent-create.sh` uses `read -p` prompts, so it cannot be used non-interactively)

---

## Part 3: Removing an Agent

### Human path

```bash
# Stop and disable
systemctl --user stop claudeclaw-myagent.service
systemctl --user disable claudeclaw-myagent.service

# Delete service file
rm ~/.config/systemd/user/claudeclaw-myagent.service
systemctl --user daemon-reload

# Remove agent directory
rm -rf ~/Projects/claudeclaw/agents/myagent

# Remove token from .env (edit the file, delete the MYAGENT_BOT_TOKEN line)
nano ~/Projects/claudeclaw/.env

# (Optional) Delete the Telegram bot via @BotFather > /deletebot
```

### AI agent path

```bash
cd ~/Projects/claudeclaw && bash scripts/agent-service.sh uninstall myagent
rm -rf agents/myagent
# Remove the token line from .env
sed -i '/^MYAGENT_BOT_TOKEN=/d' .env
```

---

## Part 4: Troubleshooting

### All agents crashing with segmentation fault (SEGV)

**Symptoms:**
- `systemctl --user status claudeclaw-*.service` shows `Active: activating (auto-restart)` and `Result: core-dump`
- Logs show `code=dumped, status=11/SEGV`
- Restart counter is climbing (50+, 100+, 200+)

**Cause:** A system update (often automatic via `unattended-upgrades`) updated the kernel or system libraries. Native Node.js modules (like `better-sqlite3`) were compiled against the old libraries and are now incompatible.

**What is happening:** ClaudeClaw uses `better-sqlite3`, a database library that includes compiled C++ code. This compiled code is built to work with a specific version of the system's low-level libraries. When Ubuntu runs a background update (which it does by default), it can replace those libraries with newer versions. The compiled code then tries to call functions that no longer match, causing a segmentation fault (the program tries to access memory it shouldn't).

**Fix:**

```bash
cd ~/Projects/claudeclaw && npm rebuild
```

Then restart all agents:

```bash
systemctl --user restart claudeclaw.service claudeclaw-bridge.service claudeclaw-lens.service claudeclaw-lumae.service claudeclaw-scout.service claudeclaw-oracle.service claudeclaw-radar.service
```

`npm rebuild` recompiles all native modules against the current system libraries. The restart picks up the new binaries.

**How to confirm this was the cause:**

```bash
grep "Start-Date" /var/log/apt/history.log | tail -10
```

If you see `unattended-upgrade` entries from the same day the crashes started, that was the trigger.

### One agent crashes but others are fine

**Symptoms:** A single service is in `auto-restart` while the rest are `running`.

**Steps:**
1. Check the logs:
   ```bash
   journalctl --user -u claudeclaw-myagent.service -n 50 --no-pager
   ```
2. Look for the actual error message before the crash. Common causes:
   - **Invalid bot token**: the env var in `.env` is wrong or missing. Check that the variable name in `.env` matches `telegram_bot_token_env` in `agent.yaml` exactly.
   - **Telegram conflict**: another process is polling the same bot token. Only one process can poll a Telegram bot at a time. Kill the other process or stop the duplicate service.
   - **Bad CLAUDE.md**: syntax errors in the agent's `CLAUDE.md` can cause startup failures. Check for unclosed code blocks or invalid YAML frontmatter.

### Agent is running but not responding in Telegram

**Steps:**
1. Confirm the service is actually running:
   ```bash
   systemctl --user status claudeclaw-myagent.service
   ```
2. Check the logs for errors:
   ```bash
   journalctl --user -u claudeclaw-myagent.service -n 30 --no-pager
   ```
3. Make sure you messaged the correct bot in Telegram (each agent has its own bot).
4. Try sending `/start` to the bot. Some bots require this to initialise the chat.

### "command not found" when running systemctl

**Cause:** The command got split across multiple lines when pasting, or the shell doesn't have `/usr/bin` in its PATH.

**Fix:** Use the full path:
```bash
/usr/bin/systemctl --user status claudeclaw.service
```

### How to restart all agents at once

```bash
systemctl --user restart claudeclaw.service claudeclaw-bridge.service claudeclaw-lens.service claudeclaw-lumae.service claudeclaw-scout.service claudeclaw-oracle.service claudeclaw-radar.service
```

### How to see which agents are running

```bash
systemctl --user list-units 'claudeclaw*' --no-pager
```

### How to see all installed agent services (including stopped ones)

```bash
systemctl --user list-unit-files 'claudeclaw*' --no-pager
```

### How to check if a system update happened recently

```bash
grep "Start-Date" /var/log/apt/history.log | tail -10
```

---

## Quick Reference

### Current Agents

| Agent ID | Bot Token Env Var | Model | Service File |
|----------|------------------|-------|-------------|
| (main) | TELEGRAM_BOT_TOKEN | - | claudeclaw.service |
| bridge | BRIDGE_BOT_TOKEN | - | claudeclaw-bridge.service |
| lens | LENS_BOT_TOKEN | - | claudeclaw-lens.service |
| lumae | LUMAE_BOT_TOKEN | - | claudeclaw-lumae.service |
| scout | SCOUT_BOT_TOKEN | sonnet | claudeclaw-scout.service |
| oracle | ORACLE_BOT_TOKEN | opus | claudeclaw-oracle.service |
| radar | RADAR_BOT_TOKEN | - | claudeclaw-radar.service |

### File Locations

| What | Where |
|------|-------|
| Service files | `~/.config/systemd/user/` |
| Agent configs | `~/Projects/claudeclaw/agents/{agent_id}/` |
| Bot tokens | `~/Projects/claudeclaw/.env` |
| Agent template | `~/Projects/claudeclaw/agents/_template/` |
| Create script (interactive, for humans) | `~/Projects/claudeclaw/scripts/agent-create.sh` |
| Service installer (scriptable, for AI agents) | `~/Projects/claudeclaw/scripts/agent-service.sh` |
| Compiled output | `~/Projects/claudeclaw/dist/` |

### Key Commands

| Action | Command |
|--------|---------|
| Build project | `cd ~/Projects/claudeclaw && npm run build` |
| Rebuild native modules | `cd ~/Projects/claudeclaw && npm rebuild` |
| Start an agent manually | `node dist/index.js --agent {id}` |
| Install agent as service | `bash scripts/agent-service.sh install {id}` |
| Uninstall agent service | `bash scripts/agent-service.sh uninstall {id}` |
| Check service status | `systemctl --user status claudeclaw-{id}.service` |
| View service logs | `journalctl --user -u claudeclaw-{id}.service -n 50 --no-pager` |
| List all running agents | `systemctl --user list-units 'claudeclaw*' --no-pager` |
