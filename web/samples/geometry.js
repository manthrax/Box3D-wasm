import { axisAngleToQuaternion } from "./helpers.js";

function createRng( seed )
{
	let state = seed >>> 0;
	return function random()
	{
		state = ( 1664525 * state + 1013904223 ) >>> 0;
		return state / 0x100000000;
	};
}

function rotatePoint( point, rotation )
{
	const x = point.x;
	const y = point.y;
	const z = point.z;
	const qx = rotation.x;
	const qy = rotation.y;
	const qz = rotation.z;
	const qw = rotation.w;

	const ix = qw * x + qy * z - qz * y;
	const iy = qw * y + qz * x - qx * z;
	const iz = qw * z + qx * y - qy * x;
	const iw = -qx * x - qy * y - qz * z;

	return {
		x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
		y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
		z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
	};
}

function transformPoints( points, rotation, translation = { x: 0, y: 0, z: 0 }, scale = { x: 1, y: 1, z: 1 } )
{
	return points.map( ( point ) =>
	{
		const rotated = rotatePoint( point, rotation );
		return {
			x: scale.x * rotated.x + translation.x,
			y: scale.y * rotated.y + translation.y,
			z: scale.z * rotated.z + translation.z,
		};
	} );
}

function createBoxPoints( halfWidths )
{
	const { x: hx, y: hy, z: hz } = halfWidths;
	return [
		{ x: hx, y: hy, z: hz },
		{ x: hx, y: hy, z: -hz },
		{ x: hx, y: -hy, z: hz },
		{ x: hx, y: -hy, z: -hz },
		{ x: -hx, y: hy, z: hz },
		{ x: -hx, y: hy, z: -hz },
		{ x: -hx, y: -hy, z: hz },
		{ x: -hx, y: -hy, z: -hz },
	];
}

function createCylinderPoints( height, radius, sides )
{
	const points = [];
	const halfHeight = 0.5 * height;
	for ( let index = 0; index < sides; index += 1 )
	{
		const angle = ( 2 * Math.PI * index ) / sides;
		const y = radius * Math.cos( angle );
		const z = radius * Math.sin( angle );
		points.push( { x: -halfHeight, y, z } );
		points.push( { x: halfHeight, y, z } );
	}
	return points;
}

function createCapsuleApproximationPoints( radius, length, sides )
{
	const points = [];
	const halfLength = 0.5 * length;
	for ( let i = 0; i < sides; i += 1 )
	{
		const theta = -0.5 * Math.PI + ( Math.PI * i ) / ( sides - 1 );
		const sinTheta = Math.sin( theta );
		const cosTheta = Math.cos( theta );
		for ( let j = 0; j < sides; j += 1 )
		{
			const phi = -0.5 * Math.PI + ( Math.PI * j ) / ( sides - 1 );
			points.push( {
				x: halfLength + radius * cosTheta,
				y: radius * sinTheta * Math.cos( phi ),
				z: radius * sinTheta * Math.sin( phi ),
			} );
		}
	}

	for ( let i = 0; i < sides; i += 1 )
	{
		const theta = 0.5 * Math.PI + ( Math.PI * i ) / ( sides - 1 );
		const sinTheta = Math.sin( theta );
		const cosTheta = Math.cos( theta );
		for ( let j = 0; j < sides; j += 1 )
		{
			const phi = -0.5 * Math.PI + ( Math.PI * j ) / ( sides - 1 );
			points.push( {
				x: -halfLength + radius * cosTheta,
				y: radius * sinTheta * Math.cos( phi ),
				z: radius * sinTheta * Math.sin( phi ),
			} );
		}
	}

	return points;
}

function rebuildGeometryScene( ctx, builder )
{
	ctx.physics.resetWorld( { gravity: { x: 0, y: 0, z: 0 } } );
	ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
	builder();
}

