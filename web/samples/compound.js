import { axisAngleToQuaternion, loadObjMesh } from "./helpers.js";
import buildingObjUrl from "../../data/meshes/building.obj?url";

function createRng( seed )
{
	let state = seed >>> 0;
	return () =>
	{
		state = ( state + 0x6d2b79f5 ) >>> 0;
		let t = Math.imul( state ^ ( state >>> 15 ), 1 | state );
		t ^= t + Math.imul( t ^ ( t >>> 7 ), 61 | t );
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
}

function randomRange( random, min, max )
{
	return min + ( max - min ) * random();
}

function randomUnitVector( random )
{
	let x = randomRange( random, -1, 1 );
	let y = randomRange( random, -1, 1 );
	let z = randomRange( random, -1, 1 );
	const length = Math.hypot( x, y, z ) || 1;
	x /= length;
	y /= length;
	z /= length;
	return { x, y, z };
}

function randomQuaternion( random )
{
	return axisAngleToQuaternion( randomUnitVector( random ), randomRange( random, 0, Math.PI * 2 ) );
}

function randomVec3( random, min, max )
{
	return {
		x: randomRange( random, min.x, max.x ),
		y: randomRange( random, min.y, max.y ),
		z: randomRange( random, min.z, max.z ),
	};
}

export function createCompoundSamples( { BodyType } )
{
	return [
		{
			key: "compound-simple",
			label: "Compound / Simple",
			description:
				"A first-pass port of the native simple compound demo. The floor is a single static body with one offset hull attached through the new raw body-plus-shapes wasm path, plus a larger falling probe so the contact is easy to read in the browser.",
			create( ctx )
			{
				let sphereHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 2, y: -1, z: 0 },
							rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, 0.25 * Math.PI ),
							boxes: [
								{
									size: { hx: 4, hy: 0.5, hz: 4 },
									localPosition: { x: 1, y: -0.5, z: 0 },
									color: 0x74828b,
								},
							],
						} );

						sphereHandle = ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 8, z: 0 },
							radius: 0.75,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 45, y: 30, z: 45 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( sphereHandle );
						return [
							`compound pieces: 1`,
							`sphere height: ${transform.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "compound-spheres",
			label: "Compound / Spheres",
			description:
				"A browser port of the random-sphere compound sample. The native version is mostly a static compound visualization, so this web version adds a few falling probes to make the collision behavior easier to see.",
			create( ctx )
			{
				const sphereCount = 20;
				const probeCount = 3;
				const probeHandles = [];

				return {
					reset()
					{
						const random = createRng( 0x5eed1234 );
						const spheres = [];
						for ( let i = 0; i < sphereCount; i += 1 )
						{
							spheres.push( {
								center: {
									x: randomRange( random, -10, 10 ),
									y: randomRange( random, -10, 10 ),
									z: randomRange( random, -10, 10 ),
								},
								radius: randomRange( random, 0.1, 0.5 ),
								color: 0x7c8792,
							} );
						}

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							spheres,
						} );

						probeHandles.length = 0;
						for ( let i = 0; i < probeCount; i += 1 )
						{
							probeHandles.push(
								ctx.physics.createSphereBody( {
									type: BodyType.dynamic,
									position: { x: -4 + 4 * i, y: 14 + 2 * i, z: -3 + 3 * i },
									radius: 0.8,
									color: 0xd67c42,
								} )
							);
						}

						ctx.setCameraLookAt( { x: 45, y: 30, z: 45 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						const firstProbe = ctx.physics.getBodyTransform( probeHandles[0] );
						return [
							`compound spheres: ${sphereCount}`,
							`probe height: ${firstProbe.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "compound-hulls",
			label: "Compound / Hulls",
			description:
				"A port of the native random-hull compound scene, approximated with transformed box hulls. The native sample is largely static, so this version adds visible falling probes to make the compound collision more legible.",
			create( ctx )
			{
				const hullCount = 20;
				const probeHandles = [];

				return {
					reset()
					{
						const random = createRng( 0xc0ffee42 );
						const boxes = [];
						for ( let i = 0; i < hullCount; i += 1 )
						{
							boxes.push( {
								size: {
									hx: randomRange( random, 0.1, 0.5 ),
									hy: randomRange( random, 0.1, 0.5 ),
									hz: randomRange( random, 0.1, 0.5 ),
								},
								localPosition: {
									x: randomRange( random, -10, 10 ),
									y: randomRange( random, -10, 10 ),
									z: randomRange( random, -10, 10 ),
								},
								localRotation: randomQuaternion( random ),
								color: 0x7a8790,
							} );
						}

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							boxes,
						} );

						probeHandles.length = 0;
						for ( let i = 0; i < 3; i += 1 )
						{
							probeHandles.push(
								ctx.physics.createBoxBody( {
									type: BodyType.dynamic,
									position: { x: -5 + 5 * i, y: 16 + 2 * i, z: 4 - 3 * i },
									size: { hx: 0.75, hy: 0.75, hz: 0.75 },
									color: 0xd67c42,
								} )
							);
						}

						ctx.setCameraLookAt( { x: 45, y: 30, z: 45 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						const firstProbe = ctx.physics.getBodyTransform( probeHandles[0] );
						return [
							`compound hulls: ${hullCount}`,
							`probe height: ${firstProbe.position.y.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "compound-tile-floor",
			label: "Compound / Tile Floor",
			description:
				"A broad static tile field built as one multi-shape body. This is a good showcase for the optimized web renderer because thousands of repeated pieces stay in a small number of draw calls.",
			create( ctx )
			{
				const gridCount = 50;
				const tileCount = gridCount * gridCount;

				return {
					reset()
					{
						const random = createRng( 0x1234abcd );
						const a = 4;
						const boxes = [];

						for ( let i = 0; i < gridCount; i += 1 )
						{
							for ( let j = 0; j < gridCount; j += 1 )
							{
								boxes.push( {
									size: { hx: a, hy: 0.5 * a, hz: a },
									localPosition: {
										x: ( 2 * i - gridCount ) * a,
										y: randomRange( random, -0.5, 0.25 ) * a,
										z: ( 2 * j - gridCount ) * a,
									},
									color: 0x71808b,
								} );
							}
						}

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: -2, y: 1, z: -3 },
							boxes,
						} );

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 3, y: 24, z: 0 },
							radius: 1,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 45, y: 30, z: 45 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`tiles: ${tileCount}`,
							`note: this native sample is mostly a static compound stress scene`,
							`compound bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "compound-mesh-tile",
			label: "Compound / Mesh Tile",
			description:
				"A closer browser port of the native mesh-tile sample. Each tile is now represented as a repeated box mesh child on one static compound body, which better matches the original sample's mesh-backed compound layout.",
			create( ctx )
			{
				const gridCount = 2;
				const tileCount = gridCount * gridCount;

				return {
					reset()
					{
						const random = createRng( 0x51ced00d );
						const a = 4;
						const meshes = [];

						for ( let i = 0; i < gridCount; i += 1 )
						{
							for ( let j = 0; j < gridCount; j += 1 )
							{
								const center = {
									x: ( 2 * i - gridCount ) * a,
									y: randomRange( random, -0.5, 0.25 ) * a,
									z: ( 2 * j - gridCount ) * a,
								};
								meshes.push( {
									mesh: ctx.physics.createBoxMesh( {
										center,
										extent: { x: a, y: 0.5 * a, z: a },
										identifyEdges: true,
									} ),
									color: 0x6f7f89,
								} );
							}
						}

						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createCompoundBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							meshes,
						} );

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 3, y: 14, z: 0 },
							radius: 0.8,
							color: 0xd67c42,
						} );

						ctx.setCameraLookAt( { x: 45, y: 30, z: 45 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`mesh tiles: ${tileCount}`,
							`rendered as repeated box-mesh children`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "compound-village",
			label: "Compound / Village",
			description:
				"A closer browser port of the native Village sample: a giant mixed compound of hulls, spheres, capsules, and repeated building meshes, plus the roaming ray-cast / shape-cast / overlap probes that make it a strong large-scene regression test.",
			create( ctx )
			{
				const gridCount = 64;
				const worldScale = 4;
				const probeHandles = [];
				const worldWidth = 2 * gridCount * worldScale;
				let loadToken = 0;
				let loading = false;
				let ready = false;
				let loadError = null;
				let capsuleCount = 0;
				let hullCount = 0;
				let meshCount = 0;
				let sphereCount = 0;
				let currentHitChildIndex = 0;
				let rayHitLabel = "ray: pending";
				let shapeHitLabel = "shape: pending";
				let overlapLabel = "overlap: pending";
				const rayOrigin = { x: -0.45 * worldWidth, y: 20, z: -0.45 * worldWidth };

				function offsetPoint( point, offset )
				{
					return {
						x: point.x + offset.x,
						y: point.y + offset.y,
						z: point.z + offset.z,
					};
				}

				function ensureLoaded()
				{
					if ( loading || ready )
					{
						return;
					}

					loading = true;
					loadError = null;
					const token = ++loadToken;

					loadObjMesh( buildingObjUrl )
						.then( ( buildingMesh ) =>
						{
							if ( token !== loadToken )
							{
								return;
							}

							const random = createRng( 0x71aa9e5 );
							const buildingMeshResource = ctx.physics.createCustomMesh( {
								vertices: buildingMesh.vertices,
								indices: buildingMesh.indices,
								materialIndices: buildingMesh.materialIndices,
								identifyEdges: true,
								weldVertices: true,
								weldTolerance: 0.001,
							} );
							const boxes = [];
							const capsules = [];
							const spheres = [];
							const meshes = [];
							const a = worldScale;
							const lower = { x: -a, y: a, z: -a };
							const upper = { x: a, y: 2 * a, z: a };

							for ( let i = 0; i < gridCount; i += 1 )
							{
								for ( let j = 0; j < gridCount; j += 1 )
								{
									const localPosition = {
										x: ( 2 * i - gridCount ) * a,
										y: randomRange( random, -0.25, 0.125 ) * a,
										z: ( 2 * j - gridCount ) * a,
									};

									boxes.push( {
										size: { hx: a, hy: 0.5 * a, hz: a },
										localPosition,
										color: 0x6f7f89,
									} );

									if ( ( i & 1 ) === 1 && ( j & 1 ) === 1 )
									{
										const offset1 = randomVec3( random, lower, upper );
										const offset2 = randomVec3( random, lower, upper );
										const p1 = offsetPoint( offset1, localPosition );
										const p2 = offsetPoint( offset2, localPosition );
										const radius = randomRange( random, 0.1, 0.5 );

										if ( capsules.length <= spheres.length )
										{
											capsules.push( {
												capsule: {
													center1: p1,
													center2: p2,
													radius,
												},
												color: 0x7b8a94,
											} );
										}
										else
										{
											spheres.push( {
												center: p1,
												radius,
												color: 0x85939d,
											} );
										}
									}
								}
							}

							const meshGridCount = Math.floor( gridCount / 4 );
							const b = 4 * a;
							for ( let i = 0; i < meshGridCount; i += 1 )
							{
								for ( let j = 0; j < meshGridCount; j += 1 )
								{
									const scale = {
										x: randomRange( random, 0.5, 2.0 ),
										y: randomRange( random, 0.5, 2.0 ),
										z: randomRange( random, 0.5, 2.0 ),
									};
									const meshIndex = meshes.length;
									if ( ( meshIndex & 1 ) !== 0 )
									{
										scale.x = -scale.x;
									}
									if ( ( meshIndex & 3 ) !== 0 )
									{
										scale.z = -scale.z;
									}

									meshes.push( {
										mesh: buildingMeshResource,
										localPosition: {
											x: ( 2 * i - meshGridCount ) * b + 0.5 * b,
											y: 0.5 * a,
											z: ( 2 * j - meshGridCount ) * b + 0.5 * b,
										},
										localRotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, randomRange( random, -Math.PI, Math.PI ) ),
										scale,
										color: 0x8a8f96,
										friction: 0.4,
										restitution: 0.05,
									} );
								}
							}

							hullCount = boxes.length;
							capsuleCount = capsules.length;
							meshCount = meshes.length;
							sphereCount = spheres.length;

							ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
							ctx.physics.createCompoundBody( {
								type: BodyType.static,
								position: { x: -1, y: -0.5, z: 2 },
								rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, -1.15 * Math.PI ),
								boxes,
								capsules,
								meshes,
								spheres,
							} );

							probeHandles.length = 0;
							for ( let index = 0; index < 5; index += 1 )
							{
								probeHandles.push(
									ctx.physics.createSphereBody( {
										type: BodyType.dynamic,
										position: { x: -60 + 30 * index, y: 38 + 4 * index, z: -55 + 24 * index },
										radius: 1.2,
										color: 0xd67c42,
									} )
								);
							}

							ctx.setCameraLookAt( { x: 220, y: 130, z: 220 }, { x: 0, y: 0, z: 0 } );
							ready = true;
							loading = false;
						} )
						.catch( ( error ) =>
						{
							if ( token !== loadToken )
							{
								return;
							}
							loadError = error;
							loading = false;
						} );
				}

				return {
					reset()
					{
						ready = false;
						loadError = null;
						currentHitChildIndex = 0;
						rayHitLabel = "ray: pending";
						shapeHitLabel = "shape: pending";
						overlapLabel = "overlap: pending";
						rayOrigin.x = -0.45 * worldWidth;
						rayOrigin.y = 20;
						rayOrigin.z = -0.45 * worldWidth;
						ensureLoaded();
					},

					update( dt )
					{
						if ( ready === false )
						{
							return;
						}

						const translation = { x: 10, y: -40, z: -5 };
						const rayResult = ctx.physics.worldCastRayClosest( { origin: rayOrigin, translation } );
						ctx.physics.addDebugLine( rayOrigin, offsetPoint( rayOrigin, translation ), 0xf0f8ff );
						if ( rayResult.hit )
						{
							const point2 = offsetPoint( rayResult.point, {
								x: 0.5 * rayResult.normal.x,
								y: 0.5 * rayResult.normal.y,
								z: 0.5 * rayResult.normal.z,
							} );
							ctx.physics.addDebugLine( rayResult.point, point2, 0xffff00 );
							ctx.physics.addDebugPoint( rayResult.point, 0xf08080 );
							rayHitLabel = `ray hit tri/child: ${rayResult.triangleIndex} / ${rayResult.childIndex}`;
						}
						else
						{
							rayHitLabel = "ray miss";
						}

						const shapeOrigin = { x: rayOrigin.x - 1, y: rayOrigin.y, z: rayOrigin.z - 1 };
						const shapeResult = ctx.physics.worldCastShapeClosest( {
							origin: shapeOrigin,
							points: [ { x: 0, y: 0, z: 0 } ],
							radius: 0.25,
							translation,
						} );
						ctx.physics.addDebugLine( shapeOrigin, offsetPoint( shapeOrigin, translation ), 0xf0f8ff );
						if ( shapeResult.hit )
						{
							const position = offsetPoint( shapeOrigin, {
								x: shapeResult.fraction * translation.x,
								y: shapeResult.fraction * translation.y,
								z: shapeResult.fraction * translation.z,
							} );
							const point2 = offsetPoint( shapeResult.point, {
								x: 0.5 * shapeResult.normal.x,
								y: 0.5 * shapeResult.normal.y,
								z: 0.5 * shapeResult.normal.z,
							} );
							ctx.physics.addDebugLine( shapeResult.point, point2, 0xffff00 );
							ctx.physics.addDebugPoint( shapeResult.point, 0xf08080 );
							ctx.physics.addDebugPoint( position, 0xda70d6 );
							shapeHitLabel = `shape hit tri/child: ${shapeResult.triangleIndex} / ${shapeResult.childIndex}`;
						}
						else
						{
							shapeHitLabel = "shape miss";
						}

						const overlapOrigin = { x: rayOrigin.x - 1, y: 2, z: rayOrigin.z - 1 };
						const overlap = ctx.physics.worldOverlapShape( {
							points: [ overlapOrigin ],
							radius: 0.3,
						} );
						ctx.physics.addDebugPoint( overlapOrigin, overlap ? 0x8b008b : 0x8fbc8f );
						overlapLabel = overlap ? "overlap: hit" : "overlap: clear";

						if ( rayResult.hit )
						{
							currentHitChildIndex = rayResult.childIndex;
						}

						if ( rayOrigin.x > 0.45 * worldWidth )
						{
							rayOrigin.x = -0.45 * worldWidth;
							rayOrigin.z += 8;
						}

						if ( rayOrigin.z > 0.45 * worldWidth )
						{
							rayOrigin.z = -0.45 * worldWidth;
						}

						rayOrigin.x += 2 * dt;
					},

					getStatusLines()
					{
						const firstProbe = probeHandles.length > 0 ? ctx.physics.getBodyTransform( probeHandles[0] ) : null;
						return [
							loading ? "mesh: loading OBJ..." : ready ? "mesh: ready" : loadError == null ? "mesh: pending" : `mesh load failed: ${loadError.message}`,
							`compound capsules / hulls / meshes / spheres: ${capsuleCount} / ${hullCount} / ${meshCount} / ${sphereCount}`,
							firstProbe == null ? "probe height: --" : `probe height: ${firstProbe.position.y.toFixed( 2 )}`,
							`hit child index: ${currentHitChildIndex}`,
							rayHitLabel,
							shapeHitLabel,
							overlapLabel,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},

					dispose()
					{
						loadToken += 1;
						loading = false;
					},
				};
			},
		},
	];
}
