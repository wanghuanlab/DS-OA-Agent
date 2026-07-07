# Zentao Log Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node.js and Playwright Agent that generates, previews, edits, and submits Zentao work logs from Git, HG, SVN commits or long text.

**Architecture:** A Fastify local server serves a lightweight browser console and exposes JSON APIs for config, preview generation, preview editing, and Zentao submission. Domain modules handle config, date periods, HG extraction, LLM calls, scheduling, and Playwright automation.

**Tech Stack:** Node.js ESM, Fastify, Playwright, node-cron, Mercurial CLI, built-in `node:test`, JSON config files.

---

## File Structure

- `package.json`: scripts and dependencies.
- `config/config.json`: local JSON configuration created from defaults.
- `src/index.js`: process entrypoint, starts server, scheduler, and opens console.
- `src/config.js`: load, validate, save, and redact config.
- `src/period.js`: default period calculation and date helpers.
- `src/vcs.js`: read Git, HG, and SVN logs grouped by date.
- `src/llm.js`: call OpenAI-compatible chat completion APIs.
- `src/generator.js`: generate preview from HG or long text.
- `src/preview-store.js`: persist current preview for confirmation and scheduled submit.
- `src/zentao.js`: Playwright login and fill workflow.
- `src/scheduler.js`: Friday 16:00 preview and 17:00 submit jobs.
- `src/server.js`: local API and static console.
- `public/index.html`: local browser console.
- `public/app.js`: console behavior.
- `public/styles.css`: console styling.
- `test/period.test.js`: date period tests.
- `test/long-text-schema.test.js`: LLM JSON extraction tests.

## Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `config/config.json`
- Create: `src/index.js`
- Create: `public/index.html`

- [ ] Create package metadata and scripts.
- [ ] Add dependencies: `@playwright/test`, `fastify`, `node-cron`, and `open`.
- [ ] Add scripts: `start`, `test`, and `install:browsers`.
- [ ] Create initial config with JSON-only secrets.
- [ ] Create a minimal server entrypoint and placeholder console page.
- [ ] Run `npm install`.
- [ ] Run `npm test`.

### Task 2: Config and Period Logic

**Files:**
- Create: `src/config.js`
- Create: `src/period.js`
- Create: `test/period.test.js`

- [ ] Write tests for Monday-Friday default periods, weekday today behavior, and weekend Friday cutoff.
- [ ] Implement `getDefaultPeriod(now, timezone)` and date formatting helpers.
- [ ] Implement config load/save with default creation and secret redaction.
- [ ] Run `npm test`.

### Task 3: HG and LLM Generation

**Files:**
- Create: `src/hg.js`
- Create: `src/llm.js`
- Create: `src/generator.js`
- Create: `test/long-text-schema.test.js`

- [ ] Implement HG log command execution per repository and group commits by ISO date.
- [ ] Implement OpenAI-compatible chat completion call from JSON config.
- [ ] Implement HG prompt that returns Chinese per-day work items.
- [ ] Implement long-text prompt that returns strict JSON grouped by date.
- [ ] Add a robust JSON extraction helper and tests.
- [ ] Run `npm test`.

### Task 4: Preview Store and Local API

**Files:**
- Create: `src/preview-store.js`
- Create: `src/server.js`
- Modify: `src/index.js`

- [ ] Implement preview persistence under `output/preview/current.json`.
- [ ] Add API endpoints: config read/save, preview generate, preview read/save, submit.
- [ ] Start Fastify and open the local console in the browser.
- [ ] Run `npm test`.

### Task 5: Browser Console

**Files:**
- Modify: `public/index.html`
- Create: `public/app.js`
- Create: `public/styles.css`

- [ ] Build form sections for Zentao, LLM, period, source selection, HG paths, and long text.
- [ ] Build preview table grouped by date with editable textareas.
- [ ] Add actions for save config, generate preview, save preview, and submit now.
- [ ] Add scheduled-submit status and confirmation-window copy.
- [ ] Verify the page loads from the local server.

### Task 6: Zentao Playwright Automation

**Files:**
- Create: `src/zentao.js`

- [ ] Use Playwright headed browser by default.
- [ ] Log in with configured Zentao URL, username, and password.
- [ ] Discover and document selectors from the live Zentao page.
- [ ] Fill each preview date and content.
- [ ] Save screenshots and execution logs under `output/playwright/`.
- [ ] Keep browser open on error when configured.

### Task 7: Scheduler

**Files:**
- Create: `src/scheduler.js`
- Modify: `src/index.js`

- [ ] Register Friday 16:00 preview generation with `node-cron`.
- [ ] Register Friday 17:00 submit with `node-cron`.
- [ ] Ensure 17:00 submit requires an existing preview.
- [ ] Open the local console at 16:00.
- [ ] Run `npm test`.

### Task 8: End-to-End Verification

**Files:**
- Modify as needed based on live Zentao behavior.

- [ ] Run `npm start`.
- [ ] Open the local console.
- [ ] Save JSON config through the UI.
- [ ] Generate preview from long text.
- [ ] Generate preview from an HG repository.
- [ ] Run Playwright login against Zentao.
- [ ] Adjust selectors until filling works.
- [ ] Confirm screenshots are written to `output/playwright/`.
