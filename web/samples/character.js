import { axisAngleToQuaternion } from "./helpers.js";

export function createCharacterSamples( { BodyType } )
{
	return [
		{
			key: "character-mover",
			label: "Character / Mover",
			description: "Use WASD or Arrow Keys to move the capsule character, and Spacebar to jump! The camera follows the player as you navigate the sloped platform, steps, and dynamic crates.",
			create( ctx )
			{
				let playerBody = 0;
				let keys = {};
				
				function handleKeyDown( e )
				{
					keys[e.key.toLowerCase()] = true;
				}

				function handleKeyUp( e )
				{
					keys[e.key.toLowerCase()] = false;
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						// Ground
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						// Create steps
						for ( let i = 0; i < 5; i += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.static,
								position: { x: -8, y: 0.15 + i * 0.3, z: -5 + i * 1.5 },
								size: { hx: 3, hy: 0.15, hz: 0.75 },
								color: 0x75838d,
							} );
						}

						// Create slope / ramp
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 8, y: 1.5, z: -5 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, -15 * Math.PI / 180 ),
							size: { hx: 3, hy: 0.2, hz: 6 },
							color: 0x75838d,
						} );

						// Dynamic crates to push around
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

						// Player body: Dynamic capsule with locked rotations
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

						// Bind keys
						window.addEventListener( "keydown", handleKeyDown );
						window.addEventListener( "keyup", handleKeyUp );
						keys = {};
					},

					update( dt, elapsed )
					{
						if ( playerBody === 0 )
						{
							return;
						}

						const transform = ctx.physics.getBodyTransform( playerBody );
						const velocity = ctx.physics.box3d.api.getBodyLinearVelocity( playerBody );

						// Movement direction based on keyboard input
						let moveX = 0;
						let moveZ = 0;

						if ( keys["w"] || keys["arrowup"] )
						{
							moveZ -= 1;
						}
						if ( keys["s"] || keys["arrowdown"] )
						{
							moveZ += 1;
						}
						if ( keys["a"] || keys["arrowleft"] )
						{
							moveX -= 1;
						}
						if ( keys["d"] || keys["arrowright"] )
						{
							moveX += 1;
						}

						// Normalize movement
						const length = Math.hypot( moveX, moveZ );
						let targetVx = 0;
						let targetVz = 0;
						const speed = 6.0;

						if ( length > 0 )
						{
							targetVx = ( moveX / length ) * speed;
							targetVz = ( moveZ / length ) * speed;
						}

						// Jump logic (if Space pressed and player Y is near ground level / objects)
						let targetVy = velocity.y;
						if ( keys[" "] && Math.abs( velocity.y ) < 0.05 && transform.position.y < 5.0 )
						{
							targetVy = 6.0; // Jump velocity
						}

						// Smoothly update linear velocity
						ctx.physics.box3d.api.setBodyLinearVelocity( playerBody, {
							x: targetVx,
							y: targetVy,
							z: targetVz,
						} );

						// Wake up the player body to ensure it responds to input
						ctx.physics.setBodyAwake( playerBody, true );

						// Follow player with camera
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
						window.removeEventListener( "keydown", handleKeyDown );
						window.removeEventListener( "keyup", handleKeyUp );
					},
				};
			},
		},
	];
}
