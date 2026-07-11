import { DEG_TO_RAD, axisAngleToQuaternion, loadObjMesh } from "./helpers.js";
import buildingObjUrl from "../../data/meshes/building.obj?url";
import stairsObjUrl from "../../data/meshes/stairs.obj?url";
import testMap01ObjUrl from "../../data/meshes/test_map01.obj?url";

function createKeyboardTracker()
{
	let keys = {};

	function handleKeyDown( event )
	{
		keys[event.key.toLowerCase()] = true;
	}

	function handleKeyUp( event )
	{
		keys[event.key.toLowerCase()] = false;
	}

	return {
		keys,
		attach()
		{
			keys = {};
			this.keys = keys;
			window.addEventListener( "keydown", handleKeyDown );
			window.addEventListener( "keyup", handleKeyUp );
		},
		detach()
		{
			window.removeEventListener( "keydown", handleKeyDown );
			window.removeEventListener( "keyup", handleKeyUp );
		},
	};
}

function getNudgeVector( keys, speed, verticalSpeed = speed )
{
	const movement = { x: 0, y: 0, z: 0 };
	if ( keys["a"] || keys["arrowleft"] )
	{
		movement.x -= speed;
	}
	if ( keys["d"] || keys["arrowright"] )
	{
		movement.x += speed;
	}
	if ( keys["w"] || keys["arrowup"] )
	{
		movement.z -= speed;
	}
	if ( keys["s"] || keys["arrowdown"] )
	{
		movement.z += speed;
	}
	if ( keys["q"] )
	{
		movement.y += verticalSpeed;
	}
	if ( keys["e"] )
	{
		movement.y -= verticalSpeed;
	}
	return movement;
}

function offsetPosition( position, delta )
{
	return {
		x: position.x + delta.x,
		y: position.y + delta.y,
		z: position.z + delta.z,
	};
}

function clonePosition( position )
{
	return { x: position.x, y: position.y, z: position.z };
}

