import { defineConfig } from "vite";

export default defineConfig( {
	base: "./",
	root: "web",
	publicDir: false,
	server: {
		host: "127.0.0.1",
		port: 5173,
	},
	worker: {
		format: "es",
	},
	build: {
		outDir: "../dist/web",
		emptyOutDir: true,
	},
} );
