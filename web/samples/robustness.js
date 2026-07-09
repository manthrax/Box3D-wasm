export function createRobustnessSamples( { BodyType } )
{
	function createBoxPyramid( ctx, options )
	{
		const baseCount = options.baseCount ?? 10;
		const extent = options.extent ?? 0.5;
		const density = options.density ?? 1;
		const origin = options.origin ?? { x: 0, y: 0, z: 0 };
		const color = options.color ?? 0xd67c42;

		for ( let row = 0; row < baseCount; row += 1 )
		{
			const y = origin.y + ( 2 * row + 1 ) * extent;
			for ( let column = row; column < baseCount; column += 1 )
			{
				const x = origin.x + ( row + 1 ) * extent + 2 * ( column - row ) * extent - baseCount * extent;
				ctx.physics.createBoxBody( {
					type: BodyType.dynamic,
					position: { x, y, z: origin.z },
					size: { hx: extent, hy: extent, hz: extent },
					density,
					color,
				} );
			}
		}
	}

	return [
		{
			key: "robustness-high-mass-ratio-1",
			label: "Robustness / HighMassRatio1",
			description:
				"A browser port of the native heavy-top pyramid stress test. Three stacks taper upward, and the top body of each stack is made dramatically heavier to exercise solver stability under extreme mass ratios.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 80, hy: 1, hz: 20 },
							color: 0x6f7f89,
						} );

						const extent = 1;
						for ( let group = 0; group < 3; group += 1 )
						{
							let count = 10;
							const offset = -20 * extent + 2 * ( count + 1 ) * extent * group;
							let y = extent;
							while ( count > 0 )
							{
								for ( let i = 0; i < count; i += 1 )
								{
									const coeff = i - 0.5 * count;
									const yy = count === 1 ? y + 2 : y;
									ctx.physics.createBoxBody( {
										type: BodyType.dynamic,
										position: { x: 2 * coeff * extent + offset, y: yy, z: 0 },
										size: { hx: extent, hy: extent, hz: extent },
										density: count === 1 ? ( group + 1 ) * 100 : 1,
										color: count === 1 ? 0xb85c38 : 0xd7a15f,
									} );
								}

								count -= 1;
								y += 2 * extent;
							}
						}

						ctx.setCameraLookAt( { x: 30, y: 15, z: 70 }, { x: 0, y: 10, z: 0 } );
					},

					getStatusLines()
					{
						const counters = ctx.physics.getWorldCounters();
						return [
							"expected: the three tapered stacks should remain mostly stable despite very heavy top boxes",
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
							`contacts: ${counters.contactCount}`,
							`bodies: ${counters.bodyCount}`,
						];
					},
				};
			},
		},
		{
			key: "robustness-tiny-pyramid",
			label: "Robustness / Tiny Pyramid",
			description:
				"A browser port of the native tiny-box pyramid. The boxes are only 5 cm wide, which makes it a nice regression scene for small-shape margins, rotational noise, and broad contact churn.",
			create( ctx )
			{
				const extent = 0.025;
				const baseCount = 30;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.25, z: 0 },
							size: { hx: 20, hy: 0.25, hz: 4 },
							color: 0x6f7f89,
						} );

						createBoxPyramid( ctx, {
							baseCount,
							extent,
							origin: { x: 0, y: 0, z: 0 },
							color: 0xd9a66b,
						} );

						ctx.setCameraLookAt( { x: -3.5, y: 1.8, z: 10 }, { x: 0, y: 0.5, z: 0 } );
					},

					getStatusLines()
					{
						const counters = ctx.physics.getWorldCounters();
						return [
							`${( 200 * extent ).toFixed( 1 )}cm boxes`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
							`contacts: ${counters.contactCount}`,
							`bodies: ${counters.bodyCount}`,
						];
					},
				};
			},
		},
		{
			key: "robustness-overlap-recovery",
			label: "Robustness / Overlap Recovery",
			description:
				"A browser port of the native overlap-recovery scene. The stack begins with intentional overlap, and the world contact tuning is biased toward aggressive recovery so we can watch whether the cluster separates cleanly over time.",
			create( ctx )
			{
				const baseCount = 4;
				const overlap = 0.25;
				const extent = 0.5;
				const speed = 3;
				const hertz = 30;
				const dampingRatio = 10;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.setWorldContactTuning( { hertz, dampingRatio, contactSpeed: speed } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 20, hy: 1, hz: 10 },
							color: 0x6f7f89,
						} );

						const fraction = 1 - overlap;
						let y = extent;
						for ( let row = 0; row < baseCount; row += 1 )
						{
							let x = fraction * extent * ( row - baseCount );
							for ( let column = row; column < baseCount; column += 1 )
							{
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x, y, z: 0 },
									size: { hx: extent, hy: extent, hz: extent },
									density: 1,
									color: 0xcf8b52,
								} );
								x += 2 * fraction * extent;
							}
							y += 2 * fraction * extent;
						}

						ctx.setCameraLookAt( { x: 12, y: 8, z: 18 }, { x: -1, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						const counters = ctx.physics.getWorldCounters();
						return [
							`overlap: ${overlap.toFixed( 2 )}, speed: ${speed.toFixed( 1)}, hertz: ${hertz.toFixed( 0)}, damping: ${dampingRatio.toFixed( 1)}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
							`contacts: ${counters.contactCount}`,
							`islands: ${counters.islandCount}`,
						];
					},
				};
			},
		},
		{
			key: "robustness-overflow-color-pile",
			label: "Robustness / Overflow Color Pile",
			description:
				"A browser approximation of the native overflow-color stress scene. The stack packs many touching bodies into a tight footprint and reports the overflow contact bucket so we can quickly spot graph-color pressure during maintenance.",
			create( ctx )
			{
				const rows = 12;
				const columns = 12;
				const layers = 5;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -1, z: 0 },
							size: { hx: 18, hy: 1, hz: 18 },
							color: 0x6f7f89,
						} );

						for ( let layer = 0; layer < layers; layer += 1 )
						{
							for ( let row = 0; row < rows; row += 1 )
							{
								for ( let column = 0; column < columns; column += 1 )
								{
									const oddLayer = layer % 2 === 1;
									ctx.physics.createBoxBody( {
										type: BodyType.dynamic,
										position: {
											x: ( column - 0.5 * ( columns - 1 ) ) * 0.7 + ( oddLayer ? 0.35 : 0 ),
											y: 0.35 + layer * 0.72,
											z: ( row - 0.5 * ( rows - 1 ) ) * 0.7 + ( oddLayer ? 0.1 : 0 ),
										},
										size: { hx: 0.32, hy: 0.32, hz: 0.32 },
										density: 1,
										friction: 0.5,
										color: layer % 2 === 0 ? 0xd49a58 : 0xc37a47,
									} );
								}
							}
						}

						ctx.setCameraLookAt( { x: 18, y: 18, z: 20 }, { x: 0, y: 2, z: 0 } );
					},

					getStatusLines()
					{
						const counters = ctx.physics.getWorldCounters();
						const overflowContacts = counters.colorCounts[counters.colorCounts.length - 1] ?? 0;
						return [
							"expected: a dense contact pile that exercises graph coloring pressure",
							`overflow contacts: ${overflowContacts}`,
							`contacts: ${counters.contactCount}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
