# Demo Parity Inventory

This is the working inventory for the browser-exposed demo set.

The statuses below are intentionally provisional. They are meant to guide the second-pass parity audit, not to claim that every reviewed sample is final.

## Status legend

- `exact`
  Intended to be a close browser port of the native C sample with no known major parity gap.

- `approximate`
  Intentionally useful but not a strict native mirror, or browser-specific by design.

- `needs-review`
  Likely created during a workaround era, or depends on subsystems that improved later and should be re-audited.

## Priority interpretation

- `high`
  Good early target for the second-pass audit.

- `medium`
  Should be reviewed after the highest-risk workaround clusters.

- `low`
  Lower suspicion of workaround debt, or already relatively self-contained/stable.

## Bodies

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Bodies / Body Type` | `Bodies / Body Type` | `needs-review` | `medium` | Early sample; verify setup and interaction fidelity. |
| `Bodies / Spinning Book` | `Bodies / Spinning Book` | `needs-review` | `medium` | Check exact angular setup and damping. |
| `Bodies / Gyroscopic Torque` | `Bodies / Gyroscopic Torque` | `needs-review` | `medium` | Recently fixed; should still be validated against native. |
| `Bodies / Gyroscopic Precession` | `Bodies / Gyroscopic Precession` | `needs-review` | `medium` | Orientation and contact visuals were corrected later; re-audit. |
| `Bodies / Weeble` | `Bodies / Weeble` | `needs-review` | `medium` | Check mass data / COM behavior against native. |
| `Bodies / Cast` | `Bodies / Cast` | `exact` | `low` | Query-oriented sample with relatively direct mapping. |
| `Bodies / Kinematic` | `Bodies / Kinematic` | `needs-review` | `medium` | Was affected by target transform API churn. |
| `Bodies / Disable` | `Bodies / Disable` | `needs-review` | `medium` | Re-check enable/disable semantics with finalized body API. |
| `Bodies / Lock Mixing` | `Bodies / Lock Mixing` | `needs-review` | `medium` | Was impacted by motion-lock API maturity. |
| `Bodies / Fixed Rotation` | `Bodies / Fixed Rotation` | `exact` | `low` | Likely straightforward, but still verify once. |

## Benchmark

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Benchmark / Large Pyramid` | `Benchmark / Large Pyramid` | `exact` | `low` | Simple direct scene construction. |
| `Benchmark / Wide Pyramid` | `Benchmark / Wide Pyramid` | `exact` | `low` | Straightforward body stack port. |
| `Benchmark / Many Pyramids` | `Benchmark / Many Pyramids` | `exact` | `low` | Good baseline stress scene. |
| `Benchmark / Joint Grid` | `Benchmark / Joint Grid` | `exact` | `low` | Native-helper backed. |
| `Benchmark / Falling Boxes` | `Benchmark / Falling Boxes` | `needs-review` | `medium` | Verify scene shape/count against native. |
| `Benchmark / Candy Cups` | `Benchmark / Candy Cups` | `needs-review` | `medium` | Good candidate for scene-construction recheck. |
| `Benchmark / Explosion` | `Benchmark / Explosion` | `needs-review` | `medium` | Re-check event/impulse behavior. |
| `Benchmark / Rain` | `Benchmark / Rain` | `needs-review` | `medium` | Large scene with many moving parts; good audit target. |
| `Benchmark / Chains` | `Benchmark / Chains` | `needs-review` | `medium` | Mixed mesh + chain scene; worthwhile second-pass review. |
| `Benchmark / Destruction` | `Benchmark / Destruction` | `needs-review` | `medium` | Re-check shape/material assumptions. |
| `Benchmark / Height Field` | `Benchmark / Height Field` | `needs-review` | `medium` | Validate against native heightfield setup. |
| `Benchmark / Hull` | `Benchmark / Hull` | `exact` | `low` | Focused geometry sample. |
| `Benchmark / Sensor` | `needs-review` | `high` | `high` | Event-heavy benchmark; verify sensor/filter fidelity. |
| `Benchmark / Falling Trees` | `exact` | `low` | `low` | Native-helper backed and recently validated. |
| `Benchmark / Washer` | `exact` | `low` | `low` | Native-helper backed. |
| `Benchmark / Large World` | `approximate` | `medium` | `medium` | Native simulation, but browser rendering uses a floor proxy instead of importing full static field. |
| `Benchmark / Junkyard` | `exact` | `low` | `low` | Native-helper backed. |

