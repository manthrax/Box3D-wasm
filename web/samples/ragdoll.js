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
								ctx.box3d.api.destroyBody(bone.bodyHandle);
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

						panel.add("Hertz", jointHertz, { min: 0, max: 20, step: 0.5 }, (val) => {
							jointHertz = val;
							if (human.isSpawned) {
								human.setJointSpringHertz(ctx, jointHertz);
							}
						});

						panel.add("Damping", jointDampingRatio, { min: 0, max: 4, step: 0.1 }, (val) => {
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
	];
}
