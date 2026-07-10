export const DEG_TO_RAD = Math.PI / 180;

export function axisAngleToQuaternion( axis, radians )
{
	const halfAngle = radians * 0.5;
	const sine = Math.sin( halfAngle );
	return {
		x: axis.x * sine,
		y: axis.y * sine,
		z: axis.z * sine,
		w: Math.cos( halfAngle ),
	};
}

export function scalePoints( points, scale )
{
	return points.map( ( point ) => ( {
		x: point.x * scale,
		y: point.y * scale,
		z: point.z * scale,
	} ) );
}

const objMeshCache = new Map();

function resolveObjIndex( value, count )
{
	const index = Number.parseInt( value, 10 );
	if ( !Number.isFinite( index ) || index === 0 )
	{
		return -1;
	}

	return index > 0 ? index - 1 : count + index;
}

export function parseObjMesh( source )
{
	const vertices = [];
	const indices = [];
	const materialIndices = [];
	let currentMaterialIndex = 0;
	let nextGroupIndex = 1;

	for ( const rawLine of source.split( /\r?\n/u ) )
	{
		const line = rawLine.trim();
		if ( line === "" || line.startsWith( "#" ) )
		{
			continue;
		}

		if ( line.startsWith( "o " ) || line.startsWith( "g " ) )
		{
			currentMaterialIndex = nextGroupIndex;
			nextGroupIndex += 1;
			continue;
		}

		if ( line.startsWith( "v " ) )
		{
			const [ x = "0", y = "0", z = "0" ] = line.slice( 2 ).trim().split( /\s+/u );
			vertices.push( {
				x: Number.parseFloat( x ),
				y: Number.parseFloat( y ),
				z: Number.parseFloat( z ),
			} );
			continue;
		}

		if ( line.startsWith( "f " ) )
		{
			const faceIndices = line.slice( 2 )
				.trim()
				.split( /\s+/u )
				.map( ( token ) => resolveObjIndex( token.split( "/" )[0], vertices.length ) )
				.filter( ( index ) => index >= 0 && index < vertices.length );

			if ( faceIndices.length < 3 )
			{
				continue;
			}

			for ( let index = 1; index < faceIndices.length - 1; index += 1 )
			{
				indices.push( faceIndices[0], faceIndices[index], faceIndices[index + 1] );
				materialIndices.push( currentMaterialIndex );
			}
		}
	}

	return { vertices, indices, materialIndices };
}

export function loadObjMesh( url )
{
	if ( objMeshCache.has( url ) )
	{
		return objMeshCache.get( url );
	}

	const promise = fetch( url )
		.then( ( response ) =>
		{
			if ( response.ok === false )
			{
				throw new Error( `Failed to load OBJ: ${response.status} ${response.statusText}` );
			}
			return response.text();
		} )
		.then( ( source ) => parseObjMesh( source ) );

	objMeshCache.set( url, promise );
	return promise;
}
