import { defineConfig } from "vite";

export default defineConfig( {
	base: "./",
	root: "web",
	publicDir: false,
	server: {
		host: "127.0.0.1",
		port: 5173,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	worker: {
		format: "es",
	},
	build: {
		outDir: "../dist/web",
		emptyOutDir: true,
	},
} );
