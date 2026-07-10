import { Human } from "./human.js";

export function createDeterminismSamples()
{
	return [
		{
			key: "determinism-falling-ragdolls",
			label: "Determinism / Falling Ragdolls",
			description: "A browser-oriented port of the native determinism sample. A fixed stack of ragdolls falls into the same scene each run so we can quickly spot obvious regressions in settling behavior.",
			create( ctx )
			{
				const humans = Array.from( { length: 8 }, () => new Human() );
				let settledFrames = 0;
				let done = false;

				function destroyHumans()
				{
					for ( const human of humans )
					{
						if ( human.isSpawned !== true )
						{
							continue;
						}

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
				}

				return {
					reset()
					{
						done = false;
						settledFrames = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.5, z: 0 },
							size: { hx: 30, hy: 0.5, hz: 30 },
							color: 0x75838d,
						} );

						for ( let index = 0; index < humans.length; index += 1 )
						{
							humans[index].spawn(
								ctx,
								{ x: -5.5 + 1.6 * index, y: 8 + 1.2 * index, z: 0 },
								5.0,
								1.0,
								0.7,
								index + 1,
								false
							);
						}

						ctx.setCameraLookAt( { x: 0, y: 16, z: 30 }, { x: 0, y: 8, z: 0 } );
					},

					update()
					{
						if ( done )
						{
							return;
						}

						if ( ctx.physics.getWorldAwakeBodyCount() === 0 )
						{
							settledFrames += 1;
							if ( settledFrames > 30 )
							{
								done = true;
							}
						}
						else
						{
							settledFrames = 0;
						}
					},

					getStatusLines()
					{
						return [
							`ragdolls: ${humans.length}`,
							done ? "status: settled" : "status: simulating",
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},

					dispose()
					{
						destroyHumans();
					},
				};
			},
		},
	];
}
