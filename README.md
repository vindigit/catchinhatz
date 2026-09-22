# Morrow game

Local PlayCanvas Engine + TypeScript project for a browser-first, third-person encounter in Bell Ward's Morrows. The current scene is the official PlayCanvas third-person controller starter. Its robot, trees, and blocks are placeholders used to verify the toolchain; the Morrow environment and combat are the next implementation work.

## Start the game

Use Node.js 22.23.2 or later. This machine has Node 24.13.1 through nvm-windows.

```powershell
nvm use 24.13.1
cd C:\Users\valexander\Documents\Codex\2026-09-20\tak\game
npm install
npm run dev
```

Open `http://localhost:5173`, click the scene, then use WASD, the mouse, and Space to test the starter controller.

## Checks

```powershell
npm run typecheck
npm run lint
npm run fmt
npm run build
npm run test:smoke
```

Playwright Chromium is installed on this machine. The smoke test starts its own Vite server, opens the scene, checks that the canvas initializes, exercises an input, and records a screenshot. It establishes that the setup runs; it does not certify final gameplay.

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
