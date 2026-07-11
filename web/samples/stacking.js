import { DEG_TO_RAD, axisAngleToQuaternion, scalePoints } from "./helpers.js";

export function createStackingSamples( { BodyType } )
{
	return [
		{
			key: "single-box",
			label: "Stacking / Single Box",
			description:
				"A simple spinning cube from the native stacking sample. It is a nice sanity check for angular velocity, contact response, and transform syncing.",
			create( ctx )
			{
				let bodyHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );
						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 0.5, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							angularVelocity: { x: 0, y: 10, z: 0 },
							color: 0xe58d44,
						} );
						ctx.setCameraLookAt( { x: 0, y: 25, z: 10 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( bodyHandle );
						return [
							`position: (${transform.position.x.toFixed( 2 )}, ${transform.position.y.toFixed( 2 )}, ${transform.position.z.toFixed( 2 )})`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "sphere-stack",
			label: "Stacking / Sphere Stack",
			description:
				"A tall stack of spheres with mild rolling resistance. This maps cleanly onto the current web harness and is a good stress test for simple primitive scenes.",
			create( ctx )
			{
				const count = 30;
				const radius = 0.5;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 15, hy: 0.5, hz: 15 } } );

						let y = 1.5 * radius;
						for ( let i = 0; i < count; i += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: 0, y, z: 0 },
								radius,
								rollingResistance: 0.1,
								color: 0xc97846,
							} );
							y += 3 * radius;
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 50 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`spheres: ${count}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "capsule-stack",
			label: "Stacking / Capsule Stack",
			description:
				"A planar stack of capsules. This is one of the first browser samples that really benefits from both capsule support and instanced rendering.",
			create( ctx )
			{
				const count = 20;
				const radius = 0.5;
				const planarLocks = {
					linearX: false,
					linearY: false,
					linearZ: true,
					angularX: true,
					angularY: true,
					angularZ: true,
				};

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 40, hy: 0.5, hz: 40 } } );

						let y = 1.5 * radius;
						for ( let i = 0; i < count; i += 1 )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: 0, y, z: 0 },
								capsule: {
									center1: { x: -1, y: 0, z: 0 },
									center2: { x: 1, y: 0, z: 0 },
									radius,
								},
								motionLocks: planarLocks,
								color: 0xc97747,
							} );
							y += 2 * radius;
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 50 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`capsules: ${count}`,
							`instanced bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "cylinder",
			label: "Stacking / Cylinder",
			description:
				"A single cylinder from the native stacking sample. This adds real convex-hull cylinder coverage to the wasm bridge while keeping the host rendering path simple and fast.",
			create( ctx )
			{
				let bodyHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );
						bodyHandle = ctx.physics.createCylinderBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2, z: 0 },
							cylinder: { height: 1, radius: 0.25, yOffset: 0, sides: 12 },
							rollingResistance: 0.05,
							color: 0xc77c48,
						} );
						ctx.setCameraLookAt( { x: 0, y: 15, z: 10 }, { x: 0, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( bodyHandle );
						return [
							`position: (${transform.position.x.toFixed( 2 )}, ${transform.position.y.toFixed( 2 )}, ${transform.position.z.toFixed( 2 )})`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "cylinder-stack",
			label: "Stacking / Cylinder Stack",
			description:
				"A stack of scaled cylinders based on the native hull sample. This is a strong browser showcase because it combines true hull-based bodies with repeated instanced rendering.",
			create( ctx )
			{
				const scales = [
					{ x: 1, y: 1, z: 1 },
					{ x: -0.75, y: 1, z: 1 },
					{ x: 1.2, y: 1, z: -0.9 },
					{ x: 0.9, y: 0.9, z: 0.9 },
				];
				const count = 10;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createCylinderBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 1.1 * index, z: 0 },
								cylinder: { height: 1, radius: 0.5, yOffset: 0, sides: 15 },
								scale: scales[index % scales.length],
								color: 0xcd8351,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 15 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`cylinders: ${count}`,
							`shared instancing buckets: ${scales.length}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "box-stack",
			label: "Stacking / Box Stack",
			description:
				"A classic tall tower of cubes. This is one of the cleanest direct ports from the native samples and gives us a denser rigid-body benchmark in the browser.",
			create( ctx )
			{
				const count = 40;
				const halfExtent = 0.5;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 40, hy: 0.5, hz: 40 } } );

						for ( let i = 0; i < count; i += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 1.5 * halfExtent + 2.5 * halfExtent * i, z: 0 },
								size: { hx: halfExtent, hy: halfExtent, hz: halfExtent },
								rollingResistance: 0.1,
								color: 0xd66f3d,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 50 }, { x: 0, y: 20, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`stack height: ${count} boxes`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "card-house",
			label: "Stacking / Card House",
			description:
				"A thinner house-of-cards layout based on the native sample. Box3D's minimum stable hull thickness is still a practical constraint here, so the browser port stays thin-looking while using a slightly safer thickness for simulation and rendering.",
			create( ctx )
			{
				const alpha = 25 * DEG_TO_RAD;
				const cardHeight = 0.2;
				const cardThickness = 0.001;
				const cardDepth = 0.1;
				const size = { hx: cardThickness, hy: cardHeight, hz: cardDepth };
				const leftRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, -alpha );
				const rightRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, alpha );
				const horizontalRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.5 * Math.PI );
				const bodyColor = 0xd0a36e;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );

						let count = 5;
						let z0 = 0;
						let y = cardHeight - 0.02;
						while ( count > 0 )
						{
							let z = z0;
							for ( let index = 0; index < count; index += 1 )
							{
								if ( index !== count - 1 )
								{
									ctx.physics.createBoxBody( {
										type: BodyType.dynamic,
										position: { x: z + 0.25, y: y + cardHeight - 0.015, z: 0 },
										rotation: horizontalRotation,
										size,
										friction: 0.7,
										color: bodyColor,
									} );
								}

								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x: z, y, z: 0 },
									rotation: leftRotation,
									size,
									friction: 0.7,
									color: bodyColor,
								} );

								z += 0.175;

								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x: z, y, z: 0 },
									rotation: rightRotation,
									size,
									friction: 0.7,
									color: bodyColor,
								} );

								z += 0.175;
							}

							y += 2 * cardHeight - 0.03;
							z0 += 0.175;
							count -= 1;
						}

						ctx.setCameraLookAt( { x: 30, y: 10, z: 3 }, { x: 0.75, y: 1.0, z: 0.4 } );
					},

					getStatusLines()
					{
						return [
							`card thickness: ${cardThickness.toFixed( 3 )}`,
							"expected: the thin card tower should settle and collapse plausibly without exploding",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "card-house-thick",
			label: "Stacking / Card House Thick",
			description:
				"A compact house-of-cards arrangement made from thicker box hulls. It is a great fit for instancing because the sample is mostly repeated boxes with shared dimensions and materials.",
			create( ctx )
			{
				const alpha = 25 * DEG_TO_RAD;
				const width = 0.38;
				const height = 0.98;
				const depth = 0.08;
				const offsetX = 0.5 * height * Math.sin( alpha ) + 0.045;
				const offsetY = 0.5 * height * Math.cos( alpha ) + 0.035;
				const size = { hx: 0.5 * depth, hy: 0.5 * height, hz: 0.5 * width };
				const leftRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, -alpha );
				const rightRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, alpha );
				const horizontalRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.5 * Math.PI );

				function addVerticalRow( startX, startY, count )
				{
					for ( let index = 0; index < count; index += 1 )
					{
						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: startX - offsetX, y: startY, z: 0 },
							rotation: leftRotation,
							size,
							friction: 0.8,
							color: 0xd09a66,
						} );
						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: startX + offsetX, y: startY, z: 0 },
							rotation: rightRotation,
							size,
							friction: 0.8,
							color: 0xd09a66,
						} );
						startX += 4 * offsetX;
					}
				}

				function addHorizontalRow( startX, startY, count )
				{
					for ( let index = 0; index < count; index += 1 )
					{
						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: startX + index * 4 * offsetX, y: startY, z: 0 },
							rotation: horizontalRotation,
							size,
							friction: 0.8,
							color: 0xb97b4d,
						} );
					}
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );
						addVerticalRow( -6 * offsetX, offsetY, 4 );
						addHorizontalRow( -4 * offsetX, 2 * offsetY + 0.04, 3 );
						addVerticalRow( -4 * offsetX, 3 * offsetY + 0.08, 3 );
						addHorizontalRow( -2 * offsetX, 4 * offsetY + 0.12, 2 );
						addVerticalRow( -2 * offsetX, 5 * offsetY + 0.16, 2 );
						addHorizontalRow( 0, 6 * offsetY + 0.2, 1 );
						addVerticalRow( 0, 7 * offsetY + 0.24, 1 );
						ctx.setCameraLookAt( { x: 0, y: 25, z: 10 }, { x: 0, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`card dimensions: ${depth.toFixed( 2 )} x ${height.toFixed( 2 )} x ${width.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "jenga-stack",
			label: "Stacking / Jenga Stack",
			description:
				"A tall alternating tower of long beams from the native Jenga sample. This is an ideal browser benchmark because it is almost entirely repeated geometry and benefits heavily from instancing.",
			create( ctx )
			{
				const size = 40;
				const beamSize = { hx: 2.5, hy: 0.25, hz: 0.25 };

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 60, hy: 0.5, hz: 60 } } );

						for ( let index = 0; index < size; index += 1 )
						{
							const alpha = ( index & 1 ) === 1 ? 0 : 0.5 * Math.PI;
							const x = ( index & 1 ) === 0 ? 1.75 : 0;
							const z = ( index & 1 ) === 0 ? 0 : 1.75;
							const y = 0.5 * index + 0.25;
							const rotation = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, alpha );

							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x, y, z },
								rotation,
								size: beamSize,
								rollingResistance: 0.01,
								color: 0xc98a57,
							} );
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: -x, y, z: -z },
								rotation,
								size: beamSize,
								rollingResistance: 0.01,
								color: 0xc98a57,
							} );
						}

						ctx.setCameraLookAt( { x: 17, y: 18, z: 24 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`levels: ${size}`,
							`beams: ${size * 2}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "dominoes",
			label: "Stacking / Dominoes",
			description:
				"Concentric rings of dominoes, kicked off with an impulse on the first piece in each ring. This is exactly the kind of sample where instancing helps keep the browser presentation from becoming draw-call bound.",
			create( ctx )
			{
				const ringCount = 30;
				const size = { hx: 0.2, hy: 0.8, hz: 0.05 };

				function createRing( radius )
				{
					for ( let alphaDegrees = 0; alphaDegrees <= 360; alphaDegrees += 2 )
					{
						const radians = alphaDegrees * DEG_TO_RAD;
						const cosine = Math.cos( radians );
						const sine = Math.sin( radians );
						const normal = { x: cosine, y: 0, z: sine };
						const position = {
							x: radius * cosine - ( alphaDegrees / 630 ) * normal.x,
							y: 0.8,
							z: radius * sine - ( alphaDegrees / 630 ) * normal.z,
						};
						const rotation = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, -radians );
						const bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position,
							rotation,
							size,
							color: 0xc98954,
						} );

						if ( alphaDegrees === 0 )
						{
							ctx.box3d.api.applyBodyLinearImpulse(
								bodyHandle,
								{ x: 0, y: 0, z: 25 },
								{ x: position.x, y: position.y + 0.8, z: position.z }
							);
						}
					}
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 80, hy: 0.5, hz: 80 } } );

						for ( let ring = 0; ring < ringCount; ring += 1 )
						{
							createRing( 7 + 1.1 * ring );
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 75 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`rings: ${ringCount}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "wedge",
			label: "Stacking / Wedge",
			description:
				"A small custom convex wedge used by the native sample to stress hull contacts. This is our first browser demo built on the generic convex-hull bridge path.",
			create( ctx )
			{
				const wedgePoints = [
					{ x: -1, y: 1, z: -0.1 },
					{ x: 1, y: 1, z: -0.1 },
					{ x: -1, y: 1, z: 0.1 },
					{ x: 1, y: 1, z: 0.1 },
					{ x: -0.5, y: 0.5, z: 0 },
					{ x: 0.5, y: 0.5, z: 0 },
				];

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );
						ctx.physics.createHullBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 1, z: 0 },
							points: wedgePoints,
							color: 0xc97d49,
						} );
						ctx.setCameraLookAt( { x: 2.6, y: 1.7, z: 9.5 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`hull vertices: ${wedgePoints.length}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "arch",
			label: "Stacking / Arch",
			description:
				"A convex-hull stone arch with a boxed cap, based directly on the native sample. This is a strong parity milestone because it exercises many unique hull bodies in one scene.",
			create( ctx )
			{
				const ps1 = scalePoints( [
					{ x: 16.0, y: 0.0, z: 0.0 },
					{ x: 14.93803712795643, y: 5.133601056842984, z: 0.0 },
					{ x: 13.79871746027416, y: 10.24928069555078, z: 0.0 },
					{ x: 12.56252963284711, y: 15.34107019122473, z: 0.0 },
					{ x: 11.20040987372525, y: 20.39856541571217, z: 0.0 },
					{ x: 9.66521217819836, y: 25.40369899225096, z: 0.0 },
					{ x: 7.87179930638133, y: 30.3179337000085, z: 0.0 },
					{ x: 5.635199558196225, y: 35.03820717801641, z: 0.0 },
					{ x: 2.405937953536585, y: 39.09554102558315, z: 0.0 },
				], 0.25 );
				const ps2 = scalePoints( [
					{ x: 24.0, y: 0.0, z: 0.0 },
					{ x: 22.33619528222415, y: 6.02299846205841, z: 0.0 },
					{ x: 20.54936888969905, y: 12.00964361211476, z: 0.0 },
					{ x: 18.60854610798073, y: 17.9470321677465, z: 0.0 },
					{ x: 16.46769273811807, y: 23.81367936585418, z: 0.0 },
					{ x: 14.05325025774858, y: 29.57079353071012, z: 0.0 },
					{ x: 11.23551045834022, y: 35.13775818285372, z: 0.0 },
					{ x: 7.752568160730571, y: 40.30450679009583, z: 0.0 },
					{ x: 3.016931552701656, y: 44.28891593799322, z: 0.0 },
				], 0.25 );
				const halfDepth = 0.5;

				function makePrism( points )
				{
					return points.flatMap( ( point ) => [
						{ x: point.x, y: point.y, z: -halfDepth },
						{ x: point.x, y: point.y, z: halfDepth },
					] );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 40, hy: 0.5, hz: 40 } } );

						for ( let index = 0; index < 8; index += 1 )
						{
							ctx.physics.createHullBody( {
								type: BodyType.dynamic,
								points: makePrism( [
									ps1[index],
									ps2[index],
									ps2[index + 1],
									ps1[index + 1],
								] ),
								density: 200,
								color: 0xc29a6a,
							} );

							ctx.physics.createHullBody( {
								type: BodyType.dynamic,
								points: makePrism( [
									{ x: -ps2[index].x, y: ps2[index].y, z: 0 },
									{ x: -ps1[index].x, y: ps1[index].y, z: 0 },
									{ x: -ps1[index + 1].x, y: ps1[index + 1].y, z: 0 },
									{ x: -ps2[index + 1].x, y: ps2[index + 1].y, z: 0 },
								] ),
								density: 200,
								color: 0xc29a6a,
							} );
						}

						ctx.physics.createHullBody( {
							type: BodyType.dynamic,
							points: makePrism( [
								ps1[8],
								ps2[8],
								{ x: -ps2[8].x, y: ps2[8].y, z: 0 },
								{ x: -ps1[8].x, y: ps1[8].y, z: 0 },
							] ),
							density: 200,
							color: 0xc29a6a,
						} );

						for ( let index = 0; index < 4; index += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 0.5 + ps2[8].y + index, z: 0 },
								size: { hx: 2, hy: 0.5, hz: halfDepth },
								density: 200,
								color: 0xbc8558,
							} );
						}

						ctx.setCameraLookAt( { x: 12, y: 5.2, z: 26.5 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`arch stones: 17`,
							`cap blocks: 4`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "double-domino",
			label: "Stacking / Double Domino",
			description:
				"A short heavy domino line with an initial impulse on the first piece. It is compact, readable, and a nice quick contact-regression scene.",
			create( ctx )
			{
				const count = 15;
				const size = { hx: 0.125, hy: 0.5, hz: 0.25 };

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						let x = -0.5 * count;
						for ( let index = 0; index < count; index += 1 )
						{
							const bodyHandle = ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x, y: 0.5, z: 0 },
								size,
								friction: 0.6,
								density: 4,
								color: 0xc28655,
							} );

							if ( index === 0 )
							{
								ctx.box3d.api.applyBodyLinearImpulse(
									bodyHandle,
									{ x: 0.2, y: 0, z: 0 },
									{ x, y: 1, z: 0 }
								);
							}

							x += 1.01;
						}

						ctx.setCameraLookAt( { x: 0, y: 15, z: 15 }, { x: 0, y: 0.5, z: 1 } );
					},

					getStatusLines()
					{
						return [
							`dominoes: ${count}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "pyramid2d",
			label: "Stacking / Pyramid2D",
			description:
				"A planar box pyramid using Box3D motion locks to keep the scene 2D inside the 3D world. This is a useful bridge sample between the simple stacks and the more specialized demos.",
			create( ctx )
			{
				const size = 12;
				const halfExtent = 1;
				const planarLocks = {
					linearX: false,
					linearY: false,
					linearZ: true,
					angularX: true,
					angularY: true,
					angularZ: false,
				};

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 40, hy: 0.5, hz: 40 } } );

						for ( let row = 0; row < size; row += 1 )
						{
							for ( let column = 0; column < size - row; column += 1 )
							{
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: {
										x: ( -10 + 2 * column + row ) * halfExtent,
										y: ( 1.5 + 2.5 * row ) * halfExtent,
										z: 0,
									},
									size: { hx: halfExtent, hy: halfExtent, hz: halfExtent },
									motionLocks: planarLocks,
									color: 0xcc8750,
								} );
							}
						}

						ctx.setCameraLookAt( { x: 0, y: 30, z: 50 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`rows: ${size}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
