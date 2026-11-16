# Assets

All visuals are generated procedurally in code, so there is nothing to license:

- **Units** (`src/render/models.ts`): low-poly figures built from primitives with vertex colours and
  body-part ids (legs, arms, head). They are merged into ONE geometry per unit type and drawn with
  `InstancedMesh`; walking is animated in the vertex shader (`src/render/materials.ts`), so a crowd of
  hundreds costs a handful of draw calls. Four bosses share one animated skeleton.
- **Look**: `MeshToonMaterial` ramp + rim light + hit flash injected via `onBeforeCompile`; inverted-hull
  outlines on brutes and bosses only (crowd outlines would multiply the triangle count).
- **Worlds** (`src/render/themes.ts`, `world.ts`): sky gradient, sun, clouds, ground texture, scenery and
  ambient particles are all canvas/geometry generated per theme.
- **Audio** (`src/audio/sfx.ts`): effects and music are synthesised with WebAudio; no sound files.

Why not CC0 model packs? Hundreds of on-screen units need instancing; skinned glTF characters cannot be
instanced cheaply, and a search found no pack that was both verifiably CC0 and suitable. A CC0 model can
still be dropped in later for a single hero asset after verifying its licence at the source and recording it here.
