---
name: gmail
description: Manage your Gmail inbox from Claude Code using the Google Workspace CLI (gws). Triage, read, reply, send, and forward emails.
allowed-tools: Bash(gws gmail *)
---

# Gmail Skill

## Purpose

Read, triage, reply, send, and forward emails from your Gmail inbox using the `gws` CLI.

## Prerequisites

- `@googleworkspace/cli` installed globally (`npm install -g @googleworkspace/cli`)
- Authenticated via `gws auth login` with a Google Workspace account
- Gmail API enabled in the GCP project

## Commands

### Triage inbox (unread summary)

```bash
gws gmail +triage
```

Returns a table of unread messages: sender, subject, date.

### Triage with filters

```bash
gws gmail +triage --max 10
gws gmail +triage --query 'from:client@example.com'
gws gmail +triage --query 'is:unread after:2026/03/20'
gws gmail +triage --labels
```

### Read a specific email

```bash
gws gmail +read --id MESSAGE_ID
```

### Read with headers

```bash
gws gmail +read --id MESSAGE_ID --headers
```

### Read as JSON

```bash
gws gmail +read --id MESSAGE_ID --format json
```

### Reply to an email

```bash
gws gmail +reply --message-id MESSAGE_ID --body 'Thanks, got it!'
```

### Reply with CC and attachments

```bash
gws gmail +reply --message-id MESSAGE_ID --body 'Looping in Carol' --cc carol@example.com -a report.pdf
```

### Reply all

```bash
gws gmail +reply-all --message-id MESSAGE_ID --body 'Noted, thanks everyone.'
```

### Forward an email

```bash
gws gmail +forward --message-id MESSAGE_ID --to recipient@example.com --body 'FYI, see below.'
```

### Send a new email

```bash
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi Alice!'
```

### Send with CC, BCC, and attachments

```bash
gws gmail +send --to alice@example.com --subject 'Report' --body 'See attached' --cc bob@example.com -a report.pdf -a data.csv
```

### Send HTML email

```bash
gws gmail +send --to alice@example.com --subject 'Update' --body '<p>Here is the <b>update</b>.</p>' --html
```

### Send from alias

```bash
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi!' --from hello@hstm.eu
```

### Watch for new emails (streaming)

```bash
gws gmail +watch
```

### List messages (raw API)

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 10, "q": "is:unread"}'
```

### List labels

```bash
gws gmail users labels list --params '{"userId": "me"}'
```

### Modify labels (move/archive)

```bash
gws gmail users messages modify --params '{"userId": "me", "id": "MESSAGE_ID"}' --json '{"removeLabelIds": ["INBOX"], "addLabelIds": ["Label_123"]}'
```

## Output Formats

All helper commands support `--format`:
- `json` -- structured, parseable
- `table` -- human-readable (default for +triage)
- `text` -- plain text (default for +read)

## Workflow

1. Run `gws gmail +triage` to show unread inbox
2. Display results to the user
3. Ask which emails to read, reply to, or act on
4. Execute the requested action

## Drafting Rules

- Always draft email content and show the user before sending
- Never send without confirmation
- Use `--dry-run` to preview what would be sent

## Error Handling

- If auth fails, run `gws auth login`
- If API not enabled, point user to GCP console to enable Gmail API
- If send fails, show error and ask the user what to do
