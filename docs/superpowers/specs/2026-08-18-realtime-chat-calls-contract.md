# Realtime Chat + Calls — Socket Contract (frozen)

> **Status:** frozen interface. Backend gateway, web-admin, and worker-app all
> build against exactly these event names + payloads. Change here first, then
> the three implementations. Owner lane: **realtime/calls** (this session).

**Goal:** live chat delivery + 1:1 WebRTC voice/video calls with in-app
incoming-call ringing, between **web-admin (admin/dispatcher)** and
**worker-app (employee)**. Media is peer-to-peer (STUN, optional TURN); the
backend only relays signaling and persists history.

## Transport

- **Socket.IO** (`@nestjs/websockets` + `@nestjs/platform-socket.io`). Default
  path `/socket.io`. Rides the existing nginx WS upgrade.
- **Connect URL (clients):** `wss://murojaatnoma.uz`, default path `/socket.io`
  (an nginx `/socket.io` route on the main host proxies to the gateway — commit
  1d58c74). **This is the host web + mobile clients MUST use.**
  NOTE: `api.murojaatnoma.uz` has **no public DNS** — it resolves only inside the
  VPN, so it's for server-side / VPN-internal testing only, never for real
  clients. (Dev: `ws://<host>:3000`.)
- **Handshake auth:** `io(url, { auth: { token: <JWT access token> } })`.
  - Backend validates the JWT with the same secret as `JwtStrategy`
    (`config.jwt.accessSecret`). On success attaches an identity to the socket:
    `{ id, name, avatar?, scope }` where `scope ∈ 'admin' | 'employee'`.
  - **Identity id:** admin → `"me"` (matches existing `ChatMessage.senderId`
    convention for the admin) OR the admin user id; employee → their `staffId`
    (the id used in `ChatConversation.staffId` / `dm-<staffId>`). One canonical
    id per user is used for `user:<id>` rooms and call routing.
  - Invalid/absent token → server emits `auth:error` `{ message }` then
    disconnects. (NOT `connect_error` — that is a Socket.IO **reserved** event
    and throws if emitted server-side; clients still get the native
    `connect_error` from the transport on a refused connection.)
- **Rooms:** each socket auto-joins `user:<id>`. Chat rooms are
  `conv:<conversationId>` (joined on demand).

## Chat events

### Client → server
| event | payload | effect |
|---|---|---|
| `chat:join` | `{ conversationId }` | join room `conv:<id>` |
| `chat:leave` | `{ conversationId }` | leave room |
| `chat:send` | `{ conversationId, kind, text?, fileName?, fileSize?, url?, durationSec? }` | persist via `ChatService.sendMessage`, then broadcast `chat:message` to `conv:<id>` |
| `chat:read` | `{ conversationId }` | persist `markRead`, broadcast `chat:read` |
| `chat:typing` | `{ conversationId, isTyping }` | broadcast `chat:typing` (not persisted) |

`kind ∈ 'text' | 'image' | 'file' | 'voice' | 'video'` (matches `ChatMsgKind`).
`'video'` = Telegram-style **round video note** (carries `url` + `durationSec`,
same shape as `voice`): client records via `getUserMedia({video,audio})` →
`MediaRecorder` → **POST /uploads** (mp4/webm) → `chat:send { kind:'video', url,
durationSec }`. Rendered as a circular player on both clients (client lane).

### Server → client
| event | payload |
|---|---|
| `chat:message` | `{ conversationId, message: ChatMessage }` |
| `chat:read` | `{ conversationId, readerId }` |
| `chat:typing` | `{ conversationId, userId, isTyping }` |
| `presence:update` | `{ userId, online: boolean, lastSeen: string /*ISO*/ }` |

`ChatMessage` is the exact Prisma/HTTP shape already returned by
`GET /chat/conversations/:id/messages` (id, conversationId, senderId, kind,
text?, fileName?, fileSize?, url?, durationSec?, status, createdAt).

**Presence:** on connect → mark user online + broadcast `presence:update`; on
disconnect → offline + `lastSeen = now`. For `dm-<staffId>` conversations also
mirror into `ChatConversation.online` so the HTTP list reflects it.

## Call events (WebRTC 1:1)

