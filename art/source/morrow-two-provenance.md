# Morrow Two architecture source record

Created for this project in Blender 5.2 from original procedural geometry and original 128 × 128 pixel materials. No stock models, downloaded textures, paid generation, or third-party image pixels are included in the runtime model.

The supplied site and floor plan establish the order of the towers, front and rear entries, central elevator pair, and flanking stairs. Their dimensions are conceptual. The first encounter uses a 30 × 32 metre footprint, a 3.4 metre storey rise, 3.65 metre stair clear widths, a 4 metre residential corridor, and a 2.2 metre Apartment 204 doorway. These dimensions are provisional gameplay choices. The stairs have 24 visual treads over a 10 metre run and separate continuous ramp surfaces for smooth movement.

Rebuild with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts/build-morrow-level.py
npx prettier --write src/level-data.json art/source/morrow-two-pieces.json
```

The generator preserves editable geometry in `morrow-two-blockout.blend`, individual construction records in `morrow-two-pieces.json`, a material-merged GLB in `public/assets/models/morrow-level.glb`, and original PNG materials in `public/assets/textures/`. Geometry and textures are packed in the GLB; the PNGs remain source-accessible. All geometry is low-polygon and static except the separate runtime interactive apartment door. The eighteen static render meshes are grouped by material to keep draw calls practical.

Coordinate convention is +X east, +Y up, -Z north. The Blender-to-glTF export preserves exact gameplay coordinates, one world unit per metre. Runtime placement is position zero, scale one, yaw zero. The terrain is deliberately buried below the walkable datum, so its global minimum must not be used to reposition this architectural assembly.

Offline vertex calibration: bounds minimum (-75, -0.53, -95), maximum (75, 47.5, 95), dimensions (150, 48.03, 190), centre (0, 23.485, 0), global ground offset 0.53. Bounds source is decoded vertices, static pose, eighteen mesh nodes, no skins or animation. Intended court width is 150 metres; actual scale is 1. The 0.53 metre global ground offset is intentionally not applied because the source already seats all walkable interior floors at y=0 and y=3.4.

Ground-floor support spaces, upper storeys, neighboring towers, the repair yard, and the Split Stack are visual shells. Closed noninteractive doors imply management, packages, community, laundry, maintenance, and other apartments. Only the ground route, Stair A, the north Level 2 corridor, Apartment 204, Stair B, and rear service route are authored for play. Window panes are opaque style placeholders. Practical fixtures and localized runtime lights support the foggy urban look; no light bake is claimed.
