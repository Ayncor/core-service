## core-service

Core domain service for Ayncor: **channels, threads, messages, reactions**, and the async-first workflow rules.

### Prereqs

- Node.js (LTS)
- Docker Desktop
- `identity-service` running (for JWT token validation)

### Local dev (Windows / macOS / Linux)

Start Postgres:

```bash
docker compose up -d
```

Create `.env` (copy from `.env.example`) and set:

- `DATABASE_URL` (points at the Postgres container)
- `JWT_ACCESS_SECRET` (must match `identity-service` so access tokens validate)
- `REDIS_URL` (for outbox relay → realtime-gateway; optional if you skip the relay)

Run Prisma + server:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Server runs on **port 3002** by default.

### Outbox and relay (realtime events)

Domain writes (create message, create message version, create thread, set thread state, add reaction) append **event envelopes** to an **outbox** in the same DB transaction. A separate **relay** process polls the outbox, publishes to Redis (`realtime:events` by default), and marks rows as published. The realtime-gateway subscribes to that channel and fans out to WebSocket clients.

**Steps to run relay (Set core-service `.env`):**

1. Start Redis (e.g. `cd realtime-gateway && docker compose up -d`).
2. Start core-service: `npm run start:dev`.
3. In another terminal, from core-service: `npm run relay`.
4. Optionally start realtime-gateway so WebSocket clients receive events: `cd realtime-gateway && npm run start:dev`.

To run the relay (requires `DATABASE_URL` and `REDIS_URL`):

```bash
npm run relay
```

Env (see `.env.example`):

- `REDIS_URL` – Redis connection (e.g. `redis://localhost:6379`)
- `REDIS_CHANNEL` – default `realtime:events` (must match realtime-gateway’s `REDIS_CHANNEL`)
- `RELAY_POLL_MS` – poll interval in ms (default 500)
- `RELAY_BATCH_SIZE` – batch size per poll (default 100)

Emitted event types: `Core.MessageCreated`, `Core.MessageVersionCreated`, `Core.ThreadCreated`, `Core.ThreadStateChanged`, `Core.ReactionAdded`. Envelope shape follows `contracts/v1/events/envelope.schema.json`.

### Authentication

All endpoints (except health checks) require a JWT access token from `identity-service`:

```
Authorization: Bearer <access_token>
```

The token includes:
- `sub` (user_id)
- `org_id` (organization ID)
- `membership_id` (membership ID)
- `role_id` (optional, role ID)
- `perms` (array of permission strings, e.g., `["org:read", "channels:manage", ...]`)
- `jti` (JWT ID for audit correlation)

All operations are **org-scoped** — users can only access resources within their organization.

**Note:** The `perms` array allows permission-based authorization checks without database lookups. See `identity-service` documentation for available permissions.

---

## API Documentation

**Postman collection:** `coreAPI.postman_collection.json` — import into Postman for all endpoints (Health, Channels, Threads, Participants, User State, Inbox, Messages, Reactions). Set `baseUrl` to `http://localhost:3002` for local dev. Canonical spec: `contracts/v1/openapi/core-service.openapi.yaml`.

---

## API Endpoints

### Health

#### `GET /health`
Liveness check (no auth required).

**Response:**
```json
{
  "status": "ok",
  "ts": "2026-01-26T12:00:00.000Z"
}
```

#### `GET /health/ready`
Readiness check with DB connectivity (no auth required).

**Response:**
```json
{
  "status": "ok",
  "db": "ok",
  "latency_ms": 2,
  "ts": "2026-01-26T12:00:00.000Z"
}
```

---

### Channels

#### `POST /channels`
Create a new channel.

**Request:**
```json
{
  "name": "General",
  "slug": "general",
  "visibility": "ORG"
}
```

**Response:**
```json
{
  "channel": {
    "id": "uuid",
    "org_id": "uuid",
    "name": "General",
    "slug": "general",
    "visibility": "ORG",
    "created_at": "2026-01-26T12:00:00.000Z"
  }
}
```

#### `GET /channels`
List all channels in the organization.

**Response:**
```json
{
  "channels": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "name": "General",
      "slug": "general",
      "visibility": "ORG",
      "created_at": "2026-01-26T12:00:00.000Z"
    }
  ]
}
```

---

### Threads

#### `POST /threads`
Create a new thread in a channel.

