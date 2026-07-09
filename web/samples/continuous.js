import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createContinuousSamples( { BodyType } )
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

	function createMeshDropSample( config )
	{
		return {
			key: config.key,
			label: config.label,
			description: config.description,
			create( ctx )
			{
				const bodyHandles = [];
				const gridCount = 32;
				const bodyFilter = { categoryBits: 0x2, maskBits: 0x1, groupIndex: 0 };
				const groundFilter = { categoryBits: 0x1, maskBits: -1, groupIndex: 0 };

				return {
					reset()
					{
						bodyHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const groundMesh = ctx.physics.createWaveMesh( {
							xCount: 40,
							zCount: 40,
							cellWidth: 1,
							amplitude: 0.5,
							rowFrequency: 0.1,
							columnFrequency: 0.2,
						} );
						const extent = 20;

						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							meshes: [
								{
									mesh: groundMesh,
									filter: groundFilter,
									color: 0x7e6d5d,
								},
							],
							boxes: [
								{ size: { hx: extent, hy: 1, hz: 0.1 }, localPosition: { x: 0, y: 1, z: -extent }, filter: groundFilter, color: 0x7e6d5d },
								{ size: { hx: extent, hy: 1, hz: 0.1 }, localPosition: { x: 0, y: 1, z: extent }, filter: groundFilter, color: 0x7e6d5d },
								{ size: { hx: 0.1, hy: 1, hz: extent }, localPosition: { x: -extent, y: 1, z: 0 }, filter: groundFilter, color: 0x7e6d5d },
								{ size: { hx: 0.1, hy: 1, hz: extent }, localPosition: { x: extent, y: 1, z: 0 }, filter: groundFilter, color: 0x7e6d5d },
							],
						} );

						const random = createSeededRandom( config.seed );

						for ( let ix = 0; ix < gridCount; ix += 1 )
						{
							for ( let iz = 0; iz < gridCount; iz += 1 )
							{
								const position = {
									x: 0.5 * ( ix - 0.5 * gridCount ),
									y: 5,
									z: 0.5 * ( iz - 0.5 * gridCount ),
								};
								const linearVelocity = {
									x: sampleRange( random, -1, 1 ),
									y: sampleRange( random, -1, 1 ),
									z: sampleRange( random, -1, 1 ),
								};
								const angularVelocity = {
									x: sampleRange( random, -5, 5 ),
									y: sampleRange( random, -5, 5 ),
									z: sampleRange( random, -5, 5 ),
								};

								bodyHandles.push(
									config.createBody( ctx, {
										type: BodyType.dynamic,
										position,
										linearVelocity,
										angularVelocity,
										filter: bodyFilter,
									} )
								);
							}
						}

						ctx.setCameraLookAt( { x: 0, y: 20, z: 34 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`${config.shapeName} drops over a wave mesh with body-body collisions filtered out`,
							`active bodies: ${bodyHandles.length}`,
							`scene bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		};
	}

	return [
		{
			key: "continuous-thin-wall",
			label: "Continuous / Thin Wall",
			description:
				"A browser port of the native thin-wall scene. Fast-moving small bodies aim at a very thin barrier, making this a compact but valuable continuous-collision regression test.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 40, hy: 1, hz: 40 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 10, z: 0 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 90 * DEG_TO_RAD ),
							size: { hx: 10, hy: 0.1, hz: 10 },
							color: 0x7e6d5d,
						} );

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: -5, y: 10, z: 20 },
							linearVelocity: { x: 0, y: 0, z: -180 },
							angularVelocity: { x: 20, y: 0, z: 0 },
							radius: 0.1,
							rollingResistance: 0.1,
							color: 0xd67c42,
						} );

						ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 10, z: 20 },
							linearVelocity: { x: 0, y: 0, z: -180 },
							angularVelocity: { x: 20, y: -5, z: 0 },
							capsule: {
								center1: { x: -0.3, y: 0, z: 0 },
								center2: { x: 0.3, y: 0, z: 0 },
								radius: 0.1,
							},
							rollingResistance: 0.1,
							color: 0xc68858,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 5, y: 10, z: 20 },
							linearVelocity: { x: 0, y: 0, z: -180 },
							angularVelocity: { x: 20, y: 5, z: 0 },
							size: { hx: 0.4, hy: 0.1, hz: 0.1 },
							rollingResistance: 0.1,
							color: 0xb8704a,
						} );

						ctx.setCameraLookAt( { x: 18, y: 18, z: 30 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"fast sphere, capsule, and box vs thin rotated wall",
							"watch for tunneling or unstable contact response",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-bounce-house",
			label: "Continuous / Bounce House",
			description:
				"A browser port of the native bounce-house scene. A zero-friction, high-restitution ball ricochets inside a boxed arena, making energy preservation and fast contacts easy to spot.",
			create( ctx )
			{
				let ballHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 10, hy: 1, hz: 10 } } );

						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: -1, z: 0 },
							boxes: [
								{ size: { hx: 0.1, hy: 5, hz: 10 }, localPosition: { x: 10, y: 6, z: 0 }, color: 0x7e6d5d },
								{ size: { hx: 0.1, hy: 5, hz: 10 }, localPosition: { x: -10, y: 6, z: 0 }, color: 0x7e6d5d },
								{ size: { hx: 10, hy: 5, hz: 0.1 }, localPosition: { x: 0, y: 6, z: -10 }, color: 0x7e6d5d },
								{ size: { hx: 10, hy: 5, hz: 0.1 }, localPosition: { x: 0, y: 6, z: 10 }, color: 0x7e6d5d },
							],
						} );

						ballHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: -8, y: 4, z: 0 },
							linearVelocity: { x: 120, y: 0, z: 120 },
							gravityScale: 0,
							radius: 0.5,
							friction: 0,
							restitution: 1,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 26, y: 22, z: 40 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( ballHandle );
						return [
							`ball position: (${transform.position.x.toFixed( 2 )}, ${transform.position.y.toFixed( 2 )}, ${transform.position.z.toFixed( 2 )})`,
							"zero-friction + restitution-1 ricochet test",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-spinning-stick",
			label: "Continuous / Spinning Stick",
			description:
				"A browser port of the spinning-stick sample. A fast-falling, rapidly rotating beam targets a thin wall, which makes it a useful stress test for angular motion during continuous contact.",
			create( ctx )
			{
				let stickHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 10, hy: 1, hz: 10 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 0.5, z: 0 },
							size: { hx: 0.125, hy: 0.5, hz: 10 },
							color: 0x7e6d5d,
						} );

						stickHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 20, z: 0.5 },
							linearVelocity: { x: 0, y: -100, z: 0 },
							angularVelocity: { x: 28, y: -17, z: 21 },
							size: { hx: 2, hy: 0.1, hz: 0.1 },
							rollingResistance: 0.1,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 14, y: 16, z: 20 }, { x: 0, y: 6, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( stickHandle );
						return [
							`stick height: ${transform.position.y.toFixed( 2 )}`,
							"fast linear + angular motion against thin obstacle",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-bullet-stack",
			label: "Continuous / Bullet vs Stack",
			description:
				"A browser port of the native bullet-versus-stack sample. A high-speed bullet sphere repeatedly slams into a tall box stack, which makes it an excellent CCD and chain-reaction regression test.",
			create( ctx )
			{
				let bulletHandle = 0;
				let nextLaunchAt = 0;

				function launch()
				{
					bulletHandle = ctx.physics.createSphereBody( {
						type: BodyType.dynamic,
						isBullet: true,
						position: { x: 20.5, y: 5.5, z: 0 },
						linearVelocity: { x: -500, y: 0, z: 0 },
						radius: 0.25,
						density: 10,
						color: 0xe1a06e,
					} );
				}

				return {
					reset()
					{
						bulletHandle = 0;
						nextLaunchAt = 1.25;

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 50, hy: 1, hz: 50 } } );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: -1, y: 5, z: 0 },
							size: { hx: 0.1, hy: 5, hz: 10 },
							color: 0x7e6d5d,
						} );

						for ( let row = 0; row < 10; row += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 0.5 + 1.1 * row, z: 0 },
								size: { hx: 0.5, hy: 0.5, hz: 0.5 },
								color: row % 2 === 0 ? 0xd67c42 : 0xc68858,
							} );
						}

						ctx.setCameraLookAt( { x: 24, y: 12, z: 30 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						if ( elapsedSeconds >= nextLaunchAt )
						{
							launch();
							nextLaunchAt += 4;
						}
					},

					getStatusLines()
					{
						const bulletText = bulletHandle === 0
							? "waiting for launch"
							: `bullet x: ${ctx.physics.getBodyTransform( bulletHandle ).position.x.toFixed( 2 )}`;
						return [
							bulletText,
							"bullet relaunches every ~4s",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-is-fast",
			label: "Continuous / Is Fast",
			description:
				"A browser port of the native Is Fast sample. Three long spinning bodies rotate about different axes while floating above the ground, making it a compact regression test for fast-body classification and axis-dependent CCD behavior.",
			create( ctx )
			{
				const bodyHandles = [];

				return {
					reset()
					{
						bodyHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 40, hy: 1, hz: 40 } } );

						const size = { hx: 0.5, hy: 10, hz: 0.5 };
						const positions = [ -12, 0, 12 ];
						const angularVelocities = [
							{ x: 0, y: 0, z: 4 },
							{ x: 0, y: 4, z: 0 },
							{ x: 4, y: 0, z: 0 },
						];
						const colors = [ 0xd67c42, 0xc68858, 0xb8704a ];

						for ( let i = 0; i < positions.length; i += 1 )
						{
							bodyHandles.push(
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x: positions[i], y: 20, z: 0 },
									size,
									gravityScale: 0,
									angularVelocity: angularVelocities[i],
									color: colors[i],
								} )
							);
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 50 }, { x: 0, y: 15, z: 0 } );
					},

					getStatusLines()
					{
						const mid = ctx.physics.getBodyTransform( bodyHandles[1] );
						return [
							"three tall bodies spin about z, y, and x axes",
							`center body height: ${mid.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-needle-mesh",
			label: "Continuous / Needle Mesh",
			description:
				"A browser port of the native needle-mesh scene. Four tiny custom triangle spikes support a thin falling plate, which makes this a good regression test for custom mesh shapes and delicate contact generation.",
			create( ctx )
			{
				function createNeedleMesh( height, radius, center, slices = 8 )
				{
					const vertices = [ { x: center.x, y: center.y + height, z: center.z } ];
					const indices = [];

					for ( let index = 0; index < slices; index += 1 )
					{
						const angle = ( 2 * Math.PI * index ) / slices;
						vertices.push( {
							x: center.x + radius * Math.cos( angle ),
							y: center.y,
							z: center.z + radius * Math.sin( angle ),
						} );
					}

					for ( let index = 0; index < slices; index += 1 )
					{
						const current = index + 1;
						const previous = index === 0 ? slices : index;
						indices.push( 0, current, previous );
					}

					return ctx.physics.createCustomMesh( {
						vertices,
						indices,
						useMedianSplit: true,
					} );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						const needles = [
							createNeedleMesh( 0.99, 0.1, { x: 0.2, y: 0, z: 0.2 } ),
							createNeedleMesh( 1.01, 0.1, { x: 0.2, y: 0, z: -0.2 } ),
							createNeedleMesh( 0.98, 0.1, { x: -0.2, y: 0, z: -0.2 } ),
							createNeedleMesh( 1.02, 0.1, { x: -0.2, y: 0, z: 0.2 } ),
						];

						for ( const mesh of needles )
						{
							ctx.physics.addMeshShape( groundHandle, {
								mesh,
								color: 0x7e6d5d,
							} );
						}

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 5, z: 0 },
							linearVelocity: { x: 0, y: -10, z: 0 },
							size: { hx: 0.3, hy: 0.01, hz: 0.3 },
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 6, y: 4, z: 6 }, { x: 0, y: 1.2, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"falling plate on four tiny custom mesh needles",
							"watch for stable resting contact and no tunneling",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-hump-mesh",
			label: "Continuous / Hump Mesh",
			description:
				"A browser port of the native hump-mesh scene. A fast falling plank lands on a tiny raised ridge, which is useful for spotting contact clustering and clipping regressions on triangle meshes.",
			create( ctx )
			{
				function createHumpMesh( cellWidth )
				{
					const vertices = [];
					for ( let ix = 0; ix <= 1; ix += 1 )
					{
						const x = -0.5 * cellWidth + ix * cellWidth;
						for ( let iz = 0; iz <= 2; iz += 1 )
						{
							const z = -cellWidth + iz * cellWidth;
							vertices.push( {
								x,
								y: iz === 1 ? 0.05 * cellWidth : 0,
								z,
							} );
						}
					}

					return ctx.physics.createCustomMesh( {
						vertices,
						indices: [
							0, 1, 4,
							4, 3, 0,
							1, 2, 5,
							5, 4, 1,
						],
						useMedianSplit: true,
						identifyEdges: true,
					} );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						const hump = createHumpMesh( 8 );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						ctx.physics.addMeshShape( groundHandle, {
							mesh: hump,
							color: 0x7e6d5d,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 5, z: 0 },
							linearVelocity: { x: 0, y: -50, z: 0 },
							size: { hx: 0.5, hy: 0.05, hz: 1 },
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 10, y: 9, z: 10 }, { x: 0, y: 1.2, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"fast plank dropping onto a small raised ridge mesh",
							"look for clipping, jitter, or unstable manifold changes",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "continuous-stall",
			label: "Continuous / Stall",
			description:
				"A browser port of the native stall scene. A high-speed bullet body shoots through a dense torus mesh, which makes this a strong stress test for CCD against detailed triangle geometry.",
			create( ctx )
			{
				let bulletHandle = 0;

				function launch()
				{
					if ( bulletHandle !== 0 )
					{
						ctx.box3d.api.destroyBody( bulletHandle );
					}

					bulletHandle = ctx.physics.createHullBody( {
						type: BodyType.dynamic,
						isBullet: true,
						position: { x: 0, y: 1, z: -10 },
						linearVelocity: { x: 0, y: 0, z: 600 },
						angularVelocity: { x: 0, y: 0, z: 20 },
						points: [
							{ x: 0.28, y: 0.04, z: 0.08 },
							{ x: 0.16, y: 0.22, z: -0.06 },
							{ x: -0.08, y: 0.24, z: 0.18 },
							{ x: -0.24, y: 0.08, z: -0.04 },
							{ x: -0.18, y: -0.2, z: 0.06 },
							{ x: 0.06, y: -0.24, z: -0.16 },
							{ x: 0.22, y: -0.1, z: 0.2 },
							{ x: -0.04, y: 0.02, z: -0.24 },
						],
						color: 0xe1a06e,
					} );
				}

				return {
					reset()
					{
						bulletHandle = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 500, hy: 1, hz: 500 } } );

						const torus = ctx.physics.createTorusMesh( {
							radialResolution: 200,
							tubularResolution: 200,
							radius: 2,
							thickness: 1,
						} );

						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 2, z: 0 },
							mesh: torus,
							color: 0x7e6d5d,
						} );

						launch();
						ctx.setCameraLookAt( { x: -9, y: 6, z: 11 }, { x: 0, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						const position = bulletHandle === 0 ? null : ctx.physics.getBodyTransform( bulletHandle ).position;
						return [
							position == null ? "bullet waiting" : `bullet z: ${position.z.toFixed( 2 )}`,
							"dense torus mesh vs high-speed bullet hull",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		createMeshDropSample( {
			key: "continuous-mesh-drop-box",
			label: "Continuous / Mesh Drop (Box)",
			description:
				"A browser port of the native mesh-drop stress test using tiny boxes. Dynamic bodies only collide with the wave mesh and arena walls, matching the native sample's focus on mesh contact robustness rather than inter-body pileups.",
			shapeName: "box",
			seed: 0x1234abcd,
			createBody( ctx, options )
			{
				return ctx.physics.createBoxBody( {
					...options,
					size: { hx: 0.02, hy: 0.2, hz: 0.04 },
					rollingResistance: 0.1,
					color: 0xd67c42,
				} );
			},
		} ),
		createMeshDropSample( {
			key: "continuous-mesh-drop-capsule",
			label: "Continuous / Mesh Drop (Capsule)",
			description:
				"A browser port of the native mesh-drop stress test using tiny capsules. This variant is especially useful for exercising capsule-vs-mesh rolling and resting behavior on the waved ground.",
			shapeName: "capsule",
			seed: 0x2345bcde,
			createBody( ctx, options )
			{
				return ctx.physics.createCapsuleBody( {
					...options,
					capsule: {
						center1: { x: 0, y: -0.2, z: 0 },
						center2: { x: 0, y: 0.2, z: 0 },
						radius: 0.05,
					},
					rollingResistance: 0.4,
					color: 0xc68858,
				} );
			},
		} ),
		createMeshDropSample( {
			key: "continuous-mesh-drop-cylinder",
			label: "Continuous / Mesh Drop (Cylinder)",
			description:
				"A browser port of the native mesh-drop stress test using thin cylinders. Like the C sample, this makes a nice regression scene for tiny convex hulls moving over dense triangle meshes.",
			shapeName: "cylinder",
			seed: 0x3456cdef,
			createBody( ctx, options )
			{
				return ctx.physics.createCylinderBody( {
					...options,
					cylinder: { height: 0.4, radius: 0.05, yOffset: 0, sides: 6 },
					rollingResistance: 0.1,
					color: 0xb8704a,
				} );
			},
		} ),
		createMeshDropSample( {
			key: "continuous-mesh-drop-sphere",
			label: "Continuous / Mesh Drop (Sphere)",
			description:
				"A browser port of the native mesh-drop stress test using tiny spheres. This is a good high-count check for rolling contact and manifold stability on the waved mesh surface.",
			shapeName: "sphere",
			seed: 0x4567def0,
			createBody( ctx, options )
			{
				return ctx.physics.createSphereBody( {
					...options,
					radius: 0.05,
					rollingResistance: 0.1,
					color: 0xe1a06e,
				} );
			},
		} ),
	];
}
