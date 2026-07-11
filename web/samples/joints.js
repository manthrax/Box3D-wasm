import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

function createPrismMeshFromLoop( points, zMin, zMax )
{
	function polygonArea()
	{
		let area = 0;
		for ( let i = 0; i < points.length; i += 1 )
		{
			const j = ( i + 1 ) % points.length;
			area += points[i].x * points[j].y - points[j].x * points[i].y;
		}
		return 0.5 * area;
	}

	function isConvex( prev, curr, next, orientation )
	{
		const cross = ( curr.x - prev.x ) * ( next.y - prev.y ) - ( curr.y - prev.y ) * ( next.x - prev.x );
		return orientation > 0 ? cross > 1e-8 : cross < -1e-8;
	}

	function pointInTriangle( p, a, b, c )
	{
		const area = ( u, v, w ) => ( v.x - u.x ) * ( w.y - u.y ) - ( v.y - u.y ) * ( w.x - u.x );
		const s1 = area( a, b, p );
		const s2 = area( b, c, p );
		const s3 = area( c, a, p );
		const hasNeg = s1 < -1e-8 || s2 < -1e-8 || s3 < -1e-8;
		const hasPos = s1 > 1e-8 || s2 > 1e-8 || s3 > 1e-8;
		return !( hasNeg && hasPos );
	}

	function triangulatePolygon()
	{
		const indices = points.map( ( _point, index ) => index );
		const triangles = [];
		const orientation = polygonArea();
		while ( indices.length > 2 )
		{
			let earFound = false;
			for ( let i = 0; i < indices.length; i += 1 )
			{
				const prevIndex = indices[( i - 1 + indices.length ) % indices.length];
				const currIndex = indices[i];
				const nextIndex = indices[( i + 1 ) % indices.length];
				const prev = points[prevIndex];
				const curr = points[currIndex];
				const next = points[nextIndex];
				if ( !isConvex( prev, curr, next, orientation ) )
				{
					continue;
				}

				let containsOther = false;
				for ( let j = 0; j < indices.length; j += 1 )
				{
					const testIndex = indices[j];
					if ( testIndex === prevIndex || testIndex === currIndex || testIndex === nextIndex )
					{
						continue;
					}
					if ( pointInTriangle( points[testIndex], prev, curr, next ) )
					{
						containsOther = true;
						break;
					}
				}

				if ( containsOther )
				{
					continue;
				}

				triangles.push( [ prevIndex, currIndex, nextIndex ] );
				indices.splice( i, 1 );
				earFound = true;
				break;
			}

			if ( !earFound )
			{
				break;
			}
		}

		return triangles;
	}

	const vertices = [];
	for ( const point of points )
	{
		vertices.push( { x: point.x, y: point.y, z: zMin } );
		vertices.push( { x: point.x, y: point.y, z: zMax } );
	}

	const indices = [];
	for ( let i = 0; i < points.length; i += 1 )
	{
		const j = ( i + 1 ) % points.length;
		const aLo = 2 * i;
		const aHi = 2 * i + 1;
		const bLo = 2 * j;
		const bHi = 2 * j + 1;
		indices.push( aLo, bLo, bHi, aLo, bHi, aHi );
	}

	const capTriangles = triangulatePolygon();
	for ( const [ r0, r1, r2 ] of capTriangles )
	{
		indices.push( 2 * r0 + 1, 2 * r1 + 1, 2 * r2 + 1 );
		indices.push( 2 * r0 + 0, 2 * r2 + 0, 2 * r1 + 0 );
	}

	return { vertices, indices };
}

function createZCylinderHullPoints( radius, zMin, zMax, sides )
{
	const points = [];
	for ( let index = 0; index < sides; index += 1 )
	{
		const angle = 2 * Math.PI * index / sides;
		const x = radius * Math.cos( angle );
		const y = radius * Math.sin( angle );
		points.push( { x, y, z: zMin } );
		points.push( { x, y, z: zMax } );
	}
	return points;
}

