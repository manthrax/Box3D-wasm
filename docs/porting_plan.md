# Sample Porting Plan

## Goal

Port the native Box3D samples to a browser harness built with:

- vanilla JavaScript
- Three.js
- the Box3D WebAssembly module

The cleanest path is not to port the native sample app wholesale. The native app mixes together:

- sample scenario setup
- renderer-specific draw calls
- imgui controls
- sokol host/window/input code
- camera behavior

For the web we should keep only the sample scenario intent and rebuild the host and renderer layers in JavaScript.

## Recommended Architecture

### 1. Stable core: Box3D wasm module

Keep the Box3D wasm module as the physics core:

- `box3d-raw.js` for direct `b3*` access
- `box3d.js` for a lighter vanilla wrapper

This runtime should stay renderer-agnostic.

### 2. Web host harness

Build one reusable browser host that provides:

- sample registry and sample switching
- Three.js scene, camera, lights, and renderer
- orbit/fly camera controls
- pause, restart, single-step, and reset
- minimal info panel for parameters
- keyboard and pointer input routing

This replaces `samples/main.cpp`, `samples/host/*`, and most of the native UI shell.

### 3. Port samples as scenario modules

Each web sample should be a small JavaScript module with a predictable shape:

```js
export function createSample(ctx) {
  return {
    name: "Hello World",
    category: "World",
    init() {},
    step(dt) {},
    reset() {},
    dispose() {},
    buildUI(panel) {},
  };
}
```

The context should expose:

- `box3d`
- `world`
- Three.js scene helpers
- input state
- reusable primitive creation helpers

### 4. Shared scene helpers

Most samples can be expressed with a small shared toolkit:

- create box body + matching Three.js mesh
- create sphere body + matching mesh
- sync transforms each frame
- create static ground / ramps / walls
- spawn stacks, grids, and random fields
- simple material/color presets

This avoids rewriting the same physics-to-render bridge in every sample.

## What To Port First

Port by difficulty, not by file order.

### Phase 1: Straightforward rigid-body scenes

These are the best first wave:

- `sample_world.cpp`
- `sample_shapes.cpp`
- `sample_stacking.cpp`
- selected parts of `sample_bodies.cpp`

Why:

- they mostly build worlds and bodies
- they depend lightly on custom rendering
- they map naturally onto Three.js primitives

### Phase 2: Joints and interactions

- `sample_joint.cpp`
- `sample_events.cpp`
- `sample_continuous.cpp`

These need more UI and visualization, but still fit well in a web harness.

### Phase 3: Specialized systems

- `sample_character.cpp`
- `sample_mesh.cpp`
- `sample_compound.cpp`
- `sample_collision.cpp`

These need richer input, mesh generation, or custom debug visualization.

### Phase 4: Native-tool-heavy samples

- `sample_replay.cpp`
- `sample_benchmark.cpp`
- diagnostics-heavy or imgui-heavy tools

These should come last because they rely the most on native host features and custom tooling.

## Important Design Choice

For the browser path, prefer single-threaded wasm first.

Why:

- avoids `SharedArrayBuffer` deployment requirements
- avoids COOP/COEP header requirements for local prototyping
- makes local static serving simpler
- reduces friction while we are still shaping the sample harness

We can add a threaded production build later if we need it.

## Cleanest Long-Term Workflow

1. Keep Box3D physics in wasm.
2. Keep all browser presentation in JavaScript/Three.js.
3. Treat the native C++ sample files as reference specifications.
4. Port sample-by-sample into small JS scenario modules using shared helpers.
5. Only add more C wrapper functions when raw `b3*` struct-passing becomes too awkward.

This keeps the browser port maintainable and avoids trying to drag sokol/imgui/native renderer code into the web stack.
