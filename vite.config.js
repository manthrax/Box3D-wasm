import { defineConfig } from "vite";

export default defineConfig( {
	root: "web",
	publicDir: false,
	server: {
		host: "127.0.0.1",
		port: 5173,
	},
	build: {
		outDir: "../dist/web",
		emptyOutDir: true,
	},
} );