## Character

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Character / CapsulePlane` | `Character / CapsulePlane` | `needs-review` | `medium` | Verify final solve/query behavior. |
| `Character / MoverOverlap` | `Character / MoverOverlap` | `needs-review` | `high` | Strong candidate for second-pass mover/query audit. |
| `Character / Mover` | `Character / Mover` | `needs-review` | `high` | Should be re-audited now that mover support is richer. |
| `Character / Rigid Body` | `needs-review` | `medium` | `medium` | Good current behavior, but still worth native comparison. |

## Collision

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Collision / Ray Curtain` | `Collision / Ray Curtain` | `exact` | `low` | Query-focused, likely close already. |
| `Collision / Mesh Scale` | `Collision / Mesh Scale` | `needs-review` | `medium` | Re-check mesh scale/material assumptions. |
| `Collision / Cast World` | `Collision / Cast World` | `exact` | `low` | Core query behavior likely close. |
| `Collision / Overlap World` | `Collision / Overlap World` | `exact` | `low` | Good raw query regression sample. |
| `Collision / Initial Overlap` | `Collision / Initial Overlap` | `exact` | `low` | Focused collision primitive test. |
| `Collision / Capsule Cast Ray` | `Collision / Capsule Cast Ray` | `exact` | `low` | Direct API mapping. |
| `Collision / Shape Cast` | `Collision / Shape Cast` | `exact` | `low` | Good baseline query sample. |
| `Collision / Shape Distance` | `Collision / Shape Distance` | `exact` | `low` | Direct geometry/query path. |
| `Collision / Distance Debug` | `Collision / Distance Debug` | `exact` | `low` | Likely already close. |
| `Collision / Time of Impact` | `Collision / Time of Impact` | `exact` | `low` | Focused collision API sample. |
| `Collision / Shape Cast Debug` | `Collision / Shape Cast Debug` | `exact` | `low` | Query/debug sample. |
| `Collision / Long Ray Cast` | `Collision / Long Ray Cast` | `exact` | `low` | Query-focused and probably stable. |

## Compound

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Compound / Simple` | `Compound / Simple` | `needs-review` | `high` | Early compound path; likely due for exactness pass. |
| `Compound / Spheres` | `Compound / Spheres` | `needs-review` | `high` | Earlier sample likely kept browser-friendly probe additions. |
| `Compound / Hulls` | `Compound / Hulls` | `needs-review` | `high` | Earlier approximation-heavy scene. |
| `Compound / Tile Floor` | `Compound / Tile Floor` | `needs-review` | `high` | Strong candidate for second-pass parity cleanup. |
| `Compound / Mesh Tile` | `Compound / Mesh Tile` | `needs-review` | `high` | Explicitly identified as a top rewrite target. |
| `Compound / Village` | `needs-review` | `high` | `high` | High-value parity sample; likely still contains workaround debt despite recent improvements. |

## Continuous

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Continuous / Thin Wall` | `Continuous / Thin Wall` | `needs-review` | `medium` | Verify exact fast-body setup against native. |
| `Continuous / Bounce House` | `Continuous / Bounce House` | `needs-review` | `medium` | Re-check restitution/friction and arena setup. |
| `Continuous / Spinning Stick` | `Continuous / Spinning Stick` | `needs-review` | `medium` | Good candidate for direct scene audit. |
| `Continuous / Bullet vs Stack` | `Continuous / Bullet vs Stack` | `needs-review` | `high` | Important regression scene. |
| `Continuous / Is Fast` | `Continuous / Is Fast` | `exact` | `low` | Focused behavior test. |
| `Continuous / Needle Mesh` | `Continuous / Needle Mesh` | `needs-review` | `high` | Mesh-era audit candidate. |
| `Continuous / Hump Mesh` | `Continuous / Hump Mesh` | `needs-review` | `high` | Mesh-era audit candidate. |
| `Continuous / Stall` | `Continuous / Stall` | `needs-review` | `medium` | Recheck kinematic/CCD semantics. |
| `Continuous / Mesh Drop` | `needs-review` | `high` | `high` | Explicit top target from the plan. |
| `Continuous / Mesh Drop (Box)` | `approximate` | `medium` | `medium` | Browser-derived variant, not a native sample name. |
| `Continuous / Mesh Drop Unit Test` | `needs-review` | `high` | `high` | Good native comparison target. |
| `Continuous / Mesh Drop (Capsule)` | `approximate` | `medium` | `medium` | Browser-derived coverage variant. |
| `Continuous / Mesh Drop (Cylinder)` | `approximate` | `medium` | `medium` | Browser-derived coverage variant. |
| `Continuous / Mesh Drop (Sphere)` | `approximate` | `medium` | `medium` | Browser-derived coverage variant. |

