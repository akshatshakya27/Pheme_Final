# One Way Implementation

This document captures all changes made for the one-way live proctoring implementation, role/auth fixes, and desktop chat UX updates.

## Scope Implemented

- One-way live camera stream from student to proctor.
- Proctor-to-student chat messaging during exam.
- Electron desktop exam UI parity for chat.
- Session-scoped message reset per fresh attempt.
- Supporting fixes for auth, dashboard session visibility, and DB connection reliability.

## Frontend Changes

### 1) Proctor Live Panel: Real WebRTC Receive + Fallback

File: `frontend/src/pages/proctor/ProctorLivePanelPage.tsx`

- Added WebRTC signaling client over WebSocket (`/proctoring/ws/{session_id}`) for role `proctor`.
- Added `RTCPeerConnection` setup with STUN server (`stun:stun.l.google.com:19302`).
- Implemented signaling handlers for:
  - `webrtc-ready`
  - `offer`
  - `answer`
  - `ice-candidate`
- Added race-condition handshake fix:
  - On receiving student `webrtc-ready`, proctor replies with `webrtc-ready` to trigger offer regardless of connection order.
- Kept snapshot polling fallback (`/proctoring/live-frame/{session_id}`) and messages polling (`/proctoring/messages/{session_id}`).
- Added WebRTC status badge for runtime diagnostics (`ws-connected`, `offer-received`, `answer-sent`, `stream-live`, etc.).

### 2) Browser Student Exam Flow: WebRTC Publish

File: `frontend/src/components/student-final/ExamInterface.tsx`

- Added student-side WebRTC publish flow.
- Sends camera track to proctor when proctor is ready.
- Added signaling handling via session WebSocket endpoint.
- Added resilient WebSocket URL building for normal browser and file/electron contexts.
- Preserved existing frame-analysis logic.

### 3) Electron Desktop Student Exam Flow: WebRTC Publish

File: `frontend/src/pages/exam/DesktopExamSessionPage.tsx`

- Added student-side WebRTC publish in desktop exam session.
- Uses camera stream from desktop exam page and sends track over peer connection.
- Added signaling handlers for `webrtc-ready`, `answer`, and `ice-candidate`.
- Added Electron-safe signaling URL fallback.
- Preserved existing proctoring frame-analysis calls.

### 4) Desktop Exam Chat UX Improvements

File: `frontend/src/pages/exam/DesktopExamSessionPage.tsx`

- Added in-exam chat capability for desktop student:
  - Poll messages from `/api/proctoring/messages/{session_id}`.
  - Send messages using `/api/proctoring/messages`.
- Refactored chat UX from fixed panel to phone-style interaction:
  - Floating chat icon button.
  - Unread badge counter on new incoming proctor messages.
  - Right-side slide-out chat drawer on click.
  - Overlay click and close button support.
- Added auto-scroll behavior in open chat drawer.

### 5) Proctor Dashboard Session Visibility Fix

File: `frontend/src/pages/proctor/ProctorDashboard.tsx`

- Fixed active session filtering to include backend active statuses (`in_progress`, `ongoing`, `active`).
- Updated session field usage from `user_id` to `student_id` where needed.

### 6) Login Role UI Separation

File: `frontend/src/pages/Login.tsx`

- Confirmed/updated separate login role options for:
  - Admin
  - Proctor
  - Student

## Backend Changes

### 1) Proctoring Signaling WebSocket

File: `backend/app/routers/proctoring.py`

- Added WebSocket signaling endpoint:
  - `/proctoring/ws/{session_id}`
- Added token-based principal resolution for WebSocket authentication.
- Added in-memory session client registry for signaling relay between student and proctor roles.
- Routed signaling message types (`webrtc-ready`, `offer`, `answer`, `ice-candidate`) to counterpart peer.

### 2) Proctor Message APIs

File: `backend/app/routers/proctoring.py`

- Confirmed/used message endpoints:
  - `GET /proctoring/messages/{session_id}`
  - `POST /proctoring/messages`
- Messages are stored in memory keyed by session.

### 3) Chat Reset Per Attempt

Files:
- `backend/app/routers/proctoring.py`
- `backend/app/routers/desktop_exam.py`
- `backend/app/routers/sessions.py`

- Added helper: `reset_session_messages(session_id)`.
- Called reset helper whenever an attempt starts/restarts in:
  - Desktop exam start flow.
  - Standard session start flow.
- Result: chat history is cleared for each fresh attempt.

### 4) Auth Role Support for Proctor Login

File: `backend/app/routers/auth.py`

- Updated login role handling to accept `proctor` in addition to existing roles.
- Mapped proctor login to Faculty/proctor auth path correctly.

### 5) Database Connection Reliability

File: `backend/app/database.py`

- Hardened SQLAlchemy engine config against stale pooled connections.
- Added connection health/recycle settings (e.g., pre-ping/recycle behavior).

## Build/Verification Summary

- Frontend build succeeded after WebRTC and chat UI changes.
- Frontend build succeeded after desktop chat icon + unread drawer refactor.
- Electron packaging (`build:exe`) was completed in session context.
- Backend restart required after backend router changes.

## Current Functional Outcome

- Student camera is streamed one-way to proctor using WebRTC signaling.
- Snapshot/frame polling remains as fallback path.
- Proctor can message candidate.
- Candidate can access chat in Electron using floating icon + unread badge + drawer.
- Chat history resets on each new attempt start.

## Notes

- This implementation is intentionally one-way for media (student -> proctor).
- If network conditions are restrictive, TURN server support may be required for broader NAT traversal reliability.
