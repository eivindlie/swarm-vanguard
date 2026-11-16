# Assets

All visuals are generated procedurally in code (`src/render/models.ts`): low-poly figures built from
primitives with vertex colours, merged into one geometry per unit type and drawn with `InstancedMesh`.
No third-party art is bundled, so there are no licence obligations.

Why not CC0 model packs? Hundreds of on-screen units need instancing; skinned glTF characters cannot be
instanced cheaply, and a web search found no pack that was both verifiably CC0 and suitable
(see the plan's performance budget). A CC0 model can still be dropped in later for the boss or elites,
after verifying the licence at the source and recording it here.

Audio (milestone 5) is synthesised with WebAudio, so it has no external files either.