export function createGeometrySamples( { BodyType } )
{
	const hullPoints = [
		{ x: -3.9866004, y: 75.4595108, z: 28.3783073 }, { x: -13.1079493, y: 73.080368, z: 28.296587 },
		{ x: -18.6611958, y: 72.0040894, z: 16.9292431 }, { x: 4.82537603, y: 79.2908554, z: 22.2369995 },
		{ x: -12.7315464, y: 79.2187576, z: 2.94275379 }, { x: -21.806488, y: 78.7758865, z: 0.985544085 },
		{ x: -27.7619209, y: 73.3481522, z: 11.9647141 }, { x: -22.3994541, y: 72.2203826, z: 21.4116211 },
		{ x: -25.3797474, y: 76.7417755, z: 27.9124985 }, { x: -22.7552319, y: 77.0559006, z: 29.4733639 },
		{ x: -6.81736374, y: 78.3484726, z: 36.8649979 }, { x: 3.62397718, y: 85.5270843, z: 29.2077713 },
		{ x: 7.90363788, y: 84.121231, z: 18.2612896 }, { x: -12.3809223, y: 84.5280533, z: -0.43230924 },
		{ x: 5.83599472, y: 95.2908325, z: 4.4423275 }, { x: -22.5541401, y: 89.9094467, z: -4.87791252 },
		{ x: -43.9060402, y: 78.5287094, z: 1.32877088 }, { x: -42.6015129, y: 76.7829742, z: 7.67437983 },
		{ x: -25.735527, y: 78.1218796, z: 27.908411 }, { x: -23.5183544, y: 77.6326675, z: 29.1178799 },
		{ x: 2.0977366, y: 100.430191, z: 34.3929482 }, { x: 1.09743047, y: 103.952553, z: 35.5656395 },
		{ x: 8.50175952, y: 96.0529861, z: 8.73674774 }, { x: 2.52570295, y: 103.303696, z: 32.2314339 },
		{ x: -20.099781, y: 89.4923248, z: -4.15468454 }, { x: 2.8092947, y: 123.516098, z: -1.12693477 },
		{ x: -43.9318161, y: 79.1106186, z: 1.39006138 }, { x: -23.358511, y: 90.9599686, z: -4.25683546 },
		{ x: 2.10804915, y: 123.603645, z: -1.38435471 }, { x: -44.1329117, y: 78.7192383, z: 1.54941654 },
		{ x: -42.4365158, y: 77.725357, z: 8.14835929 }, { x: -43.204792, y: 77.5811691, z: 7.14319515 },
		{ x: -44.17416, y: 78.7810363, z: 2.50146222 }, { x: -32.8975143, y: 99.1221771, z: 7.55588436 },
		{ x: -0.624746263, y: 110.070351, z: 32.7381058 }, { x: 0.00431228895, y: 109.14341, z: 33.6411133 },
		{ x: -0.58865279, y: 122.980537, z: 16.6554794 }, { x: 2.18539238, y: 124.324593, z: -0.620266676 },
		{ x: -1.02177501, y: 123.881721, z: 16.8230057 }, { x: 1.9842999, y: 124.571777, z: -0.321986318 },
		{ x: 1.86570692, y: 124.365791, z: -0.599836588 }, { x: -43.591507, y: 78.1373291, z: 6.1135149 },
		{ x: -43.8235397, y: 79.2239074, z: 3.48619604 }, { x: -43.591507, y: 78.50811, z: 5.54555655 },
		{ x: 1.21086729, y: 124.49453, z: 1.07543683 }, { x: -1.86223853, y: 124.195847, z: 15.6257992 },
		{ x: -1.46520972, y: 124.355492, z: 16.9864483 }, { x: 1.654302, y: 124.612976, z: 0.621887207 },
	].map( ( point ) => ( { x: 0.01 * point.x, y: 0.01 * point.y, z: 0.01 * point.z } ) );

	return [
		{
			key: "geometry-box-hull",
			label: "Geometry / Box Hull",
			description: "A browser port of the native box-hull comparison. It rebuilds a transformed box from explicit corner points and compares it against the equivalent analytic box primitive.",
			create( ctx )
			{
				let halfWidths = { x: 1.0, y: 0.5, z: 0.25 };
				let center = { x: 0, y: 0, z: 0 };
				let rotationDegrees = { x: 0, y: 0, z: 0 };
				let postScale = { x: 1, y: 1, z: 1 };

				function rebuild()
				{
					const rotation = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, rotationDegrees.x * Math.PI / 180 );
					const rotationY = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, rotationDegrees.y * Math.PI / 180 );
					const rotationZ = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, rotationDegrees.z * Math.PI / 180 );
					const points = transformPoints(
						transformPoints(
							transformPoints( createBoxPoints( halfWidths ), rotation, center ),
							rotationY,
							{ x: 0, y: 0, z: 0 }
						),
						rotationZ,
						{ x: 0, y: 0, z: 0 },
						postScale
					);
					rebuildGeometryScene( ctx, () =>
					{
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: -2, y: 0, z: 0 },
							points,
							color: 0xe2c04c,
						} );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 2 + center.x * postScale.x, y: center.y * postScale.y, z: center.z * postScale.z },
							rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, rotationDegrees.z * Math.PI / 180 ),
							size: {
								hx: Math.abs( halfWidths.x * postScale.x ),
								hy: Math.abs( halfWidths.y * postScale.y ),
								hz: Math.abs( halfWidths.z * postScale.z ),
							},
							color: 0x55c5d9,
						} );
					} );
				}

				return {
					reset()
					{
						rebuild();
						ctx.setCameraLookAt( { x: 0, y: 8, z: 12 }, { x: 0, y: 0, z: 0 } );
					},
					buildUI( panel )
					{
						panel.add( "HX", halfWidths.x, { min: 0.1, max: 2, step: 0.1 }, ( value ) => { halfWidths.x = value; rebuild(); } );
						panel.add( "HY", halfWidths.y, { min: 0.1, max: 2, step: 0.1 }, ( value ) => { halfWidths.y = value; rebuild(); } );
						panel.add( "HZ", halfWidths.z, { min: 0.1, max: 2, step: 0.1 }, ( value ) => { halfWidths.z = value; rebuild(); } );
						panel.add( "Center X", center.x, { min: -2, max: 2, step: 0.1 }, ( value ) => { center.x = value; rebuild(); } );
						panel.add( "Center Y", center.y, { min: -2, max: 2, step: 0.1 }, ( value ) => { center.y = value; rebuild(); } );
						panel.add( "Rot Z", rotationDegrees.z, { min: -180, max: 180, step: 1 }, ( value ) => { rotationDegrees.z = value; rebuild(); } );
						panel.add( "Scale X", postScale.x, { min: -2, max: 2, step: 0.1 }, ( value ) => { postScale.x = value; rebuild(); } );
						panel.add( "Scale Y", postScale.y, { min: -2, max: 2, step: 0.1 }, ( value ) => { postScale.y = value; rebuild(); } );
						panel.add( "Scale Z", postScale.z, { min: -2, max: 2, step: 0.1 }, ( value ) => { postScale.z = value; rebuild(); } );
					},
				};
			},
		},
		{
			key: "geometry-hull",
			label: "Geometry / Hull",
			description: "A browser port of the native hull sample using the same fixed point cloud that stresses convex hull generation.",
			create( ctx )
			{
				return {
					reset()
					{
						rebuildGeometryScene( ctx, () =>
						{
							ctx.physics.createHullBody( {
								type: BodyType.static,
								position: { x: 0, y: 0, z: 0 },
								points: hullPoints,
								maxVertexCount: 16,
								color: 0xe2c04c,
							} );
						} );
						ctx.setCameraLookAt( { x: 0, y: 15, z: 5 }, { x: 0, y: 1, z: 0 } );
					},
					getStatusLines()
					{
						return [
							`source points: ${hullPoints.length}`,
							"reduced hull vertices: 16",
							"expected: the hull should appear as a single stable convex body",
						];
					},
				};
			},
		},
		{
			key: "geometry-hull-reduction",
			label: "Geometry / Hull Reduction",
			description: "A browser port of the native hull-reduction sample. It generates noisy box or sphere point clouds, then rebuilds the hull as the target vertex count changes.",
			create( ctx )
			{
				let type = "sphere";
				let count = 16;

				function generatePoints()
				{
					const random = createRng( 42 );
					const points = [];
					for ( let index = 0; index < 128; index += 1 )
					{
						if ( type === "box" )
						{
							const noise = 0.001;
							points.push( {
								x: Math.max( -1, Math.min( 1, -2 + 4 * random() ) ) + ( 2 * random() - 1 ) * noise,
								y: Math.max( -1, Math.min( 1, -2 + 4 * random() ) ) + ( 2 * random() - 1 ) * noise,
								z: Math.max( -1, Math.min( 1, -2 + 4 * random() ) ) + ( 2 * random() - 1 ) * noise,
							} );
						}
						else
						{
							const z = 2 * random() - 1;
							const theta = 2 * Math.PI * random();
							const radius = Math.sqrt( Math.max( 0, 1 - z * z ) );
							points.push( { x: radius * Math.cos( theta ), y: radius * Math.sin( theta ), z } );
						}
					}
					return points.slice( 0, count );
				}

				function rebuild()
				{
					rebuildGeometryScene( ctx, () =>
					{
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							points: generatePoints(),
							color: 0xe2c04c,
						} );
					} );
				}

				return {
					reset()
					{
						rebuild();
						ctx.setCameraLookAt( { x: 0, y: 7, z: 9 }, { x: 0, y: 0, z: 0 } );
					},
					buildUI( panel )
					{
						panel.addButton( "Box", () => { type = "box"; rebuild(); } );
						panel.addButton( "Sphere", () => { type = "sphere"; rebuild(); } );
						panel.add( "Count", count, { min: 4, max: 64, step: 1 }, ( value ) => { count = Math.round( value ); rebuild(); } );
					},
					getStatusLines()
					{
						return [ `type: ${type}`, `count: ${count}` ];
					},
				};
			},
		},
		{
			key: "geometry-hull-transform",
			label: "Geometry / Hull Transform",
			description: "A browser port of the native hull-transform sample. It compares a source hull against a transformed clone using scale, rotation, and translation controls.",
			create( ctx )
			{
				let scale = { x: 1, y: 1, z: 1 };
				let angles = { x: 0, y: 0, z: 0 };
				let offset = { x: 0, y: 0, z: 0 };

				function rebuild()
				{
					const original = createCylinderPoints( 1.0, 0.5, 9 );
					const qx = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, angles.x * Math.PI / 180 );
					const qy = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, angles.y * Math.PI / 180 );
					const qz = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, angles.z * Math.PI / 180 );
					const transformed = transformPoints(
						transformPoints(
							transformPoints( original, qx ),
							qy
						),
						qz,
						offset,
						scale
					);

					rebuildGeometryScene( ctx, () =>
					{
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: -2, y: 0, z: 0 },
							points: original,
							color: 0x67c55f,
						} );
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: 2, y: 0, z: 0 },
							points: transformed,
							color: 0xe2c04c,
						} );
					} );
				}

				return {
					reset()
					{
						rebuild();
						ctx.setCameraLookAt( { x: 0, y: 8, z: 12 }, { x: 0, y: 0, z: 0 } );
					},
					buildUI( panel )
					{
						panel.add( "Scale X", scale.x, { min: -2, max: 2, step: 0.1 }, ( value ) => { scale.x = value; rebuild(); } );
						panel.add( "Scale Y", scale.y, { min: -2, max: 2, step: 0.1 }, ( value ) => { scale.y = value; rebuild(); } );
						panel.add( "Scale Z", scale.z, { min: -2, max: 2, step: 0.1 }, ( value ) => { scale.z = value; rebuild(); } );
						panel.add( "Rot X", angles.x, { min: -180, max: 180, step: 1 }, ( value ) => { angles.x = value; rebuild(); } );
						panel.add( "Rot Y", angles.y, { min: -180, max: 180, step: 1 }, ( value ) => { angles.y = value; rebuild(); } );
						panel.add( "Rot Z", angles.z, { min: -180, max: 180, step: 1 }, ( value ) => { angles.z = value; rebuild(); } );
						panel.add( "Offset X", offset.x, { min: -1, max: 1, step: 0.1 }, ( value ) => { offset.x = value; rebuild(); } );
						panel.add( "Offset Y", offset.y, { min: -1, max: 1, step: 0.1 }, ( value ) => { offset.y = value; rebuild(); } );
						panel.add( "Offset Z", offset.z, { min: -1, max: 1, step: 0.1 }, ( value ) => { offset.z = value; rebuild(); } );
					},
				};
			},
		},
		{
			key: "geometry-capsule-mass",
			label: "Geometry / Capsule Mass",
			description: "A browser port of the native capsule-mass sample. It compares mass properties for an approximate capsule hull, the analytic capsule shape, and a bounding box.",
			create( ctx )
			{
				let sides = 6;
				let massLines = [];

				function rebuild()
				{
					rebuildGeometryScene( ctx, () =>
					{
						const hullPointsApprox = createCapsuleApproximationPoints( 1.0, 2.0, sides );
						const hullHandle = ctx.physics.createHullBody( {
							type: BodyType.dynamic,
							position: { x: -3, y: 0, z: 0 },
							points: hullPointsApprox,
							density: 1,
							gravityScale: 0,
							color: 0xe2c04c,
						} );
						const capsuleHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 0, z: 0 },
							capsule: {
								center1: { x: -1, y: 0, z: 0 },
								center2: { x: 1, y: 0, z: 0 },
								radius: 1,
							},
							density: 1,
							gravityScale: 0,
							color: 0x68d0d8,
						} );
						const boxHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 3, y: 0, z: 0 },
							size: { hx: 2, hy: 1, hz: 1 },
							density: 1,
							gravityScale: 0,
							color: 0x7664d8,
						} );

						const hullMass = ctx.physics.getBodyMassData( hullHandle );
						const capsuleMass = ctx.physics.getBodyMassData( capsuleHandle );
						const boxMass = ctx.physics.getBodyMassData( boxHandle );
						massLines = [
							`mass hull/capsule/box: ${hullMass.mass.toFixed( 3)} / ${capsuleMass.mass.toFixed( 3 )} / ${boxMass.mass.toFixed( 3 )}`,
							`Ixx hull/capsule/box: ${hullMass.inertia.cx.x.toFixed( 3 )} / ${capsuleMass.inertia.cx.x.toFixed( 3 )} / ${boxMass.inertia.cx.x.toFixed( 3 )}`,
							`Iyy hull/capsule/box: ${hullMass.inertia.cy.y.toFixed( 3 )} / ${capsuleMass.inertia.cy.y.toFixed( 3 )} / ${boxMass.inertia.cy.y.toFixed( 3 )}`,
							`Izz hull/capsule/box: ${hullMass.inertia.cz.z.toFixed( 3 )} / ${capsuleMass.inertia.cz.z.toFixed( 3 )} / ${boxMass.inertia.cz.z.toFixed( 3 )}`,
						];
					} );
				}

				return {
					reset()
					{
						rebuild();
						ctx.setCameraLookAt( { x: 0, y: 8, z: 14 }, { x: 0, y: 0, z: 0 } );
					},
					buildUI( panel )
					{
						panel.add( "Sides", sides, { min: 3, max: 6, step: 1 }, ( value ) => { sides = Math.round( value ); rebuild(); } );
					},
					getStatusLines()
					{
						return [ `sides: ${sides}`, ...massLines ];
					},
				};
			},
		},
	];
}