function rotateAroundZ( point, angle )
{
	const c = Math.cos( angle );
	const s = Math.sin( angle );
	return {
		x: c * point.x - s * point.y,
		y: s * point.x + c * point.y,
		z: point.z,
	};
}

function createGearToothPoints( centerRadius, zCenter, angle, halfWidth, halfHeight, toothRadius, halfDepth )
{
	const hx = halfWidth;
	const baseHalf = halfHeight;
	const tipHalf = halfHeight - toothRadius;
	const local = [
		{ x: -hx, y: -baseHalf, z: -halfDepth },
		{ x: -hx, y: baseHalf, z: -halfDepth },
		{ x: -hx, y: baseHalf, z: halfDepth },
		{ x: -hx, y: -baseHalf, z: halfDepth },
		{ x: hx, y: -tipHalf, z: -halfDepth },
		{ x: hx, y: tipHalf, z: -halfDepth },
		{ x: hx, y: tipHalf, z: halfDepth },
		{ x: hx, y: -tipHalf, z: halfDepth },
	];
	const center = rotateAroundZ( { x: centerRadius, y: 0, z: 0 }, angle );
	return local.map( ( point ) =>
	{
		const rotated = rotateAroundZ( point, angle );
		return { x: center.x + rotated.x, y: center.y + rotated.y, z: zCenter + rotated.z };
	} );
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
			key: "joint-top-down-friction",
			label: "Joints / Top Down Friction",
			description:
				"A browser port of the native top-down friction scene. A field of zero-gravity bodies is constrained by motor joints so they scrub against the arena walls like pucks, and the explode action makes it easy to spot drift or unstable energy gain.",
			sceneOptions: {
				showGround: false,
				showGrid: false,
			},
			create( ctx )
			{
				const dynamicHandles = [];

				function spawnField()
				{
					const restitution = 0.8;
					const rows = 10;
					const cols = 10;
					let x = -5;
					let y = 15;

					for ( let row = 0; row < rows; row += 1 )
					{
						for ( let col = 0; col < cols; col += 1 )
						{
							let bodyHandle = 0;
							const position = { x, y, z: 0 };
							const remainder = ( rows * row + col ) % 4;
							if ( remainder === 0 )
							{
								bodyHandle = ctx.physics.createCapsuleBody( {
									type: BodyType.dynamic,
									position,
									capsule: {
										center1: { x: -0.25, y: 0, z: 0 },
										center2: { x: 0.25, y: 0, z: 0 },
										radius: 0.25,
									},
									restitution,
									gravityScale: 0,
									color: 0xcf7d47,
								} );
							}
							else if ( remainder === 1 )
							{
								bodyHandle = ctx.physics.createSphereBody( {
									type: BodyType.dynamic,
									position,
									radius: 0.35,
									restitution,
									gravityScale: 0,
									color: 0xc99157,
								} );
							}
							else
							{
								bodyHandle = ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position,
									size: { hx: 0.35, hy: 0.35, hz: 0.35 },
									restitution,
									gravityScale: 0,
									color: 0xaa825f,
								} );
							}

							dynamicHandles.push( bodyHandle );
							ctx.box3d.api.createMotorJoint( ctx.physics.worldHandle, {
								bodyA: groundHandle,
								bodyB: bodyHandle,
								collideConnected: true,
								maxVelocityForce: 1000,
								maxVelocityTorque: 1000,
							} );

							x += 1;
						}

						x = -5;
						y -= 1;
					}
				}

				let groundHandle = 0;

				function explode()
				{
					ctx.box3d.api.explodeWorld( ctx.physics.worldHandle, {
						position: { x: 0, y: 10, z: 0 },
						radius: 10,
						falloff: 5,
						impulsePerArea: 10000,
					} );
				}

				return {
					reset()
					{
						dynamicHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						groundHandle = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );

						ctx.physics.addBoxShape( groundHandle, {
							bodyType: BodyType.static,
							localPosition: { x: 0, y: 0, z: 0 },
							size: { hx: 10, hy: 0.5, hz: 4 },
							color: 0x75838d,
						} );
						ctx.physics.addBoxShape( groundHandle, {
							bodyType: BodyType.static,
							localPosition: { x: -10, y: 10, z: 0 },
							size: { hx: 0.5, hy: 10, hz: 4 },
							color: 0x67747d,
						} );
						ctx.physics.addBoxShape( groundHandle, {
							bodyType: BodyType.static,
							localPosition: { x: 10, y: 10, z: 0 },
							size: { hx: 0.5, hy: 10, hz: 4 },
							color: 0x67747d,
						} );
						ctx.physics.addBoxShape( groundHandle, {
							bodyType: BodyType.static,
							localPosition: { x: 0, y: 20, z: 0 },
							size: { hx: 10, hy: 0.5, hz: 4 },
							color: 0x75838d,
						} );

						spawnField();
						ctx.setCameraLookAt( { x: 0, y: 0, z: 26 }, { x: 0, y: 10, z: 0 } );
					},

					buildUI( panel )
					{
						panel.addButton( "Explode", explode );
					},

					getStatusLines()
					{
						return [
							`dynamic bodies: ${dynamicHandles.length}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
							"expected: pieces should slide and ricochet around the arena after the blast",
						];
					},
				};
			},
		},
		{
			key: "joint-driving",
			label: "Joints / Driving",
			description:
				"A browser port of the native driving sample. A chassis rides on four wheel joints over a wave mesh while WASD controls rear-wheel spin and front-wheel steering, which makes it a strong end-to-end test for the wheel-joint binding surface.",
			sceneOptions: {
				showGround: false,
				showGrid: false,
			},
			create( ctx )
			{
				const keys = {};
				let chassisHandle = 0;
				let frontLeftJoint = 0;
				let frontRightJoint = 0;
				let rearLeftJoint = 0;
				let rearRightJoint = 0;
				let spinSpeed = 30;
				let maxSpinTorque = 5;
				let suspensionHertz = 4;
				let suspensionDampingRatio = 0.7;
				let lowerTranslation = -0.2;
				let upperTranslation = 0.2;
				let steeringHertz = 10;
				let steeringDampingRatio = 0.7;
				let lowerSteeringDegrees = -45;
				let upperSteeringDegrees = 45;
				const maxSteeringTorque = 5;

				function handleKeyDown( event )
				{
					keys[event.key.toLowerCase()] = true;
				}

				function handleKeyUp( event )
				{
					keys[event.key.toLowerCase()] = false;
				}

				function setSuspensionLimits()
				{
					ctx.box3d.api.setWheelJointSuspensionLimits( frontLeftJoint, lowerTranslation, upperTranslation );
					ctx.box3d.api.setWheelJointSuspensionLimits( frontRightJoint, lowerTranslation, upperTranslation );
					ctx.box3d.api.setWheelJointSuspensionLimits( rearLeftJoint, lowerTranslation, upperTranslation );
					ctx.box3d.api.setWheelJointSuspensionLimits( rearRightJoint, lowerTranslation, upperTranslation );
				}

				function setSuspensionHertzAll()
				{
					ctx.box3d.api.setWheelJointSuspensionHertz( frontLeftJoint, suspensionHertz );
					ctx.box3d.api.setWheelJointSuspensionHertz( frontRightJoint, suspensionHertz );
					ctx.box3d.api.setWheelJointSuspensionHertz( rearLeftJoint, suspensionHertz );
					ctx.box3d.api.setWheelJointSuspensionHertz( rearRightJoint, suspensionHertz );
				}

				function setSuspensionDampingAll()
				{
					ctx.box3d.api.setWheelJointSuspensionDampingRatio( frontLeftJoint, suspensionDampingRatio );
					ctx.box3d.api.setWheelJointSuspensionDampingRatio( frontRightJoint, suspensionDampingRatio );
					ctx.box3d.api.setWheelJointSuspensionDampingRatio( rearLeftJoint, suspensionDampingRatio );
					ctx.box3d.api.setWheelJointSuspensionDampingRatio( rearRightJoint, suspensionDampingRatio );
				}

				function setSteeringHertzAll()
				{
					ctx.box3d.api.setWheelJointSteeringHertz( frontLeftJoint, steeringHertz );
					ctx.box3d.api.setWheelJointSteeringHertz( frontRightJoint, steeringHertz );
				}

				function setSteeringDampingAll()
				{
					ctx.box3d.api.setWheelJointSteeringDampingRatio( frontLeftJoint, steeringDampingRatio );
					ctx.box3d.api.setWheelJointSteeringDampingRatio( frontRightJoint, steeringDampingRatio );
				}

				function setSteeringLimitsAll()
				{
					ctx.box3d.api.setWheelJointSteeringLimits( frontLeftJoint, lowerSteeringDegrees * DEG_TO_RAD, upperSteeringDegrees * DEG_TO_RAD );
					ctx.box3d.api.setWheelJointSteeringLimits( frontRightJoint, lowerSteeringDegrees * DEG_TO_RAD, upperSteeringDegrees * DEG_TO_RAD );
				}

				function setSpinTorqueAll()
				{
					ctx.box3d.api.setWheelJointMaxSpinTorque( rearLeftJoint, maxSpinTorque );
					ctx.box3d.api.setWheelJointMaxSpinTorque( rearRightJoint, maxSpinTorque );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const groundHandle = ctx.physics.createBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
						} );
						const waveMesh = ctx.physics.createWaveMesh( {
							xCount: 50,
							zCount: 50,
							cellWidth: 4,
							amplitude: 2,
							rowFrequency: 0.02,
							columnFrequency: 0.04,
						} );
						ctx.physics.addMeshShape( groundHandle, {
							mesh: waveMesh,
							bodyType: BodyType.static,
							color: 0x75838d,
						} );

						chassisHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2.5, z: 0 },
							size: { hx: 2, hy: 0.5, hz: 1 },
							density: 0.5,
							color: 0xc77543,
						} );

						const wheelRotation = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.5 * Math.PI );
						const wheelFrameA = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.5 * Math.PI );
						const wheelFrameB = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, -0.5 * Math.PI );

						function createWheelBody( position )
						{
							return ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position,
								rotation: wheelRotation,
								radius: 0.4,
								density: 2,
								friction: 3,
								color: 0xd7a05f,
							} );
						}

						function createWheelJoint( wheelBody, localPosition, enableSteering, enableSpinMotor )
						{
							return ctx.box3d.api.createWheelJoint( ctx.physics.worldHandle, {
								bodyA: chassisHandle,
								bodyB: wheelBody,
								localFrameA: {
									position: localPosition,
									rotation: wheelFrameA,
								},
								localFrameB: {
									position: { x: 0, y: 0, z: 0 },
									rotation: wheelFrameB,
								},
								enableSuspensionLimit: true,
								lowerSuspensionLimit: lowerTranslation,
								upperSuspensionLimit: upperTranslation,
								enableSuspensionSpring: true,
								suspensionHertz,
								suspensionDampingRatio,
								enableSpinMotor,
								spinSpeed: 0,
								maxSpinTorque,
								enableSteering,
								steeringHertz,
								steeringDampingRatio,
								targetSteeringAngle: 0,
								maxSteeringTorque,
								enableSteeringLimit: true,
								lowerSteeringLimit: lowerSteeringDegrees * DEG_TO_RAD,
								upperSteeringLimit: upperSteeringDegrees * DEG_TO_RAD,
							} );
						}

						frontLeftJoint = createWheelJoint( createWheelBody( { x: 1.5, y: 2, z: 0.8 } ), { x: 1.5, y: -0.5, z: 0.8 }, true, false );
						frontRightJoint = createWheelJoint( createWheelBody( { x: 1.5, y: 2, z: -0.8 } ), { x: 1.5, y: -0.5, z: -0.8 }, true, false );
						rearLeftJoint = createWheelJoint( createWheelBody( { x: -1.5, y: 2, z: 0.8 } ), { x: -1.5, y: -0.5, z: 0.8 }, false, true );
						rearRightJoint = createWheelJoint( createWheelBody( { x: -1.5, y: 2, z: -0.8 } ), { x: -1.5, y: -0.5, z: -0.8 }, false, true );

						window.addEventListener( "keydown", handleKeyDown );
						window.addEventListener( "keyup", handleKeyUp );
						ctx.setCameraLookAt( { x: 8, y: 8, z: 20 }, { x: 0, y: 2, z: 0 } );
					},

					update()
					{
						const throttle = ( keys["w"] ? 1 : 0 ) - ( keys["s"] ? 1 : 0 );
						const steering = ( keys["a"] ? 1 : 0 ) - ( keys["d"] ? 1 : 0 );
						const maxSteeringAngle = 0.25 * Math.PI;

						ctx.box3d.api.setWheelJointTargetSteeringAngle( frontLeftJoint, maxSteeringAngle * steering );
						ctx.box3d.api.setWheelJointTargetSteeringAngle( frontRightJoint, maxSteeringAngle * steering );
						ctx.box3d.api.setWheelJointSpinMotorSpeed( rearLeftJoint, -spinSpeed * throttle );
						ctx.box3d.api.setWheelJointSpinMotorSpeed( rearRightJoint, -spinSpeed * throttle );
						ctx.box3d.api.wakeJointBodies( frontLeftJoint );
						ctx.box3d.api.wakeJointBodies( frontRightJoint );
						ctx.box3d.api.wakeJointBodies( rearLeftJoint );
						ctx.box3d.api.wakeJointBodies( rearRightJoint );

						if ( chassisHandle !== 0 )
						{
							const transform = ctx.physics.getBodyTransform( chassisHandle );
							ctx.setCameraLookAt( { x: transform.position.x + 8, y: transform.position.y + 6, z: transform.position.z + 16 }, transform.position );
						}
					},

					buildUI( panel )
					{
						panel.add( "Spin Speed", spinSpeed, { min: 0, max: 100, step: 1 }, ( value ) =>
						{
							spinSpeed = value;
						} );
						panel.add( "Spin Torque", maxSpinTorque, { min: 0, max: 100, step: 0.5 }, ( value ) =>
						{
							maxSpinTorque = value;
							setSpinTorqueAll();
						} );
						panel.add( "Suspension Min", lowerTranslation, { min: -1, max: 1, step: 0.05 }, ( value ) =>
						{
							lowerTranslation = Math.min( value, upperTranslation );
							setSuspensionLimits();
						} );
						panel.add( "Suspension Max", upperTranslation, { min: -1, max: 1, step: 0.05 }, ( value ) =>
						{
							upperTranslation = Math.max( value, lowerTranslation );
							setSuspensionLimits();
						} );
						panel.add( "Suspension Hz", suspensionHertz, { min: 0, max: 10, step: 0.1 }, ( value ) =>
						{
							suspensionHertz = value;
							setSuspensionHertzAll();
						} );
						panel.add( "Suspension Damp", suspensionDampingRatio, { min: 0, max: 2, step: 0.05 }, ( value ) =>
						{
							suspensionDampingRatio = value;
							setSuspensionDampingAll();
						} );
						panel.add( "Steering Hz", steeringHertz, { min: 0, max: 10, step: 0.1 }, ( value ) =>
						{
							steeringHertz = value;
							setSteeringHertzAll();
						} );
						panel.add( "Steering Damp", steeringDampingRatio, { min: 0, max: 2, step: 0.05 }, ( value ) =>
						{
							steeringDampingRatio = value;
							setSteeringDampingAll();
						} );
						panel.add( "Steer Min", lowerSteeringDegrees, { min: -90, max: 0, step: 1 }, ( value ) =>
						{
							lowerSteeringDegrees = value;
							setSteeringLimitsAll();
						} );
						panel.add( "Steer Max", upperSteeringDegrees, { min: 0, max: 90, step: 1 }, ( value ) =>
						{
							upperSteeringDegrees = value;
							setSteeringLimitsAll();
						} );
					},

					getStatusLines()
					{
						return [
							"use WASD to drive",
							`front steering: ${( ctx.box3d.api.getWheelJointSteeringAngle( frontLeftJoint ) / DEG_TO_RAD ).toFixed( 1 )} / ${( ctx.box3d.api.getWheelJointSteeringAngle( frontRightJoint ) / DEG_TO_RAD ).toFixed( 1 )} deg`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},

					dispose()
					{
						window.removeEventListener( "keydown", handleKeyDown );
						window.removeEventListener( "keyup", handleKeyUp );
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
							enableConeLimit: true,
							enableTwistLimit: true,
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
							`cone: +/-30 deg, twist: +/-35 deg`,
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
			key: "joint-gear-lift",
			label: "Joints / Gear Lift",
			description:
				"A browser port of the native geared lift assembly. Two meshed gear bodies drive dual hanging chains that raise a sliding gate inside a stairwell, making this a strong end-to-end regression for compound hulls, custom meshes, revolute chains, and prismatic guidance.",
			sceneOptions: {
				showGround: true,
				showGrid: false,
			},
			create( ctx )
			{
				const gearRadius = 1.0;
				const gearHalfDepth = 0.125;
				const gearZ = 1.5;
				const axleRadius = 0.2;
				const toothHalfWidth = 0.11;
				const toothHalfHeight = 0.09;
				const toothRadius = 0.03;
				const linkHalfLength = 0.07;
				const linkRadius = 0.05;
				const linkCount = 40;
				const doorHalfHeight = 1.5;
				const doorHalfDepth = 1.95;
				const gearSides = 24;
				const axleSides = 12;
				const rockRadius = 0.3;
				const stairPoints = [
					{ x: -11.3, y: -0.2167 }, { x: 9.3375, y: -0.2167 }, { x: 9.3375, y: 7.1917 }, { x: 8.8083, y: 7.1917 },
					{ x: 8.8083, y: 0.3125 }, { x: 0.3417, y: 0.3125 }, { x: 0.3417, y: 0.8417 }, { x: -0.1875, y: 0.8417 },
					{ x: -0.1875, y: 1.3708 }, { x: -0.7167, y: 1.3708 }, { x: -0.7167, y: 1.9 }, { x: -1.2458, y: 1.9 },
					{ x: -1.2458, y: 2.4292 }, { x: -1.775, y: 2.4292 }, { x: -1.775, y: 2.9583 }, { x: -2.3042, y: 2.9583 },
					{ x: -2.3042, y: 3.4875 }, { x: -2.8333, y: 3.4875 }, { x: -2.8333, y: 4.0167 }, { x: -3.3625, y: 4.0167 },
					{ x: -3.3625, y: 4.5458 }, { x: -3.8917, y: 4.5458 }, { x: -3.8917, y: 5.075 }, { x: -4.4208, y: 5.075 },
					{ x: -4.4208, y: 5.6042 }, { x: -4.95, y: 5.6042 }, { x: -4.95, y: 6.1333 }, { x: -5.4792, y: 6.1333 },
					{ x: -5.4792, y: 6.6625 }, { x: -6.0083, y: 6.6625 }, { x: -6.0083, y: 7.1917 }, { x: -11.3, y: 7.1917 },
				];
				let driverJoint = 0;
				let motorTorque = 30000;
				let motorSpeed = -0.3;
				let enableMotor = true;

				function createGearBody( position, toothCenterRadius )
				{
					const hulls = [
						{
							points: createZCylinderHullPoints( gearRadius, -gearZ - gearHalfDepth, -gearZ + gearHalfDepth, gearSides ),
							friction: 0.1,
							color: 0x8b5a2b,
						},
						{
							points: createZCylinderHullPoints( gearRadius, gearZ - gearHalfDepth, gearZ + gearHalfDepth, gearSides ),
							friction: 0.1,
							color: 0x8b5a2b,
						},
						{
							points: createZCylinderHullPoints( axleRadius, -gearZ, gearZ, axleSides ),
							friction: 0.1,
							color: 0x708090,
						},
					];

					const toothCount = 16;
					for ( let toothIndex = 0; toothIndex < toothCount; toothIndex += 1 )
					{
						const angle = 2 * Math.PI * toothIndex / toothCount;
						hulls.push( {
							points: createGearToothPoints( toothCenterRadius, -gearZ, angle, toothHalfWidth, toothHalfHeight, toothRadius, gearHalfDepth ),
							friction: 0.1,
							color: 0x7f7f7f,
						} );
						hulls.push( {
							points: createGearToothPoints( toothCenterRadius, gearZ, angle, toothHalfWidth, toothHalfHeight, toothRadius, gearHalfDepth ),
							friction: 0.1,
							color: 0x7f7f7f,
						} );
					}

					return ctx.physics.createCompoundBody( {
						type: BodyType.dynamic,
						position,
						hulls,
					} );
				}

				function createChain( topBody, attach )
				{
					let previousBody = topBody;
					let previousPivot = attach;
					let positionY = attach.y - linkHalfLength;

					for ( let index = 0; index < linkCount; index += 1 )
					{
						const bodyHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: attach.x, y: positionY, z: attach.z },
							capsule: {
								center1: { x: 0, y: -linkHalfLength, z: 0 },
								center2: { x: 0, y: linkHalfLength, z: 0 },
								radius: linkRadius,
							},
							color: 0xb0c4de,
						} );

						const pivot = { x: attach.x, y: positionY + linkHalfLength, z: attach.z };
						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: previousBody,
							bodyB: bodyHandle,
							anchor: pivot,
							enableMotor: true,
							maxMotorTorque: 0.05,
						} );

						previousBody = bodyHandle;
						previousPivot = pivot;
						positionY -= 2 * linkHalfLength;
					}

					return { bodyHandle: previousBody, pivot: previousPivot };
				}

				function createDoor( groundHandle, doorPosition, nearLink, farLink )
				{
					const doorHandle = ctx.physics.createBoxBody( {
						type: BodyType.dynamic,
						position: doorPosition,
						size: { hx: 0.05, hy: doorHalfHeight, hz: doorHalfDepth },
						density: 0.5,
						friction: 0.1,
						color: 0x008b8b,
					} );

					for ( const linkInfo of [ nearLink, farLink ] )
					{
						const pivot = { x: doorPosition.x, y: doorPosition.y + doorHalfHeight, z: linkInfo.depth };
						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: linkInfo.bodyHandle,
							bodyB: doorHandle,
							anchor: pivot,
							enableMotor: true,
							maxMotorTorque: 50,
						} );
					}

					const slideAxis = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.5 * Math.PI );
					ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
						bodyA: groundHandle,
						bodyB: doorHandle,
						localFrameA: {
							position: doorPosition,
							rotation: slideAxis,
						},
						localFrameB: {
							position: { x: 0, y: 0, z: 0 },
							rotation: slideAxis,
						},
						enableMotor: true,
						maxMotorForce: 200,
						collideConnected: true,
					} );
				}

				function createDebris()
				{
					let seed = 1337;
					function random()
					{
						seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0;
						return seed / 0x100000000;
					}

					const colors = [ 0x808080, 0xdcdcdc, 0xd3d3d3, 0x778899, 0xa9a9a9 ];
					let x = -5;
					for ( let i = 0; i < 12; i += 1 )
					{
						let y = 6.5 - 0.25 * i;
						for ( let j = 0; j < 10; j += 1 )
						{
							ctx.physics.createHullBody( {
								type: BodyType.dynamic,
								position: { x, y, z: -1.65 + 2 * random() },
								rotation: axisAngleToQuaternion( { x: random(), y: random(), z: random() }, 2 * Math.PI * random() ),
								points: createRockPoints( rockRadius, random ),
								rollingResistance: 0.3,
								color: colors[Math.floor( random() * colors.length )],
							} );
							y += 0.2;
						}
						x += 0.3;
					}
				}

				function setMotorState()
				{
					ctx.box3d.api.enableRevoluteJointMotor( driverJoint, enableMotor );
					ctx.box3d.api.setRevoluteJointMaxMotorTorque( driverJoint, motorTorque );
					ctx.box3d.api.setRevoluteJointMotorSpeed( driverJoint, motorSpeed );
					ctx.box3d.api.wakeJointBodies( driverJoint );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						const stairMesh = createPrismMeshFromLoop( stairPoints, -2, 2 );
						const meshResource = ctx.physics.createCustomMesh( {
							vertices: stairMesh.vertices,
							indices: stairMesh.indices,
							identifyEdges: true,
							weldVertices: true,
							weldTolerance: 0.001,
						} );
						ctx.physics.addMeshShape( groundHandle, {
							mesh: meshResource,
							bodyType: BodyType.static,
							color: 0x8fbc8f,
						} );
						ctx.physics.addBoxShape( groundHandle, {
							bodyType: BodyType.static,
							size: { hx: 10.31875, hy: 3.7042, hz: 0.05 },
							localPosition: { x: -0.98125, y: 3.4875, z: -2.05 },
							color: 0x8fbc8f,
						} );

						const gearPosition1 = { x: -4.25, y: 9.75, z: 0 };
						const gearPosition2 = { x: -2.25, y: 10.75, z: 0 };
						const driverBody = createGearBody( gearPosition1, gearRadius + toothHalfHeight );
						const followerBody = createGearBody( gearPosition2, gearRadius + toothHalfWidth );

						driverJoint = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: driverBody,
							anchor: gearPosition1,
							enableMotor: enableMotor,
							maxMotorTorque: motorTorque,
							motorSpeed: motorSpeed,
						} );

						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: followerBody,
							localFrameA: {
								position: gearPosition2,
								rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.25 * Math.PI ),
							},
							localFrameB: {
								position: { x: 0, y: 0, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							enableMotor: true,
							maxMotorTorque: 0.5,
							lowerAngle: -0.3 * Math.PI,
							upperAngle: 0.8 * Math.PI,
							enableLimit: true,
						} );

						const linkAttach = { x: gearPosition2.x + gearRadius + 2 * toothHalfWidth + toothRadius, y: gearPosition2.y, z: 0 };
						const doorPosition = {
							x: linkAttach.x,
							y: linkAttach.y - ( 2 * linkCount * linkHalfLength + doorHalfHeight ),
							z: 0,
						};
						const nearLink = createChain( followerBody, { x: linkAttach.x, y: linkAttach.y, z: -gearZ } );
						const farLink = createChain( followerBody, { x: linkAttach.x, y: linkAttach.y, z: gearZ } );
						createDoor(
							groundHandle,
							doorPosition,
							{ bodyHandle: nearLink.bodyHandle, depth: -gearZ },
							{ bodyHandle: farLink.bodyHandle, depth: gearZ }
						);

						createDebris();
						ctx.setCameraLookAt( { x: 16.2, y: 10.8, z: 16.7 }, { x: -1.5, y: 4.5, z: 0 } );
					},

					buildUI( panel )
					{
						panel.addButton( enableMotor ? "Motor: On" : "Motor: Off", () =>
						{
							enableMotor = !enableMotor;
							setMotorState();
						} );
						panel.add( "Max Torque", motorTorque, { min: 0, max: 100000, step: 100 }, ( value ) =>
						{
							motorTorque = value;
							setMotorState();
						} );
						panel.add( "Speed", motorSpeed, { min: -0.3, max: 0.3, step: 0.01 }, ( value ) =>
						{
							motorSpeed = value;
							setMotorState();
						} );
					},

					getStatusLines()
					{
						return [
							`motor: ${enableMotor ? "on" : "off"}`,
							`max torque: ${motorTorque.toFixed( 0 )}`,
							`speed: ${motorSpeed.toFixed( 2 )}`,
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
