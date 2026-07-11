import { axisAngleToQuaternion } from "./helpers.js";

function multiplyQuaternions( a, b )
{
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	};
}

function buildRotation( yaw, roll )
{
	return multiplyQuaternions(
		axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, yaw ),
		axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, roll )
	);
}

function makeTransform( position, yaw = 0, roll = 0 )
{
	return {
		position: { x: position.x, y: position.y, z: position.z },
		rotation: buildRotation( yaw, roll ),
	};
}

function createBoxPoints( hx, hy, hz, offset = { x: 0, y: 0, z: 0 } )
{
	return [
		{ x: offset.x + hx, y: offset.y + hy, z: offset.z + hz },
		{ x: offset.x - hx, y: offset.y + hy, z: offset.z + hz },
		{ x: offset.x - hx, y: offset.y - hy, z: offset.z + hz },
		{ x: offset.x + hx, y: offset.y - hy, z: offset.z + hz },
		{ x: offset.x + hx, y: offset.y + hy, z: offset.z - hz },
		{ x: offset.x - hx, y: offset.y + hy, z: offset.z - hz },
		{ x: offset.x - hx, y: offset.y - hy, z: offset.z - hz },
		{ x: offset.x + hx, y: offset.y - hy, z: offset.z - hz },
	];
}

function rotateVec3( q, v )
{
	const xx = q.x * q.x;
	const yy = q.y * q.y;
	const zz = q.z * q.z;
	const xy = q.x * q.y;
	const xz = q.x * q.z;
	const yz = q.y * q.z;
	const wx = q.w * q.x;
	const wy = q.w * q.y;
	const wz = q.w * q.z;
	return {
		x: ( 1 - 2 * ( yy + zz ) ) * v.x + 2 * ( xy - wz ) * v.y + 2 * ( xz + wy ) * v.z,
		y: 2 * ( xy + wz ) * v.x + ( 1 - 2 * ( xx + zz ) ) * v.y + 2 * ( yz - wx ) * v.z,
		z: 2 * ( xz - wy ) * v.x + 2 * ( yz + wx ) * v.y + ( 1 - 2 * ( xx + yy ) ) * v.z,
	};
}

function transformPoint( transform, point )
{
	const rotated = rotateVec3( transform.rotation, point );
	return {
		x: transform.position.x + rotated.x,
		y: transform.position.y + rotated.y,
		z: transform.position.z + rotated.z,
	};
}

function drawSegment( physics, a, b, color )
{
	physics.addDebugLine( a, b, color );
}

function drawBox( physics, points, transform, color )
{
	const transformed = points.map( ( point ) => transformPoint( transform, point ) );
	const edges = [
		[ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 0 ],
		[ 4, 5 ], [ 5, 6 ], [ 6, 7 ], [ 7, 4 ],
		[ 0, 4 ], [ 1, 5 ], [ 2, 6 ], [ 3, 7 ],
	];
	for ( const [ a, b ] of edges )
	{
		drawSegment( physics, transformed[a], transformed[b], color );
	}
}

function drawTriangle( physics, points, transform, color )
{
	const transformed = points.map( ( point ) => transformPoint( transform, point ) );
	drawSegment( physics, transformed[0], transformed[1], color );
	drawSegment( physics, transformed[1], transformed[2], color );
	drawSegment( physics, transformed[2], transformed[0], color );
}

function drawCapsule( physics, capsule, transform, color )
{
	const c1 = transformPoint( transform, { x: capsule[0], y: capsule[1], z: capsule[2] } );
	const c2 = transformPoint( transform, { x: capsule[3], y: capsule[4], z: capsule[5] } );
	drawSegment( physics, c1, c2, color );
	physics.addDebugPoint( c1, color );
	physics.addDebugPoint( c2, color );
}

function drawSphere( physics, sphere, transform, color )
{
	const center = transformPoint( transform, { x: sphere[0], y: sphere[1], z: sphere[2] } );
	const radius = sphere[3];
	physics.addDebugPoint( center, color );
	drawSegment( physics, { x: center.x - radius, y: center.y, z: center.z }, { x: center.x + radius, y: center.y, z: center.z }, color );
	drawSegment( physics, { x: center.x, y: center.y - radius, z: center.z }, { x: center.x, y: center.y + radius, z: center.z }, color );
	drawSegment( physics, { x: center.x, y: center.y, z: center.z - radius }, { x: center.x, y: center.y, z: center.z + radius }, color );
}

