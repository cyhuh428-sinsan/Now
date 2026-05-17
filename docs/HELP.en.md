# NowNote Help

NowNote can be used as a local-only personal note app, or connected to a server to sync notes across devices.

Start by choosing one of the two usage modes below.

## Usage Mode

### 1. Standalone User

Standalone users store notes only on the current device without connecting to a server.

This mode fits when:

- You manage notes on one phone or one PC.
- You want to start without server setup, accounts, or tokens.
- You do not want personal notes uploaded to an external server.
- You want a lightweight place for tests or temporary records.

Available features:

- Daily notes
- Knowledge notes
- Search
- Tags
- Backlinks and linked-note view
- Markdown writing and preview
- Trash
- Backup and restore: JSON for Web/installed apps, DB for mobile
- Markdown import and export
- Display settings
- Shortcut settings

Unavailable features:

- Automatic sync with other devices
- Server backup
- Server-based user management
- Server-based LLM analysis jobs
- Encrypted storage for server-login users

Standalone users should periodically use backup or Markdown export. Web/installed apps use JSON backup, while the mobile app uses DB backup.

### 2. Server-Connected User

Server-connected users connect to a NowNote server and sync notes.

There are two server connection modes.

- Personal server: Install your own server with Docker containers.
- Public server: Connect with an account issued by an existing NowNote server operator.

This mode fits when:

- You want the same notes on phone, PC, and installed desktop apps.
- You want a server-side backup copy.
- You need to manage accounts, devices, and access status.
- You want to use server-based analysis features.
- You may later use login-based encrypted storage.

Available features:

- All standalone-user features
- Server sync
- Server backup
- User profile
- Per-user time zone
- User groups
- Active status management
- Two-factor authentication status management
- Per-device sync history
- Server operations dashboard
- Server-based recording storage
- Server-based analysis jobs

Notes:

- A server URL and API token are required.
- API tokens entered in the app and installed programs are stored in the device secure storage.
- Personal server users must change the token and database password in `.env`.
- Public server users use connection information issued by the operator.
- Archived daily notes are not deleted after server connection. They stay as inactive backup records.

## Platform Guidelines

### Mobile App

The mobile app focuses on fast input.

Recommended flow:

- Quickly write today's note from Home.
- Add daily notes by voice or typing.
- Create hierarchical notes when needed.
- Server-connected users enter the server URL and token in settings.
- API tokens entered in the app are stored in the device secure storage.

Important mobile features:

- Daily notes
- Voice notes
- Quick note input
- Server sync
- Connection status
- Server recording upload status
- Server analysis job creation and result review

### Web / Installed App

Web and installed apps focus on knowledge notes.

Recommended flow:

- Organize knowledge with topic / category / note structure.
- Write longer content in Markdown.
- Explore notes with search, tags, backlinks, and linked-note view.
- Open daily notes briefly when needed.
- Adjust shortcuts and feature visibility to personal preference.

Important web and installed-app features:

- Hierarchical knowledge notes
- Tab-based editing
- Find in note
- Markdown preview
- Quick switch
- Linked-note view
- Feature on/off settings
- Editable shortcuts
- Markdown import and export

## Server Connection

Required values:

- Server URL
- API token
- User ID
- Device ID

Personal Docker server example:

```text
Server URL: http://server-address:8750
API token: NOW_API_TOKEN in server .env
User ID: local_user or the user ID issued by the operator
Device ID: Generated automatically by the app or installed program
```

When connecting from an Android emulator to a local PC server:

```text
http://10.0.2.2:8750
```

When checking directly from PC or WSL:

```text
http://localhost:8750/health
http://localhost:8750/monitor
http://localhost:8750/admin
```

## User Profile

Server-connected users have user information on the server.

User information:

- owner ID
- Email
- Display name
- Time zone
- User group
- Two-factor authentication status
- Active status
- Last access time

Apps and installed programs can edit the user's own email, display name, and time zone.
In the mobile app and the Web/installed program, open server settings, enter the user ID, then load or save the user profile.

Administrators manage user groups, two-factor authentication status, and active status in the server admin screen.
Public server operators can create a user ID in the admin screen before the user connects.
Inactive users are blocked from server sync and data APIs except profile lookup.

## Backup And Import

### Web / Installed App JSON Backup

JSON is used to back up or restore all NowNote data in the Web/installed app.

Included data:

- Daily notes
- Archived daily notes
- Knowledge notes
- Trash
- Display settings
- Open tab settings

JSON import usually replaces current data with the backup file contents.

### Mobile DB Backup

The mobile app backs up and restores all data with a `.db` file.

- Use Settings > Data Management > Export backup to save a DB backup file.
- Importing a backup replaces the current mobile data with the backup file contents.
- After import, restart the app.

### Markdown Import

Markdown import adds `.md`, `.markdown`, or `.txt` files written elsewhere as NowNote knowledge notes.

Imported files are not linked to the original files.

- The original file remains unchanged.
- NowNote creates a new internal note.
- Editing in NowNote does not change the original file.
- Deleting in NowNote does not delete the original file.

### Markdown Export

Markdown export saves knowledge notes, daily notes, and archived daily notes in a human-readable document.

Export rules:

- The file is generated in Korean or English based on the current display language.
- Knowledge note headings show the topic / category / note level.
- Daily notes and archived daily notes are included together.
- Both Korean and English Markdown files exported from NowNote can be imported back.

## Encrypted Storage

Encrypted storage is designed as an optional feature for server-login users.

It is off by default.

Principles:

- Login is used to verify access permission.
- The actual encryption key is separated based on the user password or recovery key.
- Even the server operator should not be able to read encrypted note contents.
- Encrypted notes are excluded from LLM analysis by default.

This feature will be implemented after the storage and sync structure is finalized.

## Recommended Start

You can start as a standalone user.

1. Decide your note structure in the web app or mobile app.
2. Try daily notes and knowledge notes.
3. Connect a server when you need the same notes on multiple devices.
4. After connecting a server, check your user profile and time zone.
5. Once operation is stable, enable backup, analysis, and encryption step by step.
