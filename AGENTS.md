# Morrow game project

This is the local PlayCanvas Engine + TypeScript game, built with Vite. Use the official PlayCanvas skills in `.agents/skills/` when they fit the task. The current third-person starter is a technical baseline; its robot and outdoor obstacles are placeholder content.

Game direction: a browser-first, single-player, third-person apartment-building encounter in the Morrows area of Bell Ward. The visual target is PS2-era GTA-inspired urban realism: simple silhouettes, textured surfaces, fog, practical lighting, and lived-in detail. Keep modern-feeling controls and readable combat.

The first playable encounter covers a hallway, apartment entrance, and stair landing. Build reusable systems for movement, shoulder camera, one weapon, enemy perception/navigation, damage, objective, retry/checkpoint, and completion. Verify changes in the running browser, including narrow spaces and stairs.

Use one meter as one world unit. Keep walkable architecture dimensioned in Blender and maintain separate simple collision. Ship optimized GLB assets in `public/assets/`. Keep editable Blender files and asset-source records in `art/source/`. Document the origin and generation steps of each accepted asset. Do not embed account keys or paid-service tokens in the repository.

Tripo Studio and Higgsfield are available as concept and asset sources. Their subscriptions do not imply API credit access. Before charged generation, scope the asset and check the applicable account balance and credit cost. Inspect generated meshes, repair in Blender, then verify scale, collision, style, and performance in PlayCanvas.

Before claiming a feature is complete, run `npm run typecheck`, `npm run lint`, `npm run build`, and the relevant browser test. Use playtesting for movement and combat feel; passing an automated check alone does not establish that the encounter is enjoyable.
