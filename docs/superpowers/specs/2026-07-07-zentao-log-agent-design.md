# Zentao Log Agent Design

## v1.0.2 Goal

Build a local desktop client that turns Git, Mercurial, and Subversion commit history into editable Chinese work logs and submits confirmed entries to Zentao without requiring the user to open the Zentao website.

## Product Principles

- **Evidence-based summaries:** derive work descriptions from version-control commits within the selected date range and author set.
- **One local workflow:** detect Zentao connectivity, retrieve tasks, generate a preview, and submit logs from the desktop client.
- **User confirmation:** all generated entries remain editable and are submitted only after an explicit user action.
- **Local-first configuration:** credentials, LLM settings, repository paths, task associations, and previews stay in the current user's local data directory.

## Runtime Flow

1. The app starts a Fastify service on `127.0.0.1` and displays the UI in an Electron window.
2. The status action checks whether the Zentao address is reachable, logs in when credentials are available, and retrieves the current user's task list.
3. The user selects a date range and one or more local repositories. Repository type is detected automatically; ordinary directories are ignored.
4. The app reads commits from selected authors and asks the configured LLM to summarize them by date and associated task.
5. The preview supports multiple entries per date. The user can edit each task, work description, and duration before submission.
6. The app submits confirmed entries through Zentao's HTTP form endpoint and calculates remaining task hours from the estimate and accumulated consumption.

There is no scheduled generation or automatic submission in v1.0.2.

## Supported Repositories

- Git through the local `git` command.
- Mercurial through the local `hg` command.
- Subversion through the local `svn` command.

Repository configuration stores the path, associated Zentao task, and selected commit authors. The most recent selections are restored on the next launch.

## Default Period

The default period is Monday through today. On Saturday or Sunday, the end date is the preceding Friday.

## Configuration And Privacy

All user-specific configuration is JSON. Desktop builds store it under the operating system's per-user application data directory; Web mode uses the ignored `config/config.json` file.

The stored data includes:

- Zentao address and credentials.
- LLM Base URL, API Key, and model.
- Repository paths, task associations, and selected authors.
- The latest editable preview.

Secrets must not be logged or committed. The app sends credentials only to the configured Zentao service and sends the minimum commit information needed for summarization to the user-configured LLM service.

## v1.0.2 Scope

- Electron clients for macOS and Windows.
- Three-step preparation, preview, and submission workspace.
- Git, HG, and SVN auto-detection and commit extraction.
- LLM-generated Chinese work summaries.
- Multiple task entries per date.
- Zentao status detection, task retrieval, and HTTP form submission.
- Automatic remaining-hours calculation.
- JSON-only local configuration with automatic saving.

Out of scope:

- Multi-user server deployment.
- Scheduled or unattended submission.
- Cloud-side configuration storage.
- Encrypted credential vault.