### Client → server
| event | payload | effect |
|---|---|---|
| `call:invite` | `{ toUserId, media: 'audio'\|'video', conversationId? }` | create `CallLog` (status `ringing`), emit `call:incoming` to `user:<toUserId>`. If callee has no live socket → FCM data-push `{ type:'incoming_call', ... }`; if callee already in a call → emit `call:busy` back to caller. Returns `{ callId }` (ack). |
| `call:accept` | `{ callId }` | emit `call:accepted` to caller; `CallLog.answeredAt = now`, status `accepted` |
| `call:reject` | `{ callId }` | emit `call:rejected` to caller; status `rejected` |
| `call:cancel` | `{ callId }` | caller aborts before answer → emit `call:cancelled` to callee; status `cancelled` |
| `call:sdp` | `{ callId, description: RTCSessionDescriptionInit }` | relay `call:sdp` to the other peer |
| `call:ice` | `{ callId, candidate: RTCIceCandidateInit }` | relay `call:ice` to the other peer |
| `call:end` | `{ callId }` | emit `call:ended` to the other peer; status `ended`, set `endedAt` + `durationSec` |

### Server → client
| event | payload |
|---|---|
| `call:incoming` | `{ callId, from: { id, name, avatar? }, media }` |
| `call:accepted` | `{ callId }` |
| `call:rejected` | `{ callId }` |
| `call:cancelled` | `{ callId }` |
| `call:busy` | `{ callId }` |
| `call:missed` | `{ callId }` (ring timeout ~35s with no accept) |
| `call:sdp` | `{ callId, description }` |
| `call:ice` | `{ callId, candidate }` |
| `call:ended` | `{ callId, durationSec }` |

### WebRTC negotiation flow
1. Caller: `getUserMedia` → new `RTCPeerConnection(iceServers)` → emit `call:invite` → gets `{callId}`.
2. Callee: `call:incoming` → ring UI. On accept: `getUserMedia`, new PC, emit `call:accept`.
3. Caller on `call:accepted`: `createOffer` → `setLocalDescription` → emit `call:sdp`(offer).
4. Callee on `call:sdp`(offer): `setRemoteDescription` → `createAnswer` → `setLocalDescription` → emit `call:sdp`(answer).
5. Both trickle ICE via `call:ice` (`onicecandidate` → emit; on receive → `addIceCandidate`).
6. Media flows P2P. Either side `call:end` to hang up.

### ICE servers
`GET /rt/ice-servers` (Public) → `{ iceServers: RTCIceServer[] }`.
- Always: `{ urls: 'stun:stun.l.google.com:19302' }`.
- If env `TURN_URL` set: append `{ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL }`.
Clients fetch this once before a call so TURN can be added server-side later
with **no client rebuild**.

## Persistence — `CallLog` (new Prisma model)
```prisma
model CallLog {
  id          String    @id @default(uuid())
  callerId    String
  callerName  String
  calleeId    String
  calleeName  String
  media       String    // 'audio' | 'video'
  status      String    // ringing|accepted|rejected|missed|cancelled|ended|busy
  startedAt   DateTime  @default(now())
  answeredAt  DateTime?
  endedAt     DateTime?
  durationSec Int       @default(0)
  @@index([callerId, startedAt])
  @@index([calleeId, startedAt])
  @@map("call_logs")
}
```
`GET /calls?userId=&limit=` (Public for now, gate later) → recent calls for the
call-history UI (missed/incoming/outgoing badges).

## FCM background incoming-call push
On `call:invite` when the callee has **no live socket**, send an FCM **data**
message to the callee's `DeviceToken`s (the push module already stores them):
`{ type: 'incoming_call', callId, callerId, callerName, media }`, high priority.
worker-app's background handler shows a full-screen incoming-call notification.
Requires `FIREBASE_SERVICE_ACCOUNT_B64` on the server (already wired in
`FcmService`); degrades to in-app-only ringing when absent.