function drawWorldManifold( physics, manifold )
{
	for ( const point of manifold.points ?? [] )
	{
		const color = point.separation <= 0 ? 0xf2d66b : 0xffffff;
		physics.addDebugPoint( point.point, color );
		physics.addDebugLine(
			point.point,
			{
				x: point.point.x + 0.5 * manifold.normal.x,
				y: point.point.y + 0.5 * manifold.normal.y,
				z: point.point.z + 0.5 * manifold.normal.z,
			},
			color
		);
	}
}

function createManifoldSample( definition )
{
	return {
		key: definition.key,
		label: definition.label,
		description: definition.description,
		create( ctx )
		{
			let position = { ...definition.initialPosition };
			let yaw = definition.initialYaw ?? 0;
			let roll = definition.initialRoll ?? 0;
			let lastManifold = { pointCount: 0, points: [], normal: { x: 0, y: 1, z: 0 } };

			function getMovingTransform()
			{
				return makeTransform( position, yaw, roll );
			}

			return {
				reset()
				{
					position = { ...definition.initialPosition };
					yaw = definition.initialYaw ?? 0;
					roll = definition.initialRoll ?? 0;
					lastManifold = { pointCount: 0, points: [], normal: { x: 0, y: 1, z: 0 } };
					ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
					ctx.setCameraLookAt( definition.camera.eye, definition.camera.target );
				},

				update()
				{
					const transform = getMovingTransform();
					definition.draw( ctx.physics, transform );
					lastManifold = definition.query( ctx.physics, transform );
					drawWorldManifold( ctx.physics, lastManifold );
				},

				buildUI( panel )
				{
					panel.add( "X", position.x, { min: -6, max: 6, step: 0.05 }, ( value ) => { position.x = value; } );
					panel.add( "Y", position.y, { min: -2, max: 6, step: 0.05 }, ( value ) => { position.y = value; } );
					panel.add( "Z", position.z, { min: -6, max: 6, step: 0.05 }, ( value ) => { position.z = value; } );
					panel.add( "Yaw", yaw, { min: -Math.PI, max: Math.PI, step: 0.02 }, ( value ) => { yaw = value; } );
					panel.add( "Roll", roll, { min: -Math.PI, max: Math.PI, step: 0.02 }, ( value ) => { roll = value; } );
				},

				getStatusLines()
				{
					const separations = ( lastManifold.points ?? [] ).map( ( point ) => point.separation );
					const minSeparation = separations.length === 0 ? 0 : Math.min( ...separations );
					return [
						`points: ${lastManifold.pointCount ?? 0}`,
						`min separation: ${minSeparation.toFixed( 4 )}`,
						`normal: ${lastManifold.normal.x.toFixed( 2 )}, ${lastManifold.normal.y.toFixed( 2 )}, ${lastManifold.normal.z.toFixed( 2 )}`,
					];
				},
			};
		},
	};
}