**Request:**
```json
{
  "channel_id": "uuid",
  "title": "Discussion Topic",
  "purpose": "Optional description"
}
```

**Response:**
```json
{
  "thread": {
    "id": "uuid",
    "org_id": "uuid",
    "channel_id": "uuid",
    "state": "OPEN",
    "title": "Discussion Topic",
    "purpose": "Optional description",
    "created_at": "2026-01-26T12:00:00.000Z"
  }
}
```

#### `GET /threads/channel/:channelId`
List all threads in a channel.

**Response:**
```json
{
  "threads": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "channel_id": "uuid",
      "state": "OPEN",
      "title": "Discussion Topic",
      "purpose": "Optional description",
      "created_at": "2026-01-26T12:00:00.000Z"
    }
  ]
}
```

#### `POST /threads/:threadId/state`
Update thread state (OPEN, BLOCKED, DECIDED, ARCHIVED).

**Request:**
```json
{
  "state": "BLOCKED"
}
```

**Response:**
```json
{
  "thread": {
    "id": "uuid",
    "org_id": "uuid",
    "channel_id": "uuid",
    "state": "BLOCKED",
    "title": "Discussion Topic",
    "purpose": "Optional description",
    "created_at": "2026-01-26T12:00:00.000Z",
    "archived_at": null
  }
}
```

**Note:** `ARCHIVED` is a terminal state — threads cannot transition out of `ARCHIVED`.

---

### Messages

#### `POST /messages`
Create a new message in a thread.

**Request:**
```json
{
  "thread_id": "uuid",
  "body": "Message content",
  "urgency": "NORMAL",
  "requires_response": false
}
```

**Response:**
```json
{
  "message": {
    "id": "uuid",
    "org_id": "uuid",
    "thread_id": "uuid",
    "author_user_id": "uuid",
    "author_membership_id": "uuid",
    "urgency": "NORMAL",
    "requires_response": false,
    "created_at": "2026-01-26T12:00:00.000Z",
    "latest_version": {
      "id": "uuid",
      "body": "Message content",
      "created_at": "2026-01-26T12:00:00.000Z"
    }
  }
}
```

