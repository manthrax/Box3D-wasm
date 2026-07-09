import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const args = new Set( process.argv.slice( 2 ) );
const flavor = args.has( "--flavor" ) ? process.argv[process.argv.indexOf( "--flavor" ) + 1] : "single";
const syncOnly = args.has( "--sync-only" );

const presets = {
	single: {
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

	for ( const filename of filenames )
	{
		const sourcePath = path.join( sourceDir, filename );
		const destinationPath = path.join( destinationDir, filename );
		await fs.copyFile( sourcePath, destinationPath );
	}

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