## Determinism

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Determinism / Falling Ragdolls` | `Determinism / Falling Ragdolls` | `needs-review` | `medium` | Likely close, but determinism semantics deserve explicit validation. |

## Events

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Events / Sensor Visit` | `Events / Sensor Visit` | `needs-review` | `high` | Early event sample; likely still uses workaround-style consumption logic. |
| `Events / Move` | `Events / Move` | `needs-review` | `high` | Event semantics should be checked against native. |
| `Events / Hit` | `Events / Hit` | `needs-review` | `high` | Event-heavy compound sample worth close review. |
| `Events / Joint` | `Events / Joint` | `needs-review` | `medium` | Re-check event wiring now that joint API is richer. |
| `Events / Persistent Contact` | `needs-review` | `medium` | `medium` | Verify contact lifetime semantics. |
| `Events / Sensor Hits` | `needs-review` | `medium` | `medium` | Sensor/event plumbing should be revalidated. |

## Geometry

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Geometry / Box Hull` | `Geometry / Box Hull` | `exact` | `low` | Geometry-focused and direct. |
| `Geometry / Hull` | `Geometry / Hull` | `exact` | `low` | Recently validated/fixed. |
| `Geometry / Hull Reduction` | `Geometry / Hull Reduction` | `exact` | `low` | Good pure-geometry sample. |
| `Geometry / Hull Transform` | `Geometry / Hull Transform` | `exact` | `low` | Likely stable. |
| `Geometry / Capsule Mass` | `Geometry / Capsule Mass` | `exact` | `low` | Direct API mapping. |

## Joints

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Joints / Distance Joint` | `Joints / Distance Joint` | `needs-review` | `medium` | Earlier joint sample; recheck with final API surface. |
| `Joints / Revolute` | `Joints / Revolute` | `needs-review` | `medium` | Good candidate for local-frame comparison. |
| `Joints / Weld` | `Joints / Weld` | `needs-review` | `medium` | Verify tuning parity. |
| `Joints / Filter` | `Joints / Filter` | `exact` | `low` | Small, focused sample. |
| `Joints / Motor Joint` | `needs-review` | `medium` | `medium` | Good API-fidelity audit target. |
| `Joints / Top Down Friction` | `needs-review` | `high` | `high` | Explicit top target from the plan. |
| `Joints / Driving` | `needs-review` | `high` | `high` | Interaction-heavy and important. |
| `Joints / Prismatic` | `needs-review` | `medium` | `medium` | Verify frame alignment and parameters. |
| `Joints / Spherical` | `needs-review` | `medium` | `medium` | Cone/twist parity worth checking. |
| `Joints / Wheel` | `needs-review` | `medium` | `medium` | Historically sensitive to orientation and steering frames. |
| `Joints / Ball and Chain` | `needs-review` | `high` | `high` | Fixed once already; deserves exactness verification. |
| `Joints / Door` | `needs-review` | `high` | `high` | Strong local-frame regression scene. |
| `Joints / Bridge` | `needs-review` | `medium` | `medium` | Good chain/joint stability audit target. |
| `Joints / Motion Locks` | `needs-review` | `medium` | `medium` | Depends on mature lock APIs. |
| `Joints / Gear Lift` | `needs-review` | `high` | `high` | High-value exactness target. |
| `Joints / Parallel Spring` | `needs-review` | `medium` | `medium` | Recheck once raw joint coverage stabilized. |