#### `GET /messages/thread/:threadId`
List all messages in a thread (with latest version).

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "thread_id": "uuid",
      "author_user_id": "uuid",
      "author_membership_id": "uuid",
      "urgency": "NORMAL",
      "requires_response": false,
      "created_at": "2026-01-26T12:00:00.000Z",
      "latest_version": {
        "id": "uuid",
        "body": "Message content",
        "created_at": "2026-01-26T12:00:00.000Z"
      }
    }
  ]
}
```

#### `POST /messages/:messageId/versions`
Create a new message version (edit). Messages are **immutable** — edits create new versions.

**Request:**
```json
{
  "body": "Updated message content"
}
```

**Response:**
```json
{
  "version": {
    "id": "uuid",
    "message_id": "uuid",
    "body": "Updated message content",
    "created_at": "2026-01-26T12:00:00.000Z"
  }
}
```

#### `GET /messages/:messageId/versions`
List all versions of a message (history, newest first).

**Response:**
```json
{
  "versions": [
    {
      "id": "uuid",
      "message_id": "uuid",
      "body": "Updated message content",
      "created_at": "2026-01-26T12:00:01.000Z"
    },
    {
      "id": "uuid",
      "message_id": "uuid",
      "body": "Original message content",
      "created_at": "2026-01-26T12:00:00.000Z"
    }
  ]
}
```

---

### Reactions

#### `POST /reactions`
Toggle a reaction on a message (add if not present, remove if present).

**Request:**
```json
{
  "message_id": "uuid",
  "emoji": "👍"
}
```

**Response:**
```json
{
  "action": "added",
  "reaction": {
    "id": "uuid",
    "org_id": "uuid",
    "message_id": "uuid",
    "emoji": "👍",
    "created_at": "2026-01-26T12:00:00.000Z",
    "removed_at": null
  }
}
```

#### `GET /reactions/message/:messageId`
List all reactions for a message (grouped by emoji, with counts and whether the current user reacted).

**Response:**
```json
{
  "reactions": [
    {
      "emoji": "👍",
      "count": 3,
      "me": true
    },
    {
      "emoji": "❤️",
      "count": 1,
      "me": false
    }
  ]
}
```

---

### Thread Participants

#### `POST /threads/:threadId/participants`
Add a participant to a thread.

**Request:**
```json
{
  "user_id": "uuid",
  "role": "PARTICIPANT"
}
```

**Response:**
```json
{
  "participant": {
    "id": "uuid",
    "org_id": "uuid",
    "thread_id": "uuid",
    "user_id": "uuid",
    "role": "PARTICIPANT",
    "joined_at": "2026-01-26T12:00:00.000Z",
    "left_at": null,
    "muted_until": null
  }
}
```

**Note:** `role` can be `OWNER`, `PARTICIPANT`, or `OBSERVER`. Defaults to `PARTICIPANT`. A user state is automatically created when a participant is added. A system message (`kind: "SYSTEM"`) is also created in the thread with `metadata.system_type: "participant_added"` (or `"participant_rejoined"` if the user had previously left), so the thread timeline shows "X joined" / "Y added X" when listing messages.

#### `GET /threads/:threadId/participants`
List all active participants in a thread.

**Response:**
```json
{
  "participants": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "thread_id": "uuid",
      "user_id": "uuid",
      "role": "OWNER",
      "joined_at": "2026-01-26T12:00:00.000Z",
      "left_at": null,
      "muted_until": null
    }
  ]
}
```

#### `PATCH /threads/:threadId/participants/:userId`
Update a participant's role or mute status.

**Request:**
```json
{
  "role": "OBSERVER",
  "muted_until": "2026-01-27T12:00:00.000Z"
}
```

**Response:**
```json
{
  "participant": {
    "id": "uuid",
    "org_id": "uuid",
    "thread_id": "uuid",
    "user_id": "uuid",
    "role": "OBSERVER",
    "joined_at": "2026-01-26T12:00:00.000Z",
    "left_at": null,
    "muted_until": "2026-01-27T12:00:00.000Z"
  }
}
```

#### `DELETE /threads/:threadId/participants/:userId`
Remove a participant from a thread (soft delete - sets `left_at`).

**Response:**
```json
{
  "status": "removed"
}
```

---

### Thread User State

#### `GET /threads/:threadId/user-state`
Get the current user's state for a thread (creates default state if it doesn't exist).

**Response:**
```json
{
  "user_state": {
    "id": "uuid",
    "org_id": "uuid",
    "thread_id": "uuid",
    "user_id": "uuid",
    "status": "IN_INBOX",
    "needs_response": false,
    "snoozed_until": null,
    "last_read_message_id": null,
    "last_reviewed_at": null,
    "priority_override": "NONE",
    "created_at": "2026-01-26T12:00:00.000Z",
    "updated_at": "2026-01-26T12:00:00.000Z"
  }
}
```

#### `PATCH /threads/:threadId/user-state`
Update the current user's state for a thread.

**Request:**
```json
{
  "status": "SNOOZED",
  "needs_response": true,
  "snoozed_until": "2026-01-27T12:00:00.000Z",
  "last_read_message_id": "uuid",
  "priority_override": "HIGH"
}
```

**Response:** Same as `GET /threads/:threadId/user-state`.

**Note:** If `status` is `SNOOZED`, `snoozed_until` must be provided.

---

### Inbox

#### `GET /inbox`
Get the current user's inbox (threads with status `IN_INBOX`), ordered by priority and activity.

**Query params:**
- `limit` (optional, default: 50, max: 100)
- `cursor` (optional, for pagination)

**Response:**
```json
{
  "items": [
    {
      "thread_id": "uuid",
      "thread_title": "Discussion Topic",
      "thread_purpose": "Optional description",
      "thread_state": "OPEN",
      "thread_last_activity_at": "2026-01-26T12:00:00.000Z",
      "user_status": "IN_INBOX",
      "needs_response": true,
      "has_urgent_unread": false,
      "unread_count": 3,
      "latest_message_preview": "Message content preview...",
      "next_action": "RESPOND",
      "priority_override": "NONE",
      "sort_key": "NONE_1_1706284800000"
    }
  ]
}
```

**Sorting:** Items are sorted by:
1. `priority_override` (HIGH > LOW > NONE)
2. `needs_response` (true > false)
3. `thread_last_activity_at` (newest first)

**Next Actions:**
- `RESPOND` - User needs to respond
- `REVIEW` - Has unread messages
- `WAIT` - Thread is blocked
- `NONE` - No action needed

---

## Data Model

### Thread States
- **OPEN**: Active discussion
- **BLOCKED**: Waiting on something
- **DECIDED**: Decision made (can add decision note later)
- **ARCHIVED**: Terminal state (cannot transition out)

### Message Urgency
- **NORMAL**: Default
- **URGENT**: Bypasses digest scheduling (future feature)

### Channel Visibility
- **ORG**: Visible to all org members
- **PRIVATE**: Restricted (future feature)

---

## Testing

To run a full end-to-end check of all endpoints (identity-service and core-service must be running):

**Windows (PowerShell):**
```powershell
.\test-endpoints.ps1
```

**macOS / Linux (Bash):**
```bash
chmod +x test-endpoints.sh   # once, to make executable
./test-endpoints.sh          # default: identity 3001, core 3002
./test-endpoints.sh http://localhost:3001 http://localhost:3002   # optional URLs
```

This script logs in, creates channel/thread/message, exercises reactions, user-state, inbox, message versions, thread state, and participant add/update/delete. It uses a unique channel slug per run to avoid conflicts.

### Quick Test Example

```powershell
# Set access token from identity-service
$accessToken = "YOUR_ACCESS_TOKEN"
$headers = @{ Authorization = "Bearer $accessToken" }

