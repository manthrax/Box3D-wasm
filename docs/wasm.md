# WebAssembly Build

Box3D already supports Emscripten at the core library level. This repository now also includes a dedicated WebAssembly module target that emits:

- a raw JavaScript/WASM module exporting the public Box3D C API
- a small vanilla JavaScript wrapper for common world and body operations
- a simple browser demo page

## Build

If the Emscripten SDK is installed in `tools/emsdk`, use:

```powershell
cmd /c "call tools\emsdk\emsdk_env.bat && cmake --preset emscripten-release && cmake --build --preset emscripten-release"
```

Or directly:

```powershell
emcmake cmake -S . -B build-box3d-wasm -DBOX3D_SAMPLES=OFF -DBOX3D_UNIT_TESTS=OFF -DBOX3D_VALIDATE=OFF -DBOX3D_WASM_MODULE=ON
cmake --build build-box3d-wasm --target box3d_wasm
```

## Artifacts

The module build writes these files to `build-box3d-wasm/bin`:

- `box3d-raw.js`
- `box3d-raw.wasm`
- `box3d.js`
- `demo.html`

For the optional double precision web build, use the `emscripten-release-double` preset. That writes to `build-box3d-wasm-double/bin`.

## API Layers

Use `box3d-raw.js` when you want the public `b3*` API as directly as possible from JavaScript.

Use `box3d.js` when you want a lighter wrapper for common tasks:

- `api.createWorld({ gravity })`
- `api.destroyWorld(worldHandle)`
- `api.stepWorld(worldHandle, timeStep, subStepCount)`
- `api.createBox(worldHandle, options)`
- `api.createSphere(worldHandle, options)`
- `api.destroyBody(bodyHandle)`
- `api.getBodyTransform(bodyHandle)`
- `api.setBodyTransform(bodyHandle, transform)`
- `api.getBodyLinearVelocity(bodyHandle)`
- `api.setBodyLinearVelocity(bodyHandle, velocity)`
- `api.getBodyAngularVelocity(bodyHandle)`
- `api.setBodyAngularVelocity(bodyHandle, velocity)`

The raw layer is intended for sample ports and lower-level experimentation. The wrapper exists to remove the most awkward struct-passing friction from JavaScript.

## Web Host

A first browser harness lives in `web/` and is intentionally minimal:

- vanilla JavaScript
- Three.js via CDN modules
- sample registry
- pause / restart / single-step controls
- body-to-mesh transform syncing
- world-origin rebasing so far-from-origin scenes can still render cleanly

Serve the repository root with any static file server, then open:

- `/web/index.html`

For example:

```powershell
python -m http.server 8000
```

Then browse to:

- `http://localhost:8000/web/index.html`

## Vite Workflow

This repository also supports a Vite-based browser workflow for the web port.

Install the JavaScript dependencies once:

```powershell
npm install
```

Build and sync the default wasm artifacts into the web host:

```powershell
npm run wasm
```

Start the Vite dev server with HMR:

```powershell
npm run dev
```

Useful variants:

- `npm run wasm:double` builds the double precision wasm flavor and makes it the active web runtime
- `npm run wasm:sync` re-copies the current `build-box3d-wasm/bin` artifacts without rebuilding
- `npm run wasm:sync:double` re-copies the current `build-box3d-wasm-double/bin` artifacts without rebuilding
- `npm run build` creates a production web bundle in `dist/web`

The active browser-facing wasm files are copied into:

- `web/generated/active/`

That indirection keeps the web app stable even if upstream Box3D changes its build layout, and it lets us pull future Box3D updates while keeping our JS wrapper and host code in one place.
