# Testing Distribution Plan (3 People)

## Goal
Equal testing ownership across the completed project with clear scope and no overlap confusion.

## Team Mapping
Replace these placeholders with real names:
- Tester A
- Tester B
- Tester C

## Equal Workload Rule
- Each tester owns `12 primary test cases`.
- Each tester also runs `4 shared smoke checks` from another owner's area.
- Total per person: `16 checks`.

## Assignment Matrix

| Tester | Primary Area | Key Files/Services | Primary Cases |
|---|---|---|---|
| Tester A | Auth + User Profile + Gateway auth routing | `backend/auth-service`, `frontend/src/auth`, `backend/api-gateway/index.js` | 12 |
| Tester B | Diary CRUD + Collaborators + Dashboard data | `backend/diary-service/src/routes/entries.js`, `backend/diary-service/src/routes/collaborators.js`, `frontend/src/components/FlipBook.jsx`, `frontend/src/auth/pages/DashboardPlaceholder.jsx` | 12 |
| Tester C | Realtime sockets + Notifications + Friends presence | `backend/realtime-service/websocket/realtime`, `frontend/src/components/FriendRequestToastLayer.jsx`, socket flows in `frontend/src/components/FlipBook.jsx` | 12 |

## Detailed Test Allocation

### Tester A: Auth and Account Flows (12)
1. Register with valid data (`/api/auth/register`) creates account.
2. Register with duplicate email returns expected error.
3. Login with correct credentials returns token/session.
4. Login with wrong password fails cleanly.
5. Forgot password sends reset flow (`/api/auth/forgot-password`).
6. Reset password with valid token succeeds.
7. Reset password with invalid/expired token fails.
8. 2FA login path: login requires verify step (`/api/auth/verify-2fa-login`).
9. 2FA verify with valid code succeeds.
10. 2FA verify with invalid code fails and is rate-limited.
11. Google auth URL + callback flow works (`/api/auth/google/*`).
12. Authenticated profile update (`/api/auth/profile` or `/users/profile`) persists changes.

### Tester B: Diary, Collaboration Permissions, Dashboard Data (12)
1. Create diary entry (`/diary/entries`) with valid payload succeeds.
2. Get entries list returns owned entries only.
3. Get single entry by id returns correct record.
4. Update entry (`PUT`/`POST /:id/update`) persists edits.
5. Delete entry removes record and is not retrievable.
6. Private vs collaborative diary type constraints enforced.
7. Invite collaborator to entry succeeds (`/diary/collaborators/entries/:entryId/invite`).
8. Accept collaborator invite grants access.
9. Decline collaborator invite does not grant access.
10. Unauthorized user cannot update/remove collaborators.
11. Dashboard endpoint returns expected aggregates (`/diary/dashboard`).
12. Large content payload near limit behaves correctly (accepts within limit, fails above limit).

### Tester C: Realtime, Notifications, Friends/Presence (12)
1. Socket connect with valid auth token emits `ready`.
2. Socket connect without token is rejected.
3. Join entry room event works (`JOIN_ENTRY_ROOM`).
4. Leave entry room removes viewer state (`LEAVE_ENTRY_ROOM`).
5. State request returns current state (`STATE_REQUEST/STATE_RESPONSE`).
6. Entry edit broadcast reaches other participant only.
7. Cursor move/clear broadcasts correctly.
8. Access denied event fires for unauthorized collaborator edits.
9. Notification created event reaches user room (`notification:created` + notification WS events).
10. Notification list/count requests return expected values.
11. Mark read / mark all read updates unread count correctly.
12. Friend online/offline presence events emit when users connect/disconnect.

## Shared Smoke Rotation (4 each)
- Tester A runs 4 smoke checks from Tester C's area.
- Tester B runs 4 smoke checks from Tester A's area.
- Tester C runs 4 smoke checks from Tester B's area.

Recommended smoke set:
1. Login success.
2. Create diary entry.
3. Realtime connection success.
4. Notification count updates after mark-read.

## Execution Order (Fastest to Finish)
1. Tester A executes all auth cases first so test accounts are ready.
2. Tester B executes diary/collab cases using those accounts.
3. Tester C executes socket and notification multi-user scenarios.
4. Perform shared smoke rotation and close defects.

## Exit Criteria
- 100% of `36 primary cases` executed (`12 x 3`).
- 100% of `12 smoke cross-checks` executed (`4 x 3`).
- All P0/P1 defects fixed or explicitly waived.
- Final regression pass on:
  - Login
  - Create/update diary
  - Collaborator invite/accept
  - Realtime edit sync
  - Notification unread count
