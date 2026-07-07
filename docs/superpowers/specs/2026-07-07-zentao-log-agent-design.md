# Zentao Log Agent Design

## Goal

Build a personal local Agent that helps each user generate, preview, edit, and automatically submit Zentao work logs with Playwright.

## User Model

Each user runs the Agent on their own computer. There is no shared multi-user server. All user-specific values are stored in local JSON files, including Zentao credentials, LLM configuration, report defaults, schedule settings, and source preferences.

## Runtime Flow

The Agent starts a local web console and opens it in a browser. The user can enter or edit:

- Zentao login URL, username, and password.
- LLM base URL, API key, model, and request settings.
- Report date range.
- Report source: code repository summary or long text input.
- Git, HG, SVN repository paths or long text content.

The Agent generates a per-day preview, lets the user edit it, and then uses Playwright to log in to Zentao and fill the logs.

## Schedule

The default weekly automation runs in the `Asia/Shanghai` timezone:

- Every Friday at 16:00: generate the preview and open the local console.
- Every Friday at 17:00: automatically submit the current preview to Zentao.
- The confirmation window is 60 minutes.

If preview generation fails, required config is missing, or no preview exists at 17:00, the Agent does not submit.

## Default Period

The default period is Monday through today. If today is Saturday or Sunday, the period is Monday through Friday. During the Friday scheduled run, the default period is Monday through Friday.

## Sources

### Code Repository Summary

The user selects Git, HG, or SVN and provides one or more local repository directories. The Agent reads commits in the selected date range, groups them by day, and asks the configured LLM to summarize each day in Chinese.

If a day has no matching commits, the preview marks that day as empty so the user can edit it.

### Long Text Input

The user enters a long natural-language work description. The Agent asks the LLM to split it into dated Chinese work-log entries that fit the selected date range.

## Configuration

All configuration is stored in JSON. The first version uses a single file:

`config/config.json`

The Agent creates this file from defaults when it is missing. The file includes:

- `zentao`
- `llm`
- `report`
- `schedule`
- `automation`

## Automation Safety

The Agent stores a preview snapshot before submission. At 17:00 it submits the latest preview, including any edits made by the user during the confirmation window.

Passwords and API keys are stored in local JSON because the user explicitly requested JSON-only configuration. The console should avoid logging secrets.

## Implementation Scope

First version includes:

- Local Node.js service.
- Local browser console.
- JSON config read and write.
- Default period calculation.
- Git, HG, and SVN log extraction.
- LLM summary and long-text parsing.
- Preview storage and editing.
- Friday 16:00 preview generation.
- Friday 17:00 automatic Zentao filling.
- Playwright browser automation.
- Execution logs and screenshots under `output/playwright/`.

Out of scope:

- Multi-user server deployment.
- Database.
- Encrypted credential vault.
- Cloud scheduling.
