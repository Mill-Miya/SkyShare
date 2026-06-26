# SkyShare Change Log

This file records implementation work and notable design changes so progress can be reviewed on GitHub.

## 2026-06-26

- Completed Phase1 baseline on `main`.
- Created and pushed `codex/phase2-guidance` branch.
- Added Phase2 file split:
  - `src/types.ts`
  - `src/astronomy.ts`
  - `src/drawing.ts`
  - `src/guidance.ts`
- Added Targets screen for Moon, Mercury, Venus, Mars, Jupiter, and Saturn.
- Added selected target state and Sky highlight ring/label emphasis.
- Added guidance calculation from Sky center to selected target.
- Added guidance panel with azimuth/altitude movement text.
- Added target acquired state within +/-3 degrees.
- Added altitude status: visible, difficult, below horizon.
- Added minimal Settings screen.
- Added night mode.
- Added aurora/background-effect toggle and explanatory note.
- Limited debug display to `?debug=1`.
- Iterated guidance indicator:
  - Replaced discrete arrow text with a circular guidance indicator.
  - Fixed the 180-degree spin issue by avoiding CSS rotation.
  - Added a V-notched isosceles triangle pointer.
  - Added two subtle concentric rings.
  - Switched to a smaller moving dot inside the innermost ring.
  - Kept `◎` for acquired state.
- Fixed guidance panel sizing so popup dimensions do not change between pre-acquired and acquired states.
- Increased the fixed guidance panel height to fit the acquired-state content without clipping.
- Merged Phase2 pull request into `main`.
- Started Phase3 on `codex/phase3-session-sync`.
- Added MVP session server using Node.js + `ws`.
- Added `/api/session` session creation and `/ws` WebSocket endpoint.
- Added Session screen, Host session creation, Guest session state display, QR code generation, and targetId-only sharing flow.
- Fixed unnecessary 3-second Guest reconnect churn by ignoring close events from stale WebSocket instances.
- Reorganized Session into three clear states: not joined, hosting, and guest.
- Added manual sessionId entry above Host creation on the not-joined Session screen.
- Added Host session ending flow with `session:ended` notification to Guests.
- Improved Phase3.5 Session UX with a two-step not-joined flow: choose join or create first.
- Added `session:ended.reason` for `host_ended`, `host_disconnected`, and `server_shutdown`.
- Added a 30-second Host reconnect grace period before ending a session after unexpected Host disconnects.
- Simplified Session screen copy and spacing to reduce explanation-heavy UI and keep participant-facing wording action-oriented.
- Added clear back paths in the Session not-joined flow and made QR/code join choices toggleable.
- Added bottom-nav reselect behavior so Session not-joined subviews return to the initial join/start choice without ending active sessions.
- Changed bottom-nav reselect behavior to return from Targets, Session, or Settings back to Sky as the home view.
- Moved the create-flow back button to the top to match the join-flow layout.
- Updated Host QR label to "QRを表示" and added clearer connection status dots to the status badges.
- Changed Targets, Session, and Settings from full-screen swaps to calm bottom sheets over the Sky view.
- Added smooth sheet open/close motion, backdrop tap close, and reduced-motion handling.
- Added smooth Sky view animation after selecting a target from Targets, with shortest-azimuth interpolation and touch cancellation.
- Refined bottom sheet layering so sheets stop above the bottom navigation instead of sliding behind it.
- Changed target-selection motion to close the sheet first, briefly widen the view, pan toward the selected body, restore zoom, then show guidance.
- Expanded the guidance indicator travel radius so distant targets can reach near the outer ring and better communicate distance.
- Added Phase3.6 sharing ON/OFF controls so Hosts can pause target guidance without ending the session.
- Represented sharing pause with the existing `target:update` message and `targetId: null`, preserving the WebSocket message set.
- Updated Guest Sky and Session views to show when no target is currently shared while keeping the session connected.
- Added Phase3.7 direction sharing mode with `pointer:update` for Host Sky-center azimuth/altitude sharing.
- Added `shareMode` and latest pointer data to session state so Guests can restore OFF, target, or direction sharing after reconnect.
- Added Guest direction marker UI and Host OFF/天体/方向 share mode controls with throttled pointer updates.
- Added client fallback so session state without `shareMode` still restores target sharing from `targetId`.
- Allowed `selectedTargetId` to start as `null` and added a Targets "選択なし" action.
- Separated Host selection from sharing behavior so target sharing with no selected target sends `targetId: null` while pointer sharing remains available.
- Preserved target-share mode with no selected target by allowing `target:update` to carry an optional `shareMode` field.
- Added subtle altitude guide lines, zenith label, center altitude readout, and a Settings toggle for altitude guidance.
- Changed altitude guide lines from flat screen-space lines to curved sky-sphere guide arcs, with zenith shown as a point instead of a horizontal line.
- Reduced card-like UI weight for Sky, Targets, Settings notes, and the bottom navigation while keeping guidance panels clear.

## Ongoing Rule

- From this point onward, implementation changes and important UI/design decisions should be appended here before committing to GitHub.
