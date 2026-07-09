import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createShapeSamples( { BodyType } )
{
	return [
		{
			key: "inclined-plane",
			label: "Shapes / Inclined Plane",
			description:
				"A sloped platform with boxes of increasing friction. This is a very nice browser sample because the result is visually immediate and does not require any extra host-side UI.",
			create( ctx )
			{
				const boxCount = 5;
				let trackedBody = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 7.5, z: -5 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 40 * DEG_TO_RAD ),
							size: { hx: 16, hy: 0.5, hz: 10 },
							friction: 1,
							color: 0x72818c,
						} );

						for ( let index = 0; index < boxCount; index += 1 )
						{
							trackedBody = ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: -10 + 5 * index, y: 15.75, z: -10.6 },
								size: { hx: 1, hy: 1, hz: 1 },
								friction: ( index + 1 ) * ( index + 1 ) * 0.04,
								color: 0xd98848,
							} );
						}

						ctx.setCameraLookAt( { x: -45, y: 30, z: 46 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( trackedBody );
						return [
							`boxes: ${boxCount}`,
							`last box x: ${transform.position.x.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "rolling-resistance",
			label: "Shapes / Rolling Resistance",
			description:
				"A shallow ramp with spheres and capsules that vary their rolling resistance. This is a strong browser showcase for capsule support and shared instanced geometry.",
			create( ctx )
			{
				const count = 5;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 2, z: -20 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 10 * DEG_TO_RAD ),
							size: { hx: 32, hy: 0.5, hz: 15 },
							color: 0x72818c,
						} );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: -25 + 5 * index, y: 8, z: -24 },
								radius: 1,
								rollingResistance: 0.05 * index,
								color: 0xc97846,
							} );
						}

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: 2 + 5 * index, y: 8, z: -24 },
								capsule: {
									center1: { x: -1, y: 0, z: 0 },
									center2: { x: 1, y: 0, z: 0 },
									radius: 0.5,
								},
								rollingResistance: 0.05 * index,
								color: 0xb46c43,
							} );
						}

						ctx.setCameraLookAt( { x: -45, y: 17, z: 60 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`rolling resistance range: 0.00 - 0.20`,
							`spheres + capsules: ${count * 2}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "high-resistance",
			label: "Shapes / High Resistance",
			description:
				"A row of tilted capsules with increasing rolling resistance. This is a very natural browser sample because it showcases capsule support, material variation, and shared instanced rendering at the same time.",
			create( ctx )
			{
				const count = 10;
				const rotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 30 * DEG_TO_RAD );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: -22 + 5 * index, y: 1.5, z: 0 },
								rotation,
								capsule: {
									center1: { x: 0, y: -1, z: 0 },
									center2: { x: 0, y: 1, z: 0 },
									radius: 0.5,
								},
								rollingResistance: 0.2 * index,
								color: 0xc97945,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 5, z: 40 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`capsules: ${count}`,
							`rolling resistance range: 0.00 - 1.80`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "slide-twist",
			label: "Shapes / Slide Twist",
			description:
				"A tilted platform with a spinning box, matching the native sample. It is a compact way to show coupled angular and sliding motion without adding any new engine features.",
			create( ctx )
			{
				const orientation = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 20 * DEG_TO_RAD );
				const sine = Math.sin( 20 * DEG_TO_RAD );
				const cosine = Math.cos( 20 * DEG_TO_RAD );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 4, z: 0 },
							rotation: orientation,
							size: { hx: 10, hy: 0.5, hz: 10 },
							friction: 0.6,
							color: 0x72818c,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 5, z: 0 },
							rotation: orientation,
							size: { hx: 1, hy: 0.5, hz: 1 },
							friction: 0.3,
							angularVelocity: { x: 0, y: 25 * cosine, z: 25 * sine },
							color: 0xd07a45,
						} );

						ctx.setCameraLookAt( { x: -14, y: 9, z: 24 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`tilt: 20 deg`,
							`initial spin: 25 rad/s`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "restitution",
			label: "Shapes / Restitution",
			description:
				"A row of falling shapes with increasing restitution. This is a strong candidate for later browser controls, but even the default sphere version already demonstrates the material gradient clearly.",
			create( ctx )
			{
				const count = 20;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						let restitution = 0;
						for ( let i = 0; i < count; i += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: -1 * ( count - 1 ) + 2 * i, y: 40, z: 0 },
								radius: 0.5,
								restitution,
								color: 0xc26d44,
							} );
							restitution += 1 / ( count - 1 );
						}

						ctx.setCameraLookAt( { x: 0, y: 25, z: 85 }, { x: 0, y: 20, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`shape: sphere`,
							`restitution range: 0.00 - 1.00`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "static-invoke",
			label: "Shapes / Static Invoke",
			description:
				"A dynamic sphere meets a static sphere whose contact creation mode can stay passive. This mirrors the native optimization demo in a fixed browser-friendly setup.",
			create( ctx )
			{
				let created = false;

				function createStaticBody()
				{
					ctx.physics.createSphereBody( {
						type: BodyType.static,
						position: { x: 0, y: 0.5, z: 0 },
						radius: 0.5,
						invokeContactCreation: false,
						color: 0x7b8791,
					} );
					created = true;
				}

				return {
					reset()
					{
						created = false;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 0.25, y: 1, z: 0 },
							radius: 0.5,
							rollingResistance: 0.2,
							color: 0xc97846,
						} );

						createStaticBody();
						ctx.setCameraLookAt( { x: 0, y: 25, z: 10 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`static invokeContactCreation: passive`,
							`static created: ${created ? "yes" : "no"}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "conveyor-belt",
			label: "Shapes / Conveyor Belt",
			description:
				"A rotated platform with local tangent velocity that pushes falling boxes along it. This gives us parity for one of the most obviously game-relevant material behaviors in the native samples.",
			create( ctx )
			{
				const count = 5;
				const platformRotation = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, 0.2 );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: -5, y: 5, z: 0 },
							rotation: platformRotation,
							size: { hx: 10, hy: 0.25, hz: 2 },
							friction: 0.8,
							tangentVelocity: { x: 2, y: 0, z: 0 },
							color: 0x75828b,
						} );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: -10 + 2 * index, y: 7, z: 0 },
								size: { hx: 0.5, hy: 0.5, hz: 0.5 },
								color: 0xcf824d,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 25, z: 40 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`tangent velocity: (2, 0, 0)`,
							`boxes: ${count}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "isotropic-friction",
			label: "Shapes / Isotropic Friction",
			description:
				"A circular launch pattern of boxes with matched orientation and velocity. It is a compact, visually rich sample and a good showcase for the host's transform throughput.",
			create( ctx )
			{
				const boxCount = 32;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 100, hy: 0.5, hz: 100 } } );

						for ( let index = 0; index < boxCount; index += 1 )
						{
							const alpha = ( Math.PI / 16 ) * index;
							const cosine = Math.cos( alpha );
							const sine = Math.sin( alpha );
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 15 * cosine, y: 1, z: 15 * sine },
								rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, -alpha ),
								size: { hx: 1, hy: 1, hz: 1 },
								friction: 0.6,
								linearVelocity: { x: 25 * cosine, y: 0, z: 25 * sine },
								color: 0xd08149,
							} );
						}

						ctx.setCameraLookAt( { x: 95, y: 30, z: 110 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`boxes: ${boxCount}`,
							`shared instanced bucket: yes`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
