export function createWorldSamples( { BodyType } )
{
	function createSeededRandom( seed )
	{
		let state = seed >>> 0;
		return () =>
		{
			state = ( Math.imul( state, 1664525 ) + 1013904223 ) >>> 0;
			return state / 0x100000000;
		};
	}

	function sampleRange( random, min, max )
	{
		return min + ( max - min ) * random();
	}

	function createMeshDropArena( ctx, options = {} )
	{
		const base = options.base ?? { x: 0, y: 0, z: 0 };
		const groundFilter = { categoryBits: 0x1, maskBits: -1, groupIndex: 0 };
		const bodyFilter = { categoryBits: 0x2, maskBits: 0x1, groupIndex: 0 };
		const gridCount = options.gridCount ?? 32;
		const groundGridCount = options.groundGridCount ?? 40;
		const groundMesh = ctx.physics.createWaveMesh( {
			xCount: groundGridCount,
			zCount: groundGridCount,
			cellWidth: 1,
			amplitude: 0.5,
			rowFrequency: 0.1,
			columnFrequency: 0.2,
		} );
		const extent = 0.5 * groundGridCount;

		ctx.physics.createCompoundBody( {
			type: BodyType.static,
			position: base,
			meshes: [
				{
					mesh: groundMesh,
					filter: groundFilter,
					color: 0x7e6d5d,
				},
			],
			boxes: [
				{ size: { hx: extent, hy: 1, hz: 0.1 }, localPosition: { x: 0, y: 1, z: -extent }, filter: groundFilter, color: 0x7e6d5d },
				{ size: { hx: extent, hy: 1, hz: 0.1 }, localPosition: { x: 0, y: 1, z: extent }, filter: groundFilter, color: 0x7e6d5d },
				{ size: { hx: 0.1, hy: 1, hz: extent }, localPosition: { x: -extent, y: 1, z: 0 }, filter: groundFilter, color: 0x7e6d5d },
				{ size: { hx: 0.1, hy: 1, hz: extent }, localPosition: { x: extent, y: 1, z: 0 }, filter: groundFilter, color: 0x7e6d5d },
			],
		} );

		const random = createSeededRandom( options.seed ?? 0x1234abcd );
		const bodyHandles = [];
		for ( let ix = 0; ix < gridCount; ix += 1 )
		{
			for ( let iz = 0; iz < gridCount; iz += 1 )
			{
				bodyHandles.push(
					ctx.physics.createBoxBody( {
						type: BodyType.dynamic,
						position: {
							x: base.x + 0.5 * ( ix - 0.5 * gridCount ),
							y: base.y + 5,
							z: base.z + 0.5 * ( iz - 0.5 * gridCount ),
						},
						linearVelocity: {
							x: sampleRange( random, -1, 1 ),
							y: sampleRange( random, -1, 1 ),
							z: sampleRange( random, -1, 1 ),
						},
						angularVelocity: {
							x: sampleRange( random, -5, 5 ),
							y: sampleRange( random, -5, 5 ),
							z: sampleRange( random, -5, 5 ),
						},
						size: { hx: 0.02, hy: 0.2, hz: 0.04 },
						rollingResistance: 0.1,
						filter: bodyFilter,
						color: 0xd67c42,
					} )
				);
			}
		}

		return { bodyHandles, bodyCount: bodyHandles.length };
	}

	return [
		{
			key: "hello-world",
			label: "World / Hello World",
			description:
				"A small starter scene for the wasm host: a static ground box, one falling cube, and a camera framing that matches the simple smoke test.",
			create( ctx )
			{
				let topBodyHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 10, hy: 0.5, hz: 10 } } );
						topBodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 4, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							color: 0xd66f3d,
						} );
						ctx.setCameraLookAt( { x: 10, y: 7, z: 11 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( topBodyHandle );
						return [
							`precision: ${ctx.box3d.api.isDoublePrecision() ? "double" : "single"}`,
							`cube height: ${transform.position.y.toFixed( 3 )} m`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "far-stack",
			label: "World / Far Stack",
			description:
				"A direct first-pass port of the native sample intent. In double precision builds it opens 10,000 km from the origin; in single precision it falls back to the origin so the scene stays usable.",
			create( ctx )
			{
				const maxOffsetKilometers = 10000;
				const columnCount = 6;
				let topBodyHandle = 0;
				let base = { x: 0, y: 0, z: 0 };
				let offsetKilometers = ctx.box3d.api.isDoublePrecision() ? maxOffsetKilometers : 0;

				function rebuild()
				{
					base = { x: offsetKilometers * 1000, y: 0, z: 0 };
					ctx.physics.setWorldOrigin( base );
					ctx.physics.createGroundBox( {
						position: { x: base.x, y: -1, z: 0 },
						size: { hx: 12, hy: 1, hz: 12 },
						color: 0x6f7f89,
					} );

					for ( let i = 0; i < columnCount; i += 1 )
					{
						const skew = 0.02 * ( i % 2 === 1 ? 1 : -1 );
						topBodyHandle = ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: base.x + skew, y: 0.5 + i, z: 0 },
							size: { hx: 0.5, hy: 0.5, hz: 0.5 },
							color: 0xd66f3d,
						} );
					}

					ctx.setCameraLookAt( { x: 0, y: 8, z: 16 }, { x: 0, y: 2, z: 0 } );
				}

				return {
					reset()
					{
						rebuild();
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( topBodyHandle );
						return [
							`precision: ${ctx.box3d.api.isDoublePrecision() ? "double" : "single"}`,
							`world offset: ${offsetKilometers.toFixed( 1 )} km`,
							`top box height: ${( transform.position.y - base.y ).toFixed( 4 )} m`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "far-pyramid",
			label: "World / Far Pyramid",
			description:
				"A broad rigid-body stress scene based on the native Far Pyramid sample. This is a good proving ground for body-to-mesh sync, camera framing, and large-world origin rebasing.",
			create( ctx )
			{
				const baseCount = 24;
				const offsetKilometers = ctx.box3d.api.isDoublePrecision() ? 10000 : 0;
				const base = { x: offsetKilometers * 1000, y: 0, z: 0 };

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( base );
						ctx.physics.createGroundBox( {
							position: { x: base.x, y: -1, z: 0 },
							size: { hx: 80, hy: 1, hz: 80 },
							color: 0x6f7f89,
						} );

						for ( let i = 0; i < baseCount; i += 1 )
						{
							const y = i + 0.5;
							for ( let j = i; j < baseCount; j += 1 )
							{
								const x = i + 0.5 + ( 2 * ( j - i ) ) - 0.5 * baseCount;
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x: base.x + x, y: base.y + y, z: 0 },
									size: { hx: 0.5, hy: 0.5, hz: 0.5 },
									density: 100,
									color: 0xc98b4c,
								} );
							}
						}

						ctx.setCameraLookAt( { x: 40, y: 32, z: 52 }, { x: 0, y: 11, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`precision: ${ctx.box3d.api.isDoublePrecision() ? "double" : "single"}`,
							`world offset: ${offsetKilometers.toFixed( 1 )} km`,
							`body count: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "far-mesh-drop",
			label: "World / Far Mesh Drop",
			description:
				"A browser port of the native Far Mesh Drop regression scene. A full mesh-drop field runs far from the origin and should settle cleanly, making it a nice large-world stress test for rebasing plus mesh contacts.",
			create( ctx )
			{
				const offsetKilometers = ctx.box3d.api.isDoublePrecision() ? 1000 : 0;
				const base = {
					x: offsetKilometers * 1000,
					y: 0,
					z: offsetKilometers * 1000,
				};
				let bodyCount = 0;
				let settled = false;
				let failure = false;

				return {
					reset()
					{
						settled = false;
						failure = false;
						ctx.physics.setWorldOrigin( base );
						const arena = createMeshDropArena( ctx, {
							base,
							seed: 0x1234abcd,
						} );
						bodyCount = arena.bodyCount;
						ctx.setCameraLookAt( { x: 0, y: 20, z: 34 }, { x: 0, y: 0, z: 0 } );
					},

					update( _dt, elapsedSeconds )
					{
						if ( settled || failure || elapsedSeconds < 5 )
						{
							return;
						}

						const moveCount = ctx.physics.getBodyMoveEvents().length;
						if ( moveCount > 0 )
						{
							failure = true;
						}
						else
						{
							settled = true;
						}
					},

					getStatusLines()
					{
						return [
							`precision: ${ctx.box3d.api.isDoublePrecision() ? "double" : "single"}`,
							`world offset: ${offsetKilometers.toFixed( 1 )} km`,
							"mesh-drop field settling on a wave mesh far from the origin",
							failure ? "settling check: failed" : settled ? "settling check: passed" : "settling check: waiting",
							`body count: ${bodyCount}`,
						];
					},
				};
			},
		},
	];
}
