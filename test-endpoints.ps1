# Test core-service endpoints end-to-end
# Prereqs: identity-service on 3001, core-service on 3002, valid bootstrap user

$ErrorActionPreference = "Stop"
$baseId = "http://localhost:3001"
$baseCore = "http://localhost:3002"

Write-Host "=== 1. Login (identity-service) ===" -ForegroundColor Cyan
$loginBody = @{ email = "admin@ayncor.local"; password = "ayncor@123"; org_slug = "ayncor" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$baseId/auth/login" -ContentType "application/json" -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.access_token)" }
Write-Host "OK - org_id=$($login.org.id)" -ForegroundColor Green

Write-Host "`n=== 2. Health (core-service) ===" -ForegroundColor Cyan
$h = Invoke-RestMethod -Uri "$baseCore/health" -Headers $headers
if ($h.status -ne "ok") { throw "Health failed: $($h | ConvertTo-Json)" }
Write-Host "OK" -ForegroundColor Green

Write-Host "`n=== 3. POST /channels ===" -ForegroundColor Cyan
$slug = "e2e-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$channelBody = @{ name = "E2E Test"; slug = $slug; visibility = "ORG" } | ConvertTo-Json
$channel = Invoke-RestMethod -Method Post -Uri "$baseCore/channels" -ContentType "application/json" -Body $channelBody -Headers $headers
$channelId = $channel.channel.id
Write-Host "OK - channel_id=$channelId slug=$slug" -ForegroundColor Green

Write-Host "`n=== 4. GET /channels ===" -ForegroundColor Cyan
$channels = Invoke-RestMethod -Uri "$baseCore/channels" -Headers $headers
if ($channels.channels.Count -lt 1) { throw "No channels" }
Write-Host "OK - count=$($channels.channels.Count)" -ForegroundColor Green

Write-Host "`n=== 5. POST /threads ===" -ForegroundColor Cyan
$threadBody = @{ channel_id = $channelId; title = "Test Thread"; purpose = "E2E test" } | ConvertTo-Json
$thread = Invoke-RestMethod -Method Post -Uri "$baseCore/threads" -ContentType "application/json" -Body $threadBody -Headers $headers
$threadId = $thread.thread.id
Write-Host "OK - thread_id=$threadId" -ForegroundColor Green

Write-Host "`n=== 6. GET /threads/channel/:channelId ===" -ForegroundColor Cyan
$threads = Invoke-RestMethod -Uri "$baseCore/threads/channel/$channelId" -Headers $headers
if ($threads.threads.Count -lt 1) { throw "No threads" }
Write-Host "OK - count=$($threads.threads.Count)" -ForegroundColor Green

Write-Host "`n=== 7. GET /threads/:threadId/user-state ===" -ForegroundColor Cyan
$userState = Invoke-RestMethod -Uri "$baseCore/threads/$threadId/user-state" -Headers $headers
if (-not $userState.user_state) { throw "No user_state" }
Write-Host "OK - status=$($userState.user_state.status)" -ForegroundColor Green

Write-Host "`n=== 8. GET /threads/:threadId/participants ===" -ForegroundColor Cyan
$participants = Invoke-RestMethod -Uri "$baseCore/threads/$threadId/participants" -Headers $headers
Write-Host "OK - count=$($participants.participants.Count)" -ForegroundColor Green

Write-Host "`n=== 9. POST /messages ===" -ForegroundColor Cyan
$messageBody = @{ thread_id = $threadId; body = "Hello E2E!"; requires_response = $true } | ConvertTo-Json
$message = Invoke-RestMethod -Method Post -Uri "$baseCore/messages" -ContentType "application/json" -Body $messageBody -Headers $headers
$messageId = $message.message.id
Write-Host "OK - message_id=$messageId" -ForegroundColor Green

Write-Host "`n=== 10. GET /messages/thread/:threadId ===" -ForegroundColor Cyan
$msgs = Invoke-RestMethod -Uri "$baseCore/messages/thread/$threadId" -Headers $headers
if ($msgs.messages.Count -lt 1) { throw "No messages" }
Write-Host "OK - count=$($msgs.messages.Count)" -ForegroundColor Green

Write-Host "`n=== 11. POST /reactions ===" -ForegroundColor Cyan
$reactionBody = @{ message_id = $messageId; emoji = "👍" } | ConvertTo-Json
$reaction = Invoke-RestMethod -Method Post -Uri "$baseCore/reactions" -ContentType "application/json" -Body $reactionBody -Headers $headers
Write-Host "OK - action=$($reaction.action)" -ForegroundColor Green

Write-Host "`n=== 12. GET /reactions/message/:messageId ===" -ForegroundColor Cyan
$reactions = Invoke-RestMethod -Uri "$baseCore/reactions/message/$messageId" -Headers $headers
Write-Host "OK - count=$($reactions.reactions.Count)" -ForegroundColor Green

Write-Host "`n=== 13. PATCH /threads/:threadId/user-state (needs_response) ===" -ForegroundColor Cyan
$stateBody = @{ needs_response = $true } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$baseCore/threads/$threadId/user-state" -ContentType "application/json" -Body $stateBody -Headers $headers | Out-Null
Write-Host "OK" -ForegroundColor Green

