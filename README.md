# Morrow game

Local PlayCanvas Engine + TypeScript project for a browser-first, single-player encounter in Bell Ward's Morrow Two. The first encounter runs from the south lobby through Stair A, Level 2 and Apartment 204, down Stair B and out the north service exit. Recover the ledger and clear four hostiles to finish. Failure offers a full encounter retry. See [implementation and playtest notes](docs/first-encounter.md) and the [spatial reference brief](docs/morrow-two-level-brief.md).

## Start the game

Use Node.js 22.23.2 or later. This machine has Node 24.13.1 through nvm-windows.

```powershell
nvm use 24.13.1
cd C:\Users\valexander\Documents\Codex\2026-09-20\tak\game
npm install
npm run dev
```

Open `http://localhost:5173` and select **Enter Morrow Two**. WASD moves, the mouse looks, left mouse/F fires, right mouse aims, R reloads, E interacts, Shift sprints, Q switches shoulders, M opens the route map, P switches visual quality, and Escape pauses. Arrow keys also look if pointer capture is unavailable. Enter resumes or retries. This build targets desktop keyboard/mouse browsers; touch and controller input are not implemented.

For the production build, run `npm run build` followed by `npm run start -- --host 127.0.0.1`, then open `http://127.0.0.1:4173`. Software rendering automatically uses the performance visuals; hardware rendering uses the fuller lighting path. P lets you switch during play.

## Checks

```powershell
npm run typecheck
npm run lint
npm run fmt
npm run build
npm run test:smoke
```

Playwright Chromium is installed on this machine. The browser suite starts or reuses Vite, checks real keyboard/menu interaction, and exercises route traversal, stairs, collisions, wall/door shot occlusion, combat, reload, failure/retry and extraction. Development builds expose a deterministic `window.__morrow` harness for focused tests; production builds omit it. Automated checks establish behavior, while player testing remains necessary to tune combat and camera feel.

## Asset workflow

1. Use Higgsfield for approved concepts, character references, signs, and other 2D artwork. Its connected app is available in Codex.
2. Use Tripo Studio for candidate props or characters when appropriate. Studio credits and Tripo API credits are separate. Export approved assets to `art/source/` for cleanup.
3. Use Blender 5.2 to build dimensioned modular architecture, repair generated meshes, prepare collision and animation, and export GLB files.
4. Put game-ready GLBs in `public/assets/models/`, textures in `public/assets/textures/`, and audio in `public/assets/audio/`.
5. Use the installed glTF Transform CLI to inspect and optimize assets when measurements show the need; verify the optimized model in the running game.

The Tripo CLI is installed separately from the game package. Run `tripo doctor` to check its API connection. The existing Blender Tripo add-on is enabled. Studio and API credit balances are separate, so check the relevant account before any generation.

Blender already has the Blender Lab MCP extension installed. For headless Codex access, run `./scripts/start-blender-bridge.ps1` in a separate terminal and leave it running. In an interactive Blender session, its extension can start the bridge according to its preferences. A Codex read-only scene inspection succeeded during setup.

The official PlayCanvas skills are present in `.agents/skills/`; they are instructions for the coding agent, not runtime dependencies. Project direction and acceptance rules are in [AGENTS.md](AGENTS.md).

No paid service generation is part of setup. Asset generation requires an approved asset brief and a check of the credits on the relevant account.


## Production playtest

[Play Morrow Two on GitHub Pages](https://vindigit.github.io/catchinhatz/)
