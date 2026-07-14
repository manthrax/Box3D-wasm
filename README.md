# Box3D-wasm

`Box3D-wasm` is a WebAssembly port of [Erin Catto's Box3D](https://github.com/erincatto/box3d), with a browser-focused demo app, a lean vanilla JavaScript API layer over the raw C bindings, and an expanding port of the native sample suite.

This repository is not the upstream Box3D source of truth. It is a downstream project that:

- builds Box3D for WebAssembly
- exposes a low-level raw binding surface plus a simpler vanilla JS wrapper
- ports Box3D demos to browser rendering with Three.js
- keeps checked-in web artifacts for static hosting
- falls back to single-threaded wasm on hosts that do not support cross-origin isolation

This repo is intended to support two equally important workflows:

- `consumer workflow`: clone the repo, rebuild the wasm outputs locally if desired, and use the JS/browser package as-is
- `maintainer workflow`: pull upstream Box3D changes into this repo, rebuild the wasm artifacts, and use the web demo suite as a regression surface

## Upstream Box3D

The original library lives here:

- Upstream repository: [erincatto/box3d](https://github.com/erincatto/box3d)
- Upstream README and docs: [README.md](https://github.com/erincatto/box3d/blob/main/README.md)

Please use upstream for:

- core engine source
- native library issues that are not wasm/browser specific
- official Box3D documentation and release information

Use this repository for:

- wasm/browser integration
- JavaScript bindings
- web demo/sample behavior
- static hosting and deployment concerns
- downstream maintenance of the browser port

## Project Goals

- Provide thorough Box3D bindings for browser use
- Preserve as much of the native C API as practical
- Layer a small, ergonomic vanilla JS API on top
- Port the native demos as a browser-side regression suite
- Support both threaded and non-threaded wasm delivery

## Repository Layout

- [wasm/](C:/work/Box3Dwasm/wasm) Emscripten-facing glue, exports, and module wrapper
- [web/](C:/work/Box3Dwasm/web) browser demo app, JS wrapper, and sample ports
- [web/generated/single/](C:/work/Box3Dwasm/web/generated/single) checked-in single-threaded wasm artifacts
- [web/generated/threaded/](C:/work/Box3Dwasm/web/generated/threaded) checked-in threaded wasm artifacts
- [scripts/build-wasm.mjs](C:/work/Box3Dwasm/scripts/build-wasm.mjs) local wasm build/sync helper

## Development

### Consumer workflow

Install dependencies:

```bash
npm install
```

Run the web app locally:

```bash
npm run dev
```

Build the single-threaded wasm artifacts locally:

```bash
npm run wasm
```

Build the threaded wasm artifacts locally:

```bash
npm run wasm:threaded
```

Build the site bundle:

```bash
npm run build
```

### Maintainer workflow

The intended maintenance model is:

1. update this repo with newer upstream Box3D source
2. rebuild the wasm artifacts locally
3. run the web demos as a regression suite
4. commit both source-layer changes and any updated checked-in generated artifacts

This keeps the browser port easy to regenerate while still allowing static hosting of known-good wasm outputs.

## Updating from upstream Box3D

At a high level, updating this repo from upstream should look like:

1. pull or merge newer changes from [erincatto/box3d](https://github.com/erincatto/box3d)
2. resolve any conflicts in the wasm glue, JS wrapper, or web demo layer
3. rebuild the wasm artifacts
4. rebuild the site bundle
5. run the browser demos and use them as regression coverage
6. commit the updated source plus regenerated checked-in artifacts

Typical local rebuild commands after an upstream sync:

```bash
npm install
npm run wasm
npm run wasm:threaded
npm run build
```

If you also maintain the double-precision artifacts locally, rebuild those separately as needed:

```bash
npm run wasm:double
```

## What gets checked in

This repo checks in selected generated wasm artifacts on purpose.

Why:

- GitHub Pages can publish the site without requiring an Emscripten toolchain
- consumers can clone the repo and immediately have known-good generated outputs
- maintainers can intentionally regenerate and review artifact changes after upstream updates

The checked-in generated runtime artifacts used by the web app live under:

- [web/generated/single/](C:/work/Box3Dwasm/web/generated/single)
- [web/generated/threaded/](C:/work/Box3Dwasm/web/generated/threaded)

Those artifacts are not the authoritative source of behavior. The authoritative sources remain:

- upstream Box3D engine code
- this repo's wasm glue and JS/browser integration code

## Hosting Notes

This repo supports two wasm delivery modes:

- `threaded`: for hosts that provide real cross-origin isolation (`COOP` / `COEP`)
- `single`: fallback for hosts like GitHub Pages that do not provide those headers

At runtime, the loader checks browser support and chooses the best available flavor automatically. If threaded wasm is unavailable, the app falls back to the single-threaded build and shows a short reason in the UI.

## GitHub Pages

GitHub Pages in this repo is configured as a static deploy. It does not compile Box3D during deployment.

Instead, Pages publishes the checked-in artifacts under:

- [web/generated/single/](C:/work/Box3Dwasm/web/generated/single)
- [web/generated/threaded/](C:/work/Box3Dwasm/web/generated/threaded)

This keeps deploys lightweight and avoids depending on GitHub-hosted Emscripten toolchains for site publishing.

## Status

This project is actively iterating toward broader sample parity with the native Box3D demo suite. Some demos may still diverge from upstream behavior, but the long-term intent is to use the browser port as both a showcase and a maintenance testbed.

## License

This repository inherits and depends on upstream Box3D, which is MIT licensed. See upstream for the canonical license and authorship details:

- [Upstream license and credits](https://github.com/erincatto/box3d/blob/main/README.md#license)
