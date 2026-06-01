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
- Note-level encrypted storage
- Backup and restore: JSON for Web/installed apps, DB for mobile
- Markdown import and export
- Display settings
- Shortcut settings

Unavailable features:

- Automatic sync with other devices
- Server backup
- Server-based user management
- Server-based LLM analysis jobs

Standalone users should periodically use backup or Markdown export. Web/installed apps use JSON backup, while the mobile app uses DB backup.

### 2. Server-Connected User

Server-connected users connect to a NowNote server and sync notes.

There are two server connection modes.

- Personal server: Install your own server with Docker containers.
- Public server: Register directly in the public Web program and connect apps with a token issued from your own account.

This mode fits when:

- You want the same notes on phone, PC, and installed desktop apps.
- You want a server-side backup copy.
- You need to manage accounts, devices, and access status.
- You want to use server-based analysis features.
- You want to open encrypted notes across devices with the same key.

Available features:

- All standalone-user features
- Server sync
- Server backup
- Server backup verification
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

- Mobile and installed apps require a server URL, user ID, and either an API token or a per-user access token depending on the server mode.
- The Web program logs in at the server address with a user ID and password.
- The API token protects personal servers or operator/admin APIs. It is not a normal Web login value.
- Personal server users must change the token and database password in `.env`.
- Public server users register directly in Web, then issue app/installed-app connection tokens from their own account.
- The current first-phase server can start with an admin API token for personal Docker servers, and also provides self-registration, Web password login, app/installed-app connection tokens, password reset, and two-factor code verification for public-server use.
- Before opening a public server, all `scripts/preflight.py --public-server` failures must be resolved. The public-server check confirms self-registration, Web login, connection-token issuing, HTTPS/reverse proxy, and password-reset email settings.
- Server backup verification checks backup schema, checksum, required sections, and token-sensitive data exposure.
- Archived daily notes are not deleted after server connection. They stay as inactive backup records.

## Platform Guidelines

### Mobile App

The mobile app focuses on fast input.

Installation path:

- After public release: install NowNote from Google Play.
- During internal testing: use the Google Play internal testing link provided by the operator.
- For development or verification: see `now_app/README.md` and `now_app/docs/google_play_step_by_step_ko.md`.

The mobile app can be used standalone without connecting to a server.
If server settings are left empty, notes are stored only on the current phone.
To connect to a public server, register in Web first, issue an app connection token, then enter the server URL, user ID, and connection token in the server connection settings.

Recommended flow:

- Quickly write today's note from Home.
- Add daily notes by voice or typing.
- Create hierarchical notes when needed.
- Server-connected users enter the server URL, user ID, and app connection token in settings.
- If two-factor authentication is enabled, enter the six-digit code when checking the connection.

Important mobile features:

- Daily notes
- Voice notes
- Quick note input
- Server sync
- Connection status
- Server recording upload status
- Server analysis job creation and result review

### Web Program

The Web program is a server-hosted browser app for external PCs.
It is not a local note source. It shows and edits only your server-shared documents.
Users who do not run their own server use the public Web program at `https://nownote.sinsan.kr`.
Users who run a personal server use `https://your-domain` or `http://server-ip:8750`.
Web users log in with user ID and password, not by pasting a per-user access token.

The developer file `web/index.html` is not the user-facing Web program address.
The user-facing Web program opens at the server root address.
`/app/` remains as a compatibility address for older guides.

Recommended flow:

- Organize knowledge with topic / category / note structure.
- Write longer content in Markdown.
- Explore notes with search, tags, backlinks, and linked-note view.
- Open daily notes briefly when needed.
- Adjust shortcuts and feature visibility to personal preference.

Important Web features:

- Hierarchical knowledge notes
- Tab-based editing
- Find in note
- Markdown preview
- Quick switch
- Linked-note view
- Feature on/off settings
- Editable shortcuts
- Markdown import and export
- Server analysis job creation, result summary review, and adding results to notes

### Installed App