export function createManifoldSamples()
{
	const boxLong = createBoxPoints( 2, 0.5, 0.5 );
	const boxShort = createBoxPoints( 0.5, 0.5, 0.5 );
	const boxOffset = createBoxPoints( 0.5, 1.0, 1.0, { x: 1.0, y: 0.5, z: 0.0 } );
	const triangleA = [ { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 4 }, { x: 4, y: 0, z: 0 } ];
	const triangleB = [ { x: -4, y: 0, z: -4 }, { x: -4, y: 0, z: 0 }, { x: 0, y: 0, z: 0 } ];
	const triangleC = [ { x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 } ];

	return [
		createManifoldSample( {
			key: "manifold-sphere-sphere",
			label: "Manifold / Sphere vs Sphere",
			description: "Direct sphere-vs-sphere manifold output from the native collision routine.",
			initialPosition: { x: 0, y: 1.5, z: 3.5 },
			initialYaw: 0,
			initialRoll: 0,
			camera: { eye: { x: 24, y: 18, z: 34 }, target: { x: 0, y: 4, z: 0 } },
			draw( physics, transformB )
			{
				const transformA = makeTransform( { x: 3.5, y: 0.5, z: 0 }, 0.5 * Math.PI, 0 );
				drawSphere( physics, [ 0.5, 0, -0.25, 2 ], transformA, 0x7ee07a );
				drawSphere( physics, [ 0.5, 0, -0.25, 2 ], transformB, 0x56c7d9 );
			},
			query( physics, transformB )
			{
				return physics.collideSpheres( {
					sphereA: [ 0.5, 0, -0.25, 2 ],
					transformA: makeTransform( { x: 3.5, y: 0.5, z: 0 }, 0.5 * Math.PI, 0 ),
					sphereB: [ 0.5, 0, -0.25, 2 ],
					transformB,
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-capsule-sphere",
			label: "Manifold / Capsule vs Sphere",
			description: "Direct capsule-vs-sphere manifold output from the native collision routine.",
			initialPosition: { x: -4, y: 0, z: 0 },
			camera: { eye: { x: 18, y: 12, z: 24 }, target: { x: 0, y: 0, z: 0 } },
			draw( physics, transformB )
			{
				const transformA = makeTransform( { x: 0, y: 0, z: 0 } );
				drawCapsule( physics, [ -2, 0, 0, 2, 0, 0, 1 ], transformA, 0x56c7d9 );
				drawSphere( physics, [ 0, 0, 0, 2 ], transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideCapsuleAndSphere( {
					capsuleA: [ -2, 0, 0, 2, 0, 0, 1 ],
					transformA: makeTransform( { x: 0, y: 0, z: 0 } ),
					sphereB: [ 0, 0, 0, 2 ],
					transformB,
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-hull-sphere",
			label: "Manifold / Hull vs Sphere",
			description: "Direct hull-vs-sphere manifold output from the native collision routine.",
			initialPosition: { x: 1.5, y: 0, z: 0 },
			camera: { eye: { x: 18, y: 12, z: 24 }, target: { x: 0, y: 0, z: 0 } },
			draw( physics, transformB )
			{
				const transformA = makeTransform( { x: 0, y: 0, z: 0 } );
				drawBox( physics, boxLong, transformA, 0x56c7d9 );
				drawSphere( physics, [ 0, 0, 0, 1 ], transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideHullAndSphere( {
					pointsA: boxLong,
					transformA: makeTransform( { x: 0, y: 0, z: 0 } ),
					sphereB: [ 0, 0, 0, 1 ],
					transformB,
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-triangle-sphere",
			label: "Manifold / Triangle vs Sphere",
			description: "Direct triangle-vs-sphere manifold output from the native collision routine.",
			initialPosition: { x: 2, y: 0.5, z: 1 },
			camera: { eye: { x: 0, y: 18, z: 10 }, target: { x: 0, y: 0, z: 0 } },
			draw( physics, transformB )
			{
				drawTriangle( physics, triangleA, makeTransform( { x: 0, y: 0, z: 0 } ), 0x56c7d9 );
				drawSphere( physics, [ 0, 0, 0, 0.25 ], transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideSphereAndTriangle( {
					sphereA: [ 0, 0, 0, 0.25 ],
					transformA: transformB,
					triangleB: triangleA,
					transformB: makeTransform( { x: 0, y: 0, z: 0 } ),
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-capsule-capsule",
			label: "Manifold / Capsule vs Capsule",
			description: "Direct capsule-vs-capsule manifold output from the native collision routine.",
			initialPosition: { x: -4, y: 1, z: 0 },
			camera: { eye: { x: 22, y: 14, z: 28 }, target: { x: 0, y: 1, z: 0 } },
			draw( physics, transformB )
			{
				drawCapsule( physics, [ -2, 0, 0, 2, 0, 0, 1 ], makeTransform( { x: 1, y: 1, z: 0 } ), 0x7ee07a );
				drawCapsule( physics, [ -2, 0, 0, 2, 0, 0, 1 ], transformB, 0x56c7d9 );
			},
			query( physics, transformB )
			{
				return physics.collideCapsules( {
					capsuleA: [ -2, 0, 0, 2, 0, 0, 1 ],
					transformA: makeTransform( { x: 1, y: 1, z: 0 } ),
					capsuleB: [ -2, 0, 0, 2, 0, 0, 1 ],
					transformB,
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-capsule-hull",
			label: "Manifold / Capsule vs Hull",
			description: "Direct hull-vs-capsule manifold output from the native collision routine.",
			initialPosition: { x: 1.58523774, y: 0.729615569, z: 0.451690674 },
			initialYaw: -0.0407,
			initialRoll: 0.2529,
			camera: { eye: { x: 0, y: 18, z: 8 }, target: { x: 0, y: 0, z: 0 } },
			draw( physics, transformB )
			{
				drawBox( physics, createBoxPoints( 1, 0.5, 0.5 ), makeTransform( { x: 0, y: 0, z: 0 } ), 0x56c7d9 );
				drawCapsule( physics, [ -1, 0, 0, 1, 0, 0, 0.5 ], transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideHullAndCapsule( {
					pointsA: createBoxPoints( 1, 0.5, 0.5 ),
					transformA: makeTransform( { x: 0, y: 0, z: 0 } ),
					capsuleB: [ -1, 0, 0, 1, 0, 0, 0.5 ],
					transformB,
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-triangle-capsule",
			label: "Manifold / Triangle vs Capsule",
			description: "Direct triangle-vs-capsule manifold output from the native collision routine.",
			initialPosition: { x: -0.5, y: 0.123778239, z: -0.5 },
			initialYaw: -0.541,
			initialRoll: -2.112,
			camera: { eye: { x: 0, y: 18, z: 10 }, target: { x: -2, y: 0, z: -2 } },
			draw( physics, transformB )
			{
				drawTriangle( physics, triangleB, makeTransform( { x: 0, y: 0, z: 0 } ), 0x56c7d9 );
				drawCapsule( physics, [ 0, -0.2, 0, 0, 0.2, 0, 0.05 ], transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideCapsuleAndTriangle( {
					capsuleA: [ 0, -0.2, 0, 0, 0.2, 0, 0.05 ],
					transformA: transformB,
					triangleB: triangleB,
					transformB: makeTransform( { x: 0, y: 0, z: 0 } ),
					pointCapacity: 4,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-hull-hull",
			label: "Manifold / Hull vs Hull",
			description: "Direct hull-vs-hull manifold output from the native collision routine.",
			initialPosition: { x: 0, y: 0, z: 0 },
			camera: { eye: { x: 0, y: 12, z: 12 }, target: { x: 0, y: 0, z: 0 } },
			draw( physics, transformB )
			{
				drawBox( physics, boxOffset, makeTransform( { x: 0, y: 0, z: 0 } ), 0x7ee07a );
				drawBox( physics, boxShort, transformB, 0x56c7d9 );
			},
			query( physics, transformB )
			{
				return physics.collideHulls( {
					pointsA: boxOffset,
					transformA: makeTransform( { x: 0, y: 0, z: 0 } ),
					pointsB: boxShort,
					transformB,
					pointCapacity: 8,
				} );
			},
		} ),
		createManifoldSample( {
			key: "manifold-triangle-hull",
			label: "Manifold / Triangle vs Hull",
			description: "Direct triangle-vs-hull manifold output from the native collision routine.",
			initialPosition: { x: 0, y: 0.45, z: 0.1 },
			camera: { eye: { x: 0, y: 18, z: 8 }, target: { x: 0.5, y: 0, z: 0.5 } },
			draw( physics, transformB )
			{
				drawTriangle( physics, triangleC, makeTransform( { x: 0, y: 0, z: 0 } ), 0x56c7d9 );
				drawBox( physics, boxShort, transformB, 0x7ee07a );
			},
			query( physics, transformB )
			{
				return physics.collideHullAndTriangle( {
					pointsA: boxShort,
					transformA: transformB,
					triangleB: triangleC,
					transformB: makeTransform( { x: 0, y: 0, z: 0 } ),
					triangleFlags: 0,
					pointCapacity: 8,
				} );
			},
		} ),
	];
}