## Manifold

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Manifold / Sphere vs Sphere` | `Manifold / Sphere vs Sphere` | `exact` | `low` | Pure collision primitive sample. |
| `Manifold / Capsule vs Sphere` | `Manifold / Capsule vs Sphere` | `exact` | `low` | Direct math/sample mapping. |
| `Manifold / Hull vs Sphere` | `Manifold / Hull vs Sphere` | `exact` | `low` | Likely stable. |
| `Manifold / Triangle vs Sphere` | `Manifold / Triangle vs Sphere` | `exact` | `low` | Good low-risk sample. |
| `Manifold / Capsule vs Capsule` | `Manifold / Capsule vs Capsule` | `exact` | `low` | Direct primitive test. |
| `Manifold / Capsule vs Hull` | `Manifold / Capsule vs Hull` | `exact` | `low` | Direct primitive test. |
| `Manifold / Triangle vs Capsule` | `Manifold / Triangle vs Capsule` | `exact` | `low` | Direct primitive test. |
| `Manifold / Hull vs Hull` | `Manifold / Hull vs Hull` | `exact` | `low` | Direct primitive test. |
| `Manifold / Triangle vs Hull` | `Manifold / Triangle vs Hull` | `exact` | `low` | Direct primitive test. |

## Mesh

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Mesh / Reflection` | `Mesh / Reflection` | `needs-review` | `high` | Explicit top target from the plan. |
| `Mesh / Grid` | `Mesh / Grid` | `needs-review` | `high` | Recheck cylinder orientation and primitive behavior. |
| `Mesh / Big Box` | `Mesh / Big Box` | `needs-review` | `high` | Orientation/contact fidelity should be revalidated. |
| `Mesh / Box` | `Mesh / Box` | `needs-review` | `medium` | Good general mesh parity candidate. |
| `Mesh / Height Field` | `Mesh / Height Field` | `needs-review` | `medium` | Compare against native field parameters. |
| `Mesh / Viewer` | `Mesh / Viewer` | `needs-review` | `medium` | Asset/material and view behavior worth checking. |
| `Mesh / Creation Benchmark` | `Mesh / Creation Benchmark` | `exact` | `low` | More benchmark/tool than gameplay sample. |
| `Mesh / Hollow Box` | `Mesh / Hollow Box` | `needs-review` | `medium` | Recheck shape setup and contact behavior. |
| `Mesh / Voxel` | `Mesh / Voxel` | `needs-review` | `high` | Was fixed iteratively; should now be validated exactly. |

## Ragdoll

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Ragdoll / Box` | `Ragdoll / Box` | `exact` | `low` | Likely close once rig spawning was stabilized. |
| `Ragdoll / Pile` | `Ragdoll / Pile` | `exact` | `low` | Good stress scene. |
| `Ragdoll / Mesh` | `Ragdoll / Mesh` | `needs-review` | `medium` | Mesh-backed ragdoll scene merits parity check. |
| `Ragdoll / Pose` | `Ragdoll / Pose` | `exact` | `low` | Relatively self-contained rig sample. |
| `Ragdoll / Incline` | `exact` | `low` | `low` | Likely stable but still worth spot check. |

## Robustness

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Robustness / HighMassRatio1` | `Robustness / HighMassRatio1` | `needs-review` | `medium` | Was crash-prone earlier; ensure current semantics hold. |
| `Robustness / Tiny Pyramid` | `Robustness / Tiny Pyramid` | `needs-review` | `medium` | Same rationale as above. |
| `Robustness / Overlap Recovery` | `Robustness / Overlap Recovery` | `exact` | `low` | Focused robustness test. |
| `Robustness / Overflow Color Pile` | `Robustness / Overflow Color Pile` | `exact` | `low` | Likely stable. |