# Health check
Invoke-RestMethod -Uri "http://localhost:3002/health"

# Create channel
$channelBody = @{ name = "General"; slug = "general"; visibility = "ORG" } | ConvertTo-Json
$channel = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/channels" -ContentType "application/json" -Body $channelBody -Headers $headers
$channelId = $channel.channel.id

# Create thread
$threadBody = @{ channel_id = $channelId; title = "Test Thread" } | ConvertTo-Json
$thread = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/threads" -ContentType "application/json" -Body $threadBody -Headers $headers
$threadId = $thread.thread.id

# Create message
$messageBody = @{ thread_id = $threadId; body = "Hello!" } | ConvertTo-Json
$message = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/messages" -ContentType "application/json" -Body $messageBody -Headers $headers
$messageId = $message.message.id

# Add reaction
$reactionBody = @{ message_id = $messageId; emoji = "👍" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3002/reactions" -ContentType "application/json" -Body $reactionBody -Headers $headers

# List reactions
Invoke-RestMethod -Uri "http://localhost:3002/reactions/message/$messageId" -Headers $headers
```

### Thread Participants

To add a participant you need another user's UUID from the same org. Two ways to get it:

**Option A — Add a member via identity-service** (creates user if needed; response includes `user_id`):

```powershell
# Using your org admin token and org id from login ($login.org.id) or /me
$orgId = $login.org.id   # or from: (Invoke-RestMethod -Uri "http://localhost:3001/me" -Headers $headers).org.id
$addMemberBody = @{ email = "teammate@example.com"; role_id = $null } | ConvertTo-Json
$member = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/orgs/$orgId/members" -ContentType "application/json" -Body $addMemberBody -Headers $headers
$otherUserId = $member.user_id   # use this as the participant's user_id
```

**Option B — Second user logs in and calls /me** (use that user's `user.id`):

```powershell
$login2 = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/auth/login" -ContentType "application/json" -Body (@{ email = "teammate@example.com"; password = "theirpass"; org_slug = "ayncor" } | ConvertTo-Json)
$otherUserId = (Invoke-RestMethod -Uri "http://localhost:3001/me" -Headers @{ Authorization = "Bearer $($login2.access_token)" }).user.id
```

**Then add that user as a participant:**

```powershell
# Add participant (use $otherUserId from above)
$participantBody = @{ user_id = $otherUserId; role = "PARTICIPANT" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3002/threads/$threadId/participants" -ContentType "application/json" -Body $participantBody -Headers $headers

# List participants
Invoke-RestMethod -Uri "http://localhost:3002/threads/$threadId/participants" -Headers $headers

# Update participant (mute until tomorrow)
$updateBody = @{ muted_until = (Get-Date).AddDays(1).ToUniversalTime().ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/participants/$otherUserId" -ContentType "application/json" -Body $updateBody -Headers $headers

# Remove participant
Invoke-RestMethod -Method Delete -Uri "http://localhost:3002/threads/$threadId/participants/$otherUserId" -Headers $headers
```

### Thread User State

```powershell
# Get user state
Invoke-RestMethod -Uri "http://localhost:3002/threads/$threadId/user-state" -Headers $headers

# Update user state (mark as needs response)
$stateBody = @{ needs_response = $true; priority_override = "HIGH" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $stateBody -Headers $headers

# Snooze thread
$snoozeBody = @{ status = "SNOOZED"; snoozed_until = (Get-Date).AddDays(1).ToUniversalTime().ToString("o") } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $snoozeBody -Headers $headers

# Archive thread
$archiveBody = @{ status = "ARCHIVED" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $archiveBody -Headers $headers

# Mark as read
$readBody = @{ last_read_message_id = $messageId } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $readBody -Headers $headers
```

### Inbox

```powershell
# Get inbox
Invoke-RestMethod -Uri "http://localhost:3002/inbox" -Headers $headers

# Get inbox with limit
Invoke-RestMethod -Uri "http://localhost:3002/inbox?limit=20" -Headers $headers
```

### Complete Test Flow

```powershell
# 1. Login to identity-service and get token
$loginBody = @{
  email = "admin@ayncor.local"
  password = "ayncor@123"
  org_slug = "ayncor"
} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/auth/login" -ContentType "application/json" -Body $loginBody
$accessToken = $login.access_token
$headers = @{ Authorization = "Bearer $accessToken" }

# 2. Create channel
$channelBody = @{ name = "General"; slug = "general"; visibility = "ORG" } | ConvertTo-Json
$channel = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/channels" -ContentType "application/json" -Body $channelBody -Headers $headers
$channelId = $channel.channel.id
Write-Host "Created channel: $channelId"

# 3. Create thread (auto-creates participant and user state)
$threadBody = @{ channel_id = $channelId; title = "Test Thread"; purpose = "Testing new features" } | ConvertTo-Json
$thread = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/threads" -ContentType "application/json" -Body $threadBody -Headers $headers
$threadId = $thread.thread.id
Write-Host "Created thread: $threadId"

# 4. Check user state (should exist automatically)
$userState = Invoke-RestMethod -Uri "http://localhost:3002/threads/$threadId/user-state" -Headers $headers
Write-Host "User state status: $($userState.user_state.status)"

# 5. Check participants (creator should be OWNER)
$participants = Invoke-RestMethod -Uri "http://localhost:3002/threads/$threadId/participants" -Headers $headers
Write-Host "Participants: $($participants.participants.Count)"

# 6. Create message
$messageBody = @{ thread_id = $threadId; body = "Hello, this is a test message!"; requires_response = $true } | ConvertTo-Json
$message = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/messages" -ContentType "application/json" -Body $messageBody -Headers $headers
$messageId = $message.message.id
Write-Host "Created message: $messageId"

# 7. Update user state to mark needs response
$stateBody = @{ needs_response = $true } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $stateBody -Headers $headers

# 8. Check inbox (should show this thread)
$inbox = Invoke-RestMethod -Uri "http://localhost:3002/inbox" -Headers $headers
Write-Host "Inbox items: $($inbox.items.Count)"
if ($inbox.items.Count -gt 0) {
    Write-Host "First item: $($inbox.items[0].thread_title) - Next action: $($inbox.items[0].next_action)"
}

# 9. Mark message as read
$readBody = @{ last_read_message_id = $messageId } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:3002/threads/$threadId/user-state" -ContentType "application/json" -Body $readBody -Headers $headers

# 10. Check inbox again (unread count should be 0)
$inbox2 = Invoke-RestMethod -Uri "http://localhost:3002/inbox" -Headers $headers
Write-Host "Updated inbox - First item unread count: $($inbox2.items[0].unread_count)"
```

---

## Architecture Notes

- **Org isolation**: All operations are scoped to the organization from the JWT token
- **Immutable messages**: Edits create new `MessageVersion` records (append-only)
- **Thread state machine**: Simple transitions; `ARCHIVED` is terminal
- **Soft deletes**: Messages use `deletedAt`; channels/threads use `archivedAt`
- **Outbox + relay**: Domain events are written to `OutboxEvent` in the same transaction as the write. A separate relay process publishes to Redis for realtime-gateway, then marks events as published. This matches production: at-most-once publish, no direct dependency from HTTP to Redis.
- **Async-first**: Designed for async consumption; realtime is provided by realtime-gateway via the relay

