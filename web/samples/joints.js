import { DEG_TO_RAD } from "./helpers.js";

export function createJointSamples( { BodyType } )
{
	return [
		{
			key: "joint-distance",
			label: "Joints / Distance Joint",
			description:
				"A chain of spheres linked by distance joints. This mirrors the native sample's core constraint behavior and gives us a first end-to-end joint bridge in the browser.",
			create( ctx )
			{
				const count = 8;
				const bodyHandles = [];
				const jointHandles = [];

				return {
					reset()
					{
						bodyHandles.length = 0;
						jointHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						let previousBody = groundHandle;
						const yOffset = 14;
						const length = 1.2;

						for ( let i = 0; i < count; i += 1 )
						{
							const bodyHandle = ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: length * ( i + 1 ), y: yOffset, z: 0 },
								radius: 0.35,
								density: 20,
								color: 0xd67c42,
							} );
							bodyHandles.push( bodyHandle );
							jointHandles.push(
								ctx.box3d.api.createDistanceJoint( ctx.physics.worldHandle, {
									bodyA: previousBody,
									bodyB: bodyHandle,
									anchorA: { x: length * i, y: yOffset, z: 0 },
									anchorB: { x: length * ( i + 1 ), y: yOffset, z: 0 },
									length,
									minLength: length,
									maxLength: length,
									hertz: 4,
									dampingRatio: 0.5,
									enableSpring: true,
									enableLimit: true,
									lowerSpringForce: -2000,
									upperSpringForce: 100,
								} )
							);
							previousBody = bodyHandle;
						}

						ctx.setCameraLookAt( { x: 0, y: 10, z: 40 }, { x: 4, y: 12, z: 0 } );
					},

					getStatusLines()
					{
						const tip = ctx.physics.getBodyTransform( bodyHandles[bodyHandles.length - 1] );
						return [
							`links: ${count}`,
							`tip position: (${tip.position.x.toFixed( 2 )}, ${tip.position.y.toFixed( 2 )}, ${tip.position.z.toFixed( 2 )})`,
							`first joint length: ${ctx.box3d.api.getDistanceJointCurrentLength( jointHandles[0] ).toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-revolute",
			label: "Joints / Revolute",
			description:
				"A browser port of the simple revolute-joint pendulum. The joint spring target oscillates automatically so the hinge behavior stays obvious without extra UI controls.",
			create( ctx )
			{
				let bodyHandle = 0;
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: -1, z: 0 } } );

						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							size: { hx: 0.5, hy: 1.5, hz: 0.25 },
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: bodyHandle,
							anchor: { x: 0, y: 5.5, z: 0 },
							lowerAngle: -35 * DEG_TO_RAD,
							upperAngle: 35 * DEG_TO_RAD,
							hertz: 2,
							dampingRatio: 0.7,
							targetAngle: 0,
							enableSpring: true,
							enableLimit: true,
							enableMotor: false,
						} );

						ctx.setCameraLookAt( { x: 12, y: 10, z: 15 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						const targetAngle = Math.sin( elapsedSeconds * 1.5 ) * 25 * DEG_TO_RAD;
						ctx.box3d.api.setRevoluteJointTargetAngle( jointHandle, targetAngle );
						ctx.box3d.api.wakeJointBodies( jointHandle );
					},

					getStatusLines()
					{
						return [
							`joint angle: ${( ctx.box3d.api.getRevoluteJointAngle( jointHandle ) / DEG_TO_RAD ).toFixed( 1 )} deg`,
							`spring target: auto-oscillating`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-weld",
			label: "Joints / Weld",
			description:
				"A welded dynamic bar attached to a static anchor. The browser version starts with angular velocity so the weld softness and damping are immediately visible.",
			create( ctx )
			{
				let bodyHandle = 0;
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: -1, z: 0 } } );

						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							size: { hx: 0.5, hy: 1.5, hz: 0.25 },
							gravityScale: 0,
							angularVelocity: { x: 0, y: 0, z: 5 },
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createWeldJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: bodyHandle,
							anchor: { x: 0, y: 5.5, z: 0 },
							linearHertz: 0,
							linearDampingRatio: 0,
							angularHertz: 2,
							angularDampingRatio: 0.7,
						} );

						ctx.setCameraLookAt( { x: 12, y: 10, z: 15 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						if ( elapsedSeconds > 4 && elapsedSeconds < 4.05 )
						{
							ctx.box3d.api.setWeldJointAngularHertz( jointHandle, 6 );
							ctx.box3d.api.setWeldJointAngularDampingRatio( jointHandle, 0.25 );
							ctx.box3d.api.wakeJointBodies( jointHandle );
						}
					},

					getStatusLines()
					{
						const omega = ctx.physics.getBodyAngularVelocity( bodyHandle );
						return [
							`angular speed z: ${omega.z.toFixed( 2 )}`,
							`weld damping retunes after ~4s`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-filter",
			label: "Joints / Filter",
			description:
				"A direct port of the simple filter-joint setup: two dynamic boxes linked so they do not collide with each other while still colliding with the world.",
			create( ctx )
			{
				const bodyHandles = [];

				return {
					reset()
					{
						bodyHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						const bodyA = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 2, y: 4, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							color: 0xd67c42,
						} );
						const bodyB = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: -2, y: 4, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							color: 0xc68858,
						} );
						bodyHandles.push( bodyA, bodyB );
						ctx.box3d.api.createFilterJoint( ctx.physics.worldHandle, { bodyA, bodyB } );

						ctx.setCameraLookAt( { x: 10, y: 9, z: 18 }, { x: 0, y: 3, z: 0 } );
					},

					getStatusLines()
					{
						const a = ctx.physics.getBodyTransform( bodyHandles[0] );
						const b = ctx.physics.getBodyTransform( bodyHandles[1] );
						return [
							`box separation: ${( a.position.x - b.position.x ).toFixed( 2 )}`,
							`filter joint: connected bodies should ignore mutual collision`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-motor",
			label: "Joints / Motor Joint",
			description:
				"A browser port of the motor-joint sample. A kinematic target follows an animated path while the dynamic body chases it through the joint spring, making constraint force and lag easy to see.",
			create( ctx )
			{
				let targetHandle = 0;
				let bodyHandle = 0;
				let jointHandle = 0;
				let speed = 1.5;
				let time = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						targetHandle = ctx.physics.createBody( {
							type: BodyType.kinematic,
							position: { x: 0, y: 10, z: 0 },
						} );

						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 10, z: 0 },
							size: { hx: 1, hy: 0.25, hz: 0.25 },
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createMotorJoint( ctx.physics.worldHandle, {
							bodyA: targetHandle,
							bodyB: bodyHandle,
							linearHertz: 4,
							linearDampingRatio: 0.7,
							angularHertz: 4,
							angularDampingRatio: 0.7,
							maxSpringForce: 400000,
							maxSpringTorque: 500000,
						} );

						time = 0;
						ctx.setCameraLookAt( { x: 0, y: 8, z: 25 }, { x: 0, y: 8, z: 0 } );
					},

					update( dt )
					{
						time += dt * speed;
						const position = {
							x: 6 * Math.sin( 2 * time ),
							y: 10 + 4 * Math.sin( time ),
							z: 0,
						};
						const angle = 2 * time;
						ctx.physics.setBodyTargetTransform( targetHandle, {
							position,
							rotation: { x: 0, y: 0, z: Math.sin( angle * 0.5 ), w: Math.cos( angle * 0.5 ) },
						}, dt, true );
					},

					getStatusLines()
					{
						return [
							`constraint force: ${ctx.box3d.api.getJointConstraintForceLength( jointHandle ).toFixed( 0 )}`,
							`constraint torque: ${ctx.box3d.api.getJointConstraintTorqueLength( jointHandle ).toFixed( 0 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-prismatic",
			label: "Joints / Prismatic",
			description:
				"A browser port of the spring-loaded slider joint. The target translation oscillates automatically so the constrained linear motion is easy to inspect without extra UI.",
			create( ctx )
			{
				let bodyHandle = 0;
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: -1, z: 0 } } );

						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							size: { hx: 0.5, hy: 1.5, hz: 0.25 },
							gravityScale: 0,
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: bodyHandle,
							localFrameA: {
								position: { x: 0, y: 6.5, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							localFrameB: {
								position: { x: 0, y: 1.5, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							constraintHertz: 120,
							lowerTranslation: -1,
							upperTranslation: 1,
							hertz: 2,
							dampingRatio: 0.7,
							targetTranslation: 0,
							enableSpring: true,
							enableLimit: false,
							enableMotor: false,
						} );

						ctx.setCameraLookAt( { x: 12, y: 10, z: 15 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						const target = Math.sin( elapsedSeconds * 1.2 ) * 2.5;
						ctx.box3d.api.setPrismaticJointTargetTranslation( jointHandle, target );
						ctx.box3d.api.wakeJointBodies( jointHandle );
					},

					getStatusLines()
					{
						return [
							`translation: ${ctx.box3d.api.getPrismaticJointTranslation( jointHandle ).toFixed( 2 )}`,
							`target: auto-oscillating spring translation`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-spherical",
			label: "Joints / Spherical",
			description:
				"A browser port of the spherical-joint pendulum. The target rotation animates over time so the cone/twist-limited spring behavior stays visible without a native-style inspector panel.",
			create( ctx )
			{
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: -1, z: 0 } } );
						const bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							size: { hx: 0.5, hy: 1.5, hz: 0.25 },
							gravityScale: 0,
							density: 100,
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: bodyHandle,
							localFrameA: { position: { x: 0, y: 6.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
							localFrameB: { position: { x: 0, y: 1.5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
							coneAngle: 30 * DEG_TO_RAD,
							lowerTwistAngle: -35 * DEG_TO_RAD,
							upperTwistAngle: 35 * DEG_TO_RAD,
							hertz: 2,
							dampingRatio: 0.7,
							enableSpring: true,
							enableConeLimit: false,
							enableTwistLimit: false,
							enableMotor: false,
						} );

						ctx.setCameraLookAt( { x: 12, y: 10, z: 15 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						const xAngle = Math.sin( elapsedSeconds * 1.1 ) * 20 * DEG_TO_RAD;
						const zAngle = Math.cos( elapsedSeconds * 1.5 ) * 15 * DEG_TO_RAD;
						const qx = { x: Math.sin( xAngle * 0.5 ), y: 0, z: 0, w: Math.cos( xAngle * 0.5 ) };
						const qz = { x: 0, y: 0, z: Math.sin( zAngle * 0.5 ), w: Math.cos( zAngle * 0.5 ) };
						const target = {
							x: qz.w * qx.x + qz.x * qx.w + qz.y * qx.z - qz.z * qx.y,
							y: qz.w * qx.y - qz.x * qx.z + qz.y * qx.w + qz.z * qx.x,
							z: qz.w * qx.z + qz.x * qx.y - qz.y * qx.x + qz.z * qx.w,
							w: qz.w * qx.w - qz.x * qx.x - qz.y * qx.y - qz.z * qx.z,
						};
						ctx.box3d.api.setSphericalJointTargetRotation( jointHandle, target );
						ctx.box3d.api.wakeJointBodies( jointHandle );
					},

					getStatusLines()
					{
						return [
							`spherical joint: animated target rotation`,
							`cone/twist limits omitted in first browser pass`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-wheel",
			label: "Joints / Wheel",
			description:
				"A browser port of the single wheel-joint demo. The wheel spins, steers, and bounces under an animated target so the suspension and steering constraints are easy to inspect.",
			create( ctx )
			{
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: -1, z: 0 } } );
						const wheelBody = ctx.physics.createCylinderBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2, z: 0 },
							rotation: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
							cylinder: { height: 0.25, radius: 0.4, yOffset: 0, sides: 12 },
							color: 0xd67c42,
						} );

						jointHandle = ctx.box3d.api.createWheelJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: wheelBody,
							localFrameA: {
								position: { x: 0, y: 3, z: 0 },
								rotation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
							},
							localFrameB: {
								position: { x: 0, y: 0, z: 0 },
								rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
							},
							lowerSuspensionLimit: -1,
							upperSuspensionLimit: 1,
							suspensionHertz: 2,
							suspensionDampingRatio: 0.7,
							spinSpeed: 5,
							maxSpinTorque: 20,
							steeringHertz: 1,
							steeringDampingRatio: 0.7,
							targetSteeringAngle: 0,
							maxSteeringTorque: 20,
							lowerSteeringLimit: -45 * DEG_TO_RAD,
							upperSteeringLimit: 45 * DEG_TO_RAD,
							enableSuspensionSpring: true,
							enableSuspensionLimit: false,
							enableSpinMotor: true,
							enableSteering: true,
							enableSteeringLimit: false,
							collideConnected: true,
						} );

						ctx.setCameraLookAt( { x: 12, y: 8, z: 18 }, { x: 0, y: 2, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						ctx.box3d.api.setWheelJointTargetSteeringAngle( jointHandle, Math.sin( elapsedSeconds ) * 35 * DEG_TO_RAD );
						ctx.box3d.api.setWheelJointSpinMotorSpeed( jointHandle, 5 + 3 * Math.sin( elapsedSeconds * 1.8 ) );
						ctx.box3d.api.wakeJointBodies( jointHandle );
					},

					getStatusLines()
					{
						return [
							`steering angle: ${( ctx.box3d.api.getWheelJointSteeringAngle( jointHandle ) / DEG_TO_RAD ).toFixed( 1 )} deg`,
							`spin + steering: auto animated`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-ball-chain",
			label: "Joints / Ball and Chain",
			description:
				"A direct browser port of the long articulated chain sample. It is a strong regression test for repeated spherical joints, capsule rendering, and long-chain stability in the wasm build.",
			create( ctx )
			{
				const linkCount = 32;
				const linkExtent = 0.5;
				const linkRadius = 0.125;
				const bodyHandles = [];

				return {
					reset()
					{
						bodyHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const groundHandle = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 8, z: 0 },
						} );

						let parentHandle = groundHandle;
						let parentFrame = {
							position: { x: 0, y: 0, z: 0 },
							rotation: { x: 0, y: 0, z: 0, w: 1 },
						};

						for ( let i = 0; i < linkCount; i += 1 )
						{
							const bodyHandle = ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: ( 1 + 2 * i ) * linkExtent, y: 8, z: 0 },
								capsule: {
									center1: { x: -linkExtent, y: 0, z: 0 },
									center2: { x: linkExtent, y: 0, z: 0 },
									radius: linkRadius,
								},
								density: 1,
								color: 0xd67c42,
							} );
							bodyHandles.push( bodyHandle );

							ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
								bodyA: parentHandle,
								bodyB: bodyHandle,
								localFrameA: parentFrame,
								localFrameB: {
									position: { x: -linkExtent, y: 0, z: 0 },
									rotation: { x: 0, y: 0, z: 0, w: 1 },
								},
								enableMotor: true,
								maxMotorTorque: 10,
							} );

							parentHandle = bodyHandle;
							parentFrame = {
								position: { x: linkExtent, y: 0, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							};
						}

						const sphereRadius = 2;
						const ballHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: ( 1 + 2 * linkCount ) * linkExtent + sphereRadius - linkExtent, y: 8, z: 0 },
							radius: sphereRadius,
							density: 1,
							color: 0xc68858,
						} );
						bodyHandles.push( ballHandle );

						ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
							bodyA: parentHandle,
							bodyB: ballHandle,
							localFrameA: parentFrame,
							localFrameB: {
								position: { x: -sphereRadius, y: 0, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							enableMotor: true,
							maxMotorTorque: 10,
						} );

						ctx.setCameraLookAt( { x: 0, y: 14, z: 50 }, { x: 16, y: 8, z: 0 } );
					},

					getStatusLines()
					{
						const tip = ctx.physics.getBodyTransform( bodyHandles[bodyHandles.length - 1] );
						return [
							`links: ${linkCount} + ball`,
							`ball position: (${tip.position.x.toFixed( 2 )}, ${tip.position.y.toFixed( 2 )}, ${tip.position.z.toFixed( 2 )})`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-door",
			label: "Joints / Door",
			description:
				"A browser-first port of the door sample. The native version has click impulse controls and optional double hinges; this pass keeps the single hinged heavy door and periodically kicks it so the hinge response is easy to observe.",
			create( ctx )
			{
				let doorHandle = 0;
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const groundHandle = ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						doorHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 1.5, z: 0 },
							size: { hx: 0.75, hy: 1.5, hz: 0.1 },
							gravityScale: 2,
							density: 1000,
							color: 0xd67c42,
						} );

						const hingeAxisRotation = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
						jointHandle = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: doorHandle,
							localFrameA: {
								position: { x: -0.75, y: 1.0, z: 0 },
								rotation: hingeAxisRotation,
							},
							localFrameB: {
								position: { x: -0.75, y: -1.5, z: 0 },
								rotation: hingeAxisRotation,
							},
							lowerAngle: -90 * DEG_TO_RAD,
							upperAngle: 90 * DEG_TO_RAD,
							hertz: 1,
							dampingRatio: 0.5,
							constraintHertz: 120,
							constraintDampingRatio: 0,
							enableSpring: true,
							enableLimit: true,
							enableMotor: false,
						} );

						ctx.setCameraLookAt( { x: 10, y: 7, z: 14 }, { x: 0, y: 1.5, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						if ( elapsedSeconds > 1 && Math.abs( elapsedSeconds % 3 ) < 0.02 )
						{
							ctx.physics.applyBodyLinearImpulse(
								doorHandle,
								{ x: 0, y: 0, z: -50000 },
								{ x: 0.75, y: 1.5, z: 0 },
								true
							);
						}
					},

					getStatusLines()
					{
						return [
							`door angle: ${( ctx.box3d.api.getRevoluteJointAngle( jointHandle ) / DEG_TO_RAD ).toFixed( 1 )} deg`,
							`impulse kick: repeats every ~3s`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-bridge",
			label: "Joints / Bridge",
			description:
				"A browser port of the suspension bridge sample. This is a valuable maintenance scene because it combines many instanced planks with a dense set of spherical constraints and exposes stability regressions quickly.",
			create( ctx )
			{
				const count = 150;
				const halfLength = 0.125;
				const bodyHandles = [];

				return {
					reset()
					{
						bodyHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 60, hy: 1, hz: 60 } } );

						const groundHandle = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );

						let previousBody = groundHandle;
						let previousCenterX = 0;
						const xBase = -160 * halfLength;
						const shapeHalfDepth = 0.5;

						for ( let i = 0; i < count; i += 1 )
						{
							const centerX = xBase + halfLength * ( 1 + 2 * i );
							const bodyHandle = ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: centerX, y: 20, z: 0 },
								size: { hx: halfLength, hy: 0.125, hz: shapeHalfDepth },
								density: 20,
								linearDamping: 0.1,
								angularDamping: 0.1,
								color: i % 2 === 0 ? 0xd67c42 : 0xc68858,
							} );
							bodyHandles.push( bodyHandle );

							for ( const z of [ -shapeHalfDepth, shapeHalfDepth ] )
							{
								const pivot = { x: xBase + 2 * halfLength * i, y: 20, z };
								ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
									bodyA: previousBody,
									bodyB: bodyHandle,
									localFrameA: {
										position: {
											x: pivot.x - previousCenterX,
											y: pivot.y - ( previousBody === groundHandle ? 0 : 20 ),
											z,
										},
										rotation: { x: 0, y: 0, z: 0, w: 1 },
									},
									localFrameB: {
										position: {
											x: pivot.x - centerX,
											y: 0,
											z,
										},
										rotation: { x: 0, y: 0, z: 0, w: 1 },
									},
									constraintHertz: 1000,
									enableSpring: true,
									hertz: 2,
									dampingRatio: 1,
								} );
							}

							previousBody = bodyHandle;
							previousCenterX = centerX;
						}

						for ( const z of [ -shapeHalfDepth, shapeHalfDepth ] )
						{
							const pivot = { x: xBase + 2 * halfLength * count, y: 20, z };
							ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
								bodyA: previousBody,
								bodyB: groundHandle,
								localFrameA: {
									position: {
										x: pivot.x - previousCenterX,
										y: 0,
										z,
									},
									rotation: { x: 0, y: 0, z: 0, w: 1 },
								},
								localFrameB: {
									position: pivot,
									rotation: { x: 0, y: 0, z: 0, w: 1 },
								},
								constraintHertz: 1000,
								enableSpring: true,
								hertz: 2,
								dampingRatio: 1,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 20, z: 35 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						const mid = bodyHandles[Math.floor( bodyHandles.length * 0.5 )];
						const transform = ctx.physics.getBodyTransform( mid );
						return [
							`segments: ${count}`,
							`mid-span height: ${transform.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-motion-locks",
			label: "Joints / Motion Locks",
			description:
				"A browser port of the native motion-lock regression scene. Several joint types share the same body shape while animated lock presets are applied to all bodies, making it easy to spot solver issues when linear or angular axes are constrained.",
			create( ctx )
			{
				const bodyHandles = [];
				const labels = [];
				const lockPresets = [
					{
						label: "free motion",
						locks: { linearX: false, linearY: false, linearZ: false, angularX: false, angularY: false, angularZ: false },
					},
					{
						label: "2D slab",
						locks: { linearX: false, linearY: false, linearZ: true, angularX: true, angularY: true, angularZ: false },
					},
					{
						label: "rotation locked",
						locks: { linearX: false, linearY: false, linearZ: false, angularX: true, angularY: true, angularZ: true },
					},
					{
						label: "vertical rail",
						locks: { linearX: true, linearY: false, linearZ: true, angularX: true, angularY: false, angularZ: true },
					},
				];
				let activePresetIndex = 0;
				let lastImpulseBucket = -1;

				function applyLocks( preset )
				{
					for ( const bodyHandle of bodyHandles )
					{
						ctx.physics.setBodyMotionLocks( bodyHandle, preset.locks );
						ctx.physics.setBodyAwake( bodyHandle, true );
					}
				}

				return {
					reset()
					{
						bodyHandles.length = 0;
						labels.length = 0;
						activePresetIndex = 0;
						lastImpulseBucket = -1;

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );

						const basePosition = { x: -12.5, y: 10, z: 0 };
						const stepX = 5;
						const size = { hx: 1, hy: 1, hz: 0.5 };

						const distanceBody = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { ...basePosition },
							size,
							density: 1,
							enableSleep: false,
							color: 0xd67c42,
						} );
						bodyHandles.push( distanceBody );
						labels.push( "distance" );
						ctx.box3d.api.createDistanceJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: distanceBody,
							anchorA: { x: basePosition.x, y: basePosition.y + 3, z: 0 },
							anchorB: { x: basePosition.x, y: basePosition.y + 1, z: 0 },
							length: 2,
						} );

						const prismaticPosition = { x: basePosition.x + stepX, y: basePosition.y, z: 0 };
						const prismaticBody = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: prismaticPosition,
							size,
							density: 1,
							enableSleep: false,
							color: 0xc68858,
						} );
						bodyHandles.push( prismaticBody );
						labels.push( "prismatic" );
						ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: prismaticBody,
							localFrameA: {
								position: { x: prismaticPosition.x - 1, y: prismaticPosition.y, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							localFrameB: {
								position: { x: -1, y: 0, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							collideConnected: true,
						} );

						const revolutePosition = { x: basePosition.x + stepX * 2, y: basePosition.y, z: 0 };
						const revoluteBody = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: revolutePosition,
							size,
							density: 1,
							enableSleep: false,
							color: 0xb8704a,
						} );
						bodyHandles.push( revoluteBody );
						labels.push( "revolute" );
						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: revoluteBody,
							anchor: { x: revolutePosition.x - 1, y: revolutePosition.y, z: 0 },
							collideConnected: true,
						} );

						const weldPosition = { x: basePosition.x + stepX * 3, y: basePosition.y, z: 0 };
						const weldBody = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: weldPosition,
							size,
							density: 1,
							enableSleep: false,
							color: 0xe1a06e,
						} );
						bodyHandles.push( weldBody );
						labels.push( "weld" );
						ctx.box3d.api.createWeldJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: weldBody,
							anchor: { x: weldPosition.x - 1, y: weldPosition.y, z: 0 },
							angularHertz: 2,
							angularDampingRatio: 0.5,
						} );

						applyLocks( lockPresets[0] );
						ctx.setCameraLookAt( { x: 0, y: 12, z: 36 }, { x: -2, y: 8, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						const presetIndex = Math.floor( elapsedSeconds / 4 ) % lockPresets.length;
						if ( presetIndex !== activePresetIndex )
						{
							activePresetIndex = presetIndex;
							applyLocks( lockPresets[activePresetIndex] );
						}

						const impulseBucket = Math.floor( elapsedSeconds / 2.5 );
						if ( impulseBucket !== lastImpulseBucket )
						{
							lastImpulseBucket = impulseBucket;
							const bodyHandle = bodyHandles[0];
							const transform = ctx.physics.getBodyTransform( bodyHandle );
							ctx.physics.applyBodyLinearImpulse(
								bodyHandle,
								{ x: 180, y: 0, z: 0 },
								transform.position,
								true
							);
						}
					},

					getStatusLines()
					{
						const tracked = ctx.physics.getBodyTransform( bodyHandles[0] );
						return [
							`lock preset: ${lockPresets[activePresetIndex].label}`,
							`joint row: ${labels.join( ", " )}`,
							`distance body x: ${tracked.position.x.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "joint-parallel-spring",
			label: "Joints / Parallel Spring",
			description:
				"A browser port of the native parallel-joint spring sample. This is especially valuable for wasm parity because the joint depends on correctly oriented local frames, making it a good detector for rotational frame mistakes.",
			create( ctx )
			{
				let bodyHandle = 0;
				let jointHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const groundHandle = ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: -1, z: 0 },
							boxes: [
								{ size: { hx: 20, hy: 1, hz: 20 }, localPosition: { x: 0, y: 0, z: 0 }, color: 0x7e6d5d },
								{ size: { hx: 20, hy: 5, hz: 0.1 }, localPosition: { x: 0, y: 6, z: -20 }, color: 0x7e6d5d },
								{ size: { hx: 20, hy: 5, hz: 0.1 }, localPosition: { x: 0, y: 6, z: 20 }, color: 0x7e6d5d },
								{ size: { hx: 0.1, hy: 5, hz: 20 }, localPosition: { x: -20, y: 6, z: 0 }, color: 0x7e6d5d },
								{ size: { hx: 0.1, hy: 5, hz: 20 }, localPosition: { x: 20, y: 6, z: 0 }, color: 0x7e6d5d },
							],
						} );

						const bodyRotation = {
							x: Math.sin( Math.PI / 8 ),
							y: 0,
							z: 0,
							w: Math.cos( Math.PI / 8 ),
						};
						bodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							rotation: bodyRotation,
							size: { hx: 0.5, hy: 1.5, hz: 0.25 },
							color: 0xd67c42,
						} );

						const frameARotation = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
						const frameBRotation = {
							x: -Math.sin( 3 * Math.PI / 8 ),
							y: 0,
							z: 0,
							w: Math.cos( 3 * Math.PI / 8 ),
						};
						jointHandle = ctx.box3d.api.createParallelJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: bodyHandle,
							localFrameA: {
								position: { x: 0, y: 0, z: 0 },
								rotation: frameARotation,
							},
							localFrameB: {
								position: { x: 0, y: 0, z: 0 },
								rotation: frameBRotation,
							},
							hertz: 10,
							dampingRatio: 0.7,
							maxTorque: 5000,
							collideConnected: true,
						} );

						ctx.setCameraLookAt( { x: 12, y: 11, z: 15 }, { x: 0, y: 4, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						const hertz = 1 + 4 * ( 0.5 + 0.5 * Math.sin( elapsedSeconds * 0.9 ) );
						const damping = 0.15 + 1.35 * ( 0.5 + 0.5 * Math.cos( elapsedSeconds * 0.7 ) );
						ctx.box3d.api.setParallelJointSpringHertz( jointHandle, hertz );
						ctx.box3d.api.setParallelJointSpringDampingRatio( jointHandle, damping );
						ctx.box3d.api.wakeJointBodies( jointHandle );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( bodyHandle );
						return [
							`parallel spring: animated hertz + damping`,
							`body height: ${transform.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