The Windows installed app is the PC version of NowNote.
Its design can look similar to the Web program, but its internal behavior is different.
The installed app handles both PC-local documents and server-shared documents.
Without a server connection, it can be used standalone on the PC.
With a server connection, it syncs daily notes and knowledge notes that the user chose to share.

## Server Connection

Required values for mobile and installed apps:

- Server URL
- User ID
- API token: Used only by personal-server default mode. Leave empty on public servers.
- App/installed-app connection token: Used by public servers or token-required personal servers.
- Two-factor code: Enter only for users with two-factor authentication enabled
- Device ID

The Web program logs in at the server address with a user ID and password.
On public servers, the API token protects operator screens and admin APIs.

### Users Who Do Not Install A Server

If you use NowNote only as a standalone app, leave server connection settings empty.

Start here:

```text
User help: docs/HELP.md
Mobile app guide: now_app/README.md
Installed app guide: desktop/README.md
Public Web program: https://nownote.sinsan.kr
Public privacy policy: https://nownote.sinsan.kr/privacy
```

If you only connect to a public server, register in Web and issue your own app/installed-app connection token.

```text
Web URL: example) https://nownote.sinsan.kr
Web login: User ID and password created by the user in Web
App/installed server URL: example) https://nownote.sinsan.kr
App/installed user ID: User ID created by the user in Web
App/installed connection token: Token issued by the user after Web login
App/installed API token: Leave empty on public servers
Two-factor code: Six-digit code when two-factor authentication is enabled
Device ID: Automatically generated by the app or installed program
```

Input location:

```text
Mobile app: Server connection section in settings
Installed app: Server connection section in display settings
Web program: Login screen at https://nownote.sinsan.kr or https://your-domain
```

Users do not need to see the server `.env` file.
Use only the connection values shown in Web after login.

Personal Docker server example:

```text
Web URL: http://server-address:8750
Web login: User ID and Web password created in Web or by an operator for administration
App/installed server URL: http://server-address:8750
App/installed API token: NOW_API_TOKEN from server .env in personal-server default mode
App/installed connection token: Token issued in Web or, for administration, in the admin screen
Two-factor code: Six-digit code when required
User ID: local_user or the user ID created in Web
Device ID: Generated automatically by the app or installed program
```

When a personal server is installed on a Linux server, phones and external PCs do not use `localhost`.
Use the server domain or server IP address.

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
In the mobile app and installed program, open server settings, enter the user ID, then load or save the user profile.
The Web program uses the logged-in user and server-shared documents.
Knowledge notes shared by other users in the same user group are shown as read-only.
Group-shared notes cannot be edited or deleted and are excluded from uploads from your account.

Administrators manage user groups, two-factor authentication status, and active status in the server admin screen.
Public server operators normally monitor users and service status. Admin-created users are reserved for tests, pre-registration, or recovery support.
Inactive users are blocked from server sync and data APIs except profile lookup.
Users with two-factor authentication enabled must enter the six-digit verification code during token login checks.

## Backup And Import

### Web / Installed App JSON Backup

JSON is used to back up or restore data in the development Web screen or installed app.
For the public Web program, the server shared documents are the source of truth, so server backup is the primary backup path.

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

Knowledge notes can be encrypted note by note when needed.

Encrypted notes stay encrypted when synced to the server. To open the same note in the web app, desktop app, or mobile app, enter the same key.

Principles:

- Login is used to verify access permission.
- The actual encryption key is not stored on the server or in browser storage.
- Even the server operator should not be able to read encrypted note contents.
- Encrypted notes are excluded from LLM analysis by default.
- Decrypting temporarily opens the content.
- Removing encryption saves the note as plain text again.

If you forget the key, NowNote cannot recover the content.

## Recommended Start

You can start as a standalone user.

1. Decide your note structure in the web app or mobile app.
2. Try daily notes and knowledge notes.
3. Connect a server when you need the same notes on multiple devices.
4. After connecting a server, check your user profile and time zone.
5. Once operation is stable, enable backup, analysis, and encryption step by step.