export function createCharacterSamples( { BodyType } )
{
	return [
		{
			key: "character-capsule-plane",
			label: "Character / CapsulePlane",
			description: "Move the test capsule with WASD or Arrow Keys, plus Q/E for vertical motion. This exercises `b3World_CollideMover` and `b3SolvePlanes` directly, with the Solve button snapping the mover to the computed push-out position.",
			create( ctx )
			{
				const keyboard = createKeyboardTracker();
				const capsule = {
					center1: { x: 0, y: -0.5, z: 0 },
					center2: { x: 0, y: 0.5, z: 0 },
					radius: 0.25,
				};
				const queryFilter = { categoryBits: 1, maskBits: ~0x0002, groupIndex: 0 };
				let moverHandle = 0;
				let moverPosition = { x: 0, y: 1, z: 0.4 };
				let planeResults = [];
				let solvedDelta = { x: 0, y: 0, z: 0 };

				function updateMoverTransform()
				{
					ctx.physics.setBodyTransform( moverHandle, {
						position: moverPosition,
						rotation: { x: 0, y: 0, z: 0, w: 1 },
					} );
					ctx.physics.setBodyAwake( moverHandle, true );
				}

				function queryPlanes()
				{
					planeResults = ctx.physics.worldCollideMover( {
						origin: moverPosition,
						capsule,
						filter: queryFilter,
						maxPlanes: 3,
					} );
					if ( planeResults.length > 0 )
					{
						solvedDelta = ctx.box3d.api.solveCollisionPlanes( {
							targetDelta: { x: 0, y: 0, z: 0 },
							planes: planeResults,
						} ).delta;
					}
					else
					{
						solvedDelta = { x: 0, y: 0, z: 0 };
					}
				}

				function solve()
				{
					queryPlanes();
					if ( planeResults.length === 0 )
					{
						return;
					}

					moverPosition = offsetPosition( moverPosition, solvedDelta );
					updateMoverTransform();
					queryPlanes();
				}

				return {
					reset()
					{
						moverPosition = { x: 0, y: 1, z: 0.4 };
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 1, z: 1 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							color: 0x75838d,
						} );
						moverHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.kinematic,
							position: moverPosition,
							capsule,
							gravityScale: 0,
							enableSleep: false,
							isSensor: true,
							filter: { categoryBits: 0x0002, maskBits: 0, groupIndex: 0 },
							color: 0x8fd65c,
						} );
						keyboard.attach();
						queryPlanes();
						ctx.setCameraLookAt( { x: 8, y: 6, z: 10 }, { x: 0, y: 1, z: 0 } );
					},

					update( dt )
					{
						const movement = getNudgeVector( keyboard.keys, 2.5 * dt );
						if ( movement.x !== 0 || movement.y !== 0 || movement.z !== 0 )
						{
							moverPosition = offsetPosition( moverPosition, movement );
							updateMoverTransform();
						}

						queryPlanes();
						for ( const result of planeResults )
						{
							const point = offsetPosition( moverPosition, result.point );
							const end = offsetPosition( point, {
								x: 0.25 * result.plane.normal.x,
								y: 0.25 * result.plane.normal.y,
								z: 0.25 * result.plane.normal.z,
							} );
							ctx.physics.addDebugPoint( point, 0xf3d24f );
							ctx.physics.addDebugLine( point, end, 0xf3d24f );
						}
					},

					buildUI( panel )
					{
						panel.addButton( "Solve", solve );
					},

					getStatusLines()
					{
						return [
							"use WASD/arrow keys to move, Q/E to move vertically",
							`planes: ${planeResults.length}`,
							`solve delta: ${solvedDelta.x.toFixed( 3 )}, ${solvedDelta.y.toFixed( 3 )}, ${solvedDelta.z.toFixed( 3 )}`,
							`position: ${moverPosition.x.toFixed( 2 )}, ${moverPosition.y.toFixed( 2 )}, ${moverPosition.z.toFixed( 2 )}`,
						];
					},

					dispose()
					{
						keyboard.detach();
					},
				};
			},
		},
		{
			key: "character-mover-overlap",
			label: "Character / MoverOverlap",
			description: "Push the yellow capsule into the sphere, capsule, and box using WASD or Arrow Keys plus Q/E. The sample reports returned plane counts and highlights any degenerate normals that would break the mover solver.",
			create( ctx )
			{
				const keyboard = createKeyboardTracker();
				const capsule = {
					center1: { x: 0, y: -0.5, z: 0 },
					center2: { x: 0, y: 0.5, z: 0 },
					radius: 0.35,
				};
				const queryFilter = { categoryBits: 1, maskBits: ~0x0002, groupIndex: 0 };
				let moverHandle = 0;
				let moverPosition = { x: 0, y: 3.5, z: 0 };
				let planeResults = [];
				let solvedPosition = clonePosition( moverPosition );
				let zeroNormalCount = 0;

				function updateMoverTransform()
				{
					ctx.physics.setBodyTransform( moverHandle, {
						position: moverPosition,
						rotation: { x: 0, y: 0, z: 0, w: 1 },
					} );
					ctx.physics.setBodyAwake( moverHandle, true );
				}

				function queryPlanes()
				{
					planeResults = ctx.physics.worldCollideMover( {
						origin: moverPosition,
						capsule,
						filter: queryFilter,
						maxPlanes: 32,
					} );
					zeroNormalCount = 0;
					for ( const result of planeResults )
					{
						const length = Math.hypot( result.plane.normal.x, result.plane.normal.y, result.plane.normal.z );
						if ( length < 0.5 )
						{
							zeroNormalCount += 1;
						}
					}

					if ( planeResults.length > 0 )
					{
						const solved = ctx.box3d.api.solveCollisionPlanes( { planes: planeResults } );
						solvedPosition = offsetPosition( moverPosition, solved.delta );
					}
					else
					{
						solvedPosition = clonePosition( moverPosition );
					}
				}

				function snapToSolved()
				{
					queryPlanes();
					moverPosition = clonePosition( solvedPosition );
					updateMoverTransform();
					queryPlanes();
				}

				return {
					reset()
					{
						moverPosition = { x: 0, y: 3.5, z: 0 };
						solvedPosition = clonePosition( moverPosition );
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						ctx.physics.createSphereBody( {
							type: BodyType.static,
							position: { x: -3, y: 1, z: 0 },
							radius: 0.6,
							color: 0x75838d,
						} );
						ctx.physics.createCapsuleBody( {
							type: BodyType.static,
							position: { x: 0, y: 1, z: 0 },
							capsule: {
								center1: { x: 0, y: 0, z: -0.7 },
								center2: { x: 0, y: 0, z: 0.7 },
								radius: 0.4,
							},
							color: 0x7f8d97,
						} );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 3, y: 1, z: 0 },
							size: { hx: 0.6, hy: 0.6, hz: 0.6 },
							color: 0x6d7b85,
						} );

						moverHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.kinematic,
							position: moverPosition,
							capsule,
							gravityScale: 0,
							enableSleep: false,
							isSensor: true,
							filter: { categoryBits: 0x0002, maskBits: 0, groupIndex: 0 },
							color: 0xf0c94a,
						} );

						keyboard.attach();
						queryPlanes();
						ctx.setCameraLookAt( { x: 10, y: 7, z: 12 }, { x: 0, y: 1.2, z: 0 } );
					},

					update( dt )
					{
						const movement = getNudgeVector( keyboard.keys, 3.0 * dt );
						if ( movement.x !== 0 || movement.y !== 0 || movement.z !== 0 )
						{
							moverPosition = offsetPosition( moverPosition, movement );
							updateMoverTransform();
						}

						queryPlanes();
						ctx.physics.addDebugPoint( solvedPosition, 0x3ec8ff );
						for ( const result of planeResults )
						{
							const point = offsetPosition( moverPosition, result.point );
							const valid = Math.hypot( result.plane.normal.x, result.plane.normal.y, result.plane.normal.z ) >= 0.5;
							const color = valid ? 0x8fd65c : 0xff5544;
							ctx.physics.addDebugPoint( point, color );
							ctx.physics.addDebugLine( point, offsetPosition( point, {
								x: 0.5 * result.plane.normal.x,
								y: 0.5 * result.plane.normal.y,
								z: 0.5 * result.plane.normal.z,
							} ), color );
						}
					},

					buildUI( panel )
					{
						panel.addButton( "Snap To Solved", snapToSolved );
					},

					getStatusLines()
					{
						return [
							"use WASD/arrow keys to move, Q/E to move vertically",
							`planes: ${planeResults.length}`,
							`degenerate normals: ${zeroNormalCount}`,
						];
					},

					dispose()
					{
						keyboard.detach();
					},
				};
			},
		},
		{
			key: "character-mover",
			label: "Character / Mover",
			description: "Use WASD or Arrow Keys to move the capsule character, and Spacebar to jump. The camera follows the player as you navigate the sloped platform, steps, and dynamic crates.",
			create( ctx )
			{
				let playerBody = 0;
				const keyboard = createKeyboardTracker();
				
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						for ( let i = 0; i < 5; i += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.static,
								position: { x: -8, y: 0.15 + i * 0.3, z: -5 + i * 1.5 },
								size: { hx: 3, hy: 0.15, hz: 0.75 },
								color: 0x75838d,
							} );
						}

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 8, y: 1.5, z: -5 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, -15 * Math.PI / 180 ),
							size: { hx: 3, hy: 0.2, hz: 6 },
							color: 0x75838d,
						} );

						for ( let i = 0; i < 4; i += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 0, y: 0.5 + i * 1.1, z: -5 },
								size: { hx: 0.5, hy: 0.5, hz: 0.5 },
								density: 1.0,
								color: 0xd98848,
							} );
						}

						playerBody = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 2.0, z: 5 },
							motionLocks: { angularX: true, angularY: true, angularZ: true },
							enableSleep: false,
						} );

						ctx.physics.addCapsuleShape( playerBody, {
							capsule: {
								center1: { x: 0, y: -0.6, z: 0 },
								center2: { x: 0, y: 0.6, z: 0 },
								radius: 0.3,
							},
							bodyType: BodyType.dynamic,
							density: 10.0,
							friction: 0.5,
							color: 0x1e90ff,
						} );

						keyboard.attach();
					},

					update()
					{
						if ( playerBody === 0 )
						{
							return;
						}

						const transform = ctx.physics.getBodyTransform( playerBody );
						const velocity = ctx.physics.box3d.api.getBodyLinearVelocity( playerBody );

						let moveX = 0;
						let moveZ = 0;

						if ( keyboard.keys["w"] || keyboard.keys["arrowup"] )
						{
							moveZ -= 1;
						}
						if ( keyboard.keys["s"] || keyboard.keys["arrowdown"] )
						{
							moveZ += 1;
						}
						if ( keyboard.keys["a"] || keyboard.keys["arrowleft"] )
						{
							moveX -= 1;
						}
						if ( keyboard.keys["d"] || keyboard.keys["arrowright"] )
						{
							moveX += 1;
						}

						const length = Math.hypot( moveX, moveZ );
						let targetVx = 0;
						let targetVz = 0;
						const speed = 6.0;

						if ( length > 0 )
						{
							targetVx = ( moveX / length ) * speed;
							targetVz = ( moveZ / length ) * speed;
						}

						let targetVy = velocity.y;
						if ( keyboard.keys[" "] && Math.abs( velocity.y ) < 0.05 && transform.position.y < 5.0 )
						{
							targetVy = 6.0;
						}

						ctx.physics.box3d.api.setBodyLinearVelocity( playerBody, {
							x: targetVx,
							y: targetVy,
							z: targetVz,
						} );

						ctx.physics.setBodyAwake( playerBody, true );

						ctx.setCameraLookAt(
							{
								x: transform.position.x,
								y: transform.position.y + 6.0,
								z: transform.position.z + 10.0,
							},
							{
								x: transform.position.x,
								y: transform.position.y,
								z: transform.position.z,
							}
						);
					},

					dispose()
					{
						keyboard.detach();
					},
				};
			},
		},
		{
			key: "character-rigid-body",
			label: "Character / Rigid Body",
			description: "A mesh-backed rigid-body character scene inspired by the native s&box-style sample. Use WASD or Arrow Keys to move, Space to jump, Shift to sprint, T to toggle the follow camera, and V to toggle debug lines.",
			sceneOptions: {
				showGround: false,
				showGrid: false,
			},
			create( ctx )
			{
				const keyboard = createKeyboardTracker();
				let loadToken = 0;
				let disposed = false;
				let loading = false;
				let ready = false;
				let loadError = null;
				let thirdPerson = true;
				let showDebug = true;
				let characterBody = 0;
				let lastGrounded = false;
				let lastHorizontalSpeed = 0;
				let lastVerticalSpeed = 0;
				let lastGroundDistance = Infinity;

				function addStaticObjMesh( objMesh, options )
				{
					const mesh = ctx.physics.createCustomMesh( {
						vertices: objMesh.vertices,
						indices: objMesh.indices,
						materialIndices: objMesh.materialIndices,
					} );
					return ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: options.position,
						rotation: options.rotation,
						scale: options.scale,
						mesh,
						color: options.color,
					} );
				}

				async function rebuildScene()
				{
					const token = ++loadToken;
					loading = true;
					ready = false;
					loadError = null;

					try
					{
						const [ levelMesh, stairsMesh, buildingMesh ] = await Promise.all( [
							loadObjMesh( testMap01ObjUrl ),
							loadObjMesh( stairsObjUrl ),
							loadObjMesh( buildingObjUrl ),
						] );

						if ( disposed || token !== loadToken )
						{
							return;
						}

						ctx.physics.resetWorld();
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						addStaticObjMesh( levelMesh, {
							position: { x: 0, y: 0, z: 0 },
							rotation: { x: 0, y: 0, z: 0, w: 1 },
							scale: { x: 1, y: 1, z: 1 },
							color: 0x75838d,
						} );

						addStaticObjMesh( stairsMesh, {
							position: { x: -10, y: 0, z: 0 },
							rotation: { x: 0, y: 0, z: 0, w: 1 },
							scale: { x: 0.75, y: 0.75, z: -1.5 },
							color: 0x6c7b84,
						} );

						addStaticObjMesh( buildingMesh, {
							position: { x: -5, y: 0, z: -10 },
							rotation: { x: 0, y: 0, z: 0, w: 1 },
							scale: { x: 1, y: 1, z: 1 },
							color: 0x7f8a92,
						} );

						const heightField = ctx.physics.createWaveMesh( {
							xCount: 48,
							zCount: 48,
							cellWidth: 1.0,
							amplitude: 1.0,
							rowFrequency: 0.02,
							columnFrequency: 0.04,
							materialCount: 3,
							identifyEdges: true,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 20, y: 0, z: 0 },
							mesh: heightField,
							color: 0x7a878f,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 6, y: 1, z: 4 },
							rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, -20 * DEG_TO_RAD ),
							size: { hx: 3.0, hy: 0.15, hz: 1.5 },
							friction: 0.6,
							color: 0x708855,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 6, y: 2, z: -4 },
							rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, -50 * DEG_TO_RAD ),
							size: { hx: 2.5, hy: 0.15, hz: 1.5 },
							friction: 0.6,
							color: 0x98685a,
						} );

						for ( let index = 0; index < 3; index += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.static,
								position: { x: -4 + 3.5 * index, y: 1.2, z: -5 },
								size: { hx: 1.2, hy: 0.15, hz: 1.2 },
								friction: 0.6,
								color: 0x72818c,
							} );
						}

						for ( let index = 0; index < 5; index += 1 )
						{
							const lipHeight = 0.05 + 0.08 * index;
							ctx.physics.createBoxBody( {
								type: BodyType.static,
								position: { x: -8, y: lipHeight, z: -1 + 2 * index },
								size: { hx: 1.0, hy: lipHeight, hz: 0.6 },
								friction: 0.6,
								color: 0x5c88c0,
							} );
						}

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 1.5, z: 10 },
							size: { hx: 4.0, hy: 1.5, hz: 0.2 },
							friction: 0.6,
							color: 0x506068,
						} );

						for ( let index = 0; index < 3; index += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 3 + 1.5 * index, y: 0.5, z: 0 },
								size: { hx: 0.4, hy: 0.4, hz: 0.4 },
								density: 1,
								friction: 0.6,
								color: 0xd3a14a,
							} );
						}

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: -3, y: 1, z: 0 },
							radius: 0.5,
							density: 1,
							friction: 0.6,
							color: 0xdc8e3e,
						} );

						characterBody = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: { x: 7.5, y: 2.0, z: 9.0 },
							enableSleep: false,
							motionLocks: {
								angularX: true,
								angularY: true,
								angularZ: true,
							},
							linearDamping: 0.3,
						} );

						ctx.physics.addCapsuleShape( characterBody, {
							bodyType: BodyType.dynamic,
							capsule: {
								center1: { x: 0, y: -0.6, z: 0 },
								center2: { x: 0, y: 0.6, z: 0 },
								radius: 0.3,
							},
							density: 10,
							friction: 0.6,
							color: 0x279dff,
						} );

						lastGrounded = false;
						lastHorizontalSpeed = 0;
						lastVerticalSpeed = 0;
						lastGroundDistance = Infinity;
						ready = true;
						ctx.setCameraLookAt( { x: 11, y: 6, z: 14 }, { x: 7.5, y: 2.0, z: 9.0 } );
					}
					catch ( error )
					{
						if ( disposed || token !== loadToken )
						{
							return;
						}

						loadError = error instanceof Error ? error.message : String( error );
					}
					finally
					{
						if ( token === loadToken )
						{
							loading = false;
						}
					}
				}

				function updateCamera( position )
				{
					if ( thirdPerson )
					{
						ctx.setCameraLookAt(
							{
								x: position.x + 5.5,
								y: position.y + 4.5,
								z: position.z + 7.5,
							},
							{
								x: position.x,
								y: position.y + 1.0,
								z: position.z,
							}
						);
					}
					else
					{
						ctx.setCameraLookAt(
							{
								x: position.x,
								y: position.y + 1.8,
								z: position.z + 0.1,
							},
							{
								x: position.x,
								y: position.y + 1.8,
								z: position.z - 4.0,
							}
						);
					}
				}

				function onKeyDown( event )
				{
					if ( event.repeat )
					{
						return;
					}

					const key = event.key.toLowerCase();
					if ( key === "t" )
					{
						thirdPerson = !thirdPerson;
					}
					else if ( key === "v" )
					{
						showDebug = !showDebug;
					}
				}

				return {
					reset()
					{
						ready = false;
						loadError = null;
						keyboard.attach();
						window.addEventListener( "keydown", onKeyDown );
						void rebuildScene();
					},

					update()
					{
						if ( ready === false || characterBody === 0 )
						{
							return;
						}

						const transform = ctx.physics.getBodyTransform( characterBody );
						const velocity = ctx.physics.getBodyLinearVelocity( characterBody );
						const movement = getNudgeVector( keyboard.keys, 1.0 );
						const moveLength = Math.hypot( movement.x, movement.z );
						const sprint = ( keyboard.keys["shift"] || keyboard.keys["shiftleft"] || keyboard.keys["shiftright"] ) === true;
						const targetSpeed = sprint ? 9.0 : 6.0;
						const targetVelocity = moveLength > 0
							? {
								x: targetSpeed * movement.x / moveLength,
								y: velocity.y,
								z: targetSpeed * movement.z / moveLength,
							}
							: {
								x: velocity.x * 0.82,
								y: velocity.y,
								z: velocity.z * 0.82,
							};

						const groundProbe = ctx.physics.worldCastRayClosest( {
							origin: transform.position,
							translation: { x: 0, y: -1.7, z: 0 },
							maxFraction: 1,
						} );
						lastGrounded = groundProbe.hit && groundProbe.normal.y > 0.45;
						lastGroundDistance = groundProbe.hit ? 1.7 * groundProbe.fraction : Infinity;

						if ( keyboard.keys[" "] && lastGrounded && velocity.y < 1.5 )
						{
							targetVelocity.y = 6.5;
						}

						ctx.physics.setBodyLinearVelocity( characterBody, targetVelocity );
						ctx.physics.setBodyAwake( characterBody, true );

						lastHorizontalSpeed = Math.hypot( targetVelocity.x, targetVelocity.z );
						lastVerticalSpeed = targetVelocity.y;

						if ( showDebug )
						{
							ctx.physics.addDebugLine(
								transform.position,
								offsetPosition( transform.position, {
									x: 0.25 * targetVelocity.x,
									y: 0.25 * targetVelocity.y,
									z: 0.25 * targetVelocity.z,
								} ),
								0xc25cff
							);
							if ( groundProbe.hit )
							{
								ctx.physics.addDebugPoint( groundProbe.point, 0x8fd65c );
								ctx.physics.addDebugLine(
									groundProbe.point,
									offsetPosition( groundProbe.point, {
										x: 0.6 * groundProbe.normal.x,
										y: 0.6 * groundProbe.normal.y,
										z: 0.6 * groundProbe.normal.z,
									} ),
									0x8fd65c
								);
							}
						}

						updateCamera( transform.position );
					},

					buildUI( panel )
					{
						panel.addButton( "Toggle Camera (T)", () =>
						{
							thirdPerson = !thirdPerson;
						} );
						panel.addButton( "Toggle Debug (V)", () =>
						{
							showDebug = !showDebug;
						} );
					},

					getStatusLines()
					{
						if ( loadError != null )
						{
							return [ `load error: ${loadError}` ];
						}

						if ( loading || ready === false )
						{
							return [ "loading rigid-body character scene..." ];
						}

						return [
							`camera: ${thirdPerson ? "third-person" : "forward-follow"}`,
							`grounded: ${lastGrounded ? "yes" : "no"} (${Number.isFinite( lastGroundDistance ) ? lastGroundDistance.toFixed( 2 ) : "n/a"})`,
							`speed: ${lastHorizontalSpeed.toFixed( 2 )} m/s`,
							`vertical: ${lastVerticalSpeed.toFixed( 2 )} m/s`,
							`debug: ${showDebug ? "on" : "off"}`,
						];
					},

					dispose()
					{
						disposed = true;
						loadToken += 1;
						keyboard.detach();
						window.removeEventListener( "keydown", onKeyDown );
					},
				};
			},
		},
	];
}
