# Ayncor Core Service — AGENTS.md

This file defines the **non-negotiable rules** for `core-service`.

If violated → do not merge.

---

# 1. Core Responsibility (DO NOT BREAK)

This service owns:

- channels
- threads (first-class)
- messages
- message versions
- reactions
- participants
- per-user thread state
- inbox state (review queue)

This is the **source of truth for collaboration data**.

---

# 2. Async-First Invariants (NON-NEGOTIABLE)

- No presence indicators
- No typing indicators
- No implicit urgency
- No auto-bumping threads
- Messages do NOT imply immediate response

If a change introduces Slack-like behavior → reject it.

---

# 3. Hard Boundaries

Do NOT add:

- authentication logic
- user/org management
- notification delivery
- realtime transport
- scheduling logic

---

# 4. Contracts (STRICT)

`contracts/` defines API + event truth.

Rules:

- No undocumented responses or fields
- No silent schema changes
- No breaking changes without justification

If change required:

1. Explain why contract fails
2. Evaluate alternatives
3. Document trade-offs
4. Maintain backward compatibility where possible

---

# 5. Domain Rules

- Threads are first-class entities
- Messages are immutable
- Edits create versions
- ARCHIVED is terminal
- Inbox must remain deterministic

Never compromise data integrity for convenience.

---

# 6. Data Ownership

- Owns threads, messages, reactions, inbox
- Identity referenced by ID only
- No identity DB access

---

# 7. Event Rules

- Events emitted AFTER persistence
- Events are not source of truth
- Do not embed business logic in events

---

# 8. Logging Rules

- Use the shared logger util (`src/shared/logger/logger.ts`) for operational logs (avoid raw `console.*`)
- Default to minimal logging in request paths; add domain logs only when needed and rate-limited
- Log failures explicitly in long-running processes (e.g. relay)
- Never log sensitive data

---

# 9. Performance Rules

- APIs must remain stateless
- No in-memory cross-request state
- Prefer append-only patterns

---

# 10. Things That Must Never Happen

- Realtime logic inside core-service
- Slack-like UX behavior creeping in
- Breaking inbox logic silently
- Mutating message history

---

# 11. Philosophy

Data integrity > UX shortcuts  
Async > realtime pressure  
Clarity > cleverness

This service defines product correctness.
