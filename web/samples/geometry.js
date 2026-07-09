import { axisAngleToQuaternion } from "./helpers.js";

export function createGeometrySamples( { BodyType } )
{
	return [
		{
			key: "convex-hull",
			label: "Geometry / Convex Hull",
			description: "Generate a convex hull from a set of random points. Adjust the number of points and click 'Randomize' to generate new physical hulls on the fly.",
			create( ctx )
			{
				let hullBody = 0;
				let pointCount = 12;

				function generateRandomPoints( count, range )
				{
					const points = [];
					for ( let i = 0; i < count; i += 1 )
					{
						points.push( {
							x: ( Math.random() - 0.5 ) * range.x,
							y: ( Math.random() - 0.5 ) * range.y,
							z: ( Math.random() - 0.5 ) * range.z,
						} );
					}
					return points;
				}

				function spawn()
				{
					if ( hullBody !== 0 )
					{
						ctx.box3d.api.destroyBody( hullBody );
						hullBody = 0;
					}

					const points = generateRandomPoints( pointCount, { x: 1.5, y: 1.5, z: 1.5 } );

					hullBody = ctx.physics.createHullBody( {
						type: BodyType.dynamic,
						position: { x: 0, y: 4.0, z: 0 },
						points,
						density: 1.0,
						friction: 0.3,
						color: 0xe58d44,
					} );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						spawn();

						ctx.setCameraLookAt( { x: 5, y: 4, z: 8 }, { x: 0, y: 1.5, z: 0 } );
					},

					buildUI( panel )
					{
						panel.add( "Points", pointCount, { min: 4, max: 32, step: 1 }, ( val ) =>
						{
							pointCount = val;
						} );

						panel.addButton( "Randomize & Spawn", () =>
						{
							spawn();
						} );
					},
				};
			},
		},
		{
			key: "hollow-box",
			label: "Geometry / Hollow Box",
			description: "A hollow box container mesh loaded with dynamic cylinders and capsules, demonstrating complex inner-shell geometry collisions.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const hollowMesh = ctx.physics.createHollowBoxMesh( {
							center: { x: 0, y: 0, z: 0 },
							extent: { x: 10, y: 10, z: 10 },
						} );
						const groundBody = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );
						ctx.physics.addMeshShape( groundBody, {
							mesh: hollowMesh,
							bodyType: BodyType.static,
							color: 0x75838d,
						} );

						const cylinderPositions = [
							{ x: 0.0, y: -10.2, z: 0.0 }, { x: 0.0, y: 9.2, z: 0.0 }, { x: -9.8, y: 0.0, z: 0.0 },
							{ x: 9.8, y: 0.0, z: 0.0 }, { x: 0.0, y: 0.0, z: -9.8 }, { x: 0.0, y: 0.0, z: 9.8 },
						];
						for ( const pos of cylinderPositions )
						{
							ctx.physics.createCylinderBody( {
								type: BodyType.dynamic,
								position: pos,
								cylinder: { height: 1.0, radius: 0.25, yOffset: 0.0, sides: 8 },
								density: 1.0,
								color: 0xd98848,
								gravityScale: 0.0,
							} );
						}

						const capsulePositions = [
							{ x: 0.0, y: -10.2, z: 2.0 }, { x: 0.0, y: 9.2, z: 2.0 }, 
							{ x: 0.0, y: -9.9, z: 4.0 }, { x: 0.0, y: 8.9, z: 4.0 }, 
							{ x: -9.8, y: 2.0, z: 0.0 },
							{ x: 9.8, y: 2.0, z: 0.0 }, { x: 0.0, y: 2.0, z: -9.8 }, { x: 0.0, y: 2.0, z: 9.8 },
						];
						for ( const pos of capsulePositions )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: pos,
								capsule: {
									center1: { x: 0, y: 0, z: 0 },
									center2: { x: 0, y: 1.0, z: 0 },
									radius: 0.25,
								},
								density: 1.0,
								color: 0x1e90ff,
								gravityScale: 0.0,
							} );
						}

						ctx.setCameraLookAt( { x: 25, y: 15, z: 30 }, { x: 0, y: 0, z: 0 } );
					},
				};
			},
		},
	];
}
