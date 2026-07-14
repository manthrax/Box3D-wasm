# Demo Parity Plan

This document describes the next pass for the Box3D wasm/browser port now that we have a broad first-pass sample conversion in place.

The first pass optimized for coverage and momentum: get demos running, expose missing wasm surface area, and uncover engine/binding gaps. During that work we sometimes used temporary approximations or workaround-era scene setups that made sense before later features landed.

The next pass should optimize for parity, maintainability, and regression value.

## Primary Objective

Move from:

- "most demos run and look plausible"

to:

- "demos are strong, mostly exact browser ports of the native C samples"
- "later wasm/binding fixes are propagated back into older ports"
- "the browser demo suite serves as a regression harness for future upstream syncs"

## Operating Principles

For each sample, we want one of three explicit states:

1. `exact`
   The browser port closely matches the native C sample in setup, runtime behavior, and interaction.

2. `intentionally approximate`
   The browser port diverges on purpose, and the reason is known and documented.

3. `needs second-pass parity rewrite`
   The browser port was created before a later capability existed and should be revisited.

The goal of this pass is to shrink category 3 aggressively and keep category 2 rare.

## What changed during the first pass

These capabilities improved over time and likely invalidated some early workaround ports:

- mesh loading and custom mesh support
- compound mesh children
- mesh material / material-index plumbing
- world ray cast / shape cast / overlap query support
- character mover and related collision helpers
- richer joint API coverage
- more accurate local-frame and transform helpers
- better cylinder/capsule orientation handling
- native helper scenes for benchmark-like content
- runtime single-thread/threaded wasm split

Any sample port created before one of those capabilities landed should be considered a candidate for audit.

## High-priority audit buckets

### 1. Compound

Why:

- earlier compound ports were among the most likely to simplify geometry before mesh support matured
- compound scenes expose mesh children, material IDs, query behavior, and large-scene traversal

Priority samples:

- `Compound / Village`
- `Compound / Mesh Tile`
- `Compound / Tile Floor`
- `Compound / Hulls`
- `Compound / Spheres`
- `Compound / Simple`

Audit questions:

- Is the current scene using the same shape classes as native?
- Are any hull/box approximations still standing in for mesh content?
- Are query overlays and sample-specific debug semantics present where native has them?
- Are material IDs and child-index behaviors represented?

### 2. Mesh

Why:

- mesh support evolved significantly during the port
- early ports may still encode assumptions from before stable OBJ/custom-mesh support

Priority samples:

- `Mesh / Reflection`
- `Mesh / Grid`
- `Mesh / Big Box`
- `Mesh / Box`
- `Mesh / Height Field`
- `Mesh / Viewer`
- `Mesh / Voxel`
- `Mesh / Hollow Box`

Audit questions:

- Are we using the intended source mesh assets?
- Are scale, handedness, and orientation faithful to native?
- Are material groups and material IDs handled correctly where relevant?
- Are cylinder/capsule test bodies using the intended orientation?

### 3. Continuous

Why:

- several continuous scenes intersect with mesh and query behavior
- some early scenes may have been simplified before mesh support stabilized

Priority samples:

- `Continuous / Mesh Drop`
- `Continuous / Mesh Drop Unit Test`
- `Continuous / Hump Mesh`
- `Continuous / Needle Mesh`
- `Continuous / Bullet vs Stack`

Audit questions:

- Are these still using earlier approximations where native now maps cleanly?
- Are collision filters, body counts, and spawn layouts still faithful?
- Are there any stale workarounds for mesh contact or tunneling behavior?

### 4. Joints

Why:

- joint ports uncovered a lot of missing/raw API surface
- local frame correctness, motor behavior, and interaction semantics improved incrementally

Priority samples:

- `Joints / Gear Lift`
- `Joints / Driving`
- `Joints / Bridge`
- `Joints / Ball and Chain`
- `Joints / Door`
- `Joints / Motion Locks`
- `Joints / Top Down Friction`

Audit questions:

- Are local frames computed the same way native computes them?
- Do motors, limits, springs, and tuning values match native setup?
- Are any sample-specific helper behaviors still "close enough" instead of exact?

### 5. Events and Character

Why:

- these were especially affected by missing API surface early on
- they are also interaction-heavy and regression-sensitive

Priority samples:

- `Events / Sensor Visit`
- `Events / Hit`
- `Events / Move`
- `Events / Joint`
- `Character / CapsulePlane`
- `Character / MoverOverlap`
- `Character / Mover`
- `Character / Rigid Body`

Audit questions:

- Are event flags, body setup, and consumption semantics faithful?
- Do we still have any ad hoc post-step logic replacing better raw API support?
- Are mover/solve/query paths using the best available implementation now?

## First concrete second-pass targets

These are the samples most likely to repay immediate parity work:

1. `Compound / Mesh Tile`
   Early compound scene likely created before later mesh maturity.

2. `Compound / Village`
   Large, high-value parity sample that combines compound geometry, mesh content, and queries.

3. `Mesh / Reflection`
   Strong mesh/material/sign-flip regression scene that should be treated as a reference-quality port.

4. `Continuous / Mesh Drop`
   Good candidate for removing earlier mesh-era simplifications.

5. `Joints / Top Down Friction`
   Good candidate for validating exact motor-joint setup against native.

6. `Events / Sensor Visit`
   Early event sample that may still be using workaround logic rather than ideal event semantics.

## Native verification checklist

For each sample we audit, compare against the native C sample in these dimensions:

- same asset usage
- same body count and spawn placement
- same shape classes
- same density / friction / restitution / rolling resistance
- same joint definitions and local frames
- same collision filters
- same runtime control behavior
- same status/debug/query intent
- same expected "story" of the sample

If the browser version intentionally diverges, document why.

## Interaction parity checklist

Even when scenes are visually correct, interaction can still diverge.

Audit:

- mouse dragging
- body wake-up behavior on interaction
- demo-specific buttons and toggles
- keyboard controls
- pause / restart semantics
- camera reset behavior
- status text and debug overlays

Goal:

- browser demos should feel like tools and test scenes, not only visual approximations

## Regression strategy

The sample suite should evolve into a stronger regression harness.

### Smoke level

- page loads
- wasm initializes
- sample can reset
- no missing exports
- no console exceptions during cycle mode

### Behavioral level

Where practical, add sample-specific expectations such as:

- body count
- mesh load success
- awake count remaining finite
- tracked body transforms remaining finite
- event counts becoming non-zero
- key body not tunneling or falling out of scene unexpectedly

### Metadata level

For future maintenance, each sample should eventually carry parity metadata:

- native sample name
- parity status (`exact`, `approximate`, `needs-review`)
- known deviations
- important subsystems touched

## Recommended execution order

1. Build an inventory of all current browser samples and assign parity status.
2. Audit `Compound`, `Mesh`, and `Continuous` first to retire stale pre-mesh workarounds.
3. Audit `Joints` and `Events` next for correctness now that the raw API surface is much richer.
4. Normalize interaction behavior across all samples.
5. Add lightweight parity metadata and regression checks.

## Success criteria for this pass

This pass is successful when:

- earlier workaround-heavy samples have been re-evaluated against later capabilities
- a clear subset of demos can be honestly called exact browser ports
- remaining approximations are intentional and documented
- future upstream updates can use the browser demo suite as a serious maintenance signal
