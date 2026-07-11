import { Human, BoneId } from "./human.js";
import { axisAngleToQuaternion } from "./helpers.js";

export function createBenchmarkSamples( { BodyType } )
{
	function rotateAroundZ( vector, angle )
	{
		const cosine = Math.cos( angle );
		const sine = Math.sin( angle );
		return {
			x: cosine * vector.x - sine * vector.y,
			y: sine * vector.x + cosine * vector.y,
			z: vector.z,
		};
	}

	function mulAddVec3( a, scale, b )
	{
		return {
			x: a.x + scale * b.x,
			y: a.y + scale * b.y,
			z: a.z + scale * b.z,
		};
	}

	function createRockPoints( radius, random )
	{
		const points = [];
		for ( let index = 0; index < 12; index += 1 )
		{
			const theta = 2 * Math.PI * random();
			const phi = Math.acos( 2 * random() - 1 );
			const r = radius * ( 0.65 + 0.35 * random() );
			points.push( {
				x: r * Math.sin( phi ) * Math.cos( theta ),
				y: r * Math.cos( phi ),
				z: r * Math.sin( phi ) * Math.sin( theta ),
			} );
		}
		return points;
	}

	function createWasherHullParts()
	{
		const hulls = [];
		const r0 = 14.0;
		const r1 = 16.0;
		const r2 = 18.0;
		const nearDepth = { x: 0, y: 0, z: -10.0 };
		const farDepth = { x: 0, y: 0, z: 10.0 };
		const angle = Math.PI / 18.0;
		const offsetAngle = 0.1 * angle;
		let u1 = { x: 1, y: 0, z: 0 };

		for ( let index = 0; index < 36; index += 1 )
		{
			const u2 = index === 35 ? { x: 1, y: 0, z: 0 } : rotateAroundZ( u1, angle );
			const a1 = rotateAroundZ( u1, -offsetAngle );
			const a2 = rotateAroundZ( u2, offsetAngle );

			hulls.push( {
				points: [
					mulAddVec3( nearDepth, r1, a1 ),
					mulAddVec3( nearDepth, r2, a1 ),
					mulAddVec3( nearDepth, r1, a2 ),
					mulAddVec3( nearDepth, r2, a2 ),
					mulAddVec3( farDepth, r1, a1 ),
					mulAddVec3( farDepth, r2, a1 ),
					mulAddVec3( farDepth, r1, a2 ),
					mulAddVec3( farDepth, r2, a2 ),
				],
				density: 1.0,
				color: 0x7c8791,
				roughness: 0.82,
				metalness: 0.05,
			} );

			if ( index % 9 === 0 )
			{
				hulls.push( {
					points: [
						mulAddVec3( nearDepth, r0, u1 ),
						mulAddVec3( nearDepth, r1, u1 ),
						mulAddVec3( nearDepth, r0, u2 ),
						mulAddVec3( nearDepth, r1, u2 ),
						mulAddVec3( farDepth, r0, u1 ),
						mulAddVec3( farDepth, r1, u1 ),
						mulAddVec3( farDepth, r0, u2 ),
						mulAddVec3( farDepth, r1, u2 ),
					],
					density: 1.0,
					color: 0x7c8791,
					roughness: 0.82,
					metalness: 0.05,
				} );
			}

			u1 = u2;
		}

		return hulls;
	}

	function lerpVec3( a, b, t )
	{
		return {
			x: a.x + ( b.x - a.x ) * t,
			y: a.y + ( b.y - a.y ) * t,
			z: a.z + ( b.z - a.z ) * t,
		};
	}

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
			sceneOptions: { showGround: true, showGrid: true },
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
			sceneOptions: { showGround: true, showGrid: true },
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
			sceneOptions: { showGround: true, showGrid: true },
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
						ctx.box3d.api.createBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.jointGrid );
						ctx.physics.importNativeWorldBodies();
						ctx.setCameraLookAt( { x: -25, y: 25, z: 94 }, { x: 30, y: -30, z: 30 } );
					},

					getStatusLines()
					{
						return [
							"native helper: joint grid",
							`bodies: ${ctx.physics.getBodyCount()}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
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
						panel.add( "Magnitude", impulse, { min: 0, max: 2000, step: 10 }, ( val ) => { impulse = val; } );
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
			key: "chains",
			label: "Benchmark / Chains",
			description: "A dense field of short capsule chains over a wave mesh. This stresses spherical joints, sleeping behavior, and the aerodynamic wind path across many articulated bodies.",
			create( ctx )
			{
				let noise = { x: 0, y: 0, z: 0 };
				const terminalBodies = [];
				const gridCount = 25;

				return {
					reset()
					{
						noise = { x: 0, y: 0, z: 0 };
						terminalBodies.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const groundBody = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );
						const waveMesh = ctx.physics.createWaveMesh( {
							xCount: 80,
							zCount: 80,
							cellWidth: 1,
							amplitude: 0.5,
							rowFrequency: 0.05,
							columnFrequency: 0.01,
						} );
						ctx.physics.addMeshShape( groundBody, {
							mesh: waveMesh,
							bodyType: BodyType.static,
							color: 0x72818c,
						} );

						const linkRadius = 0.125;
						const linkExtent = 0.25;
						const linkCount = 4;
						let x = -gridCount;
						for ( let rowIndex = 0; rowIndex < gridCount; rowIndex += 1 )
						{
							let z = -gridCount;
							for ( let columnIndex = 0; columnIndex < gridCount; columnIndex += 1 )
							{
								let previousBody = 0;
								for ( let linkIndex = 0; linkIndex < linkCount; linkIndex += 1 )
								{
									const bodyHandle = ctx.physics.createCapsuleBody( {
										type: linkIndex === 0 ? BodyType.static : BodyType.dynamic,
										position: { x, y: ( 1 - 2 * linkIndex ) * linkExtent + 3, z },
										capsule: {
											center1: { x: 0, y: -linkExtent, z: 0 },
											center2: { x: 0, y: linkExtent, z: 0 },
											radius: linkRadius,
										},
										enableSleep: false,
										color: linkIndex === 0 ? 0x75838d : 0x79c85d,
									} );

									if ( previousBody !== 0 )
									{
										ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
											bodyA: previousBody,
											bodyB: bodyHandle,
											localFrameA: { p: { x: 0, y: -linkExtent, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
											localFrameB: { p: { x: 0, y: linkExtent, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
											enableSpring: true,
											hertz: 1,
											dampingRatio: 0.7,
											enableMotor: true,
											maxMotorTorque: 1,
										} );
									}

									previousBody = bodyHandle;
									if ( linkIndex === linkCount - 1 )
									{
										terminalBodies.push( bodyHandle );
									}
								}

								z += 2;
							}

							x += 2;
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 50 }, { x: 0, y: 5, z: 0 } );
					},

					update()
					{
						const baseWind = { x: 20, y: 0, z: 0 };
						const speed = Math.hypot( baseWind.x, baseWind.y, baseWind.z );
						const direction = { x: baseWind.x / speed, y: 0, z: 0 };
						const wind = {
							x: speed * ( direction.x + noise.x ),
							y: speed * ( direction.y + noise.y ),
							z: speed * ( direction.z + noise.z ),
						};

						for ( const bodyHandle of terminalBodies )
						{
							ctx.physics.applyBodyWind( bodyHandle, wind, 1, 1, 20, false );
						}

						noise = lerpVec3(
							noise,
							{
								x: sampleRange( Math.random, -0.3, 0.3 ),
								y: sampleRange( Math.random, -0.3, 0.3 ),
								z: sampleRange( Math.random, -0.3, 0.3 ),
							},
							0.05
						);
					},

					getStatusLines()
					{
						return [
							`chains: ${terminalBodies.length}`,
							`winded endpoints: ${terminalBodies.length}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "destruction",
			label: "Benchmark / Destruction",
			description: "A respawning cube cloud over a grid mesh, immediately hit by a radial explosion. This is a strong browser stress test because it repeatedly exercises body creation, destruction, and broadphase rebuilds.",
			create( ctx )
			{
				const small = false;
				const gridCount = small ? 6 : 20;
				const extent = small ? 0.75 : 2.5;
				const randomRange = small ? 3 : 2;
				let bodyHandles = [];
				let spawnMilliseconds = 0;
				let destroyMilliseconds = 0;

				function destroyBodies()
				{
					const startMs = performance.now();
					for ( const bodyHandle of bodyHandles )
					{
						ctx.physics.destroyBody( bodyHandle );
					}
					bodyHandles = [];
					destroyMilliseconds = performance.now() - startMs;
				}

				function spawn()
				{
					const startMs = performance.now();
					const a = extent / gridCount;
					bodyHandles = [];

					for ( let i = 0; i < gridCount; i += 1 )
					{
						for ( let j = 0; j < gridCount; j += 1 )
						{
							for ( let k = 0; k < gridCount; k += 1 )
							{
								if ( Math.floor( Math.random() * randomRange ) === 0 )
								{
									continue;
								}

								bodyHandles.push( ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: {
										x: ( 2 * i - gridCount + 1 ) * a,
										y: ( 2 * j + 1 ) * a,
										z: ( 2 * k - gridCount + 1 ) * a,
									},
									size: { hx: 0.8 * a, hy: 0.8 * a, hz: 0.8 * a },
									color: 0xd98a45,
								} ) );
							}
						}
					}

					ctx.box3d.api.explodeWorld( ctx.physics.worldHandle, {
						position: { x: 0, y: 2 * extent, z: 0 },
						radius: extent,
						falloff: 0.5 * extent,
						impulsePerArea: small ? 200 : 1000,
					} );

					spawnMilliseconds = performance.now() - startMs;
				}

				return {
					reset()
					{
						bodyHandles = [];
						spawnMilliseconds = 0;
						destroyMilliseconds = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const gridMesh = ctx.physics.createGridMesh( {
							xCount: 40,
							zCount: 40,
							cellWidth: 1,
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

						spawn();
						ctx.setCameraLookAt( { x: 0, y: 40, z: 30 }, { x: 0, y: 0, z: 0 } );
					},

					update( _dt, elapsed )
					{
						const spawnStepSeconds = small ? 80 / 60 : 140 / 60;
						if ( elapsed > 0 && Math.floor( elapsed / spawnStepSeconds ) !== Math.floor( ( elapsed - 1 / 60 ) / spawnStepSeconds ) )
						{
							destroyBodies();
							spawn();
						}

						ctx.physics.addDebugPoint( { x: 0, y: 2 * extent, z: 0 }, 0x61d7e8 );
					},

					getStatusLines()
					{
						return [
							`bodies: ${bodyHandles.length}`,
							`spawn: ${spawnMilliseconds.toFixed( 2 )} ms`,
							`destroy: ${destroyMilliseconds.toFixed( 2 )} ms`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},

					dispose()
					{
						destroyBodies();
					},
				};
			},
		},
		{
			key: "height-field",
			label: "Benchmark / Height Field",
			description: "Casts a dense grid of rays or swept spheres against a wave terrain every frame. This is a strong browser regression for world-query throughput and hit stability.",
			create( ctx )
			{
				let radius = 0.1;
				const columnCount = 50;
				const rowCount = 50;

				function castShapeClosest( origin, translation )
				{
					return ctx.physics.worldCastShapeClosest( {
						origin,
						translation,
						points: [ { x: 0, y: 0, z: 0 } ],
						radius,
					} );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const mesh = ctx.physics.createWaveMesh( {
							xCount: columnCount,
							zCount: rowCount,
							cellWidth: 1,
							amplitude: 1,
							rowFrequency: 0.02,
							columnFrequency: 0.04,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: -0.5 * columnCount, y: 0, z: -0.5 * rowCount },
							mesh,
							color: 0x72818c,
						} );
						ctx.setCameraLookAt( { x: 0, y: 20, z: 50 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						const delta = 1.0;
						const spanX = 0.94 * 0.5 * columnCount;
						const spanZ = 0.96 * 0.5 * rowCount;
						const rayTranslation = { x: 80000, y: -80000, z: 8 };

						let hitCount = 0;
						let castCount = 0;
						const startMs = performance.now();

						for ( let x = -spanX; x <= spanX; x += delta )
						{
							for ( let z = -spanZ; z <= spanZ; z += delta )
							{
								const origin = { x, y: 2, z };
								const result = radius === 0
									? ctx.physics.worldCastRayClosest( { origin, translation: rayTranslation } )
									: castShapeClosest( origin, rayTranslation );

								castCount += 1;
								if ( result.hit )
								{
									hitCount += 1;
									ctx.physics.addDebugPoint( result.point, 0x7ee07a );
									ctx.physics.addDebugLine(
										result.point,
										{
											x: result.point.x + 0.35 * result.normal.x,
											y: result.point.y + 0.35 * result.normal.y,
											z: result.point.z + 0.35 * result.normal.z,
										},
										0x7ee07a
									);
								}
							}
						}

						this.lastCastCount = castCount;
						this.lastHitCount = hitCount;
						this.lastCastMilliseconds = performance.now() - startMs;
					},

					buildUI( panel )
					{
						panel.add( "Radius", radius, { min: 0, max: 1, step: 0.05 }, ( value ) =>
						{
							radius = value;
						} );
					},

					getStatusLines()
					{
						const castCount = this.lastCastCount ?? 0;
						const castMilliseconds = this.lastCastMilliseconds ?? 0;
						return [
							`radius: ${radius.toFixed( 2 )}`,
							`casts: ${castCount}, hits: ${this.lastHitCount ?? 0}`,
							`cast time: ${castMilliseconds.toFixed( 2 )} ms`,
							castCount > 0 ? `avg: ${( 1000 * castMilliseconds / castCount ).toFixed( 3 )} us` : "avg: 0.000 us",
						];
					},
				};
			},
		},
		{
			key: "hull",
			label: "Benchmark / Hull",
			description: "Measures native convex-hull creation versus clone+transform cost while showing the source and mirrored hull side by side.",
			sceneOptions: { showGround: false, showGrid: false },
			create( ctx )
			{
				const random = createSeededRandom( 42 );
				const points = [];
				const scale = { x: -1, y: 1, z: 1 };
				let baseHullHandle = 0;

				for ( let i = 0; i < 64; i += 1 )
				{
					points.push( {
						x: sampleRange( random, -1, 1 ),
						y: sampleRange( random, -1, 1 ),
						z: sampleRange( random, -1, 1 ),
					} );
				}

				function destroyBaseHull()
				{
					if ( baseHullHandle !== 0 )
					{
						ctx.box3d.api.destroyHullData( baseHullHandle );
						baseHullHandle = 0;
					}
				}

				return {
					reset()
					{
						destroyBaseHull();
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: -2, y: 0, z: 0 },
							points,
							color: 0x67bb5f,
						} );
						ctx.physics.createHullBody( {
							type: BodyType.static,
							position: { x: 2, y: 0, z: 0 },
							points,
							scale,
							color: 0xd8c25b,
						} );
						baseHullHandle = ctx.box3d.api.createHullData( { points, maxVertexCount: points.length } );
						ctx.setCameraLookAt( { x: 0, y: 15, z: 5 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						const trials = 2000;
						let area = 0;
						let scaledArea = 0;

						let startMs = performance.now();
						for ( let i = 0; i < trials; i += 1 )
						{
							const handle = ctx.box3d.api.createHullData( { points, maxVertexCount: points.length } );
							area += ctx.box3d.api.getHullSurfaceArea( handle );
							ctx.box3d.api.destroyHullData( handle );
						}
						this.createMilliseconds = performance.now() - startMs;

						startMs = performance.now();
						for ( let i = 0; i < trials; i += 1 )
						{
							const handle = ctx.box3d.api.cloneAndTransformHullData( baseHullHandle, { scale } );
							scaledArea += ctx.box3d.api.getHullSurfaceArea( handle );
							ctx.box3d.api.destroyHullData( handle );
						}
						this.cloneMilliseconds = performance.now() - startMs;
						this.trials = trials;
						this.area = area / trials;
						this.scaledArea = scaledArea / trials;
					},

					getStatusLines()
					{
						const trials = this.trials ?? 0;
						const createMilliseconds = this.createMilliseconds ?? 0;
						const cloneMilliseconds = this.cloneMilliseconds ?? 0;
						const ratio = cloneMilliseconds > 0 ? createMilliseconds / cloneMilliseconds : 0;
						return [
							`trials: ${trials}`,
							`create: ${trials > 0 ? ( 1000 * createMilliseconds / trials ).toFixed( 2 ) : "0.00"} us, area: ${( this.area ?? 0 ).toFixed( 2 )}`,
							`clone: ${trials > 0 ? ( 1000 * cloneMilliseconds / trials ).toFixed( 2 ) : "0.00"} us, area: ${( this.scaledArea ?? 0 ).toFixed( 2 )}`,
							`create / clone: ${ratio.toFixed( 2 )}`,
						];
					},

					dispose()
					{
						destroyBaseHull();
					},
				};
			},
		},
		{
			key: "sensor",
			label: "Benchmark / Sensor",
			description: "A faithful port of the native sensor benchmark. Rows of passive sensors tint falling visitors, one active sensor destroys them, and a custom filter suppresses one row to exercise the world filter callback path.",
			create( ctx )
			{
				const activeFlag = 1 << 24;
				const passiveFlag = 2 << 24;
				const columnCount = 40;
				const rowCount = 40;
				const passiveSensorBodies = new Set();
				const activeSensorBodies = new Set();
				const highlightedBodies = new Set();
				let filterRow = rowCount >> 1;
				let maxBeginCount = 0;
				let maxEndCount = 0;
				let stepCount = 0;

				function encodeSensorData( active, row )
				{
					return ( active ? activeFlag : passiveFlag ) | ( row & 0xffff );
				}

				function createRow( y )
				{
					const shift = 5.0;
					const xCenter = 0.5 * shift * columnCount;
					for ( let i = 0; i < columnCount; i += 1 )
					{
						const yOffset = sampleRange( Math.random, -1.0, 1.0 );
						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: shift * i - xCenter, y: y + yOffset, z: 0 },
							linearVelocity: { x: 0, y: -5, z: 0 },
							gravityScale: 0,
							radius: 0.5,
							enableSensorEvents: true,
							color: 0xd67c42,
						} );
					}
				}

				return {
					reset()
					{
						passiveSensorBodies.clear();
						activeSensorBodies.clear();
						highlightedBodies.clear();
						maxBeginCount = 0;
						maxEndCount = 0;
						stepCount = 0;
						filterRow = rowCount >> 1;

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.setWorldCustomFilterCallback( ( event ) =>
						{
							const sensorData = event.isSensorA ? event.userDataA : event.isSensorB ? event.userDataB : 0;
							if ( sensorData === 0 )
							{
								return true;
							}

							const type = sensorData >>> 24;
							if ( type === 1 )
							{
								return true;
							}

							const row = sensorData & 0xffff;
							return row !== filterRow;
						} );

						{
							const gridSize = 3.0;
							const xStart = -40.0 * gridSize;
							for ( let i = 0; i < 81; i += 1 )
							{
								const bodyHandle = ctx.physics.createBoxBody( {
									type: BodyType.static,
									position: { x: xStart + gridSize * i, y: 0, z: 0 },
									size: { hx: 0.48 * gridSize, hy: 0.48 * gridSize, hz: 0.48 * gridSize },
									isSensor: true,
									enableSensorEvents: true,
									userData: encodeSensorData( true, 0 ),
									color: 0x505050,
									metalness: 0.15,
									roughness: 0.55,
								} );
								activeSensorBodies.add( bodyHandle );
							}
						}

						{
							const shift = 5.0;
							const xCenter = 0.5 * shift * columnCount;
							const yStart = 10.0;
							for ( let row = 0; row < rowCount; row += 1 )
							{
								const y = row * shift + yStart;
								for ( let i = 0; i < columnCount; i += 1 )
								{
									const bodyHandle = ctx.physics.createBoxBody( {
										type: BodyType.static,
										position: { x: i * shift - xCenter, y, z: 0 },
										size: { hx: 0.5, hy: 0.5, hz: 0.5 },
										isSensor: true,
										enableSensorEvents: true,
										enableCustomFiltering: row === filterRow,
										userData: encodeSensorData( false, row ),
										color: row === filterRow ? 0xff00ff : 0x808080,
									} );
									passiveSensorBodies.add( bodyHandle );
								}
							}
						}

						ctx.setCameraLookAt( { x: 0, y: 0, z: 250 }, { x: 0, y: 110, z: 0 } );
					},

					update()
					{
						for ( const event of ctx.physics.getSensorBeginEvents() )
						{
							if ( activeSensorBodies.has( event.sensorBody ) )
							{
								ctx.physics.destroyBody( event.visitorBody );
								highlightedBodies.delete( event.visitorBody );
							}
							else if ( passiveSensorBodies.has( event.sensorBody ) )
							{
								ctx.physics.setBodyColor( event.visitorBody, 0x7cff67 );
								highlightedBodies.add( event.visitorBody );
							}
						}

						for ( const event of ctx.physics.getSensorEndEvents() )
						{
							if ( highlightedBodies.has( event.visitorBody ) )
							{
								ctx.physics.setBodyColor( event.visitorBody, 0xd67c42 );
								highlightedBodies.delete( event.visitorBody );
							}
						}

						if ( ( stepCount & 0x1f ) === 0 )
						{
							createRow( 10.0 + rowCount * 5.0 );
						}

						const beginCount = ctx.physics.getSensorBeginEvents().length;
						const endCount = ctx.physics.getSensorEndEvents().length;
						maxBeginCount = Math.max( maxBeginCount, beginCount );
						maxEndCount = Math.max( maxEndCount, endCount );
						stepCount += 1;
					},

					getStatusLines()
					{
						return [
							`max begin touch events: ${maxBeginCount}`,
							`max end touch events: ${maxEndCount}`,
							`filtered row: ${filterRow}`,
							`highlighted visitors: ${highlightedBodies.size}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},

					dispose()
					{
						ctx.physics.setWorldCustomFilterCallback( null );
					},
				};
			},
		},
		{
			key: "falling-trees",
			label: "Benchmark / Falling Trees",
			description: "An exact native-helper port of the falling-trees benchmark. The wasm helper builds the wave mesh terrain and the stacked hull trees exactly like the C sample, then the browser imports the native bodies for rendering.",
			sceneOptions: { showGround: false, showGrid: false },
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.api.createBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.trees100 );
						ctx.physics.importNativeWorldBodies();
						ctx.setCameraLookAt( { x: 20, y: 0, z: 140 }, { x: 0, y: 15, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"native helper: falling trees",
							`bodies: ${ctx.physics.getBodyCount()}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "washer",
			label: "Benchmark / Washer",
			sceneOptions: { showGround: false, showGrid: false },
			description: "An exact native-helper port of the washer benchmark. The wasm helper builds the same kinematic drum and dense cube stack as the C sample, then the browser imports the created bodies for rendering.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.api.createBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.washer );
						ctx.physics.importNativeWorldBodies();
						ctx.setCameraLookAt( { x: 15, y: 20, z: 60 }, { x: 0, y: 15, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"kinematic washer spinning at 25 deg/s",
							`bodies: ${ctx.physics.getBodyCount()}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "large-world",
			label: "Benchmark / Large World",
			sceneOptions: { showGround: false, showGrid: false },
			description: "An exact native-helper port of the large-world benchmark. The wasm helper owns the enormous static floor field and staggered sphere drops; the browser renders only a lightweight floor proxy plus the tracked dynamic spheres so the benchmark remains practical on the web.",
			create( ctx )
			{
				let stepCount = 0;
				const floorCellSize = 10;
				const floorGridCount = 1000;
				const floorHalfSpan = 0.5 * floorCellSize * floorGridCount;

				return {
					reset()
					{
						stepCount = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.api.createBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.largeWorld );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.25, z: 0 },
							size: { hx: floorHalfSpan, hy: 0.25, hz: floorHalfSpan },
							color: 0x6e7b84,
							roughness: 0.96,
						} );
						ctx.setCameraLookAt( { x: 0, y: 10, z: 250 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						ctx.box3d.api.stepBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.largeWorld, stepCount );
						ctx.physics.importNativeWorldBodies();
						stepCount += 1;
					},

					getStatusLines()
					{
						return [
							`native helper: large world`,
							`steps: ${stepCount}`,
							`rendered dynamic drops: ${Math.max( 0, ctx.physics.getBodyCount() - 1 )}`,
						];
					},
				};
			},
		},
		{
			key: "junkyard",
			label: "Benchmark / Junkyard",
			sceneOptions: { showGround: false, showGrid: false },
			description: "An exact native-helper port of the junkyard benchmark. The wasm helper builds the full pile and moving pusher, while the browser imports those native bodies for rendering.",
			create( ctx )
			{
				let stepCount = 0;

				return {
					reset()
					{
						stepCount = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.box3d.api.createBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.junkyard );
						ctx.physics.importNativeWorldBodies();
						ctx.setCameraLookAt( { x: 45, y: 30, z: 125 }, { x: 0, y: 18, z: 0 } );
					},

					update()
					{
						ctx.box3d.api.stepBenchmarkHelper( ctx.physics.worldHandle, ctx.box3d.BenchmarkHelper.junkyard, stepCount );
						ctx.physics.importNativeWorldBodies();
						stepCount += 1;
					},

					getStatusLines()
					{
						return [
							`native helper: junkyard`,
							`steps: ${stepCount}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
