import { Human, BoneId } from "./human.js";
import { axisAngleToQuaternion } from "./helpers.js";

export function createBenchmarkSamples( { BodyType } )
{
	function createSeededRandom( seed )
	{
		let state = seed >>> 0;
		return () =>
		{
			state = ( Math.imul( state, 1664525 ) + 1013904223 ) >>> 0;
			return state / 0x100000000;
		};
	}

	function sampleRange( random, min, max )
	{
		return min + ( max - min ) * random();
	}

	return [
		{
			key: "large-pyramid",
			label: "Benchmark / Large Pyramid",
			description: "A massive pyramid made of box bodies. Tests static-to-dynamic contact creation, contact resolution, and stacking stability.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.raw.b3World_EnableSleeping( ctx.physics.worldHandle, false );

						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 400, hy: 1, hz: 400 }
						} );

						const baseCount = 80;
						const h = 0.5;
						const shift = 1.0 * h;

						for ( let i = 0; i < baseCount; ++i )
						{
							const y = ( 2.0 * i + 1.0 ) * shift;
							for ( let j = i; j < baseCount; ++j )
							{
								const x = ( i + 1.0 ) * shift + 2.0 * ( j - i ) * shift - h * baseCount;
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x, y, z: 0 },
									size: { hx: h, hy: h, hz: h },
									density: 100,
									color: 0xe58d44,
								} );
							}
						}

						ctx.setCameraLookAt( { x: 40, y: -10, z: 110 }, { x: 0, y: 40, z: 0 } );
					},
				};
			},
		},
		{
			key: "wide-pyramid",
			label: "Benchmark / Wide Pyramid",
			description: "A wide pyramid structure, exercising contact updates and stacking solvers.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 100, hy: 1, hz: 100 }
						} );

						const boxSize = 2.0;
						const boxSeparation = 0.5;
						const halfBoxSize = 0.5 * boxSize;
						const pyramidHeight = 15;
						const h = halfBoxSize - 0.025;

						for ( let i = 0; i < pyramidHeight; ++i )
						{
							for ( let j = Math.floor( i / 2 ); j < pyramidHeight - Math.floor( ( i + 1 ) / 2 ); ++j )
							{
								for ( let k = Math.floor( i / 2 ); k < pyramidHeight - Math.floor( ( i + 1 ) / 2 ); ++k )
								{
									const x = -pyramidHeight + boxSize * j + ( ( i & 1 ) ? halfBoxSize : 0.0 );
									const y = 1.0 + ( boxSize + boxSeparation ) * i;
									const z = -pyramidHeight + boxSize * k + ( ( i & 1 ) ? halfBoxSize : 0.0 );

									ctx.physics.createBoxBody( {
										type: BodyType.dynamic,
										position: { x, y, z },
										size: { hx: h, hy: h, hz: h },
										color: 0x5a9eb4,
									} );
								}
							}
						}

						ctx.setCameraLookAt( { x: 0, y: 5, z: 80 }, { x: 0, y: 18, z: 0 } );
					},
				};
			},
		},
		{
			key: "many-pyramids",
			label: "Benchmark / Many Pyramids",
			description: "A massive field of small pyramids to stress-test collision detection and multiple islands.",
			create( ctx )
			{
				function createSmallPyramid( baseCount, extent, centerX, baseZ )
				{
					for ( let i = 0; i < baseCount; ++i )
					{
						const y = ( 2.0 * i + 1.0 ) * extent;
						for ( let j = i; j < baseCount; ++j )
						{
							const x = ( i + 1.0 ) * extent + 2.0 * ( j - i ) * extent + centerX - 0.5;
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x, y, z: baseZ },
								size: { hx: extent, hy: extent, hz: extent },
								density: 100,
								color: 0xb35fa5,
							} );
						}
					}
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const baseCount = 10;
						const extent = 0.5;
						const rowCount = 14;
						const columnCount = 14;
						const groundExtent = extent * columnCount * ( baseCount + 1.0 );

						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: groundExtent, hy: 1, hz: groundExtent }
						} );

						const baseWidth = 2.0 * extent * baseCount;
						let baseZ = -groundExtent + 2.0 * extent;
						const deltaZ = 2.0 * ( groundExtent - 2.0 * extent ) / ( rowCount - 1.0 );

						for ( let i = 0; i < rowCount; ++i )
						{
							for ( let j = 0; j < columnCount; ++j )
							{
								const centerX = -groundExtent + j * ( baseWidth + 2.0 * extent ) + 2.0 * extent;
								createSmallPyramid( baseCount, extent, centerX, baseZ );
							}
							baseZ += deltaZ;
						}

						ctx.setCameraLookAt( { x: -10, y: 10, z: 120 }, { x: 0, y: 5, z: 0 } );
					},
				};
			},
		},
		{
			key: "joint-grid",
			label: "Benchmark / Joint Grid",
			description: "A large grid of spheres suspended by spherical joints, stressing the constraint solver graph.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.raw.b3World_EnableSleeping( ctx.physics.worldHandle, false );

						const n = 100;
						const bodies = [];

						for ( let k = 0; k < n; ++k )
						{
							for ( let i = 0; i < n; ++i )
							{
								const bodyType = ( i === 0 ) ? BodyType.static : BodyType.dynamic;
								const bodyHandle = ctx.physics.createSphereBody( {
									type: bodyType,
									position: { x: k, y: -i, z: 0 },
									radius: 0.4,
									color: ( i === 0 ) ? 0x75838d : 0x76c94c,
								} );

								if ( i > 0 )
								{
									ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
										bodyA: bodies[bodies.length - 1],
										bodyB: bodyHandle,
										localFrameA: { p: { x: 0.0, y: -0.5, z: 0.0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
										localFrameB: { p: { x: 0.0, y: 0.5, z: 0.0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
									} );
								}

								if ( k > 0 )
								{
									ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
										bodyA: bodies[bodies.length - n],
										bodyB: bodyHandle,
										localFrameA: { p: { x: 0.5, y: 0.0, z: 0.0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
										localFrameB: { p: { x: -0.5, y: 0.0, z: 0.0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
									} );
								}

								bodies.push( bodyHandle );
							}
						}

						ctx.setCameraLookAt( { x: -25, y: 25, z: 94 }, { x: 30, y: -30, z: 30 } );
					},
				};
			},
		},
		{
			key: "falling-boxes",
			label: "Benchmark / Falling Boxes",
			description: "A classic dense drop test of thousands of boxes on a flat ground.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.5, z: 0 },
							size: { hx: 100, hy: 0.5, hz: 100 }
						} );

						const n = 50;
						const a = 0.5;

						for ( let i = 0; i < n; ++i )
						{
							for ( let j = 0; j < 8; ++j )
							{
								for ( let k = 0; k < 8; ++k )
								{
									ctx.physics.createBoxBody( {
										type: BodyType.dynamic,
										position: {
											x: -16.0 * a + 4.0 * a * j,
											y: 4.0 * a * i + 5.0 * a,
											z: -16.0 * a + 4.0 * a * k,
										},
										size: { hx: a, hy: a, hz: a },
										color: 0xda6f3c,
									} );
								}
							}
						}

						ctx.setCameraLookAt( { x: 45, y: 10, z: 80 }, { x: 0, y: 20, z: 0 } );
					},
				};
			},
		},
		{
			key: "candy-cups",
			label: "Benchmark / Candy Cups",
			description: "Generates custom convex hulls (candy cup shape) and drops them. Tests custom hull collision.",
			create( ctx )
			{
				function createConvexPoints( radius1, height1, radius2, height2 )
				{
					const sideCount = 8;
					const deltaAlpha = 2.0 * Math.PI / sideCount;
					const points = [];

					for ( let sideIndex = 0; sideIndex < sideCount; ++sideIndex )
					{
						const alpha = sideIndex * deltaAlpha;
						const cos = Math.cos( alpha );
						const sin = Math.sin( alpha );

						points.push( { x: radius1 * cos, y: height1, z: radius1 * sin } );
						points.push( { x: radius2 * cos, y: height2, z: radius2 * sin } );
					}
					return points;
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.5, z: 0 },
							size: { hx: 60, hy: 0.5, hz: 60 }
						} );

						const n = 16;
						const m = 16;
						const points = createConvexPoints( 0.6, 0.0, 0.95, 1.0 );

						for ( let i = 0; i < n; ++i )
						{
							for ( let j = 0; j < m; ++j )
							{
								for ( let k = 0; k < m; ++k )
								{
									ctx.physics.createHullBody( {
										type: BodyType.dynamic,
										position: {
											x: -10.0 + 2.5 * j,
											y: 1.0 * i,
											z: -10.0 + 2.5 * k,
										},
										points,
										color: 0xcd62a8,
									} );
								}
							}
						}

						ctx.setCameraLookAt( { x: 45, y: 20, z: 70 }, { x: 0, y: 0, z: 0 } );
					},
				};
			},
		},
		{
			key: "explosion",
			label: "Benchmark / Explosion",
			description: "A cylinder grid on a wave mesh that can be exploded outwards with an impulse.",
			create( ctx )
			{
				let impulse = 1000.0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const gridMesh = ctx.physics.createWaveMesh( {
							xCount: 40,
							zCount: 40,
							cellWidth: 1.0,
							amplitude: 0.0,
						} );

						const groundBody = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );

						ctx.physics.addMeshShape( groundBody, {
							mesh: gridMesh,
							bodyType: BodyType.static,
							color: 0x75838d,
						} );

						// Walls
						const hy = 1.0;
						ctx.physics.addBoxShape( groundBody, {
							size: { hx: 20, hy, hz: 0.1 },
							localPosition: { x: 0, y: hy, z: -20 },
							color: 0x75838d,
						} );
						ctx.physics.addBoxShape( groundBody, {
							size: { hx: 20, hy, hz: 0.1 },
							localPosition: { x: 0, y: hy, z: 20 },
							color: 0x75838d,
						} );
						ctx.physics.addBoxShape( groundBody, {
							size: { hx: 0.1, hy, hz: 20 },
							localPosition: { x: -20, y: hy, z: 0 },
							color: 0x75838d,
						} );
						ctx.physics.addBoxShape( groundBody, {
							size: { hx: 0.1, hy, hz: 20 },
							localPosition: { x: 20, y: hy, z: 0 },
							color: 0x75838d,
						} );

						// Cylinders
						const n = 16;
						for ( let i = -n; i <= n; ++i )
						{
							for ( let k = -n; k <= n; ++k )
							{
								ctx.physics.createCylinderBody( {
									type: BodyType.dynamic,
									position: { x: 1.0 * i, y: 0, z: 1.0 * k },
									cylinder: { height: 0.2, radius: 0.5, yOffset: 0.0, sides: 15 },
									color: 0xd6cd5c,
								} );
							}
						}

						ctx.setCameraLookAt( { x: 45, y: 20, z: 30 }, { x: 0, y: 0, z: 0 } );
					},

					explode()
					{
						ctx.box3d.api.explodeWorld( ctx.physics.worldHandle, {
							position: { x: 0.0, y: -4.0, z: 0.0 },
							radius: 16.0,
							impulsePerArea: impulse,
						} );
					},

					buildUI( panel )
					{
						panel.add( "Magnitude", impulse, { min: 0, max: 2000, step: 100 }, ( val ) => { impulse = val; } );
						panel.addButton( "Explode", () => this.explode() );
					},
				};
			},
		},

		{
			key: "rain",
			label: "Benchmark / Rain",
			description: "Spawns dynamic ragdoll humans falling onto static grid and torus shapes.",
			create( ctx )
			{
				let humans = [];
				let columnCount = 0;
				let columnIndex = 0;
				let stepCount = 0;
				const gridCount = 10;
				const gridSize = 15.0;
				const groupSize = 3;

				function createGroup( rowIndex, colIndex )
				{
					const groupIndex = rowIndex * gridCount + colIndex;
					const span = gridCount * gridSize;
					const groupDistance = span / gridCount;

					let x = -0.5 * span + groupDistance * ( colIndex + 0.5 );
					const y = 20.0;
					const z = -0.5 * span + groupDistance * ( rowIndex + 0.5 );

					for ( let i = 0; i < groupSize; i += 1 )
					{
						const human = new Human();
						human.spawn( ctx, { x, y, z }, 5.0, 1.0, 0.7, groupIndex, false );
						humans.push( human );
						x += 0.75;
					}
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						humans = [];
						columnCount = 0;
						columnIndex = 0;
						stepCount = 0;

						const halfMeshGridRows = 4;
						const meshGridCellWidth = gridSize / ( 2.0 * halfMeshGridRows );

						const gridMesh = ctx.physics.createGridMesh( {
							xCount: 2 * halfMeshGridRows,
							zCount: 2 * halfMeshGridRows,
							cellWidth: meshGridCellWidth,
						} );

						const torusMesh = ctx.physics.createTorusMesh( {
							radialResolution: 16,
							tubularResolution: 16,
							radius: 0.25 * gridSize,
							thickness: 1.0,
						} );

						const span = gridSize * gridCount;

						for ( let i = 0; i < gridCount; ++i )
						{
							for ( let j = 0; j < gridCount; ++j )
							{
								const body = ctx.physics.createBody( {
									type: BodyType.static,
									position: {
										x: -0.5 * span + 0.5 * gridSize + i * gridSize,
										y: 0.0,
										z: -0.5 * span + 0.5 * gridSize + j * gridSize,
									},
								} );

								ctx.physics.addMeshShape( body, {
									mesh: gridMesh,
									bodyType: BodyType.static,
									color: 0x75838d,
								} );

								ctx.physics.addMeshShape( body, {
									mesh: torusMesh,
									bodyType: BodyType.static,
									color: 0x6e7e8d,
								} );
							}
						}

						ctx.setCameraLookAt( { x: 25, y: 10, z: 70 }, { x: 0, y: 0, z: 0 } );
					},

					update( _dt, _elapsed )
					{
						const delay = 0x2f;
						if ( ( stepCount & delay ) === 0 )
						{
							if ( columnCount < gridCount )
							{
								for ( let i = 0; i < gridCount; i += 1 )
								{
									createGroup( i, columnCount );
								}
								columnCount = Math.min( columnCount + 1, gridCount );
							}
							else
							{
								// Recycle groups
								// In this JS version, to keep it simple, we just keep spawning,
								// or let the old ones settle since broadphase sleep threshold handles it.
								for ( let i = 0; i < gridCount; i += 1 )
								{
									createGroup( i, columnIndex );
								}
								columnIndex += 1;
								if ( columnIndex >= gridCount )
								{
									columnIndex = 0;
								}
							}
						}
						stepCount += 1;
					},

					getStatusLines()
					{
						return [
							`Bodies: ${ctx.physics.getBodyCount()}`,
							`Awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "falling-trees",
			label: "Benchmark / Falling Trees",
			description: "A forest of compound cylinder 'trees' collapsing under gravity onto a wave mesh.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const scale = 1.0;
						const xCount = scale * 150;
						const zCount = scale * 200;
						const cellWidth = 1.0 / scale;

						const waveMesh = ctx.physics.createWaveMesh( {
							xCount,
							zCount,
							cellWidth,
							amplitude: 0.4,
							rowFrequency: 0.05,
							columnFrequency: 0.1,
						} );

						const groundBody = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );

						ctx.physics.addMeshShape( groundBody, {
							mesh: waveMesh,
							bodyType: BodyType.static,
							color: 0x6e8e5d,
						} );

						const bodyCount = 50;

						// Define a tree compound body config
						const hullCount = 22;
						const cylinders = [];
						let y = 1.0;
						let r = 0.75;
						const l = 1.5;

						for ( let i = 0; i < hullCount; ++i )
						{
							const height = l + 2.0 * r;
							cylinders.push( {
								cylinder: { height, radius: r, yOffset: y - r, sides: 6 },
								localPosition: { x: 0, y: 0, z: 0 },
								density: 1.0,
								color: 0x8b5a2b,
							} );
							y += l + 2.0 * r;
							r = 0.95 * r;
						}

						const angularVelocity = -0.5;
						let z = -70.0;

						for ( let bodyIndex = 0; bodyIndex < bodyCount; ++bodyIndex )
						{
							const bodyHandle = ctx.physics.createCompoundBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 1.0, z },
								cylinders,
							} );

							const velocityScale = 0.5 + ( 0.5 * bodyIndex ) / bodyCount;
							const omega = { x: 0, y: 0, z: velocityScale * angularVelocity };

							ctx.physics.box3d.api.setBodyAngularVelocity( bodyHandle, omega );
							// Note: Center of mass is computed natively by box3d when calling createCompoundBody.
							const transform = ctx.physics.getBodyTransform( bodyHandle );
							const v = {
								x: -omega.z * ( transform.position.y - 1.0 ),
								y: omega.z * ( transform.position.x - 0.0 ),
								z: 0,
							};
							ctx.physics.box3d.api.setBodyLinearVelocity( bodyHandle, v );

							z += 3.0;
						}

						ctx.setCameraLookAt( { x: 20, y: 0, z: 140 }, { x: 0, y: 15, z: 0 } );
					},
				};
			},
		},
	];
}
