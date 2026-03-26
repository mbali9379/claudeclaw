---
name: google-calendar
description: Manage your Google Calendar from Claude Code using the Google Workspace CLI (gws). View agenda, create events with Meet links, send invites, check availability.
allowed-tools: Bash(gws calendar *)
---

# Google Calendar Skill

## Purpose

Create meetings with Google Meet links, send invites, check availability, and manage calendar events using the `gws` CLI.

## Prerequisites

- `@googleworkspace/cli` installed globally (`npm install -g @googleworkspace/cli`)
- Authenticated via `gws auth login` with a Google Workspace account
- Google Calendar API enabled in the GCP project

## Commands

### Show today's agenda

```bash
gws calendar +agenda --today
```

### Show upcoming events (default: 24 hours)

```bash
gws calendar +agenda
```

### Show next N days

```bash
gws calendar +agenda --days 7
```

### Show this week

```bash
gws calendar +agenda --week
```

### Filter to a specific calendar

```bash
gws calendar +agenda --today --calendar 'Work'
```

### Override timezone

```bash
gws calendar +agenda --today --timezone Europe/Tallinn
```

### Create an event

```bash
gws calendar +insert --summary 'Meeting Title' --start '2026-03-25T10:00:00+02:00' --end '2026-03-25T10:30:00+02:00'
```

### Create with Meet link and attendees

```bash
gws calendar +insert --summary 'Review' --start '2026-03-25T10:00:00+02:00' --end '2026-03-25T10:30:00+02:00' --attendee alice@example.com --attendee bob@example.com --meet
```

### Add description and location

```bash
gws calendar +insert --summary 'Offsite' --start '...' --end '...' --location 'Tallinn HQ' --description 'Quarterly review'
```

### List events (raw API)

```bash
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-03-24T00:00:00Z", "timeMax": "2026-03-25T00:00:00Z", "singleEvents": true, "orderBy": "startTime"}'
```

### Get a specific event

```bash
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

### Update an event

```bash
gws calendar events patch --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' --json '{"summary": "New Title", "location": "Updated Location"}'
```

### Delete an event

```bash
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

### Check free/busy

```bash
gws calendar freebusy query --json '{"timeMin": "2026-03-25T09:00:00+02:00", "timeMax": "2026-03-25T17:00:00+02:00", "items": [{"id": "primary"}]}'
```

## Output Formats

All commands support `--format`:
- `json` (default) -- structured, parseable
- `table` -- human-readable
- `yaml` -- verbose structured
- `csv` -- spreadsheet-friendly

## CRITICAL: Day-of-Week Verification

**NEVER assume a date from a day name** (e.g. "Monday", "next Thursday"). Always verify before creating an event:

```bash
python3 -c "from datetime import date; d = date(2026, 3, 25); print(f'{d.strftime(\"%A\")} {d}')"
```

If the output day name does NOT match what was requested, find the correct date. This is a **blocking requirement**.

## Confirmation Before Creating

Always show the user what you're about to create before running the command:
- Title
- **Day of week + Date/time** (e.g. "Wednesday Mar 25, 10:00")
- Duration
- Attendees
- Meet: yes/no

Then ask for confirmation before executing.

## Datetime Format

Use RFC 3339 with timezone offset:
- `2026-03-25T10:00:00+02:00` (EET)
- `2026-03-25T10:00:00Z` (UTC)

## Defaults

- Duration: 30 minutes (unless the user specifies otherwise)
- Always add `--meet` unless the user specifically says no video call
- Invites are sent to all attendees automatically

## Error Handling

- If auth fails, run `gws auth login`
- If API not enabled, point user to GCP console to enable Calendar API
- If event creation fails, show error and ask the user what to do
