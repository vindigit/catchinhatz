# First encounter verification — 22 September 2026

The existing PlayCanvas Engine + TypeScript/Vite project now contains the playable Morrow Two encounter. Blender 5.2 authored the original dimensioned architecture; Playwright Chromium verified the running game. No paid generation or new runtime dependencies were used.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run fmt`: passed.
- `npm run build`: passed. The engine bundle is approximately 349 KB gzipped; the environment GLB is approximately 2.32 MB. Vite reports the expected large-engine-bundle warning and browser-externalized optional Node workers.
- `npm run test:smoke`: all eight tests passed in 30.3 seconds.
- Separate production preview check on port 4173: real Start click and held W entered the lobby, objective advanced to Stair A, enemy fire reduced health, and Escape paused. No page or console errors. The development harness is absent from the production page.

The regression suite covers damage and full retry reset, rejection of early extraction, continuous movement up and down the stairs, facade collision, twelve camera orbit/pitch poses on a ramp, closed-door movement and bullet occlusion, the complete mission, and real keyboard/menu/map/quality-switch input. The complete-route test walks from spawn through every required space, shoots all four guards through the weapon system, recovers the ledger, reloads, descends Stair B and extracts. It does not teleport through the route or directly set enemies dead. The completion button also starts a fresh encounter.

An independent authoring audit sampled 1,460 points along the route with the player's 0.3 m radius and found no unsupported points or wall collisions. Camera and shot raycasts include analytic ramp planes in addition to solid boxes.

## Rendering observations and limits

The installed headless test browser uses ANGLE Vulkan SwiftShader, a software renderer. The initial dynamic-lighting path ran at approximately 0.5 FPS there. Paused rendering, rigid character batching, a smaller internal image and approximate static vertex lighting were added for that backend.

The final live-input sample measured **21.08 FPS**, a 47.43 ms mean across 26 frame intervals, with 75 draw calls and a 432 × 270 internal image inside a 960 × 600 browser viewport. This is a short sample at the approach, not a sustained frame-time guarantee for the whole mission. Performance visuals cap the internal image at 480 × 270, while keeping the DOM interface at browser resolution. Full visuals cap at 1600 × 900. P changes quality during play; software renderers start in performance mode.

Both visual modes were inspected in actual browser screenshots, including switching to full and back without losing models or textures. Full-visual hardware performance has not been measured; the installed full Chromium probe could not launch, so no hardware frame-rate claim is made. Character art, animation, sound and AI complexity remain deliberately provisional. A human playtest is still needed to tune camera comfort, difficulty and pacing.

## Browser evidence

[Production lobby](screenshots/production-lobby.png) · [Full visual mode](screenshots/full-visuals.png) · [Completed encounter](screenshots/encounter-complete.png)

Screenshots come from the running game, not Blender previews. The editable Blender file, original textures and architectural provenance are in `art/source/`. Gameplay scope and outstanding design choices are in [the encounter notes](first-encounter.md).
