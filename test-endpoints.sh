#!/usr/bin/env bash
# Test core-service endpoints end-to-end (macOS / Linux)
# Prereqs: identity-service on 3001, core-service on 3002, valid bootstrap user
# Usage: ./test-endpoints.sh [IDENTITY_URL] [CORE_URL]
# Example: ./test-endpoints.sh http://localhost:3001 http://localhost:3002

set -e

BASE_ID="${1:-http://localhost:3001}"
BASE_CORE="${2:-http://localhost:3002}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# JSON get by dot path (e.g. "channel.id"); prints value only
json_get() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for k in sys.argv[1].split('.'):
        d = d[k]
    if isinstance(d, list):
        print(len(d))
    else:
        print(d)
except Exception: pass
" "$key" 2>/dev/null
}

# HTTP GET; prints body; exits 1 if status != 200
get() {
  local url="$1"
  local auth="${2:-}"
  local resp
  resp=$(curl -s -w '\n%{http_code}' "$url" ${auth:+ -H "Authorization: Bearer $auth"})
  local code
  code=$(echo "$resp" | tail -n1)
  local body
  body=$(echo "$resp" | sed '$d')
  if [ "$code" != "200" ]; then
    echo "${RED}GET $url failed: $code $body${NC}" >&2
    return 1
  fi
  echo "$body"
}

# HTTP POST; prints body; exits 1 if status not 2xx
post() {
  local url="$1"
  local body="$2"
  local auth="${3:-}"
  local resp
  resp=$(curl -s -w '\n%{http_code}' -X POST "$url" -H "Content-Type: application/json" -d "$body" ${auth:+ -H "Authorization: Bearer $auth"})
  local code
  code=$(echo "$resp" | tail -n1)
  local out
  out=$(echo "$resp" | sed '$d')
  if [ "${code:0:1}" != "2" ]; then
    echo "${RED}POST $url failed: $code $out${NC}" >&2
    return 1
  fi
  echo "$out"
}

# HTTP PATCH
patch() {
  local url="$1"
  local body="$2"
  local auth="$3"
  local resp
  resp=$(curl -s -w '\n%{http_code}' -X PATCH "$url" -H "Content-Type: application/json" -d "$body" -H "Authorization: Bearer $auth")
  local code
  code=$(echo "$resp" | tail -n1)
  if [ "${code:0:1}" != "2" ]; then
    local out
    out=$(echo "$resp" | sed '$d')
    echo "${RED}PATCH $url failed: $code $out${NC}" >&2
    return 1
  fi
  echo "$(echo "$resp" | sed '$d')"
}

# HTTP DELETE
delete() {
  local url="$1"
  local auth="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$url" -H "Authorization: Bearer $auth")
  if [ "${code:0:1}" != "2" ]; then
    echo "${RED}DELETE $url failed: $code${NC}" >&2
    return 1
  fi
}

echo "${CYAN}=== 1. Login (identity-service) ===${NC}"
LOGIN_BODY='{"email":"admin@ayncor.local","password":"ayncor@123","org_slug":"ayncor"}'
LOGIN=$(post "$BASE_ID/auth/login" "$LOGIN_BODY")
ACCESS=$(json_get "$LOGIN" "access_token")
ORG_ID=$(json_get "$LOGIN" "org.id")
echo "${GREEN}OK - org_id=$ORG_ID${NC}"

echo ""
echo "${CYAN}=== 2. Health (core-service) ===${NC}"
H=$(get "$BASE_CORE/health" "$ACCESS")
STATUS=$(json_get "$H" "status")
if [ "$STATUS" != "ok" ]; then
  echo "${RED}Health failed: $H${NC}" >&2
  exit 1
fi
echo "${GREEN}OK${NC}"

echo ""
echo "${CYAN}=== 3. POST /channels ===${NC}"
SLUG="e2e-$(date +%Y%m%d-%H%M%S)"
CHANNEL_BODY="{\"name\":\"E2E Test\",\"slug\":\"$SLUG\",\"visibility\":\"ORG\"}"
CHANNEL=$(post "$BASE_CORE/channels" "$CHANNEL_BODY" "$ACCESS")
CHANNEL_ID=$(json_get "$CHANNEL" "channel.id")
echo "${GREEN}OK - channel_id=$CHANNEL_ID slug=$SLUG${NC}"

echo ""
echo "${CYAN}=== 4. GET /channels ===${NC}"
CHANNELS=$(get "$BASE_CORE/channels" "$ACCESS")
COUNT=$(json_get "$CHANNELS" "channels")
if [ -z "$COUNT" ] || [ "$COUNT" -lt 1 ]; then
  echo "${RED}No channels${NC}" >&2
  exit 1