## Config (env) — additive
- `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (optional; STUN-only if unset).
- `CALL_RING_TIMEOUT_SEC` (default 35).

## Meeting rooms (multi-party mesh WebRTC — "yig'ilish / selektor")
Ephemeral **in-memory** rooms keyed by `meetingId` (no persistence, no
meetings-backend change). Participant id = the socket's identity id (`me` for
any admin, employeeId for employees). Mesh convention: the **newcomer offers**
to each existing participant. Demo scope = one admin (`me`) + distinct employees
(two admin browsers share id `me`, so they can't be distinct peers — fine for an
admin-led selektor where employees join from mobile).

### Client → server
| event | payload | effect |
|---|---|---|
| `meeting:join` | `{ meetingId }` | join; **ack** `{ participants: [{id,name,avatar?}] }` (existing, distinct) + broadcast `meeting:participant-joined` to the room |
| `meeting:leave` | `{ meetingId }` | leave; broadcast `meeting:participant-left` (also fires automatically on socket disconnect) |
| `meeting:sdp` | `{ meetingId, toUserId, description }` | relay to that participant's socket(s) as `{ meetingId, fromUserId, description }` |
| `meeting:ice` | `{ meetingId, toUserId, candidate }` | relay as `{ meetingId, fromUserId, candidate }` |

### Server → client
| event | payload |
|---|---|
| `meeting:participant-joined` | `{ meetingId, participant: { id, name, avatar? } }` |
| `meeting:participant-left` | `{ meetingId, userId }` |
| `meeting:sdp` | `{ meetingId, fromUserId, description }` |
| `meeting:ice` | `{ meetingId, fromUserId, candidate }` |

Flow: on join, the ack gives the newcomer the existing participants; it creates
an offer to each (`meeting:sdp`), each answers. Current members learn of the
newcomer via `meeting:participant-joined` and expect its offer. ICE trickles via
`meeting:ice`. Reuses the same JWT-authed socket + `/rt/ice-servers` (STUN/TURN)
as 1:1 calls.

## Message-level ops (delete any / edit while unread)
User ask: delete each message; edit a message **while it is still unread**
("o'qilmagan bo'lsa edit"). Schema: add `editedAt DateTime?` to `ChatMessage`.

| method | route | rule |
|---|---|---|
| `DELETE` | `/chat/conversations/:cid/messages/:mid` | remove a message (soft-guard: any participant may delete) |
| `PATCH` | `/chat/conversations/:cid/messages/:mid` `{ text }` | edit body **only while `status !== 'read'`** → else `409` ("o'qilgan xabarni tahrirlab bo'lmaydi"); sets `editedAt` |

Realtime (broadcast to `conv:<cid>`):
- `chat:message:deleted` `{ conversationId, messageId }`
- `chat:message:edited` `{ conversationId, message }` (carries `editedAt`)

These fire from BOTH the REST endpoints and their socket twins
(`chat:delete-message`, `chat:edit-message`) via the domain-event bridge, so a
client may use either channel and the other side still updates live.

## Screen sharing (calls + meetings)
Pure client-side — **no new backend**. During an active call the sharer swaps
its video track for `getDisplayMedia()` and triggers WebRTC **renegotiation**,
which reuses the existing `call:sdp` relay (new offer → answer). Optional UI
hint so the peer can label it: `call:media` `{ callId, source: 'camera'|'screen', on: boolean }`
(client→server relayed to the other peer). Applies identically in 1:1 calls and
in the meetings call surface (`features/meetings` / worker-app
`meeting_call_page`) — same events, same PeerConnection code path (client lane).

## Chat conversation management (archive / clear / delete)
User ask: per-conversation actions — delete, "clear chat", and **when cleared →
archive** ("tozalansa archieve bolsin"). Semantics:

- **Archive** (`arxivlash`) — move conversation to the Archive view, **keep
  messages**; unarchive restores it to the main list.
- **Clear** (`tozalash`) — delete all messages in the conversation, keep the
  conversation, and **auto-archive** it (this is the "cleared → archived" flow).
- **Delete** (`o'chirish`) — permanently remove the conversation + its messages.
  The group conversation `group-all` ("Umumiy chat") is **not** deletable or
  clearable (guard server-side → 400).

Schema: add `archived Boolean @default(false)` to `ChatConversation` (+ optional
`archivedAt DateTime?`). New endpoints (Public for now, gate later):

| method | route | effect |
|---|---|---|
| `PATCH` | `/chat/conversations/:id/archive` `{ archived: boolean }` | set archived flag (+ archivedAt) |
| `DELETE` | `/chat/conversations/:id/messages` | **clear**: delete all messages + set archived=true (block `group-all`) |
| `DELETE` | `/chat/conversations/:id` | **delete** conversation + messages (block `group-all`) |

`GET /chat/conversations` gains `?archived=true|false` (default `false` — the
main list hides archived; the Archive view requests `archived=true`). The
`ChatConversationResponse` already carries enough fields; add `archived` to it.

Realtime: on archive/clear/delete, emit `chat:conversation` `{ conversationId,
action: 'archived'|'cleared'|'deleted'|'unarchived' }` to `user:<id>` rooms of
both participants so the other side's list updates live.

## Employee directory ("Xodimga yozish" — add + search)
No new backend needed: the client opens a direct chat via the existing
`POST /chat/conversations/direct { staffId }`, and lists/searches employees via
the existing staff endpoint (`GET /workforce/staff` / `/staff`) already consumed
by `useLiveEmployees` + `EmployeePickerModal`. This is a **client polish** item
(picker UI, search, avatars, online dots) owned by the client lane — backend
contract is unchanged. Presence dots come from `presence:update` (above).

## Out of scope (this iteration)
- Citizen (user-app) calls — calls are admin↔employee only for now.
- Group calls (1:1 only).
- Native CallKit/ConnectionService full integration (in-app ringing + FCM
  full-screen notification instead; CallKit is a later enhancement).
