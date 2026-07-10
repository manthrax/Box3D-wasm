export function createEventSamples( { BodyType } )
{
	return [
		{
			key: "events-sensor-visit",
			label: "Events / Sensor Visit",
			description:
				"A browser port of the native sensor-visit sample. A falling dynamic box overlaps a kinematic sensor volume, and the overlap event is used to consume the visitor body.",
			create( ctx )
			{
				let visitorHandle = 0;
				let consumedCount = 0;

				return {
					reset()
					{
						visitorHandle = 0;
						consumedCount = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						visitorHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 12.5, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							enableSensorEvents: true,
							color: 0xd67c42,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.kinematic,
							position: { x: 0, y: 2, z: 0 },
							size: { hx: 2, hy: 2, hz: 2 },
							isSensor: true,
							enableSensorEvents: true,
							color: 0x6e8fa3,
							roughness: 0.35,
							metalness: 0.05,
						} );

						ctx.setCameraLookAt( { x: 0, y: 10, z: 20 }, { x: 0, y: 5, z: 0 } );
					},

					update()
					{
						for ( const event of ctx.physics.getSensorBeginEvents() )
						{
							if ( event.visitorBody === visitorHandle && visitorHandle !== 0 )
							{
								ctx.physics.disableBody( visitorHandle );
								ctx.physics.setBodyTransform( visitorHandle, {
									position: { x: 0, y: -1000, z: 0 },
									rotation: { x: 0, y: 0, z: 0, w: 1 },
								} );
								consumedCount += 1;
								visitorHandle = 0;
								break;
							}
						}
					},

					getStatusLines()
					{
						return [
							visitorHandle === 0 ? "visitor consumed by sensor" : "visitor falling toward sensor",
							`consumed events: ${consumedCount}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "events-move",
			label: "Events / Move",
			description:
				"A browser port of the native move-event sample. A tall dynamic body swings across the scene while body move events report which handles moved and whether they fell asleep.",
			create( ctx )
			{
				let bodyHandle = 0;
				let latestMoveLines = [];

				return {
					reset()
					{
						bodyHandle = 0;
						latestMoveLines = [];
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 40, hy: 1, hz: 40 } } );

						bodyHandle = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 1, z: 0 },
						} );
						ctx.physics.addBoxShape( bodyHandle, {
							size: { hx: 0.5, hy: 10, hz: 0.5 },
							localPosition: { x: 0, y: 10, z: 0 },
							enableHitEvents: true,
							density: 1,
							color: 0xc68858,
						} );

						const pivot = { x: 0, y: 1, z: 0 };
						const center = ctx.physics.getBodyWorldCenter( bodyHandle );
						const r = {
							x: pivot.x - center.x,
							y: pivot.y - center.y,
							z: pivot.z - center.z,
						};
						const rr = r.x * r.x + r.y * r.y + r.z * r.z;
						const linearVelocity = { x: -10, y: 0, z: 0 };
						if ( rr > 0 )
						{
							const cross = {
								x: linearVelocity.y * r.z - linearVelocity.z * r.y,
								y: linearVelocity.z * r.x - linearVelocity.x * r.z,
								z: linearVelocity.x * r.y - linearVelocity.y * r.x,
							};
							ctx.physics.setBodyAngularVelocity( bodyHandle, {
								x: cross.x / rr,
								y: cross.y / rr,
								z: cross.z / rr,
							} );
						}
						ctx.physics.setBodyLinearVelocity( bodyHandle, linearVelocity );

						ctx.setCameraLookAt( { x: 0, y: 16, z: 34 }, { x: 0, y: 5, z: 0 } );
					},

					update()
					{
						const moveEvents = ctx.physics.getBodyMoveEvents();
						latestMoveLines = moveEvents.slice( 0, 4 ).map(
							( event ) => event.body === bodyHandle
								? `tracked body ${event.fellAsleep ? "fell asleep" : "moved this step"}`
								: `body ${event.body} ${event.fellAsleep ? "fell asleep" : "moved"}`
						);
					},

					getStatusLines()
					{
						const velocity = bodyHandle === 0 ? null : ctx.physics.getBodyLinearVelocity( bodyHandle );
						return [
							"expected: repeated move events while swinging, then one fell-asleep event at rest",
							`tracked body: ${bodyHandle}`,
							velocity == null ? "velocity unavailable" : `velocity: (${velocity.x.toFixed( 2 )}, ${velocity.y.toFixed( 2 )}, ${velocity.z.toFixed( 2 )})`,
							...( latestMoveLines.length > 0 ? latestMoveLines : [ "waiting for body move events" ] ),
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "events-hit",
			label: "Events / Hit",
			description:
				"A browser port of the native hit-event sample. Compound bodies made from stacked capsules whip into the ground and record hit events with approach speed and material metadata.",
			create( ctx )
			{
				const recentHits = [];

				return {
					reset()
					{
						recentHits.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 80, hy: 1, hz: 80 },
							color: 0x7e6d5d,
							userMaterialId: 1,
						} );

						let radius = 0.75;
						let y = radius;
						const length = 1.5;
						let offset = 0.05;
						let velocityScale = 0.5;
						const shapeCount = 22;
						const shapesPerBody = 3;
						const origin = { x: 0, y: 0, z: 0 };

						let bodyHandle = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: origin,
						} );

						for ( let index = 0; index < shapeCount; index += 1 )
						{
							ctx.physics.addCapsuleShape( bodyHandle, {
								capsule: {
									center1: { x: offset, y, z: 0 },
									center2: { x: 0, y: y + length, z: -offset },
									radius
								},
								enableHitEvents: true,
								rollingResistance: 0.2,
								userMaterialId: 42,
								density: 1,
								color: 0xd67c42,
								bodyType: BodyType.dynamic,
							} );

							const completeBody = ( index + 1 ) % shapesPerBody === 0 || index === shapeCount - 1;
							if ( completeBody )
							{
								const center = ctx.physics.getBodyWorldCenter( bodyHandle );
								const angularVelocity = { x: 0, y: 0, z: -velocityScale };
								ctx.physics.setBodyAngularVelocity( bodyHandle, angularVelocity );
								ctx.physics.setBodyLinearVelocity( bodyHandle, {
									x: -angularVelocity.z * ( center.y - origin.y ),
									y: angularVelocity.z * ( center.x - origin.x ),
									z: 0,
								} );

								if ( index < shapeCount - 1 )
								{
									const nextBodyHandle = ctx.physics.createBody( {
										type: BodyType.dynamic,
										position: origin,
									} );

									ctx.box3d.api.createWeldJoint( ctx.physics.worldHandle, {
										bodyA: bodyHandle,
										bodyB: nextBodyHandle,
										anchor: { x: 0, y: y + length + radius, z: 0 },
									} );

									bodyHandle = nextBodyHandle;
									velocityScale *= 0.75;
								}
							}

							y += length + 2 * radius;
							radius *= 0.95;
							offset = -offset;
						}

						if ( bodyHandle !== 0 )
						{
							ctx.physics.setBodyAwake( bodyHandle, true );
						}

						ctx.setCameraLookAt( { x: 0, y: 30, z: 100 }, { x: 0, y: 12, z: 0 } );
					},

					update()
					{
						for ( const event of ctx.physics.getContactHitEvents() )
						{
							recentHits.unshift( event );
						}
						recentHits.splice( 8 );
					},

					getStatusLines()
					{
						const lines = [
							"expected: several capsule clusters should sweep down and register ground hit events",
							`recent hit events: ${recentHits.length}`,
						];
						for ( const event of recentHits.slice( 0, 4 ) )
						{
							lines.push(
								`speed ${event.approachSpeed.toFixed( 1 )} at y=${event.point.y.toFixed( 2 )} material=${event.userMaterialIdA}`
							);
						}
						if ( recentHits.length === 0 )
						{
							lines.push( "waiting for hit events" );
						}
						lines.push( `bodies: ${ctx.physics.getBodyCount()}` );
						return lines;
					},
				};
			},
		},
		{
			key: "events-joint",
			label: "Events / Joint",
			description:
				"A browser port of the native joint-threshold scene. Several joint types are stressed until they exceed force/torque budgets, then they are removed and reported in the status text.",
			create( ctx )
			{
				const thresholds = {
					force: 3000,
					torque: 10000,
				};
				const tracked = [];
				const broken = [];

				function registerJoint( label, jointHandle )
				{
					tracked.push( {
						label,
						jointHandle,
						broken: false,
					} );
				}

				return {
					reset()
					{
						tracked.length = 0;
						broken.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 20, hy: 1, hz: 20 } } );

						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						const basePosition = { x: -12.5, y: 10, z: 0 };

						function createDynamicBox( x )
						{
							return ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x, y: basePosition.y, z: 0 },
								size: { hx: 1, hy: 1, hz: 0.5 },
								density: 1,
								enableSleep: false,
								color: 0xd67c42,
							} );
						}

						{
							const body = createDynamicBox( basePosition.x );
							registerJoint(
								"distance",
								ctx.box3d.api.createDistanceJoint( ctx.physics.worldHandle, {
									bodyA: groundHandle,
									bodyB: body,
									anchorA: { x: basePosition.x, y: basePosition.y + 3, z: 0 },
									anchorB: { x: basePosition.x, y: basePosition.y + 1, z: 0 },
									length: 2,
									minLength: 2,
									maxLength: 2,
								} )
							);
						}

						{
							const x = basePosition.x + 10;
							const body = createDynamicBox( x );
							registerJoint(
								"prismatic",
								ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
									bodyA: groundHandle,
									bodyB: body,
									localFrameA: { position: { x: x - 1, y: basePosition.y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
									localFrameB: { position: { x: x - 1, y: basePosition.y, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
								} )
							);
						}

						{
							const x = basePosition.x + 15;
							const body = createDynamicBox( x );
							registerJoint(
								"revolute",
								ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
									bodyA: groundHandle,
									bodyB: body,
									anchor: { x: x - 1, y: basePosition.y, z: 0 },
								} )
							);
						}

						{
							const x = basePosition.x + 20;
							const body = createDynamicBox( x );
							registerJoint(
								"weld",
								ctx.box3d.api.createWeldJoint( ctx.physics.worldHandle, {
									bodyA: groundHandle,
									bodyB: body,
									anchor: { x: x - 1, y: basePosition.y, z: 0 },
									angularHertz: 2,
									angularDampingRatio: 0.5,
								} )
							);
						}

						ctx.setCameraLookAt( { x: 0, y: 16, z: 40 }, { x: 0, y: 8, z: 0 } );
					},

					update()
					{
						for ( const joint of tracked )
						{
							if ( joint.broken || joint.jointHandle === 0 )
							{
								continue;
							}

							const force = ctx.box3d.api.getJointConstraintForceLength( joint.jointHandle );
							const torque = ctx.box3d.api.getJointConstraintTorqueLength( joint.jointHandle );
							if ( force > thresholds.force || torque > thresholds.torque )
							{
								ctx.box3d.api.destroyJoint( joint.jointHandle, true );
								joint.broken = true;
								broken.unshift( `${joint.label} broke (force ${force.toFixed( 0 )}, torque ${torque.toFixed( 0 )})` );
								broken.splice( 6 );
							}
						}
					},

					getStatusLines()
					{
						const intactCount = tracked.filter( ( joint ) => joint.broken === false ).length;
						return [
							"joints are polled for high reaction force/torque and removed when thresholds are exceeded",
							`intact joints: ${intactCount}/${tracked.length}`,
							...( broken.length > 0 ? broken : [ "waiting for joints to break" ] ),
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "events-persistent-contact",
			label: "Events / Persistent Contact",
			description:
				"A browser port of the native persistent-contact sample. A heavy sphere rolls across a triangle grid while begin/end contact events reveal when the contact stays active over time.",
			create( ctx )
			{
				let sphereHandle = 0;
				let activeContact = false;
				let beginCount = 0;
				let endCount = 0;

				return {
					reset()
					{
						sphereHandle = 0;
						activeContact = false;
						beginCount = 0;
						endCount = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const gridMesh = ctx.physics.createGridMesh( {
							xCount: 20,
							zCount: 20,
							cellWidth: 2,
							materialCount: 2,
							identifyEdges: true,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							mesh: gridMesh,
							color: 0x7e6d5d,
						} );

						sphereHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: -18, y: 1, z: 0.5 },
							linearVelocity: { x: 4, y: 0, z: 0 },
							radius: 0.5,
							density: 20,
							enableContactEvents: true,
							rollingResistance: 0.01,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 0, y: 16, z: 34 }, { x: 0, y: 2, z: 0 } );
					},

					update()
					{
						for ( const event of ctx.physics.getContactBeginEvents() )
						{
							if ( event.bodyA === sphereHandle || event.bodyB === sphereHandle )
							{
								beginCount += 1;
								activeContact = true;
							}
						}

						for ( const event of ctx.physics.getContactEndEvents() )
						{
							if ( event.bodyA === sphereHandle || event.bodyB === sphereHandle )
							{
								endCount += 1;
								activeContact = false;
							}
						}
					},

					getStatusLines()
					{
						const position = sphereHandle === 0 ? null : ctx.physics.getBodyTransform( sphereHandle ).position;
						const velocity = sphereHandle === 0 ? null : ctx.physics.getBodyLinearVelocity( sphereHandle );
						return [
							activeContact ? "persistent contact: active" : "persistent contact: inactive",
							`begin events: ${beginCount}`,
							`end events: ${endCount}`,
							position == null ? "sphere position unavailable" : `sphere x: ${position.x.toFixed( 2 )}, y: ${position.y.toFixed( 2 )}`,
							velocity == null ? "velocity unavailable" : `velocity: (${velocity.x.toFixed( 2 )}, ${velocity.y.toFixed( 2 )}, ${velocity.z.toFixed( 2 )})`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "events-sensor-hits",
			label: "Events / Sensor Hits",
			description:
				"A browser port of the native sensor-hits scene. A fast sphere crosses three different sensors while begin/end touch counts accumulate from static, kinematic, and dynamically constrained sensor shapes.",
			create( ctx )
			{
				let staticSensorHandle = 0;
				let kinematicSensorHandle = 0;
				let dynamicSensorHandle = 0;
				let kinematicBodyHandle = 0;
				let dynamicBodyHandle = 0;
				let dynamicJointHandle = 0;
				let bulletHandle = 0;
				let bulletEnabled = true;
				let beginCount = 0;
				let endCount = 0;
				const recentEvents = [];

				function launch()
				{
					if ( bulletHandle !== 0 )
					{
						ctx.physics.destroyBody( bulletHandle );
					}

					recentEvents.length = 0;
					bulletHandle = ctx.physics.createSphereBody( {
						type: BodyType.dynamic,
						position: { x: -26.7, y: 6, z: 0 },
						linearVelocity: { x: 250, y: 0, z: 0 },
						isBullet: bulletEnabled,
						radius: 0.25,
						enableSensorEvents: true,
						friction: 0.8,
						rollingResistance: 0.01,
						color: 0xd67c42,
					} );
				}

				return {
					reset()
					{
						staticSensorHandle = 0;
						kinematicSensorHandle = 0;
						dynamicSensorHandle = 0;
						kinematicBodyHandle = 0;
						dynamicBodyHandle = 0;
						dynamicJointHandle = 0;
						bulletHandle = 0;
						bulletEnabled = true;
						beginCount = 0;
						endCount = 0;
						recentEvents.length = 0;

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -1, z: 0 }, size: { hx: 10, hy: 1, hz: 10 } } );

						const wallHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						ctx.physics.addBoxShape( wallHandle, {
							size: { hx: 0.1, hy: 5, hz: 5 },
							localPosition: { x: 10, y: 5, z: 0 },
							color: 0x6f7f89,
							bodyType: BodyType.static,
						} );

						const sensorMesh = ctx.physics.createGridMesh( {
							xCount: 2,
							zCount: 2,
							cellWidth: 5,
							materialCount: 0,
							identifyEdges: true,
						} );
						const sensorRotation = { x: 0, y: 0, z: Math.sqrt( 0.5 ), w: Math.sqrt( 0.5 ) };

						staticSensorHandle = ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: -4, y: 6, z: 0 },
							rotation: sensorRotation,
							mesh: sensorMesh,
							isSensor: true,
							enableSensorEvents: true,
							color: 0x6e8fa3,
							roughness: 0.35,
							metalness: 0.05,
						} );

						kinematicBodyHandle = ctx.physics.createBody( {
							type: BodyType.kinematic,
							position: { x: 0, y: 6, z: 0 },
							rotation: sensorRotation,
							linearVelocity: { x: 0.5, y: 0, z: 0 },
						} );
						kinematicSensorHandle = ctx.physics.addMeshShape( kinematicBodyHandle, {
							mesh: sensorMesh,
							isSensor: true,
							enableSensorEvents: true,
							color: 0x89a8ba,
							roughness: 0.35,
							metalness: 0.05,
							bodyType: BodyType.kinematic,
						} );

						dynamicBodyHandle = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: { x: 4, y: 1, z: 0 },
						} );
						dynamicSensorHandle = ctx.physics.addCapsuleShape( dynamicBodyHandle, {
							capsule: {
								center1: { x: 0, y: 1, z: 0 },
								center2: { x: 0, y: 9, z: 0 },
								radius: 0.1,
							},
							isSensor: true,
							enableSensorEvents: true,
							color: 0x9eb9c8,
							bodyType: BodyType.dynamic,
						} );
						dynamicJointHandle = ctx.box3d.api.createPrismaticJoint( ctx.physics.worldHandle, {
							bodyA: wallHandle,
							bodyB: dynamicBodyHandle,
							localFrameA: { position: { x: 4, y: 6, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
							localFrameB: { position: { x: 0, y: 5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
							enableMotor: true,
							maxMotorForce: 1000,
							motorSpeed: 0.5,
						} );

						launch();
						ctx.setCameraLookAt( { x: 0, y: 12, z: 36 }, { x: 0, y: 6, z: 0 } );
					},

					update()
					{
						if ( kinematicBodyHandle !== 0 )
						{
							const p = ctx.physics.getBodyTransform( kinematicBodyHandle ).position;
							if ( p.x > 1 )
							{
								ctx.physics.setBodyLinearVelocity( kinematicBodyHandle, { x: -0.5, y: 0, z: 0 } );
							}
							else if ( p.x < -1 )
							{
								ctx.physics.setBodyLinearVelocity( kinematicBodyHandle, { x: 0.5, y: 0, z: 0 } );
							}
						}

						if ( dynamicJointHandle !== 0 )
						{
							const x = ctx.box3d.api.getPrismaticJointTranslation( dynamicJointHandle );
							if ( x > 1 )
							{
								ctx.box3d.api.setPrismaticJointMotorSpeed( dynamicJointHandle, -0.5 );
							}
							else if ( x < -1 )
							{
								ctx.box3d.api.setPrismaticJointMotorSpeed( dynamicJointHandle, 0.5 );
							}
						}

						for ( const event of ctx.physics.getSensorBeginEvents() )
						{
							beginCount += 1;
							if ( event.visitorBody === bulletHandle )
							{
								recentEvents.unshift( `begin: sensor ${event.sensorBody} hit by bullet` );
							}
						}
						for ( const event of ctx.physics.getSensorEndEvents() )
						{
							endCount += 1;
							if ( event.visitorBody === bulletHandle )
							{
								recentEvents.unshift( `end: sensor ${event.sensorBody} released bullet` );
							}
						}
						recentEvents.splice( 6 );

						if ( bulletHandle !== 0 )
						{
							const position = ctx.physics.getBodyTransform( bulletHandle ).position;
							if ( position.x > 14 )
							{
								launch();
							}
						}
					},

					getStatusLines()
					{
						const bulletPosition = bulletHandle === 0 ? null : ctx.physics.getBodyTransform( bulletHandle ).position;
						return [
							`bullet mode: ${bulletEnabled ? "bullet" : "regular dynamic"}`,
							`begin touch count: ${beginCount}`,
							`end touch count: ${endCount}`,
							bulletPosition == null ? "bullet unavailable" : `bullet x: ${bulletPosition.x.toFixed( 2 )}`,
							...( recentEvents.length > 0 ? recentEvents : [ "waiting for sensor crossings" ] ),
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
