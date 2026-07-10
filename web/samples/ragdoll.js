import { Human } from "./human.js";

export function createRagdollSamples({ BodyType }) {
	return [
		{
			key: "ragdoll-box",
			label: "Ragdoll / Box",
			description: "A single ragdoll dropped onto a ground box. Adjust joint friction, hertz, and damping ratio to see how it affects the ragdoll's flexibility and joints.",
			create(ctx) {
				let jointFrictionTorque = 5.0;
				let jointHertz = 1.0;
				let jointDampingRatio = 0.7;
				let human = new Human();

				function spawn() {
					if (human.isSpawned) {
						// Clean up existing human
						for (const bone of human.bones) {
							if (bone.bodyHandle !== 0) {
								ctx.physics.destroyBody(bone.bodyHandle);
								bone.bodyHandle = 0;
							}
							if (bone.jointHandle !== 0) {
								ctx.box3d.api.destroyJoint(bone.jointHandle);
								bone.jointHandle = 0;
							}
						}
						for (const filterHandle of human.filterJointHandles) {
							ctx.box3d.api.destroyJoint(filterHandle);
						}
						human.filterJointHandles = [];
						human.isSpawned = false;
					}

					human.spawn(ctx, { x: 0.0, y: 2.0, z: 0.0 }, jointFrictionTorque, jointHertz, jointDampingRatio, 1, false);
				}

				return {
					reset() {
						ctx.physics.setWorldOrigin({ x: 0, y: 0, z: 0 });
						ctx.physics.createGroundBox({ position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } });
						spawn();
						ctx.setCameraLookAt({ x: 5, y: 3, z: 6 }, { x: 0, y: 1, z: 0 });
					},

					buildUI(panel) {
						panel.add("Joint Friction", jointFrictionTorque, { min: 0, max: 20, step: .01 }, (val) => {
							jointFrictionTorque = val;
							if (human.isSpawned) {
								human.setJointFrictionTorque(ctx, jointFrictionTorque);
							}
						});

						panel.add("Hertz", jointHertz, { min: 0, max: 20, step: 0.1 }, (val) => {
							jointHertz = val;
							if (human.isSpawned) {
								human.setJointSpringHertz(ctx, jointHertz);
							}
						});

						panel.add("Damping", jointDampingRatio, { min: 0, max: 4, step: 0.01 }, (val) => {
							jointDampingRatio = val;
							if (human.isSpawned) {
								human.setJointDampingRatio(ctx, jointDampingRatio);
							}
						});

						panel.addButton("Respawn", () => {
							spawn();
						});
					},
				};
			},
		},
		{
			key: "ragdoll-pile",
			label: "Ragdoll / Pile",
			description: "Multiple ragdolls dropped sequentially to form a pile, demonstrating complex multi-body constraint solving and stability.",
			create(ctx) {
				const count = 10;
				const humans = Array.from({ length: count }, () => new Human());

				return {
					reset() {
						ctx.physics.setWorldOrigin({ x: 0, y: 0, z: 0 });

						const gridMesh = ctx.physics.createGridMesh({
							xCount: 20,
							zCount: 20,
							cellWidth: 1.0,
							amplitude: 0.0,
						});
						const groundBody = ctx.physics.createBody({
							type: BodyType.static,
							position: { x: 0, y: -0.5, z: 0 },
						});
						ctx.physics.addMeshShape(groundBody, {
							mesh: gridMesh,
							bodyType: BodyType.static,
							color: 0x75838d,
						});

						for (let i = 0; i < count; i += 1) {
							const pos = { x: 0.1 * i, y: 2.0 + 1.5 * i, z: -0.1 * i };
							humans[i].spawn(ctx, pos, 10.0, 0.5, 0.7, i, false);
						}

						ctx.setCameraLookAt({ x: 12, y: 5, z: 12 }, { x: 0, y: 2, z: 0 });
					},
				};
			},
		},
		{
			key: "ragdoll-mesh",
			label: "Ragdoll / Mesh",
			description: "A single ragdoll inside a mesh-backed arena with surrounding walls. This is a good parity test for ragdoll constraints against triangle meshes rather than simple hulls.",
			create( ctx )
			{
				let jointFrictionTorque = 5.0;
				let jointHertz = 2.0;
				let jointDampingRatio = 0.7;
				let human = new Human();

				function spawn()
				{
					if ( human.isSpawned )
					{
						for ( const bone of human.bones )
						{
							if ( bone.bodyHandle !== 0 )
							{
								ctx.physics.destroyBody( bone.bodyHandle );
								bone.bodyHandle = 0;
							}
							if ( bone.jointHandle !== 0 )
							{
								ctx.box3d.api.destroyJoint( bone.jointHandle );
								bone.jointHandle = 0;
							}
						}
						for ( const filterHandle of human.filterJointHandles )
						{
							ctx.box3d.api.destroyJoint( filterHandle );
						}
						human.filterJointHandles = [];
						human.isSpawned = false;
					}

					human.spawn( ctx, { x: 0.0, y: 1.0, z: 0.0 }, jointFrictionTorque, jointHertz, jointDampingRatio, 1, false );
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const mesh = ctx.physics.createGridMesh( {
							xCount: 20,
							zCount: 20,
							cellWidth: 2.0,
							materialCount: 2,
							identifyEdges: true,
						} );
						const groundHandle = ctx.physics.createBody( { type: BodyType.static, position: { x: 0, y: 0, z: 0 } } );
						ctx.physics.addMeshShape( groundHandle, {
							mesh,
							bodyType: BodyType.static,
							color: 0x75838d,
						} );

						const wallExtents = [
							{ position: { x: 0, y: 5, z: -20 }, size: { hx: 20, hy: 5, hz: 0.1 } },
							{ position: { x: 0, y: 5, z: 20 }, size: { hx: 20, hy: 5, hz: 0.1 } },
							{ position: { x: -20, y: 5, z: 0 }, size: { hx: 0.1, hy: 5, hz: 20 } },
							{ position: { x: 20, y: 5, z: 0 }, size: { hx: 0.1, hy: 5, hz: 20 } },
						];
						for ( const wall of wallExtents )
						{
							ctx.physics.addBoxShape( groundHandle, {
								bodyType: BodyType.static,
								localPosition: wall.position,
								size: wall.size,
								color: 0x6c7b84,
							} );
						}

						spawn();
						ctx.setCameraLookAt( { x: 8, y: 10, z: 14 }, { x: 0, y: 2, z: 0 } );
					},

					buildUI( panel )
					{
						panel.add( "Joint Friction", jointFrictionTorque, { min: 0, max: 20, step: 0.01 }, ( value ) =>
						{
							jointFrictionTorque = value;
							if ( human.isSpawned )
							{
								human.setJointFrictionTorque( ctx, jointFrictionTorque );
							}
						} );
						panel.add( "Hertz", jointHertz, { min: 0, max: 20, step: 0.1 }, ( value ) =>
						{
							jointHertz = value;
							if ( human.isSpawned )
							{
								human.setJointSpringHertz( ctx, jointHertz );
							}
						} );
						panel.add( "Damping", jointDampingRatio, { min: 0, max: 4, step: 0.01 }, ( value ) =>
						{
							jointDampingRatio = value;
							if ( human.isSpawned )
							{
								human.setJointDampingRatio( ctx, jointDampingRatio );
							}
						} );
						panel.addButton( "Respawn", spawn );
					},
				};
			},
		},
		{
			key: "ragdoll-incline",
			label: "Ragdoll / Incline",
			description: "A ragdoll dropped onto paired mesh ramps. After a short delay the joint motors are weakened, making this a nice regression test for sliding, resting, and spring retuning on mesh terrain.",
			create( ctx )
			{
				let human = new Human();
				let elapsed = 0;
				let motorized = true;

				return {
					reset()
					{
						elapsed = 0;
						motorized = true;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const gridMesh = ctx.physics.createGridMesh( {
							xCount: 4,
							zCount: 4,
							cellWidth: 2.0,
							materialCount: 1,
							identifyEdges: true,
						} );

						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: -10, y: 2, z: 0 },
							rotation: { x: 0, y: 0, z: Math.sin( -0.2 * Math.PI * 0.5 ), w: Math.cos( -0.2 * Math.PI * 0.5 ) },
							mesh: gridMesh,
							color: 0x75838d,
						} );

						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							scale: { x: 4, y: 4, z: 4 },
							mesh: gridMesh,
							color: 0x86939a,
						} );

						human = new Human();
						human.spawn( ctx, { x: -12, y: 6, z: 0 }, 10.0, 2.0, 0.7, 1, false );
						ctx.setCameraLookAt( { x: 18, y: 12, z: 22 }, { x: -6, y: 2, z: 0 } );
					},

					update( dt )
					{
						elapsed += dt;
						if ( elapsed > 2.0 && motorized )
						{
							human.setJointFrictionTorque( ctx, 0.5 );
							human.setJointSpringHertz( ctx, 0.5 );
							motorized = false;
						}
					},

					getStatusLines()
					{
						return [
							`elapsed: ${elapsed.toFixed( 1 )}s`,
							`motorized: ${motorized ? "yes" : "reduced"}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