## Shapes

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Shapes / Inclined Plane` | `Shapes / Inclined Plane` | `exact` | `low` | Straightforward scene. |
| `Shapes / Rolling Resistance` | `Shapes / Rolling Resistance` | `needs-review` | `medium` | Check final rolling/cylinder behavior against native. |
| `Shapes / High Resistance` | `Shapes / High Resistance` | `exact` | `low` | Likely direct. |
| `Shapes / Slide Twist` | `needs-review` | `medium` | `medium` | Friction/sliding behavior was previously suspect. |
| `Shapes / Restitution` | `exact` | `low` | `low` | Direct parameter sample. |
| `Shapes / Static Invoke` | `exact` | `low` | `low` | Focused event/shape behavior. |
| `Shapes / Conveyor Belt` | `exact` | `low` | `low` | Likely close. |
| `Shapes / Conveyor Mesh` | `needs-review` | `high` | `high` | Mesh/material/tangent mapping issue area; top audit target. |
| `Shapes / Wind` | `needs-review` | `medium` | `medium` | Recheck with finalized wind/shape plumbing. |
| `Shapes / Wind Drop` | `needs-review` | `medium` | `medium` | Same rationale as above. |
| `Shapes / Wind Flap` | `needs-review` | `medium` | `medium` | Same rationale as above. |
| `Shapes / Isotropic Friction` | `exact` | `low` | `low` | Parameter-focused scene. |

## Stacking

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `Stacking / Single Box` | `Stacking / Single Box` | `exact` | `low` | Simple baseline. |
| `Stacking / Sphere Stack` | `Stacking / Sphere Stack` | `exact` | `low` | Likely direct. |
| `Stacking / Capsule Stack` | `Stacking / Capsule Stack` | `exact` | `low` | Likely direct. |
| `Stacking / Cylinder` | `Stacking / Cylinder` | `needs-review` | `medium` | Cylinder orientation/contact correctness deserves verification. |
| `Stacking / Cylinder Stack` | `Stacking / Cylinder Stack` | `needs-review` | `medium` | Same rationale as above. |
| `Stacking / Box Stack` | `Stacking / Box Stack` | `exact` | `low` | Stable baseline. |
| `Stacking / Card House` | `needs-review` | `medium` | `medium` | Was previously unstable; friction/setup should be checked against native. |
| `Stacking / Card House Thick` | `needs-review` | `medium` | `medium` | Same rationale as above. |
| `Stacking / Jenga Stack` | `exact` | `low` | `low` | Likely straightforward. |
| `Stacking / Dominoes` | `exact` | `low` | `low` | Good baseline chain-reaction sample. |
| `Stacking / Wedge` | `exact` | `low` | `low` | Likely direct. |
| `Stacking / Arch` | `needs-review` | `medium` | `medium` | Was previously collapsing quickly; recheck parameters vs native. |
| `Stacking / Double Domino` | `exact` | `low` | `low` | Likely direct. |
| `Stacking / Pyramid2D` | `exact` | `low` | `low` | Simple layout sample. |

## World

| Browser sample | Native counterpart | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| `World / Hello World` | browser-specific | `approximate` | `low` | Useful introductory browser sample, not a native registry entry. |
| `World / Far Stack` | `World / Far Stack` | `exact` | `low` | Large-world regression sample. |
| `World / Far Pyramid` | `World / Far Pyramid` | `exact` | `low` | Large-world regression sample. |
| `World / Far Mesh Drop` | `World / Far Mesh Drop` | `needs-review` | `medium` | Mesh-backed large-world scene should be rechecked. |
| `World / Far Ragdolls` | `World / Far Ragdolls` | `exact` | `low` | Likely stable once rebasing path matured. |

## Immediate second-pass queue

Recommended first audit/rewrite tranche:

1. `Compound / Mesh Tile`
2. `Compound / Village`
3. `Mesh / Reflection`
4. `Mesh / Grid`
5. `Mesh / Big Box`
6. `Continuous / Mesh Drop`
7. `Continuous / Mesh Drop Unit Test`
8. `Joints / Top Down Friction`
9. `Joints / Gear Lift`
10. `Events / Sensor Visit`
11. `Shapes / Conveyor Mesh`

## Next step

As each sample is audited, update this inventory with:

- confirmed status
- specific deviations
- the subsystem that was cleaned up
- whether the browser version can now be considered an exact port
