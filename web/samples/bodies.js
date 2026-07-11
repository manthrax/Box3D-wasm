import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createBodySamples( { BodyType } )
{
	return [
		{
			key: "bodies-body-type",
			label: "Bodies / Body Type",
			description:
				"A close browser port of the native body-type sample. It bundles type switching, a driven kinematic platform, and selective body enablement into one compact regression scene.",
			create( ctx )
			{
				const speed = 3;
				const typeLabels = {
					[BodyType.static]: "static",
					[BodyType.kinematic]: "kinematic",
					[BodyType.dynamic]: "dynamic",
				};
				const state = {
					type: BodyType.dynamic,
					enabled: true,
					attachmentHandle: 0,
					secondAttachmentHandle: 0,
					platformHandle: 0,
					payloadHandle: 0,
					secondPayloadHandle: 0,
					touchingHandle: 0,
					floatingHandle: 0,
				};

				function setType( bodyType )
				{
					state.type = bodyType;
					const managedBodies = [
						state.platformHandle,
						state.secondAttachmentHandle,
						state.secondPayloadHandle,
						state.touchingHandle,
						state.floatingHandle,
					];

					for ( const bodyHandle of managedBodies )
					{
						if ( bodyHandle !== 0 )
						{
							ctx.physics.setBodyType( bodyHandle, bodyType );
						}
					}

					if ( bodyType === BodyType.kinematic )
					{
						ctx.physics.setBodyLinearVelocity( state.platformHandle, { x: -speed, y: 0, z: 0 } );
						ctx.physics.setBodyAngularVelocity( state.platformHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyLinearVelocity( state.secondAttachmentHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyAngularVelocity( state.secondAttachmentHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyLinearVelocity( state.secondPayloadHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyAngularVelocity( state.secondPayloadHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyLinearVelocity( state.touchingHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyAngularVelocity( state.touchingHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyLinearVelocity( state.floatingHandle, { x: 0, y: 0, z: 0 } );
						ctx.physics.setBodyAngularVelocity( state.floatingHandle, { x: 0, y: 0, z: 0 } );
					}

					for ( const bodyHandle of managedBodies )
					{
						if ( bodyHandle !== 0 )
						{
							ctx.physics.setBodyAwake( bodyHandle, true );
						}
					}
				}

				function setEnabled( enabled )
				{
					state.enabled = enabled;
					const toggledBodies = [
						state.attachmentHandle,
						state.secondPayloadHandle,
						state.floatingHandle,
					];

					for ( const bodyHandle of toggledBodies )
					{
						if ( bodyHandle === 0 )
						{
							continue;
						}

						if ( enabled )
						{
							ctx.physics.enableBody( bodyHandle );
							ctx.physics.setBodyAwake( bodyHandle, true );
						}
						else
						{
							ctx.physics.disableBody( bodyHandle );
						}
					}
				}

				return {
					reset()
					{
						state.type = BodyType.dynamic;
						state.enabled = true;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );

						state.attachmentHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: -2, y: 3, z: 0 },
							size: { hx: 0.5, hy: 2, hz: 0.5 },
							density: 1,
							color: 0x7d8a94,
						} );

						state.secondAttachmentHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 3, y: 3, z: 0 },
							size: { hx: 0.5, hy: 2, hz: 0.5 },
							density: 1,
							color: 0xca8754,
						} );

						state.platformHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 5, z: 0 },
							size: { hx: 4, hy: 0.5, hz: 0.5 },
							density: 2,
							color: 0xcf7847,
						} );

						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: state.attachmentHandle,
							bodyB: state.platformHandle,
							anchor: { x: -2, y: 5, z: 0 },
							maxMotorTorque: 50,
							enableMotor: true,
						} );

						ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: state.secondAttachmentHandle,
							bodyB: state.platformHandle,
							anchor: { x: 3, y: 5, z: 0 },
							maxMotorTorque: 50,
							enableMotor: true,
						} );

						ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
							bodyA: groundHandle,
							bodyB: state.platformHandle,
							localFrameA: {
								position: { x: 0, y: 5, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							localFrameB: {
								position: { x: 0, y: 0, z: 0 },
								rotation: { x: 0, y: 0, z: 0, w: 1 },
							},
							maxMotorForce: 1000,
							motorSpeed: 0,
							enableMotor: true,
							lowerTranslation: -10,
							upperTranslation: 10,
							enableLimit: true,
						} );

						state.payloadHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: -3, y: 8, z: 0 },
							size: { hx: 0.75, hy: 0.75, hz: 0.75 },
							density: 2,
							color: 0x557cb2,
						} );

						state.secondPayloadHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 2, y: 8, z: 0 },
							size: { hx: 0.75, hy: 0.75, hz: 0.75 },
							density: 2,
							color: 0xc28a59,
						} );

						state.touchingHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 8, y: 0.2, z: 0 },
							capsule: {
								center1: { x: 0, y: 0, z: 0 },
								center2: { x: 1, y: 0, z: 0 },
								radius: 0.25,
							},
							density: 2,
							color: 0x6ba084,
						} );

						state.floatingHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: -8, y: 12, z: 0 },
							radius: 0.25,
							density: 2,
							gravityScale: 0,
							color: 0xa96ec4,
						} );

						ctx.setCameraLookAt( { x: 0, y: 30, z: 30 }, { x: 0, y: 1.5, z: 0 } );
					},

					update()
					{
						if ( state.type !== BodyType.kinematic || state.platformHandle === 0 )
						{
							return;
						}

						const position = ctx.physics.getBodyTransform( state.platformHandle ).position;
						const velocity = ctx.physics.getBodyLinearVelocity( state.platformHandle );
						if ( ( position.x < -14 && velocity.x < 0 ) || ( position.x > 6 && velocity.x > 0 ) )
						{
							ctx.physics.setBodyLinearVelocity( state.platformHandle, { x: -velocity.x, y: velocity.y, z: velocity.z } );
							ctx.physics.setBodyAwake( state.platformHandle, true );
						}
					},

					buildUI( panel )
					{
						panel.addButton( "Set Static", () =>
						{
							setType( BodyType.static );
						} );
						panel.addButton( "Set Kinematic", () =>
						{
							setType( BodyType.kinematic );
						} );
						panel.addButton( "Set Dynamic", () =>
						{
							setType( BodyType.dynamic );
						} );
						panel.addButton( "Toggle Select Bodies", () =>
						{
							setEnabled( !state.enabled );
						} );
					},

					getStatusLines()
					{
						const platformPosition = state.platformHandle === 0
							? null
							: ctx.physics.getBodyTransform( state.platformHandle ).position;
						return [
							`type: ${typeLabels[state.type]}`,
							`enabled subset: ${state.enabled ? "yes" : "no"}`,
							platformPosition == null ? "platform x: n/a" : `platform x: ${platformPosition.x.toFixed( 2 )}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-spinning-book",
			label: "Bodies / Spinning Book",
			description:
				"Three thin dynamic boxes spin around different principal axes with zero gravity, matching the native gyroscopic sanity sample. It is a compact parity scene and a nice check that angular velocity survives the wasm bridge cleanly.",
			create( ctx )
			{
				const bookSize = { hx: 0.35, hy: 0.08, hz: 0.5 };
				const bodies = [];

				return {
					reset()
					{
						bodies.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );

						bodies.push( ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: -2, y: 2, z: 0 },
							size: bookSize,
							gravityScale: 0,
							angularVelocity: { x: 5, y: 0.01, z: 0.01 },
							color: 0xd17c49,
						} ) );

						bodies.push( ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2, z: 0 },
							size: bookSize,
							gravityScale: 0,
							angularVelocity: { x: 0.01, y: 5, z: 0.01 },
							color: 0xc68f58,
						} ) );

						bodies.push( ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 2, y: 2, z: 0 },
							size: bookSize,
							gravityScale: 0,
							angularVelocity: { x: 0.01, y: 0.01, z: -5 },
							color: 0xb78456,
						} ) );

						ctx.setCameraLookAt( { x: 0, y: 30, z: 10 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							"expected: each book should keep spinning about a different dominant axis",
							`books: ${bodies.length}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-gyroscopic-torque",
			label: "Bodies / Gyroscopic Torque",
			description:
				"A browser port of the native Dzhanibekov-style sample. A zero-gravity compound rotor spins rapidly so we can sanity-check gyroscopic behavior, compound mass properties, and angular velocity fidelity through the wasm bridge.",
			create( ctx )
			{
				let bodyHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						bodyHandle = ctx.physics.createCylinderBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2, z: 0 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, -0.5 * Math.PI ),
							cylinder: { height: 1.2, radius: 0.15, yOffset: 0, sides: 32 },
							gravityScale: 0,
							color: 0xd17c49,
						} );

						ctx.physics.addBoxShape( bodyHandle, {
							bodyType: BodyType.dynamic,
							size: { hx: 1.0, hy: 0.05, hz: 0.1 },
							density: 1,
							color: 0x4d92d5,
						} );

						ctx.physics.setBodyAngularVelocity( bodyHandle, { x: 0.01, y: 0.01, z: 10.0 } );
						ctx.setCameraLookAt( { x: 0, y: 20, z: 4 }, { x: 0, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						const center = bodyHandle === 0 ? null : ctx.physics.getBodyWorldCenter( bodyHandle );
						return [
							"expected: the compound rotor should exhibit gyroscopic wobble rather than simple planar spin",
							center == null ? "center: n/a" : `center: ${center.x.toFixed( 2 )}, ${center.y.toFixed( 2 )}, ${center.z.toFixed( 2 )}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-gyroscopic-precession",
			label: "Bodies / Gyroscopic Precession",
			description:
				"A browser port of the disabled native top-precession experiment. A tilted spinning top is initialized with high angular speed so we can inspect precession behavior, fast-rotation support, and contact stability in the wasm build.",
			create( ctx )
			{
				let bodyHandle = 0;

				function createTopPoints()
				{
					const points = [];
					const segmentCount = 7;
					const radius = 2.0;
					const height = 2.0;
					for ( let index = 0; index < segmentCount; index += 1 )
					{
						const angle = 2 * Math.PI * index / segmentCount;
						points.push( {
							x: radius * Math.cos( angle ),
							y: height,
							z: radius * Math.sin( angle ),
						} );
					}
					points.push( { x: 0, y: 0, z: 0 } );
					return points;
				}

				return {
					reset()
					{
						const tiltRotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 15 * DEG_TO_RAD );
						const spinAxis = { x: 0, y: 75, z: 0 };
						const sinHalf = Math.sin( 15 * DEG_TO_RAD * 0.5 );
						const cosHalf = Math.cos( 15 * DEG_TO_RAD * 0.5 );
						const angularVelocity = {
							x: cosHalf * spinAxis.x - sinHalf * spinAxis.y,
							y: sinHalf * spinAxis.x + cosHalf * spinAxis.y,
							z: spinAxis.z,
						};

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 30, hy: 0.5, hz: 30 } } );

						bodyHandle = ctx.physics.createHullBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 0.02, z: 0 },
							rotation: tiltRotation,
							points: createTopPoints(),
							gravityScale: 0,
							allowFastRotation: true,
							angularVelocity,
							color: 0xc67a49,
						} );

						ctx.setCameraLookAt( { x: 0, y: 22, z: 50 }, { x: 0, y: 1.5, z: 0 } );
					},

					getStatusLines()
					{
						const transform = bodyHandle === 0 ? null : ctx.physics.getBodyTransform( bodyHandle );
						const omega = bodyHandle === 0 ? null : ctx.physics.getBodyAngularVelocity( bodyHandle );
						return [
							"expected: the tilted top should precess instead of only spinning in place",
							transform == null ? "tilt: n/a" : `tip height: ${transform.position.y.toFixed( 2 )}`,
							omega == null ? "angular speed: n/a" : `angular speed: ${Math.hypot( omega.x, omega.y, omega.z ).toFixed( 2 )}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-weeble",
			label: "Bodies / Weeble",
			description:
				"A close port of the native weighted-capsule weeble. The browser sample exposes the same core behavior by shifting the center of mass downward, then letting us teleport or explode the body to verify self-righting behavior.",
			create( ctx )
			{
				let weebleHandle = 0;
				let explosionMagnitude = 20000.0;
				const explosionPosition = { x: 0, y: -0.1, z: 0 };
				const explosionRadius = 8.0;

				function applyWeebleMass()
				{
					const massData = ctx.physics.getBodyMassData( weebleHandle );
					const offset = { x: 0, y: -1.5, z: 0 };
					const mass = massData.mass;
					const xx = mass * ( offset.y * offset.y + offset.z * offset.z );
					const yy = mass * ( offset.x * offset.x + offset.z * offset.z );
					const zz = mass * ( offset.x * offset.x + offset.y * offset.y );
					const xy = -mass * offset.x * offset.y;
					const xz = -mass * offset.x * offset.z;
					const yz = -mass * offset.y * offset.z;
					ctx.physics.setBodyMassData( weebleHandle, {
						mass,
						center: offset,
						inertia: {
							cx: {
								x: massData.inertia.cx.x + xx,
								y: massData.inertia.cx.y + xy,
								z: massData.inertia.cx.z + xz,
							},
							cy: {
								x: massData.inertia.cy.x + xy,
								y: massData.inertia.cy.y + yy,
								z: massData.inertia.cy.z + yz,
							},
							cz: {
								x: massData.inertia.cz.x + xz,
								y: massData.inertia.cz.y + yz,
								z: massData.inertia.cz.z + zz,
							},
						},
					} );
				}

				function teleport()
				{
					if ( weebleHandle === 0 )
					{
						return;
					}

					ctx.physics.setBodyTransform( weebleHandle, {
						position: { x: 0, y: 5, z: 0 },
						rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.95 * Math.PI ),
					} );
					ctx.physics.setBodyAwake( weebleHandle, true );
				}

				function explode()
				{
					ctx.box3d.api.explodeWorld( ctx.physics.worldHandle, {
						position: explosionPosition,
						radius: explosionRadius,
						falloff: 0.1,
						impulsePerArea: explosionMagnitude,
					} );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 30, hy: 0.5, hz: 30 } } );
						weebleHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 3, z: 0 },
							capsule: {
								center1: { x: 0, y: -1, z: 0 },
								center2: { x: 0, y: 1, z: 0 },
								radius: 1,
							},
							rollingResistance: 0.1,
							color: 0xd17a48,
						} );
						applyWeebleMass();
						ctx.setCameraLookAt( { x: 18, y: 12, z: 18 }, { x: 0, y: 1, z: 0 } );
					},

					buildUI( panel )
					{
						panel.addButton( "Teleport", teleport );
						panel.addButton( "Explode", explode );
						panel.add( "Magnitude", explosionMagnitude, { min: -100000, max: 100000, step: 100 }, ( value ) =>
						{
							explosionMagnitude = value;
						} );
					},

					getStatusLines()
					{
						const transform = weebleHandle === 0 ? null : ctx.physics.getBodyTransform( weebleHandle );
						return [
							"expected: the weighted capsule should self-right after teleports and blast impulses",
							transform == null ? "tilt: n/a" : `height: ${transform.position.y.toFixed( 2 )}`,
							`explosion magnitude: ${explosionMagnitude.toFixed( 0 )}`,
						];
					},
				};
			},
		},
		{
			key: "bodies-cast",
			label: "Bodies / Cast",
			description:
				"A browser port of the native body-query sample. A controllable cylinder body is used as the target for a ray cast, a sphere shape cast, a capsule overlap test, and a capsule mover-collision query, all drawn with debug overlays.",
			create( ctx )
			{
				let bodyHandle = 0;
				let queryPosition = { x: -10.0, y: 2.0, z: 0.0 };
				const queryRotationAxis = { x: 1 / Math.sqrt( 14 ), y: -2 / Math.sqrt( 14 ), z: 3 / Math.sqrt( 14 ) };
				const queryRotation = axisAngleToQuaternion( queryRotationAxis, 0.75 * Math.PI );
				const keys = {};

				function handleKeyDown( event )
				{
					keys[event.key.toLowerCase()] = true;
				}

				function handleKeyUp( event )
				{
					keys[event.key.toLowerCase()] = false;
				}

				function getBodyTransform()
				{
					return {
						position: queryPosition,
						rotation: queryRotation,
					};
				}

				function syncBodyTransform()
				{
					ctx.physics.setBodyTransform( bodyHandle, getBodyTransform() );
					ctx.physics.setBodyAwake( bodyHandle, true );
				}

				return {
					reset()
					{
						queryPosition = { x: -10.0, y: 2.0, z: 0.0 };
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						bodyHandle = ctx.physics.createCylinderBody( {
							type: BodyType.kinematic,
							position: queryPosition,
							rotation: queryRotation,
							cylinder: { height: 2.0, radius: 0.5, yOffset: 0, sides: 16 },
							color: 0x4d92d5,
							enableSleep: false,
						} );
						window.addEventListener( "keydown", handleKeyDown );
						window.addEventListener( "keyup", handleKeyUp );
						ctx.setCameraLookAt( { x: -2, y: 8, z: 18 }, { x: -10, y: 2, z: 0 } );
					},

					update( dt )
					{
						let moved = false;
						const speed = 4.0 * dt;
						if ( keys["a"] || keys["arrowleft"] )
						{
							queryPosition.x -= speed;
							moved = true;
						}
						if ( keys["d"] || keys["arrowright"] )
						{
							queryPosition.x += speed;
							moved = true;
						}
						if ( keys["w"] || keys["arrowup"] )
						{
							queryPosition.z -= speed;
							moved = true;
						}
						if ( keys["s"] || keys["arrowdown"] )
						{
							queryPosition.z += speed;
							moved = true;
						}
						if ( keys["q"] )
						{
							queryPosition.y += speed;
							moved = true;
						}
						if ( keys["e"] )
						{
							queryPosition.y -= speed;
							moved = true;
						}
						if ( moved )
						{
							syncBodyTransform();
						}

						const bodyTransform = getBodyTransform();

						{
							const origin = { x: -9.75, y: 3.0, z: -4.0 };
							const translation = { x: 0, y: 0, z: 8.0 };
							const result = ctx.physics.bodyCastRay( bodyHandle, {
								bodyTransform,
								origin,
								translation,
								maxFraction: 1,
							} );
							ctx.physics.addDebugLine( origin, { x: origin.x + translation.x, y: origin.y + translation.y, z: origin.z + translation.z }, 0x4fd8ff );
							ctx.physics.addDebugPoint( origin, 0x6ee36a );
							ctx.physics.addDebugPoint( { x: origin.x + translation.x, y: origin.y + translation.y, z: origin.z + translation.z }, 0xff5555 );
							if ( result.hit )
							{
								ctx.physics.addDebugPoint( result.point, 0xf6e65a );
								ctx.physics.addDebugLine( result.point, {
									x: result.point.x + 0.2 * result.normal.x,
									y: result.point.y + 0.2 * result.normal.y,
									z: result.point.z + 0.2 * result.normal.z,
								}, 0xf6e65a );
							}
						}

						{
							const origin = { x: -14.5, y: 2.5, z: 0.5 };
							const translation = { x: 8.0, y: 0.0, z: 0.0 };
							const result = ctx.physics.bodyCastShape( bodyHandle, {
								bodyTransform,
								origin,
								points: [ { x: 0, y: 0, z: 0 } ],
								radius: 0.2,
								translation,
								maxFraction: 1,
								canEncroach: true,
							} );
							const endPoint = result.hit
								? { x: origin.x + result.fraction * translation.x, y: origin.y + result.fraction * translation.y, z: origin.z + result.fraction * translation.z }
								: { x: origin.x + translation.x, y: origin.y + translation.y, z: origin.z + translation.z };
							ctx.physics.addDebugLine( origin, { x: origin.x + translation.x, y: origin.y + translation.y, z: origin.z + translation.z }, 0xffffff );
							ctx.physics.addDebugPoint( origin, 0x6ee36a );
							ctx.physics.addDebugPoint( { x: origin.x + translation.x, y: origin.y + translation.y, z: origin.z + translation.z }, 0xff5555 );
							ctx.physics.addDebugPoint( endPoint, result.hit ? 0x6ee36a : 0xffffff );
							if ( result.hit )
							{
								ctx.physics.addDebugLine( result.point, {
									x: result.point.x + 0.2 * result.normal.x,
									y: result.point.y + 0.2 * result.normal.y,
									z: result.point.z + 0.2 * result.normal.z,
								}, 0xf6e65a );
							}
						}

						{
							const origin = { x: -10.0, y: 1.0, z: 0.5 };
							const overlaps = ctx.physics.bodyOverlapShape( bodyHandle, {
								bodyTransform,
								origin,
								points: [
									{ x: -0.5, y: 1.0, z: 0.0 },
									{ x: 0.5, y: 0.0, z: 0.0 },
								],
								radius: 0.5,
							} );
							ctx.physics.addDebugPoint( origin, overlaps ? 0x6ee36a : 0x808080 );
						}

						{
							const origin = { x: -10.0, y: 2.0, z: -0.75 };
							const planes = ctx.physics.bodyCollideMover( bodyHandle, {
								bodyTransform,
								origin,
								capsule: {
									center1: { x: -0.25, y: 0.0, z: 0.0 },
									center2: { x: 0.25, y: 1.0, z: 0.0 },
									radius: 0.3,
								},
								maxPlanes: 4,
							} );
							for ( const plane of planes )
							{
								ctx.physics.addDebugPoint( plane.point, 0xf39c32 );
								ctx.physics.addDebugLine( plane.point, {
									x: plane.point.x + 0.5 * plane.plane.normal.x,
									y: plane.point.y + 0.5 * plane.plane.normal.y,
									z: plane.point.z + 0.5 * plane.plane.normal.z,
								}, 0xf39c32 );
							}
						}
					},

					getStatusLines()
					{
						return [
							"use WASD/arrow keys to move, Q/E to move vertically",
							`query position: ${queryPosition.x.toFixed( 2 )}, ${queryPosition.y.toFixed( 2 )}, ${queryPosition.z.toFixed( 2 )}`,
							"debug colors: cyan ray, white shape cast, green overlap hit, orange mover planes",
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
			key: "bodies-disable",
			label: "Bodies / Disable",
			description:
				"A short welded capsule chain plus a loose ball, matching the native enable-disable sample. The browser UI keeps the interaction simple while still exercising body enablement state and welded-chain behavior.",
			create( ctx )
			{
				const linkCount = 4;
				const linkRadius = 0.1;
				const linkLength = 5 * linkRadius;
				const linkCapsule = {
					center1: { x: 0, y: 0, z: 0 },
					center2: { x: 0, y: -linkLength, z: 0 },
					radius: linkRadius,
				};
				const state = {
					links: [],
					ballHandle: 0,
					linkEnabled: true,
					ballEnabled: true,
				};

				function updateLinkEnabled( enabled )
				{
					state.linkEnabled = enabled;
					const target = state.links[2] ?? 0;
					if ( target === 0 )
					{
						return;
					}

					if ( enabled )
					{
						ctx.physics.enableBody( target );
						ctx.physics.setBodyAwake( target, true );
					}
					else
					{
						ctx.physics.disableBody( target );
					}
				}

				function updateBallEnabled( enabled )
				{
					state.ballEnabled = enabled;
					if ( state.ballHandle === 0 )
					{
						return;
					}

					if ( enabled )
					{
						ctx.physics.enableBody( state.ballHandle );
						ctx.physics.setBodyAwake( state.ballHandle, true );
					}
					else
					{
						ctx.physics.disableBody( state.ballHandle );
					}
				}

				return {
					reset()
					{
						state.links = [];
						state.ballHandle = 0;
						state.linkEnabled = true;
						state.ballEnabled = true;

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						let parentHandle = 0;
						for ( let link = 0; link < linkCount; link += 1 )
						{
							const bodyHandle = ctx.physics.createCapsuleBody( {
								type: link === 0 ? BodyType.kinematic : BodyType.dynamic,
								position: { x: 0, y: ( linkCount - link ) * linkLength + 1, z: 0 },
								capsule: linkCapsule,
								color: link === 0 ? 0x7a8790 : 0xcf7e49,
							} );
							state.links.push( bodyHandle );

							if ( parentHandle !== 0 )
							{
								ctx.box3d.api.createWeldJoint( ctx.physics.worldHandle, {
									bodyA: parentHandle,
									bodyB: bodyHandle,
									anchor: { x: 0, y: ( linkCount - link ) * linkLength + 1, z: 0 },
									angularHertz: 10,
									angularDampingRatio: 1,
								} );
							}

							parentHandle = bodyHandle;
						}

						state.ballHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 3, y: 3, z: 0 },
							radius: 0.5,
							color: 0x4d92d5,
						} );

						ctx.setCameraLookAt( { x: 14, y: 10, z: 14 }, { x: 0, y: 1.5, z: 0 } );
					},

					update()
					{
						const impulseTarget = state.links[2] ?? 0;
						if ( impulseTarget !== 0 && state.linkEnabled )
						{
							const transform = ctx.physics.getBodyTransform( impulseTarget );
							ctx.physics.applyBodyLinearImpulse(
								impulseTarget,
								{ x: 0, y: 0.1, z: 0 },
								transform.position,
								true
							);
						}
					},

					buildUI( panel )
					{
						panel.addButton( "Toggle Link", () =>
						{
							updateLinkEnabled( !state.linkEnabled );
						} );
						panel.addButton( "Toggle Ball", () =>
						{
							updateBallEnabled( !state.ballEnabled );
						} );
					},

					getStatusLines()
					{
						return [
							`link enabled: ${state.linkEnabled ? "yes" : "no"}`,
							`ball enabled: ${state.ballEnabled ? "yes" : "no"}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
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
