function getErrorMessage( error )
{
	if ( error instanceof Error )
	{
		return error.message;
	}

	return String( error );
}

export function getThreadingSupport()
{
	if ( typeof Worker !== "function" )
	{
		return { available: false, reason: "Workers are not available in this browser." };
	}

	if ( typeof SharedArrayBuffer !== "function" )
	{
		return { available: false, reason: "SharedArrayBuffer is unavailable." };
	}

	if ( globalThis.crossOriginIsolated !== true )
	{
		return { available: false, reason: "Cross-origin isolation is required for wasm threads." };
	}

	return { available: true, reason: "" };
}

const flavorImporters = {
	single: () => import( "./generated/single/box3d.js" ),
	threaded: () => import( "./generated/threaded/box3d.js" ),
};

async function loadFlavor( flavor, options = {} )
{
	const importer = flavorImporters[flavor];
	if ( importer == null )
	{
		throw new Error( `Unknown Box3D wasm flavor "${flavor}".` );
	}

	const module = await importer();
	const loadBox3D = module.default ?? module.loadBox3D;
	return loadBox3D( options );
}

export async function loadBestBox3D( options = {} )
{
	const support = getThreadingSupport();

	if ( support.available )
	{
		try
		{
			const box3d = await loadFlavor( "threaded", options );
			return {
				box3d,
				runtime: {
					flavor: "threaded",
					threadingSupport: support,
					fallbackReason: "",
				},
			};
		}
		catch ( error )
		{
			const message = getErrorMessage( error );
			console.warn( `Threaded Box3D wasm failed to initialize, falling back to single-threaded wasm: ${message}` );
			const box3d = await loadFlavor( "single", options );
			return {
				box3d,
				runtime: {
					flavor: "single",
					threadingSupport: {
						available: false,
						reason: `Fell back to single-threaded wasm because the threaded build failed to initialize: ${message}`,
					},
					fallbackReason: message,
				},
			};
		}
	}

	const box3d = await loadFlavor( "single", options );
	return {
		box3d,
		runtime: {
			flavor: "single",
			threadingSupport: support,
			fallbackReason: support.reason,
		},
	};
}
