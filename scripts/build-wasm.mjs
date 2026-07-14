import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const args = new Set( process.argv.slice( 2 ) );
const flavor = args.has( "--flavor" ) ? process.argv[process.argv.indexOf( "--flavor" ) + 1] : "single";
const syncOnly = args.has( "--sync-only" );

const presets = {
	single: {
		configure: "emscripten-release-single",
		build: "emscripten-release-single",
		outputDir: path.join( rootDir, "build-box3d-wasm-single", "bin" ),
	},
	threaded: {
		configure: "emscripten-release",
		build: "emscripten-release",
		outputDir: path.join( rootDir, "build-box3d-wasm", "bin" ),
	},
	double: {
		configure: "emscripten-release-double",
		build: "emscripten-release-double",
		outputDir: path.join( rootDir, "build-box3d-wasm-double", "bin" ),
	},
};

const selectedPreset = presets[flavor];

if ( selectedPreset == null )
{
	throw new Error( `Unknown wasm flavor "${flavor}". Expected one of: ${Object.keys( presets ).join( ", " )}` );
}

const generatedDir = path.join( rootDir, "web", "generated" );
const flavorDir = path.join( generatedDir, flavor );
const activeDir = path.join( generatedDir, "active" );
const metadataPath = path.join( generatedDir, "metadata.json" );

async function ensureDir( directory )
{
	await fs.mkdir( directory, { recursive: true } );
}

function patchRawLoaderSource( source )
{
	const initMemoryNeedle = "function initMemory(){if(ENVIRONMENT_IS_PTHREAD){return}{var INITIAL_MEMORY=16777216;wasmMemory=new WebAssembly.Memory({initial:INITIAL_MEMORY/65536,maximum:32768,shared:true})}updateMemoryViews()}";
	const initMemoryReplacement = "function initMemory(){if(ENVIRONMENT_IS_PTHREAD){return}if(Module[\"wasmMemory\"]){wasmMemory=Module[\"wasmMemory\"]}else{var INITIAL_MEMORY=Module[\"initialMemoryBytes\"]||16777216;var MAXIMUM_MEMORY=Module[\"maximumMemoryBytes\"]||2147483648;if(INITIAL_MEMORY<=0||INITIAL_MEMORY%65536!==0){abort(\"initialMemoryBytes must be a positive multiple of 64 KiB\")}if(MAXIMUM_MEMORY<=0||MAXIMUM_MEMORY%65536!==0){abort(\"maximumMemoryBytes must be a positive multiple of 64 KiB\")}if(MAXIMUM_MEMORY<INITIAL_MEMORY){abort(\"maximumMemoryBytes must be greater than or equal to initialMemoryBytes\")}wasmMemory=new WebAssembly.Memory({initial:INITIAL_MEMORY/65536,maximum:MAXIMUM_MEMORY/65536,shared:true})}if(!(wasmMemory.buffer instanceof SharedArrayBuffer)){abort(\"wasmMemory must use shared memory when pthreads are enabled\")}updateMemoryViews()}";

	if ( source.includes( initMemoryNeedle ) === false )
	{
		return source;
	}

	return source.replace( initMemoryNeedle, initMemoryReplacement );
}

async function patchRawLoader( filePath )
{
	const original = await fs.readFile( filePath, "utf8" );
	const patched = patchRawLoaderSource( original );
	if ( patched !== original )
	{
		await fs.writeFile( filePath, patched );
	}
}

function runCommand( command )
{
	return new Promise( ( resolve, reject ) =>
	{
		const child = spawn( command, {
			cwd: rootDir,
			shell: true,
			stdio: "inherit",
		} );

		child.on( "exit", ( code ) =>
		{
			if ( code === 0 )
			{
				resolve();
				return;
			}

			reject( new Error( `Command failed with exit code ${code}: ${command}` ) );
		} );
	} );
}

async function copyArtifacts( sourceDir, destinationDir )
{
	await ensureDir( destinationDir );
	const filenames = [ "box3d-raw.js", "box3d-raw.wasm" ];
	try
	{
		await fs.access( path.join( sourceDir, "box3d-raw.worker.js" ) );
		filenames.push( "box3d-raw.worker.js" );
	}
	catch ( _ ) {}

	for ( const filename of filenames )
	{
		const sourcePath = path.join( sourceDir, filename );
		const destinationPath = path.join( destinationDir, filename );
		await fs.copyFile( sourcePath, destinationPath );
	}

	await patchRawLoader( path.join( destinationDir, "box3d-raw.js" ) );

	await fs.copyFile( path.join( rootDir, "wasm", "box3d.js" ), path.join( destinationDir, "box3d.js" ) );
	await fs.copyFile( path.join( rootDir, "wasm", "demo.html" ), path.join( destinationDir, "demo.html" ) );
}

async function syncArtifacts()
{
	await fs.access( selectedPreset.outputDir );
	await copyArtifacts( selectedPreset.outputDir, flavorDir );
	await fs.rm( activeDir, { recursive: true, force: true } );
	await copyArtifacts( selectedPreset.outputDir, activeDir );
	await fs.writeFile(
		metadataPath,
		JSON.stringify(
			{
				activeFlavor: flavor,
				syncedAt: new Date().toISOString(),
				sourceDir: path.relative( rootDir, selectedPreset.outputDir ),
			},
			null,
			2
		)
	);
	console.log( `Synced ${flavor} wasm artifacts into ${path.relative( rootDir, activeDir )}` );
}

async function main()
{
	if ( syncOnly === false )
	{
		const command = `cmd /c "call tools\\emsdk\\emsdk_env.bat && cmake --preset ${selectedPreset.configure} && cmake --build --preset ${selectedPreset.build}"`;
		await runCommand( command );
	}

	await syncArtifacts();
}

main().catch( ( error ) =>
{
	console.error( error instanceof Error ? error.message : error );
	process.exitCode = 1;
} );
