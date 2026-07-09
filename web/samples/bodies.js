import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createBodySamples( { BodyType } )
{
	return [
		{
			key: "bodies-kinematic",
			label: "Bodies / Kinematic",
			description:
				"A direct browser port of the native kinematic target-transform sample. The thin JS layer drives the body with target transforms while the renderer stays fully instanced.",
			create( ctx )
			{
				const amplitude = 2;
				const delaySeconds = 2;
				let bodyHandle = 0;
				let elapsedSeconds = 0;

				return {
					reset()
					{
						elapsedSeconds = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );
						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.kinematic,
							position: { x: 2 * amplitude, y: amplitude + 1, z: 0 },
							size: { hx: 0.1, hy: 1, hz: 0.2 },
							color: 0xb06cb8,
						} );
						ctx.setCameraLookAt( { x: 0, y: 30, z: 10 }, { x: 0, y: 1.5, z: 0 } );
					},

					update( deltaSeconds )
					{
						elapsedSeconds += deltaSeconds;
						if ( elapsedSeconds <= delaySeconds || bodyHandle === 0 )
						{
							return;
						}

						const t = elapsedSeconds - delaySeconds;
						const position = {
							x: 2 * amplitude * Math.cos( t ),
							y: amplitude * ( Math.sin( 2 * t ) + 1 ) + 1,
							z: 0,
						};
						const rotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 2 * t );
						ctx.box3d.api.setBodyTransform( bodyHandle, { position, rotation } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( bodyHandle );
						return [
							`delay: ${delaySeconds.toFixed( 1 )}s`,
							`target x: ${transform.position.x.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-lock-mixing",
			label: "Bodies / Lock Mixing",
			description:
				"Five cubes with different motion-lock combinations. This is a compact parity sample and a good way to show that the raw motion-lock semantics survive the wasm bridge intact.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2, z: 0 },
							size: { hx: 1, hy: 1, hz: 1 },
							color: 0xd66f3d,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 2, y: 2, z: 0 },
							size: { hx: 1, hy: 1, hz: 1 },
							motionLocks: {
								linearX: false,
								linearY: false,
								linearZ: false,
								angularX: true,
								angularY: false,
								angularZ: true,
							},
							color: 0xcb804d,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: -2, y: 2, z: 0 },
							size: { hx: 1, hy: 1, hz: 1 },
							motionLocks: {
								linearX: true,
								linearY: true,
								linearZ: true,
								angularX: false,
								angularY: false,
								angularZ: false,
							},
							color: 0xc99960,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 1, z: 2 },
							size: { hx: 1, hy: 1, hz: 1 },
							motionLocks: {
								linearX: true,
								linearY: true,
								linearZ: true,
								angularX: true,
								angularY: true,
								angularZ: true,
							},
							color: 0xb78058,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 1, z: -3 },
							size: { hx: 1, hy: 1, hz: 1 },
							color: 0x72818c,
						} );

						ctx.setCameraLookAt( { x: 28, y: 20, z: 28 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`variants: free, angular xz, linear xyz, full, static`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-fixed-rotation",
			label: "Bodies / Fixed Rotation",
			description:
				"A static capsule and a dynamic capsule with all angular axes locked. It is a small sample, but it demonstrates an important body behavior that our vanilla API can expose with almost no extra surface area.",
			create( ctx )
			{
				const capsule = {
					center1: { x: 0, y: 0, z: 0 },
					center2: { x: 0, y: 1, z: 0 },
					radius: 0.3,
				};

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createCapsuleBody( {
							type: BodyType.static,
							position: { x: 0, y: 0.5, z: 0 },
							capsule,
							color: 0x76838d,
						} );

						ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 0.3, y: 0.5, z: 0 },
							capsule: { ...capsule, radius: 0.2 },
							gravityScale: 0,
							enableSleep: false,
							motionLocks: {
								linearX: false,
								linearY: false,
								linearZ: false,
								angularX: true,
								angularY: true,
								angularZ: true,
							},
							color: 0xd17a48,
						} );

						ctx.setCameraLookAt( { x: 0, y: 15, z: 10 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`dynamic capsule gravity scale: 0`,
							`rotation locked: xyz`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
