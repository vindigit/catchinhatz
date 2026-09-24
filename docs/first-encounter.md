# Morrow Two — first playable encounter

## Playable scope

Enter from the south courtyard, clear the lobby, ascend the west stair (A), cross the Level 2 north corridor, open Apartment 204 and recover its ledger with E. Return to the corridor, descend the east stair (B), take the east service hall north and leave through the rear exit. Four crew members occupy the lobby, corridor, apartment and service hall. All four must be defeated before extraction completes.

The objective and crew are provisional encounter design, not narrative canon inferred from the concept sheets. The spatial references define relationships rather than construction measurements. Morrow One is north of Two, Three is south, and the repair yard and Split Stack sit east/east-southeast. The tower's upper floors are exterior scenery.

## Dimensions and controls

One world unit is one metre. The first blockout uses a 30 × 32 m tower footprint, 3.4 m storeys, a 4 m north residential corridor, 3.65 m clear stair widths, and a 2.2 m Apartment 204 opening. The 10 m stair runs have 24 visible treads over continuous movement ramps. Floor slabs contain real openings above the stairs. These are playtest dimensions, not a reconstruction of measured plans.

| Input              | Action                                           |
| ------------------ | ------------------------------------------------ |
| WASD               | Camera-relative movement                         |
| Mouse / arrow keys | Look                                             |
| Left mouse / F     | Fire; hold for repeated shots                    |
| Right mouse        | Aim with mild, visible-target assistance         |
| R                  | Reload 12-round handgun                          |
| E                  | Open/close apartment door; recover ledger        |
| Shift              | Sprint                                           |
| Q                  | Swap camera shoulder                             |
| M                  | Show conceptual floor/route map                  |
| P                  | Switch performance / full visuals                |
| Escape / Enter     | Pause / resume; Enter also retries after failure |

Grounded movement is intentionally used for the clearing encounter; jumping and climbing props are absent. The character is 1.78 m tall with a 0.3 m movement radius. Walking, aiming and sprint speeds are 3.65, 2.25 and 5.3 m/s. The shoulder camera sweeps an expanded volume against the same solid architecture used by movement, enemy perception and bullets, compresses immediately near obstacles, and eases back outward. Q gives an alternate shoulder in narrow doorways.

## Combat and encounter state

The handgun holds 12 rounds with 96 in reserve; reload takes 1.25 seconds. A hostile takes two hits. Guards patrol within authored room areas, hear nearby gunfire, turn to track visible threats, approach within their room, aim before firing, stagger when hit and stop attacking after death. Solid walls, floor slabs and the closed apartment door block perception and hitscan. A second muzzle obstruction check prevents shooting through a corner using only the offset camera's sightline.

Enemy aim has a 0.95-second warning interval, followed by 12 damage per hit and a 1.45-second firing cooldown. Sprinting reduces incoming damage to 7. There is no health regeneration. The HUD includes condition, ammunition, remaining hostiles, hit/kill markers, damage flashes, current objective and nearby interaction prompts. Gunfire, footsteps, reload and interaction use original synthesized placeholder audio.

Ready, playing, paused, failed and complete are explicit states. Escape, focus loss and pointer-lock loss pause simulation and its clock. Retry resets the player, enemies, door, objective, ammo, timers, camera and temporary effects at the south approach. This short encounter uses a full restart rather than a mid-mission checkpoint.

## Art and implementation

The original Blender architecture, texture generator, measurements and collision manifest are in `art/source/` and `scripts/build-morrow-level.py`. The runtime loads `public/assets/models/morrow-level.glb` at identity scale and orientation. Architecture is batched by material; movement uses separate simple boxes and support surfaces from the same authoring data. See the source provenance record for regeneration details.

The environment includes tiled floors, worn plaster and concrete, brick exterior surfaces, fluorescent fixtures, stair paint and handrails, mailboxes, noticeboards, doors, a lobby bench, rubbish, and apartment furniture. Exterior fog and a restrained post-processing pass support the PS2-inspired direction. All textures are original procedural art; reference screenshots inform layout and tone and are not embedded as game textures. No paid asset generation was used.

Software renderers automatically use a smaller internal image, original textures with approximate static vertex lighting, simple contact shadows and no HDR post-processing. P switches visual quality. The fuller path retains practical lights, directional shadows and restrained bloom. Both paths keep the HUD at browser resolution. Menus and paused games render a still frame rather than repeatedly redrawing the world. Characters merge rigid pieces within their animated pivots to reduce rendering cost.

## Remaining placeholders and decisions

- The characters are original low-poly human proxies with procedural walk/aim/death animation. Final faces, clothing art, rigs, hit reactions and audio need an art pass.
- Guard behavior is confined to authored room zones. There is no cross-floor pursuit, cover planner, squad coordination or navigation mesh yet.
- Most ground-floor side rooms and residential doors are closed scenery. Floors above Level 2, elevators, basement and roof are not playable.
- A full encounter restart is implemented; checkpoint placement remains a pacing decision.
- The ledger objective, protagonist, crew identity, weapon, lethality and whether clearing every hostile should be mandatory need narrative direction after the first playtest.
- Desktop keyboard/mouse is the supported input target. Controller, touch, remapping, save/load and accessibility settings remain future work.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run fmt`, `npm run build` and `npm run test:smoke`. Tests use development-only controls to advance the same simulation and collision logic deterministically. The complete-route regression uses continuous movement and weapon fire rather than teleporting progress or directly killing enemies. Focused tests may place the player at geometry boundaries to isolate a specific behavior. Passing tests does not establish final difficulty or enjoyable camera feel.