fi
echo "${GREEN}OK - count=$COUNT${NC}"

echo ""
echo "${CYAN}=== 5. POST /threads ===${NC}"
THREAD_BODY="{\"channel_id\":\"$CHANNEL_ID\",\"title\":\"Test Thread\",\"purpose\":\"E2E test\"}"
THREAD=$(post "$BASE_CORE/threads" "$THREAD_BODY" "$ACCESS")
THREAD_ID=$(json_get "$THREAD" "thread.id")
echo "${GREEN}OK - thread_id=$THREAD_ID${NC}"

echo ""
echo "${CYAN}=== 6. GET /threads/channel/:channelId ===${NC}"
THREADS=$(get "$BASE_CORE/threads/channel/$CHANNEL_ID" "$ACCESS")
TCOUNT=$(json_get "$THREADS" "threads")
if [ -z "$TCOUNT" ] || [ "$TCOUNT" -lt 1 ]; then
  echo "${RED}No threads${NC}" >&2
  exit 1
fi
echo "${GREEN}OK - count=$TCOUNT${NC}"

echo ""
echo "${CYAN}=== 7. GET /threads/:threadId/user-state ===${NC}"
USER_STATE=$(get "$BASE_CORE/threads/$THREAD_ID/user-state" "$ACCESS")
USTATUS=$(json_get "$USER_STATE" "user_state.status")
if [ -z "$USTATUS" ]; then
  echo "${RED}No user_state${NC}" >&2
  exit 1
fi
echo "${GREEN}OK - status=$USTATUS${NC}"

echo ""
echo "${CYAN}=== 8. GET /threads/:threadId/participants ===${NC}"
PARTICIPANTS=$(get "$BASE_CORE/threads/$THREAD_ID/participants" "$ACCESS")
PCOUNT=$(json_get "$PARTICIPANTS" "participants")
echo "${GREEN}OK - count=${PCOUNT:-0}${NC}"

echo ""
echo "${CYAN}=== 9. POST /messages ===${NC}"
MSG_BODY="{\"thread_id\":\"$THREAD_ID\",\"body\":\"Hello E2E!\",\"requires_response\":true}"
MSG=$(post "$BASE_CORE/messages" "$MSG_BODY" "$ACCESS")
MESSAGE_ID=$(json_get "$MSG" "message.id")
echo "${GREEN}OK - message_id=$MESSAGE_ID${NC}"

echo ""
echo "${CYAN}=== 10. GET /messages/thread/:threadId ===${NC}"
MSGS=$(get "$BASE_CORE/messages/thread/$THREAD_ID" "$ACCESS")
MSG_COUNT=$(json_get "$MSGS" "messages")
if [ -z "$MSG_COUNT" ] || [ "$MSG_COUNT" -lt 1 ]; then
  echo "${RED}No messages${NC}" >&2
  exit 1
fi
echo "${GREEN}OK - count=$MSG_COUNT${NC}"

echo ""
echo "${CYAN}=== 11. POST /reactions ===${NC}"
REACT_BODY="{\"message_id\":\"$MESSAGE_ID\",\"emoji\":\"👍\"}"
REACT=$(post "$BASE_CORE/reactions" "$REACT_BODY" "$ACCESS")
ACTION=$(json_get "$REACT" "action")
echo "${GREEN}OK - action=$ACTION${NC}"

echo ""
echo "${CYAN}=== 12. GET /reactions/message/:messageId ===${NC}"
REACTIONS=$(get "$BASE_CORE/reactions/message/$MESSAGE_ID" "$ACCESS")
RCOUNT=$(json_get "$REACTIONS" "reactions")
echo "${GREEN}OK - count=${RCOUNT:-0}${NC}"

echo ""
echo "${CYAN}=== 13. PATCH /threads/:threadId/user-state (needs_response) ===${NC}"
patch "$BASE_CORE/threads/$THREAD_ID/user-state" '{"needs_response":true}' "$ACCESS" >/dev/null
echo "${GREEN}OK${NC}"

echo ""
echo "${CYAN}=== 14. GET /inbox ===${NC}"
INBOX=$(get "$BASE_CORE/inbox" "$ACCESS")
INBOX_COUNT=$(json_get "$INBOX" "items")
echo "${GREEN}OK - items=${INBOX_COUNT:-0}${NC}"

echo ""
echo "${CYAN}=== 15. PATCH /threads/:threadId/user-state (last_read_message_id) ===${NC}"
patch "$BASE_CORE/threads/$THREAD_ID/user-state" "{\"last_read_message_id\":\"$MESSAGE_ID\"}" "$ACCESS" >/dev/null
echo "${GREEN}OK${NC}"