Write-Host "`n=== 14. GET /inbox ===" -ForegroundColor Cyan
$inbox = Invoke-RestMethod -Uri "$baseCore/inbox" -Headers $headers
Write-Host "OK - items=$($inbox.items.Count)" -ForegroundColor Green
if ($inbox.items.Count -gt 0) { Write-Host "  first: $($inbox.items[0].thread_title) next_action=$($inbox.items[0].next_action)" }

Write-Host "`n=== 15. PATCH /threads/:threadId/user-state (last_read_message_id) ===" -ForegroundColor Cyan
$readBody = @{ last_read_message_id = $messageId } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$baseCore/threads/$threadId/user-state" -ContentType "application/json" -Body $readBody -Headers $headers | Out-Null
Write-Host "OK" -ForegroundColor Green

Write-Host "`n=== 16. GET /inbox (after mark read) ===" -ForegroundColor Cyan
$inbox2 = Invoke-RestMethod -Uri "$baseCore/inbox" -Headers $headers
Write-Host "OK - items=$($inbox2.items.Count)" -ForegroundColor Green

Write-Host "`n=== 17. POST /messages/:messageId/versions ===" -ForegroundColor Cyan
$verBody = @{ body = "Edited content" } | ConvertTo-Json
$ver = Invoke-RestMethod -Method Post -Uri "$baseCore/messages/$messageId/versions" -ContentType "application/json" -Body $verBody -Headers $headers
Write-Host "OK - version_id=$($ver.version.id)" -ForegroundColor Green

Write-Host "`n=== 18. GET /messages/:messageId/versions ===" -ForegroundColor Cyan
$versions = Invoke-RestMethod -Uri "$baseCore/messages/$messageId/versions" -Headers $headers
Write-Host "OK - count=$($versions.versions.Count)" -ForegroundColor Green

Write-Host "`n=== 19. POST /threads/:threadId/state ===" -ForegroundColor Cyan
$stateReq = @{ state = "BLOCKED" } | ConvertTo-Json
$t = Invoke-RestMethod -Method Post -Uri "$baseCore/threads/$threadId/state" -ContentType "application/json" -Body $stateReq -Headers $headers
Write-Host "OK - state=$($t.thread.state)" -ForegroundColor Green

Write-Host "`n=== 20. GET /health/ready ===" -ForegroundColor Cyan
$ready = Invoke-RestMethod -Uri "$baseCore/health/ready"
if ($ready.status -ne "ok") { throw "Ready failed" }
Write-Host "OK - db=$($ready.db)" -ForegroundColor Green

Write-Host "`n=== 21. Add member (identity-service) for participant test ===" -ForegroundColor Cyan
$orgId = $login.org.id
$teammateEmail = "e2e-teammate-" + (Get-Date -Format "yyyyMMddHHmmss") + "@example.com"
try {
  $addMemberBody = @{ email = $teammateEmail } | ConvertTo-Json
  $member = Invoke-RestMethod -Method Post -Uri "$baseId/orgs/$orgId/members" -ContentType "application/json" -Body $addMemberBody -Headers $headers
  $otherUserId = $member.user_id
  Write-Host "OK - other_user_id=$otherUserId" -ForegroundColor Green
} catch {
  Write-Host "SKIP - add member failed (use existing user for participant tests): $_" -ForegroundColor Yellow
  $otherUserId = $null
}

if ($otherUserId) {
  Write-Host "`n=== 22. POST /threads/:threadId/participants ===" -ForegroundColor Cyan
  $participantBody = @{ user_id = $otherUserId; role = "PARTICIPANT" } | ConvertTo-Json
  $p = Invoke-RestMethod -Method Post -Uri "$baseCore/threads/$threadId/participants" -ContentType "application/json" -Body $participantBody -Headers $headers
  Write-Host "OK - participant_id=$($p.participant.id)" -ForegroundColor Green

  Write-Host "`n=== 23. GET /threads/:threadId/participants (after add) ===" -ForegroundColor Cyan
  $participants2 = Invoke-RestMethod -Uri "$baseCore/threads/$threadId/participants" -Headers $headers
  Write-Host "OK - count=$($participants2.participants.Count)" -ForegroundColor Green

  Write-Host "`n=== 24. PATCH /threads/:threadId/participants/:userId ===" -ForegroundColor Cyan
  $muteBody = @{ muted_until = (Get-Date).AddDays(1).ToUniversalTime().ToString("o") } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri "$baseCore/threads/$threadId/participants/$otherUserId" -ContentType "application/json" -Body $muteBody -Headers $headers | Out-Null
  Write-Host "OK" -ForegroundColor Green

  Write-Host "`n=== 25. DELETE /threads/:threadId/participants/:userId ===" -ForegroundColor Cyan
  Invoke-RestMethod -Method Delete -Uri "$baseCore/threads/$threadId/participants/$otherUserId" -Headers $headers | Out-Null
  Write-Host "OK" -ForegroundColor Green

  $totalSteps = 25
} else {
  $totalSteps = 20
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "All $totalSteps steps passed." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
