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

## Ongoing Rule

- From this point onward, implementation changes and important UI/design decisions should be appended here before committing to GitHub.