echo ""
echo "${CYAN}=== 16. GET /inbox (after mark read) ===${NC}"
INBOX2=$(get "$BASE_CORE/inbox" "$ACCESS")
INBOX2_COUNT=$(json_get "$INBOX2" "items")
echo "${GREEN}OK - items=${INBOX2_COUNT:-0}${NC}"

echo ""
echo "${CYAN}=== 17. POST /messages/:messageId/versions ===${NC}"
VER_BODY='{"body":"Edited content"}'
VER=$(post "$BASE_CORE/messages/$MESSAGE_ID/versions" "$VER_BODY" "$ACCESS")
VER_ID=$(json_get "$VER" "version.id")
echo "${GREEN}OK - version_id=$VER_ID${NC}"

echo ""
echo "${CYAN}=== 18. GET /messages/:messageId/versions ===${NC}"
VERSIONS=$(get "$BASE_CORE/messages/$MESSAGE_ID/versions" "$ACCESS")
VCOUNT=$(json_get "$VERSIONS" "versions")
echo "${GREEN}OK - count=${VCOUNT:-0}${NC}"

echo ""
echo "${CYAN}=== 19. POST /threads/:threadId/state ===${NC}"
STATE_BODY='{"state":"BLOCKED"}'
TSTATE=$(post "$BASE_CORE/threads/$THREAD_ID/state" "$STATE_BODY" "$ACCESS")
THREAD_STATE=$(json_get "$TSTATE" "thread.state")
echo "${GREEN}OK - state=$THREAD_STATE${NC}"

echo ""
echo "${CYAN}=== 20. GET /health/ready ===${NC}"
READY=$(curl -s "$BASE_CORE/health/ready")
READY_STATUS=$(json_get "$READY" "status")
READY_DB=$(json_get "$READY" "db")
if [ "$READY_STATUS" != "ok" ]; then
  echo "${RED}Ready failed: $READY${NC}" >&2
  exit 1
fi
echo "${GREEN}OK - db=$READY_DB${NC}"

echo ""
echo "${CYAN}=== 21. Add member (identity-service) for participant test ===${NC}"
TEAMMATE_EMAIL="e2e-teammate-$(date +%Y%m%d%H%M%S)@example.com"
OTHER_USER_ID=""
ADD_MEMBER=$(post "$BASE_ID/orgs/$ORG_ID/members" "{\"email\":\"$TEAMMATE_EMAIL\"}" "$ACCESS" 2>/dev/null) || true
if [ -n "$ADD_MEMBER" ]; then
  OTHER_USER_ID=$(json_get "$ADD_MEMBER" "user_id")
fi
if [ -n "$OTHER_USER_ID" ]; then
  echo "${GREEN}OK - other_user_id=$OTHER_USER_ID${NC}"
else
  echo "${YELLOW}SKIP - add member failed (use existing user for participant tests)${NC}"
fi

TOTAL_STEPS=21
if [ -n "$OTHER_USER_ID" ]; then
  echo ""
  echo "${CYAN}=== 22. POST /threads/:threadId/participants ===${NC}"
  PART_BODY="{\"user_id\":\"$OTHER_USER_ID\",\"role\":\"PARTICIPANT\"}"
  P=$(post "$BASE_CORE/threads/$THREAD_ID/participants" "$PART_BODY" "$ACCESS")
  PART_ID=$(json_get "$P" "participant.id")
  echo "${GREEN}OK - participant_id=$PART_ID${NC}"

  echo ""
  echo "${CYAN}=== 23. GET /threads/:threadId/participants (after add) ===${NC}"
  PARTICIPANTS2=$(get "$BASE_CORE/threads/$THREAD_ID/participants" "$ACCESS")
  P2COUNT=$(json_get "$PARTICIPANTS2" "participants")
  echo "${GREEN}OK - count=$P2COUNT${NC}"

  echo ""
  echo "${CYAN}=== 24. PATCH /threads/:threadId/participants/:userId ===${NC}"
  MUTE_UNTIL=$(date -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
  patch "$BASE_CORE/threads/$THREAD_ID/participants/$OTHER_USER_ID" "{\"muted_until\":\"$MUTE_UNTIL\"}" "$ACCESS" >/dev/null
  echo "${GREEN}OK${NC}"

  echo ""
  echo "${CYAN}=== 25. DELETE /threads/:threadId/participants/:userId ===${NC}"
  delete "$BASE_CORE/threads/$THREAD_ID/participants/$OTHER_USER_ID" "$ACCESS"
  echo "${GREEN}OK${NC}"

  TOTAL_STEPS=25
fi

echo ""
echo "${CYAN}========================================${NC}"
echo "${GREEN}All $TOTAL_STEPS steps passed.${NC}"
echo "${CYAN}========================================${NC}"
