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

Run Prisma + server:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Server runs on **port 3002** by default.

### Authentication

All endpoints (except health checks) require a JWT access token from `identity-service`:

```
Authorization: Bearer <access_token>
```

The token must include:
- `sub` (user_id)
- `org_id` (organization ID)
- `membership_id` (membership ID)
- `role_id` (optional, role ID)

All operations are **org-scoped** — users can only access resources within their organization.

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

### PowerShell Example

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

---

## Architecture Notes

- **Org isolation**: All operations are scoped to the organization from the JWT token
- **Immutable messages**: Edits create new `MessageVersion` records (append-only)
- **Thread state machine**: Simple transitions; `ARCHIVED` is terminal
- **Soft deletes**: Messages use `deletedAt`; channels/threads use `archivedAt`
- **Async-first**: No real-time features here; designed for async consumption

