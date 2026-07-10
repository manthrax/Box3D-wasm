import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createCollisionSamples( { BodyType } )
{
	function offsetPoint( point, offset )
	{
		return {
			x: point.x + offset.x,
			y: point.y + offset.y,
			z: point.z + offset.z,
		};
	}

	function lerp( a, b, t )
	{
		return a + ( b - a ) * t;
	}

	function lerpVec3( a, b, t )
	{
		return {
			x: lerp( a.x, b.x, t ),
			y: lerp( a.y, b.y, t ),
			z: lerp( a.z, b.z, t ),
		};
	}

	function normalizeQuaternion( q )
	{
		const length = Math.hypot( q.x, q.y, q.z, q.w ) || 1;
		return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
	}

	function slerpQuaternion( a, b, t )
	{
		let bx = b.x;
		let by = b.y;
		let bz = b.z;
		let bw = b.w;
		let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;
		if ( dot < 0 )
		{
			dot = -dot;
			bx = -bx;
			by = -by;
			bz = -bz;
			bw = -bw;
		}

		if ( dot > 0.9995 )
		{
			return normalizeQuaternion( {
				x: lerp( a.x, bx, t ),
				y: lerp( a.y, by, t ),
				z: lerp( a.z, bz, t ),
				w: lerp( a.w, bw, t ),
			} );
		}

		const theta0 = Math.acos( Math.max( -1, Math.min( 1, dot ) ) );
		const sinTheta0 = Math.sin( theta0 ) || 1;
		const theta = theta0 * t;
		const s0 = Math.sin( theta0 - theta ) / sinTheta0;
		const s1 = Math.sin( theta ) / sinTheta0;
		return {
			x: s0 * a.x + s1 * bx,
			y: s0 * a.y + s1 * by,
			z: s0 * a.z + s1 * bz,
			w: s0 * a.w + s1 * bw,
		};
	}

	function rotateVec3( q, v )
	{
		const xx = q.x * q.x;
		const yy = q.y * q.y;
		const zz = q.z * q.z;
		const xy = q.x * q.y;
		const xz = q.x * q.z;
		const yz = q.y * q.z;
		const wx = q.w * q.x;
		const wy = q.w * q.y;
		const wz = q.w * q.z;
		return {
			x: ( 1 - 2 * ( yy + zz ) ) * v.x + 2 * ( xy - wz ) * v.y + 2 * ( xz + wy ) * v.z,
			y: 2 * ( xy + wz ) * v.x + ( 1 - 2 * ( xx + zz ) ) * v.y + 2 * ( yz - wx ) * v.z,
			z: 2 * ( xz - wy ) * v.x + 2 * ( yz + wx ) * v.y + ( 1 - 2 * ( xx + yy ) ) * v.z,
		};
	}

	function transformPoint( transform, point )
	{
		const rotated = rotateVec3( transform.rotation, point );
		return {
			x: transform.position.x + rotated.x,
			y: transform.position.y + rotated.y,
			z: transform.position.z + rotated.z,
		};
	}

	function drawSegment( physics, a, b, color )
	{
		physics.addDebugLine( a, b, color );
		physics.addDebugPoint( a, color );
		physics.addDebugPoint( b, color );
	}

	function drawTriangle( physics, points, color )
	{
		drawSegment( physics, points[0], points[1], color );
		drawSegment( physics, points[1], points[2], color );
		drawSegment( physics, points[2], points[0], color );
	}

	function drawCapsule( physics, center1, center2, radius, color )
	{
		drawSegment( physics, center1, center2, color );
		physics.addDebugPoint( center1, color );
		physics.addDebugPoint( center2, color );
		const axis = {
			x: center2.x - center1.x,
			y: center2.y - center1.y,
			z: center2.z - center1.z,
		};
		const axisLength = Math.hypot( axis.x, axis.y, axis.z ) || 1;
		const tangent = Math.abs( axis.y / axisLength ) > 0.9
			? { x: 1, y: 0, z: 0 }
			: { x: 0, y: 1, z: 0 };
		const normal = {
			x: axis.y * tangent.z - axis.z * tangent.y,
			y: axis.z * tangent.x - axis.x * tangent.z,
			z: axis.x * tangent.y - axis.y * tangent.x,
		};
		const normalLength = Math.hypot( normal.x, normal.y, normal.z ) || 1;
		const unit = {
			x: ( radius * normal.x ) / normalLength,
			y: ( radius * normal.y ) / normalLength,
			z: ( radius * normal.z ) / normalLength,
		};
		drawSegment( physics, offsetPoint( center1, unit ), offsetPoint( center2, unit ), color );
		drawSegment( physics, offsetPoint( center1, { x: -unit.x, y: -unit.y, z: -unit.z } ), offsetPoint( center2, { x: -unit.x, y: -unit.y, z: -unit.z } ), color );
	}

	function drawBox( physics, points, color )
	{
		const edges = [
			[ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 0 ],
			[ 4, 5 ], [ 5, 6 ], [ 6, 7 ], [ 7, 4 ],
			[ 0, 4 ], [ 1, 5 ], [ 2, 6 ], [ 3, 7 ],
		];
		for ( const edge of edges )
		{
			physics.addDebugLine( points[edge[0]], points[edge[1]], color );
		}
	}

	function makeShapePoints( type )
	{
		switch ( type )
		{
			case "point":
				return [ { x: 0, y: 0, z: 0 } ];
			case "segment":
				return [ { x: -0.75, y: 0, z: 0 }, { x: 0.75, y: 0, z: 0 } ];
			case "triangle":
				return [ { x: -1, y: 0, z: -0.5 }, { x: 0.2, y: 0.7, z: 0.4 }, { x: 0.9, y: 0, z: -0.3 } ];
			case "box":
			default:
				return [
					{ x: 0.6, y: 0.6, z: 0.6 }, { x: -0.6, y: 0.6, z: 0.6 }, { x: -0.6, y: -0.6, z: 0.6 }, { x: 0.6, y: -0.6, z: 0.6 },
					{ x: 0.6, y: 0.6, z: -0.6 }, { x: -0.6, y: 0.6, z: -0.6 }, { x: -0.6, y: -0.6, z: -0.6 }, { x: 0.6, y: -0.6, z: -0.6 },
				];
		}
	}

	function drawShape( physics, points, transform, color )
	{
		const transformed = points.map( ( point ) => transformPoint( transform, point ) );
		if ( transformed.length === 1 )
		{
			physics.addDebugPoint( transformed[0], color );
		}
		else if ( transformed.length === 2 )
		{
			drawSegment( physics, transformed[0], transformed[1], color );
		}
		else if ( transformed.length === 3 )
		{
			drawTriangle( physics, transformed, color );
		}
		else if ( transformed.length === 8 )
		{
			drawBox( physics, transformed, color );
		}
		return transformed;
	}

	return [
		{
			key: "collision-ray-curtain",
			label: "Collision / Ray Curtain",
			description:
				"A browser port of the native ray-curtain sample. A moving vertical curtain of rays sweeps across rotating kinematic shapes so we can sanity-check world ray casting against spheres, capsules, hulls, and meshes.",
			create( ctx )
			{
				let offset = 2;
				let speed = -0.015;

				return {
					reset()
					{
						offset = 2;
						speed = -0.015;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const torusMesh = ctx.physics.createTorusMesh( {
							radialResolution: 10,
							tubularResolution: 12,
							radius: 0.65,
							thickness: 0.35,
						} );

						ctx.physics.createSphereBody( {
							type: BodyType.kinematic,
							position: { x: -6, y: 3, z: 0 },
							angularVelocity: { x: 0.8, y: 0.4, z: 0.8 },
							radius: 0.9,
							color: 0xca8359,
						} );

						ctx.physics.createCapsuleBody( {
							type: BodyType.kinematic,
							position: { x: -2, y: 3, z: 0 },
							angularVelocity: { x: 0.8, y: 0.4, z: 0.8 },
							capsule: {
								center1: { x: -0.5, y: 0, z: 0 },
								center2: { x: 0.5, y: 0, z: 0 },
								radius: 0.8,
							},
							color: 0xb37656,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.kinematic,
							position: { x: 2, y: 3, z: 0 },
							angularVelocity: { x: 0.8, y: 0.4, z: 0.8 },
							size: { hx: 0.6, hy: 0.6, hz: 0.6 },
							color: 0x9c6a49,
						} );

						ctx.physics.createMeshBody( {
							type: BodyType.kinematic,
							position: { x: 6, y: 3, z: 0 },
							angularVelocity: { x: 0.8, y: 0.4, z: 0.8 },
							mesh: torusMesh,
							color: 0x7f8d96,
						} );

						ctx.setCameraLookAt( { x: 16, y: 12, z: 20 }, { x: 0, y: 3, z: 0 } );
					},

					update()
					{
						for ( let x = -8; x <= 8.001; x += 0.4 )
						{
							const origin = { x, y: 8, z: offset };
							const end = { x, y: 0, z: offset };
							const translation = { x: 0, y: -8, z: 0 };
							const result = ctx.physics.worldCastRayClosest( { origin, translation } );

							ctx.physics.addDebugPoint( origin, 0x53d16a );
							ctx.physics.addDebugPoint( end, 0xd05c44 );
							ctx.physics.addDebugLine( origin, end, 0xd8c86b );

							if ( result.hit )
							{
								ctx.physics.addDebugLine(
									result.point,
									{
										x: result.point.x + 0.5 * result.normal.x,
										y: result.point.y + 0.5 * result.normal.y,
										z: result.point.z + 0.5 * result.normal.z,
									},
									0x67d466
								);
							}
						}

						if ( offset > 2 )
						{
							speed = -0.015;
						}
						else if ( offset < -2 )
						{
							speed = 0.015;
						}

						offset += speed;
					},

					getStatusLines()
					{
						return [
							`curtain z offset: ${offset.toFixed( 2 )}`,
							"moving ray curtain vs rotating sphere, capsule, box, and torus mesh",
							"use this to catch broken world ray-cast behavior quickly",
						];
					},
				};
			},
		},
		{
			key: "collision-mesh-scale",
			label: "Collision / Mesh Scale",
			description:
				"A browser port of the native mesh-scale sample. A ray or sphere cast probes a single box mesh while its non-uniform scale and cast start position are adjusted, making this a handy regression case for scaled-mesh queries.",
			create( ctx )
			{
				let mesh = null;
				let meshBodyHandle = 0;
				let meshScale = { x: 1, y: 1, z: 1 };
				let start = { x: -2, y: 0, z: 0 };
				let sphereCast = true;

				function rebuildMeshBody()
				{
					if ( meshBodyHandle !== 0 )
					{
						ctx.physics.destroyBody( meshBodyHandle );
					}

					meshBodyHandle = ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: { x: 0, y: 0, z: 0 },
						mesh,
						scale: meshScale,
						color: 0x7b8891,
					} );
				}

				return {
					reset()
					{
						meshScale = { x: 1, y: 1, z: 1 };
						start = { x: -2, y: 0, z: 0 };
						sphereCast = true;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						mesh = ctx.physics.createBoxMesh( {
							center: { x: 0, y: 0, z: 0 },
							extent: { x: 0.5, y: 0.5, z: 0.5 },
							identifyEdges: true,
						} );
						rebuildMeshBody();
						ctx.setCameraLookAt( { x: 12, y: 8, z: 14 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						const origin = start;
						const translation = { x: 4, y: 0, z: 0 };
						const end = { x: origin.x + translation.x, y: origin.y, z: origin.z };

						ctx.physics.addDebugPoint( origin, 0x53d16a );
						ctx.physics.addDebugPoint( end, 0xd05c44 );
						ctx.physics.addDebugLine( origin, end, 0xffffff );

						if ( sphereCast )
						{
							const castStart = { x: origin.x, y: origin.y, z: origin.z };
							const result = ctx.physics.worldCastShapeClosest( {
								points: [ castStart ],
								radius: 0.25,
								translation,
							} );

							ctx.physics.addDebugPoint( castStart, 0xf2d66b );
							if ( result.hit )
							{
								const finalCenter = {
									x: castStart.x + result.fraction * translation.x,
									y: castStart.y + result.fraction * translation.y,
									z: castStart.z + result.fraction * translation.z,
								};
								ctx.physics.addDebugPoint( finalCenter, 0xf2d66b );
								ctx.physics.addDebugPoint( result.point, 0xf2d66b );
								ctx.physics.addDebugLine(
									result.point,
									{
										x: result.point.x + 0.5 * result.normal.x,
										y: result.point.y + 0.5 * result.normal.y,
										z: result.point.z + 0.5 * result.normal.z,
									},
									0x67d466
								);
							}
						}
						else
						{
							const result = ctx.physics.worldCastRayClosest( { origin, translation } );
							if ( result.hit )
							{
								ctx.physics.addDebugPoint( result.point, 0xf2d66b );
								ctx.physics.addDebugLine(
									result.point,
									{
										x: result.point.x + 0.5 * result.normal.x,
										y: result.point.y + 0.5 * result.normal.y,
										z: result.point.z + 0.5 * result.normal.z,
									},
									0x67d466
								);
							}
						}
					},

					buildUI( panel )
					{
						panel.add( "Scale X", meshScale.x, { min: -2, max: 2, step: 0.1 }, ( value ) =>
						{
							meshScale.x = value;
							rebuildMeshBody();
						} );
						panel.add( "Scale Y", meshScale.y, { min: -2, max: 2, step: 0.1 }, ( value ) =>
						{
							meshScale.y = value;
							rebuildMeshBody();
						} );
						panel.add( "Scale Z", meshScale.z, { min: -2, max: 2, step: 0.1 }, ( value ) =>
						{
							meshScale.z = value;
							rebuildMeshBody();
						} );
						panel.add( "Start Y", start.y, { min: -2, max: 2, step: 0.1 }, ( value ) =>
						{
							start.y = value;
						} );
						panel.add( "Start Z", start.z, { min: -2, max: 2, step: 0.1 }, ( value ) =>
						{
							start.z = value;
						} );
						panel.addButton( sphereCast ? "Mode: Sphere" : "Mode: Ray", () =>
						{
							sphereCast = ! sphereCast;
						} );
					},

					getStatusLines()
					{
						return [
							`mesh scale: (${meshScale.x.toFixed( 1 )}, ${meshScale.y.toFixed( 1 )}, ${meshScale.z.toFixed( 1 )})`,
							`cast mode: ${sphereCast ? "sphere cast" : "ray cast"}`,
							"adjust scale and start offsets to probe scaled-mesh query behavior",
						];
					},
				};
			},
		},
		{
			key: "collision-cast-world",
			label: "Collision / Cast World",
			description:
				"A browser port of the native cast-world scene built around the currently exposed closest-hit queries. It keeps the same cast primitives and spawn controls so we can regression-test broad world queries across spheres, capsules, hulls, torus meshes, and a wave mesh.",
			sceneOptions: {
				showGround: false,
				showGrid: true,
			},
			create( ctx )
			{
				const maxBodies = 64;
				const ignoreBaseMask = 0x7;
				const sphereShape = { radius: 0.9 };
				const capsuleShape = {
					center1: { x: -0.5, y: 0, z: 0 },
					center2: { x: 0.5, y: 0, z: 0 },
					radius: 0.8,
				};
				const hullPoints = makeShapePoints( "box" );
				const torusMesh = ctx.physics.createTorusMesh( {
					radialResolution: 10,
					tubularResolution: 12,
					radius: 0.65,
					thickness: 0.35,
				} );
				const waveMesh = ctx.physics.createWaveMesh( {
					xCount: 10,
					zCount: 10,
					cellWidth: 0.5,
					amplitude: 0.2,
					rowFrequency: 0.03,
					columnFrequency: 0.09,
				} );

				const bodySlots = new Array( maxBodies ).fill( 0 );
				let bodyIndex = 0;
				let castType = "ray";
				let castRadius = 0.5;
				let ignoreInitialOverlap = false;
				let castOrigin = { x: -20, y: 10, z: 0 };
				let castTranslation = { x: 20, y: 10, z: 0 };
				let lastHit = null;

				function randomUnitVector()
				{
					const z = 2 * Math.random() - 1;
					const theta = 2 * Math.PI * Math.random();
					const radius = Math.sqrt( Math.max( 0, 1 - z * z ) );
					return {
						x: radius * Math.cos( theta ),
						y: z,
						z: radius * Math.sin( theta ),
					};
				}

				function randomQuaternion()
				{
					const axis = randomUnitVector();
					const angle = -Math.PI + 2 * Math.PI * Math.random();
					return axisAngleToQuaternion( axis, angle );
				}

				function nextBodyType(index, forceStatic = false)
				{
					if ( forceStatic )
					{
						return BodyType.static;
					}

					if ( index % 3 === 0 )
					{
						return BodyType.kinematic;
					}

					if ( index % 2 === 0 )
					{
						return BodyType.dynamic;
					}

					return BodyType.static;
				}

				function replaceBodyAtSlot( createBody )
				{
					if ( bodySlots[bodyIndex] !== 0 )
					{
						ctx.physics.destroyBody( bodySlots[bodyIndex] );
						bodySlots[bodyIndex] = 0;
					}

					bodySlots[bodyIndex] = createBody( bodyIndex );
					bodyIndex = ( bodyIndex + 1 ) % maxBodies;
				}

				function spawnShapeFamily( family, count )
				{
					for ( let index = 0; index < count; index += 1 )
					{
						replaceBodyAtSlot( ( slotIndex ) =>
						{
							const forceStatic = family === "height";
							const type = nextBodyType( slotIndex, forceStatic );
							const position = {
								x: -20 + 40 * Math.random(),
								y: -20 + 40 * Math.random(),
								z: -20 + 40 * Math.random(),
							};
							const rotation = randomQuaternion();
							const isIgnoredOutline = ( slotIndex & ignoreBaseMask ) === ignoreBaseMask;
							const color = isIgnoredOutline ? 0xd7c85d : 0xc9804d;

							switch ( family )
							{
								case "sphere":
									return ctx.physics.createSphereBody( {
										type,
										position,
										rotation,
										gravityScale: 0,
										radius: sphereShape.radius,
										color,
									} );
								case "capsule":
									return ctx.physics.createCapsuleBody( {
										type,
										position,
										rotation,
										gravityScale: 0,
										capsule: capsuleShape,
										color,
									} );
								case "hull":
									return ctx.physics.createHullBody( {
										type,
										position,
										rotation,
										gravityScale: 0,
										points: hullPoints,
										color,
									} );
								case "mesh":
									return ctx.physics.createMeshBody( {
										type,
										position,
										rotation,
										gravityScale: 0,
										mesh: torusMesh,
										scale: { x: 4, y: 3, z: -2 },
										color,
									} );
								case "height":
									return ctx.physics.createMeshBody( {
										type: BodyType.static,
										position,
										rotation,
										mesh: waveMesh,
										color,
									} );
								default:
									return 0;
							}
						} );
					}
				}

				function destroyOneBody()
				{
					for ( let index = 0; index < maxBodies; index += 1 )
					{
						if ( bodySlots[index] !== 0 )
						{
							ctx.physics.destroyBody( bodySlots[index] );
							bodySlots[index] = 0;
							return;
						}
					}
				}

				function drawCastPrimitive()
				{
					if ( castType === "ray" )
					{
						return;
					}

					const fraction = lastHit?.hit ? lastHit.fraction : 1;
					const hitOffset = {
						x: fraction * castTranslation.x,
						y: fraction * castTranslation.y,
						z: fraction * castTranslation.z,
					};

					if ( castType === "sphere" )
					{
						ctx.physics.addDebugPoint( castOrigin, 0x53d16a );
						ctx.physics.addDebugPoint( offsetPoint( castOrigin, hitOffset ), lastHit?.hit ? 0xff7151 : 0x808890 );
						return;
					}

					if ( castType === "capsule" )
					{
						const start1 = offsetPoint( castOrigin, { x: 0, y: 0, z: 0 } );
						const start2 = offsetPoint( castOrigin, { x: 0, y: 1, z: 0 } );
						drawCapsule( ctx.physics, start1, start2, castRadius, 0x53d16a );
						drawCapsule( ctx.physics, offsetPoint( start1, hitOffset ), offsetPoint( start2, hitOffset ), castRadius, lastHit?.hit ? 0xff7151 : 0x808890 );
						return;
					}

					const extent = { x: castRadius, y: 0.5 * castRadius, z: 0.25 * castRadius };
					const startPoints = [
						{ x: extent.x, y: extent.y, z: extent.z }, { x: -extent.x, y: extent.y, z: extent.z }, { x: -extent.x, y: -extent.y, z: extent.z }, { x: extent.x, y: -extent.y, z: extent.z },
						{ x: extent.x, y: extent.y, z: -extent.z }, { x: -extent.x, y: extent.y, z: -extent.z }, { x: -extent.x, y: -extent.y, z: -extent.z }, { x: extent.x, y: -extent.y, z: -extent.z },
					].map( ( point ) => offsetPoint( point, castOrigin ) );
					drawBox( ctx.physics, startPoints, 0x53d16a );
					drawBox( ctx.physics, startPoints.map( ( point ) => offsetPoint( point, hitOffset ) ), lastHit?.hit ? 0xff7151 : 0x808890 );
				}

				function runCast()
				{
					if ( castType === "ray" )
					{
						lastHit = ctx.physics.worldCastRayClosest( {
							origin: castOrigin,
							translation: castTranslation,
						} );
						return;
					}

					if ( castType === "sphere" )
					{
						lastHit = ctx.physics.worldCastShapeClosest( {
							points: [ castOrigin ],
							radius: castRadius,
							translation: castTranslation,
							ignoreInitialOverlap,
						} );
						return;
					}

					if ( castType === "capsule" )
					{
						lastHit = ctx.physics.worldCastShapeClosest( {
							points: [
								castOrigin,
								offsetPoint( castOrigin, { x: 0, y: 1, z: 0 } ),
							],
							radius: castRadius,
							translation: castTranslation,
							ignoreInitialOverlap,
						} );
						return;
					}

					const extent = { x: castRadius, y: 0.5 * castRadius, z: 0.25 * castRadius };
					lastHit = ctx.physics.worldCastShapeClosest( {
						points: [
							{ x: castOrigin.x + extent.x, y: castOrigin.y + extent.y, z: castOrigin.z + extent.z },
							{ x: castOrigin.x - extent.x, y: castOrigin.y + extent.y, z: castOrigin.z + extent.z },
							{ x: castOrigin.x - extent.x, y: castOrigin.y - extent.y, z: castOrigin.z + extent.z },
							{ x: castOrigin.x + extent.x, y: castOrigin.y - extent.y, z: castOrigin.z + extent.z },
							{ x: castOrigin.x + extent.x, y: castOrigin.y + extent.y, z: castOrigin.z - extent.z },
							{ x: castOrigin.x - extent.x, y: castOrigin.y + extent.y, z: castOrigin.z - extent.z },
							{ x: castOrigin.x - extent.x, y: castOrigin.y - extent.y, z: castOrigin.z - extent.z },
							{ x: castOrigin.x + extent.x, y: castOrigin.y - extent.y, z: castOrigin.z - extent.z },
						],
						radius: 0,
						translation: castTranslation,
						ignoreInitialOverlap,
					} );
				}

				return {
					reset()
					{
						for ( let index = 0; index < maxBodies; index += 1 )
						{
							bodySlots[index] = 0;
						}
						bodyIndex = 0;
						castType = "ray";
						castRadius = 0.5;
						ignoreInitialOverlap = false;
						castOrigin = { x: -20, y: 10, z: 0 };
						castTranslation = { x: 20, y: 10, z: 0 };
						lastHit = null;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.setCameraLookAt( { x: 18, y: 12, z: 18 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						runCast();
						ctx.physics.addDebugLine( castOrigin, offsetPoint( castOrigin, castTranslation ), 0x59d5de );
						ctx.physics.addDebugPoint( castOrigin, 0x53d16a );
						if ( lastHit?.hit )
						{
							ctx.physics.addDebugPoint( lastHit.point, 0xff7151 );
							ctx.physics.addDebugLine( lastHit.point, offsetPoint( lastHit.point, {
								x: 0.5 * lastHit.normal.x,
								y: 0.5 * lastHit.normal.y,
								z: 0.5 * lastHit.normal.z,
							} ), 0xf2d66b );
						}
						drawCastPrimitive();
					},

					buildUI( panel )
					{
						panel.addButton( `Cast: ${castType}`, () =>
						{
							castType = castType === "ray"
								? "sphere"
								: castType === "sphere"
									? "capsule"
									: castType === "capsule"
										? "box"
										: "ray";
						} );
						panel.add( "Radius", castRadius, { min: 0.1, max: 2.0, step: 0.1 }, ( value ) =>
						{
							castRadius = value;
						} );
						panel.add( "Origin X", castOrigin.x, { min: -30, max: 30, step: 0.5 }, ( value ) =>
						{
							castOrigin.x = value;
						} );
						panel.add( "Origin Y", castOrigin.y, { min: -30, max: 30, step: 0.5 }, ( value ) =>
						{
							castOrigin.y = value;
						} );
						panel.add( "Origin Z", castOrigin.z, { min: -30, max: 30, step: 0.5 }, ( value ) =>
						{
							castOrigin.z = value;
						} );
						panel.add( "Delta X", castTranslation.x, { min: -100, max: 100, step: 1 }, ( value ) =>
						{
							castTranslation.x = value;
						} );
						panel.add( "Delta Y", castTranslation.y, { min: -100, max: 100, step: 1 }, ( value ) =>
						{
							castTranslation.y = value;
						} );
						panel.add( "Delta Z", castTranslation.z, { min: -100, max: 100, step: 1 }, ( value ) =>
						{
							castTranslation.z = value;
						} );
						panel.addButton( ignoreInitialOverlap ? "Initial: Ignore" : "Initial: Report", () =>
						{
							ignoreInitialOverlap = !ignoreInitialOverlap;
						} );
						panel.addButton( "Spheres", () => { spawnShapeFamily( "sphere", 10 ); } );
						panel.addButton( "Capsules", () => { spawnShapeFamily( "capsule", 10 ); } );
						panel.addButton( "Hulls", () => { spawnShapeFamily( "hull", 10 ); } );
						panel.addButton( "Meshes", () => { spawnShapeFamily( "mesh", 1 ); } );
						panel.addButton( "Height Field", () => { spawnShapeFamily( "height", 1 ); } );
						panel.addButton( "Destroy Shape", destroyOneBody );
					},

					getStatusLines()
					{
						const livingBodies = bodySlots.filter( ( handle ) => handle !== 0 ).length;
						return [
							`cast type: ${castType} (closest only)`,
							`hit: ${lastHit?.hit ? "yes" : "no"}${lastHit?.hit ? `, fraction ${lastHit.fraction.toFixed( 3 )}` : ""}`,
							`spawned bodies: ${livingBodies}/${maxBodies}`,
							`initial overlap: ${ignoreInitialOverlap ? "ignored" : "reported"}`,
							"native any/multiple/sorted query callbacks are not surfaced in the browser binding yet",
						];
					},
				};
			},
		},
		{
			key: "collision-initial-overlap",
			label: "Collision / Initial Overlap",
			description:
				"A browser port of the native initial-overlap sample. A zero-length capsule shape cast starts overlapping a tilted mesh, which is a nice regression case for how initial contacts are reported.",
			create( ctx )
			{
				let ignoreInitialOverlap = false;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const mesh = ctx.physics.createCustomMesh( {
							vertices: [
								{ x: -0.5, y: 0.5, z: 0.5 },
								{ x: -0.5, y: 0.5, z: -0.5 },
								{ x: -0.5, y: -0.5, z: -0.5 },
								{ x: -0.5, y: -0.5, z: 0.5 },
							],
							indices: [ 0, 1, 2, 2, 3, 0 ],
							useMedianSplit: false,
							identifyEdges: false,
							weldVertices: false,
						} );

						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 10 * DEG_TO_RAD ),
							scale: { x: 4, y: 4, z: 4 },
							mesh,
							color: 0x7b8891,
						} );

						ctx.setCameraLookAt( { x: -8.6, y: 2.2, z: -7.2 }, { x: 0, y: 0.2, z: 0 } );
					},

					update()
					{
						const p1 = { x: -2.1, y: -0.8, z: 0.95 };
						const p2 = { x: -2.1, y: 0.2, z: 0.95 };
						const result = ctx.physics.worldCastShapeClosest( {
							points: [ p1, p2 ],
							radius: 0.25,
							translation: { x: 0, y: 0, z: 0 },
							ignoreInitialOverlap,
						} );

						ctx.physics.addDebugPoint( p1, 0x53d16a );
						ctx.physics.addDebugPoint( p2, 0x53d16a );
						ctx.physics.addDebugLine( p1, p2, 0x53d16a );

						if ( result.hit )
						{
							ctx.physics.addDebugPoint( result.point, 0xcfe6ff );
							ctx.physics.addDebugLine(
								result.point,
								{
									x: result.point.x + 0.5 * result.normal.x,
									y: result.point.y + 0.5 * result.normal.y,
									z: result.point.z + 0.5 * result.normal.z,
								},
								0xcfe6ff
							);
						}
					},

					buildUI( panel )
					{
						panel.addButton( "Toggle Initial", () =>
						{
							ignoreInitialOverlap = !ignoreInitialOverlap;
						} );
					},

					getStatusLines()
					{
						return [
							`ignore initial overlap: ${ignoreInitialOverlap ? "on" : "off"}`,
							"zero-length capsule cast against a tilted mesh quad",
							"toggle to compare raw initial overlap hits vs ignored overlap starts",
						];
					},
				};
			},
		},
		{
			key: "collision-capsule-cast-ray",
			label: "Collision / Capsule Cast Ray",
			description:
				"A browser port of the native capsule body ray-cast sample. This is a tiny but useful direct check that body-level ray casts against a capsule shape return the expected hit point.",
			create( ctx )
			{
				let bodyHandle = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						bodyHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.kinematic,
							position: { x: 0, y: 0, z: 0 },
							capsule: {
								center1: { x: 0, y: 0, z: 0 },
								center2: { x: 0, y: 1, z: 0 },
								radius: 0.5,
							},
							color: 0xc78655,
						} );

						ctx.setCameraLookAt( { x: 10, y: 7, z: 13 }, { x: 0, y: 0.5, z: 0 } );
					},

					update()
					{
						const origin = { x: -1, y: 0.5, z: 0 };
						const translation = { x: 2, y: 0, z: 0 };
						const rayEnd = { x: 1, y: 0.5, z: 0 };
						const result = ctx.physics.bodyCastRay( bodyHandle, { origin, translation, maxFraction: 1 } );

						ctx.physics.addDebugLine( { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0x4c8fda );
						ctx.physics.addDebugPoint( origin, 0x53d16a );
						ctx.physics.addDebugPoint( rayEnd, 0xd05c44 );
						ctx.physics.addDebugLine( origin, rayEnd, 0x9ea4aa );

						if ( result.hit )
						{
							ctx.physics.addDebugPoint( result.point, 0xffa13d );
						}
					},

					getStatusLines()
					{
						return [
							"ray cast directly against a capsule body",
							"expected hit near the left hemisphere of the capsule",
							`body handle: ${bodyHandle}`,
						];
					},
				};
			},
		},
		{
			key: "collision-shape-cast",
			label: "Collision / Shape Cast",
			description:
				"A browser port of the native shape-cast scene. Spheres, capsules, and oriented box hulls sweep forward through stacked target shapes, which makes it easy to spot broad-phase or narrow-phase regressions in world shape casts.",
			create( ctx )
			{
				let castOffset = { x: 0, y: 0, z: 0 };
				let ignoreInitialOverlap = false;

				function drawHit( result )
				{
					if ( result.hit === false )
					{
						return;
					}

					ctx.physics.addDebugPoint( result.point, 0xff7151 );
					ctx.physics.addDebugLine(
						result.point,
						{
							x: result.point.x + 0.2 * result.normal.x,
							y: result.point.y + 0.2 * result.normal.y,
							z: result.point.z + 0.2 * result.normal.z,
						},
						0xf2d66b
					);
				}

				function drawCast( startPoints, radius, translation, color )
				{
					for ( const point of startPoints )
					{
						ctx.physics.addDebugPoint( point, color );
						const endPoint = {
							x: point.x + translation.x,
							y: point.y + translation.y,
							z: point.z + translation.z,
						};
						ctx.physics.addDebugLine( point, endPoint, 0x7f8c96 );
					}

					const result = ctx.physics.worldCastShapeClosest( {
						points: startPoints,
						radius,
						translation,
						ignoreInitialOverlap,
					} );

					if ( result.hit )
					{
						const shifted = startPoints.map( ( point ) => ( {
							x: point.x + result.fraction * translation.x,
							y: point.y + result.fraction * translation.y,
							z: point.z + result.fraction * translation.z,
						} ) );
						for ( const point of shifted )
						{
							ctx.physics.addDebugPoint( point, 0xff7151 );
						}
					}

					drawHit( result );
				}

				return {
					reset()
					{
						castOffset = { x: 0, y: 0, z: 0 };
						ignoreInitialOverlap = false;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const torusMesh = ctx.physics.createTorusMesh( {
							radialResolution: 10,
							tubularResolution: 12,
							radius: 0.65,
							thickness: 0.35,
						} );

						for ( let index = 0; index < 3; index += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.static,
								position: { x: -6, y: 3 + 2 * index, z: 0 },
								rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.5 * Math.PI ),
								radius: 0.9,
								color: 0xca8359,
							} );

							ctx.physics.createCapsuleBody( {
								type: BodyType.static,
								position: { x: -2, y: 3 + 2 * index, z: 0 },
								rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.25 * Math.PI ),
								capsule: {
									center1: { x: -0.5, y: 0, z: 0 },
									center2: { x: 0.5, y: 0, z: 0 },
									radius: 0.7,
								},
								color: 0xb37656,
							} );

							ctx.physics.createBoxBody( {
								type: BodyType.static,
								position: { x: 2, y: 3 + 2 * index, z: 0 },
								rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.25 * Math.PI ),
								size: { hx: 0.6, hy: 0.6, hz: 0.6 },
								color: 0x9c6a49,
							} );

							ctx.physics.createMeshBody( {
								type: BodyType.static,
								position: { x: 6, y: 3 + 2 * index, z: 0 },
								rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.5 * Math.PI ),
								mesh: torusMesh,
								color: 0x7f8d96,
							} );
						}

						ctx.setCameraLookAt( { x: 16, y: 12, z: 20 }, { x: 0, y: 4.5, z: 0 } );
					},

					update()
					{
						const translation = { x: 0, y: 0, z: 10 };

						for ( let castIndex = 0; castIndex < 4; castIndex += 1 )
						{
							const x = -6 + 4 * castIndex + castOffset.x;
							drawCast(
								[ { x, y: 3 + castOffset.y, z: -5 + castOffset.z } ],
								0.3,
								translation,
								0x53d16a
							);
						}

						for ( let castIndex = 0; castIndex < 4; castIndex += 1 )
						{
							const x = -6 + 4 * castIndex + castOffset.x;
							drawCast(
								[
									{ x: x - 0.2, y: 5 - 0.2 + castOffset.y, z: -5 - 0.2 + castOffset.z },
									{ x: x + 0.2, y: 5 + 0.2 + castOffset.y, z: -5 + 0.2 + castOffset.z },
								],
								0.2,
								translation,
								0x53d16a
							);
						}

						const hullOffsets = [
							{ x: -0.3, y: -0.3, z: -0.3 },
							{ x: 0.3, y: -0.3, z: -0.3 },
							{ x: -0.3, y: 0.3, z: -0.3 },
							{ x: 0.3, y: 0.3, z: -0.3 },
							{ x: -0.3, y: -0.3, z: 0.3 },
							{ x: 0.3, y: -0.3, z: 0.3 },
							{ x: -0.3, y: 0.3, z: 0.3 },
							{ x: 0.3, y: 0.3, z: 0.3 },
						];

						for ( let castIndex = 0; castIndex < 4; castIndex += 1 )
						{
							const center = { x: -6 + 4 * castIndex + castOffset.x, y: 7 + castOffset.y, z: -5 + castOffset.z };
							drawCast(
								hullOffsets.map( ( point ) => offsetPoint( center, point ) ),
								0,
								translation,
								0x53d16a
							);
						}
					},

					buildUI( panel )
					{
						panel.add( "Offset Y", castOffset.y, { min: -3, max: 3, step: 0.1 }, ( value ) =>
						{
							castOffset.y = value;
						} );
						panel.add( "Offset Z", castOffset.z, { min: -3, max: 3, step: 0.1 }, ( value ) =>
						{
							castOffset.z = value;
						} );
						panel.addButton( ignoreInitialOverlap ? "Initial: Ignore" : "Initial: Report", () =>
						{
							ignoreInitialOverlap = ! ignoreInitialOverlap;
						} );
					},

					getStatusLines()
					{
						return [
							`cast offset: y=${castOffset.y.toFixed( 1)}, z=${castOffset.z.toFixed( 1 )}`,
							`initial overlap: ${ignoreInitialOverlap ? "ignored" : "reported"}`,
							"spheres, capsules, and box hulls sweep through four target columns",
						];
					},
				};
			},
		},
		{
			key: "collision-shape-distance",
			label: "Collision / Shape Distance",
			description:
				"A browser port of the native shape-distance sample. Two raw convex proxies are compared through the wasm distance API, with witness points and the separating normal drawn each frame.",
			create( ctx )
			{
				let typeA = "box";
				let typeB = "segment";
				let useRadii = false;
				let transformA = {
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0, w: 1 },
				};
				let transformB = {
					position: { x: 0.1, y: 1.1, z: 0 },
					rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.25 ),
				};

				function cycleType( current )
				{
					const types = [ "point", "segment", "triangle", "box" ];
					return types[( types.indexOf( current ) + 1 ) % types.length];
				}

				return {
					reset()
					{
						typeA = "box";
						typeB = "segment";
						useRadii = false;
						transformA = {
							position: { x: 0, y: 0, z: 0 },
							rotation: { x: 0, y: 0, z: 0, w: 1 },
						};
						transformB = {
							position: { x: 0.1, y: 1.1, z: 0 },
							rotation: axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 0.25 ),
						};
						ctx.setCameraLookAt( { x: 10, y: 7, z: 12 }, { x: 0, y: 0.75, z: 0 } );
					},

					update()
					{
						const pointsA = makeShapePoints( typeA );
						const pointsB = makeShapePoints( typeB );
						drawShape( ctx.physics, pointsA, transformA, 0x56c7d9 );
						drawShape( ctx.physics, pointsB, transformB, 0xe9c7a4 );

						const result = ctx.physics.shapeDistance( {
							pointsA,
							pointsB,
							radiusA: useRadii ? 0.05 : 0,
							radiusB: useRadii ? 0.05 : 0,
							transformA,
							transformB,
							useRadii,
						} );

						ctx.physics.addDebugLine( result.pointA, result.pointB, 0x8f98a0 );
						ctx.physics.addDebugPoint( result.pointA, 0x7ee07a );
						ctx.physics.addDebugPoint( result.pointB, 0x69b6ff );
						if ( result.distance > 0 )
						{
							ctx.physics.addDebugLine(
								result.pointA,
								{
									x: result.pointA.x + 0.5 * result.normal.x,
									y: result.pointA.y + 0.5 * result.normal.y,
									z: result.pointA.z + 0.5 * result.normal.z,
								},
								0xf2d66b
							);
						}
					},

					buildUI( panel )
					{
						panel.addButton( `Shape A: ${typeA}`, () => { typeA = cycleType( typeA ); } );
						panel.addButton( `Shape B: ${typeB}`, () => { typeB = cycleType( typeB ); } );
						panel.addButton( useRadii ? "Radii: On" : "Radii: Off", () => { useRadii = ! useRadii; } );
						panel.add( "B X", transformB.position.x, { min: -2, max: 2, step: 0.05 }, ( value ) => { transformB.position.x = value; } );
						panel.add( "B Y", transformB.position.y, { min: -1, max: 3, step: 0.05 }, ( value ) => { transformB.position.y = value; } );
						panel.add( "B Z", transformB.position.z, { min: -2, max: 2, step: 0.05 }, ( value ) => { transformB.position.z = value; } );
					},

					getStatusLines()
					{
						const result = ctx.physics.shapeDistance( {
							pointsA: makeShapePoints( typeA ),
							pointsB: makeShapePoints( typeB ),
							radiusA: useRadii ? 0.05 : 0,
							radiusB: useRadii ? 0.05 : 0,
							transformA,
							transformB,
							useRadii,
						} );
						return [
							`distance: ${result.distance.toFixed( 4 )}`,
							`iterations: ${result.iterations}, simplex count: ${result.simplexCount}`,
							`${typeA} vs ${typeB}`,
						];
					},
				};
			},
		},
		{
			key: "collision-distance-debug",
			label: "Collision / Distance Debug",
			description:
				"A browser port of the native distance-debug regression. It keeps the same near-touching box setup and runs the raw distance query so we can quickly spot drift or witness-point regressions.",
			create( ctx )
			{
				const boxA = [
					{ x: 40, y: 1, z: 40 }, { x: -40, y: 1, z: 40 }, { x: -40, y: -1, z: 40 }, { x: 40, y: -1, z: 40 },
					{ x: 40, y: 1, z: -40 }, { x: -40, y: 1, z: -40 }, { x: -40, y: -1, z: -40 }, { x: 40, y: -1, z: -40 },
				];
				const boxB = [
					{ x: 0.5, y: 0, z: 0.5 }, { x: -0.5, y: 0, z: 0.5 }, { x: -0.5, y: 20, z: 0.5 }, { x: 0.5, y: 20, z: 0.5 },
					{ x: 0.5, y: 0, z: -0.5 }, { x: -0.5, y: 0, z: -0.5 }, { x: -0.5, y: 20, z: -0.5 }, { x: 0.5, y: 20, z: -0.5 },
				];
				const transformA = {
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0, w: 1 },
				};
				const transformB = {
					position: { x: -0.00000164657831, y: 1.00989532471, z: 0 },
					rotation: { x: 0, y: 0, z: 0.004947796, w: 0.999987781 },
				};

				return {
					reset()
					{
						ctx.setCameraLookAt( { x: 14, y: 10, z: 16 }, { x: 0, y: 3, z: 0 } );
					},

					update()
					{
						drawShape( ctx.physics, boxA, transformA, 0x56c7d9 );
						drawShape( ctx.physics, boxB, transformB, 0xe9c7a4 );
						const result = ctx.physics.shapeDistance( {
							pointsA: boxA,
							pointsB: boxB,
							transformA,
							transformB,
							useRadii: false,
						} );
						ctx.physics.addDebugLine( result.pointA, result.pointB, 0xffffff );
						ctx.physics.addDebugPoint( result.pointA, 0x7ee07a );
						ctx.physics.addDebugPoint( result.pointB, 0x69b6ff );
					},

					getStatusLines()
					{
						const result = ctx.physics.shapeDistance( {
							pointsA: boxA,
							pointsB: boxB,
							transformA,
							transformB,
							useRadii: false,
						} );
						return [
							`distance: ${result.distance.toFixed( 6 )}`,
							`iterations: ${result.iterations}`,
							"native near-touch box-vs-box regression case",
						];
					},
				};
			},
		},
		{
			key: "collision-time-of-impact",
			label: "Collision / Time of Impact",
			description:
				"A browser port of the native TOI sample. The wasm binding computes the impact fraction for a swept capsule against a triangle and we draw start, end, and hit poses.",
			create( ctx )
			{
				const triangle = [
					{ x: -4, y: 0, z: -4 },
					{ x: -4, y: 0, z: -8 },
					{ x: -8, y: 0, z: -8 },
				];
				const capsule = [
					{ x: 0, y: -0.2, z: 0 },
					{ x: 0, y: 0.2, z: 0 },
				];
				const sweepA = {
					localCenter: { x: 0, y: 0, z: 0 },
					c1: { x: 0, y: 0, z: 0 },
					c2: { x: 0, y: 0, z: 0 },
					q1: { x: 0, y: 0, z: 0, w: 1 },
					q2: { x: 0, y: 0, z: 0, w: 1 },
				};
				const sweepB = {
					localCenter: { x: 0, y: 0, z: 0 },
					c1: { x: -4.0651207, y: 0.101333618, z: -7.87591267 },
					c2: { x: -4.15895557, y: 0.0356027633, z: -7.69682646 },
					q1: { x: -0.860495985, y: -0.272824734, z: 0.0724888667, w: 0.424097389 },
					q2: { x: -0.604184389, y: -0.424355596, z: 0.0457959622, w: 0.672894001 },
				};

				function getTransformAt( sweep, fraction )
				{
					return {
						position: lerpVec3( sweep.c1, sweep.c2, fraction ),
						rotation: normalizeQuaternion( slerpQuaternion( sweep.q1, sweep.q2, fraction ) ),
					};
				}

				return {
					reset()
					{
						ctx.setCameraLookAt( { x: -14, y: 6, z: 2 }, { x: -5, y: 0, z: -6 } );
					},

					update()
					{
						drawTriangle( ctx.physics, triangle, 0x56c7d9 );

						const startTransform = getTransformAt( sweepB, 0 );
						const endTransform = getTransformAt( sweepB, 1 );
						drawShape( ctx.physics, capsule, startTransform, 0x7ee07a );
						drawShape( ctx.physics, capsule, endTransform, 0xd08d83 );

						const result = ctx.physics.timeOfImpact( {
							pointsA: triangle,
							radiusA: 0,
							sweepA,
							pointsB: capsule,
							radiusB: 0.02,
							sweepB,
							maxFraction: 1,
						} );

						if ( result.fraction < 1 )
						{
							const hitTransform = getTransformAt( sweepB, result.fraction );
							drawShape( ctx.physics, capsule, hitTransform, 0x80d5e8 );
						}

						if ( result.state === 1 || result.state === 3 )
						{
							ctx.physics.addDebugPoint( result.point, 0xf2d66b );
							ctx.physics.addDebugLine(
								result.point,
								{
									x: result.point.x + 0.5 * result.normal.x,
									y: result.point.y + 0.5 * result.normal.y,
									z: result.point.z + 0.5 * result.normal.z,
								},
								0xf2d66b
							);
						}
					},

					getStatusLines()
					{
						const result = ctx.physics.timeOfImpact( {
							pointsA: triangle,
							radiusA: 0,
							sweepA,
							pointsB: capsule,
							radiusB: 0.02,
							sweepB,
							maxFraction: 1,
						} );
						const states = [ "unknown", "failed", "overlapped", "hit", "separated" ];
						return [
							`state: ${states[result.state] ?? result.state}, fraction: ${result.fraction.toFixed( 5 )}`,
							`distance iterations: ${result.distanceIterations}, push-back: ${result.pushBackIterations}, root: ${result.rootIterations}`,
							"triangle vs swept capsule",
						];
					},
				};
			},
		},
		{
			key: "collision-shape-cast-debug",
			label: "Collision / Shape Cast Debug",
			description:
				"A browser port of the native shape-cast-debug regression. A swept capsule is cast against a single thin triangle mesh using the same tiny scaled inputs, which makes it a useful precision check for the raw world shape-cast bridge.",
			sceneOptions: {
				showGround: false,
				showGrid: false,
			},
			create( ctx )
			{
				const scale = 0.01;
				const triangle = [
					{ x: 0, y: 0, z: 0 },
					{ x: 0, y: -64, z: 0 },
					{ x: 64, y: 0, z: 0.22609375 },
				];
				const capsuleLocal = {
					center1: { x: 436.162109375, y: -1002.13, z: 1326.318125 },
					center2: { x: 3422.3196875, y: 3597.116875, z: 1326.318125 },
					radius: scale,
				};
				const startPosition = { x: -1152, y: -192, z: -2027.55 };
				const translation = { x: 0.00008614914, y: 0, z: 722.671171875 };
				let triangleBodyHandle = 0;

				function toWorld(point, position)
				{
					return {
						x: position.x + point.x,
						y: position.y + point.y,
						z: position.z + point.z,
					};
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const mesh = ctx.physics.createCustomMesh( {
							vertices: triangle,
							indices: [ 0, 1, 2 ],
						} );
						triangleBodyHandle = ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							mesh,
							color: 0x56c7d9,
						} );
						ctx.setCameraLookAt( { x: 8, y: -4, z: 18 }, { x: 0, y: -20, z: 6 } );
					},

					update()
					{
						const startCenter1 = toWorld( capsuleLocal.center1, startPosition );
						const startCenter2 = toWorld( capsuleLocal.center2, startPosition );
						const endCenter1 = offsetPoint( startCenter1, translation );
						const endCenter2 = offsetPoint( startCenter2, translation );

						drawTriangle( ctx.physics, triangle, 0x56c7d9 );
						drawCapsule( ctx.physics, startCenter1, startCenter2, capsuleLocal.radius, 0x53d16a );
						drawCapsule( ctx.physics, endCenter1, endCenter2, capsuleLocal.radius, 0x808890 );

						const result = ctx.physics.worldCastShapeClosest( {
							points: [ startCenter1, startCenter2 ],
							radius: capsuleLocal.radius,
							translation,
							maxFraction: 0.970617533,
							ignoreInitialOverlap: true,
						} );

						if ( result.hit )
						{
							const hitOffset = {
								x: result.fraction * translation.x,
								y: result.fraction * translation.y,
								z: result.fraction * translation.z,
							};
							drawCapsule(
								ctx.physics,
								offsetPoint( startCenter1, hitOffset ),
								offsetPoint( startCenter2, hitOffset ),
								capsuleLocal.radius,
								0xff7151
							);
							ctx.physics.addDebugPoint( result.point, 0xf2d66b );
							ctx.physics.addDebugLine( result.point, offsetPoint( result.point, {
								x: 0.5 * result.normal.x,
								y: 0.5 * result.normal.y,
								z: 0.5 * result.normal.z,
							} ), 0xf2d66b );
						}
					},

					getStatusLines()
					{
						const result = ctx.physics.worldCastShapeClosest( {
							points: [
								toWorld( capsuleLocal.center1, startPosition ),
								toWorld( capsuleLocal.center2, startPosition ),
							],
							radius: capsuleLocal.radius,
							translation,
							maxFraction: 0.970617533,
							ignoreInitialOverlap: true,
						} );
						return [
							`triangle body: ${triangleBodyHandle}`,
							`hit: ${result.hit ? "yes" : "no"}, fraction: ${result.fraction.toFixed( 6 )}`,
							"expected: green start, gray full sweep, red resolved hit pose",
						];
					},
				};
			},
		},
		{
			key: "collision-long-ray-cast",
			label: "Collision / Long Ray Cast",
			description:
				"A browser port of the native far-origin ray-cast stress test. Very long rays precess over a row of shapes so we can spot precision drift and missed hits in the browser build.",
			create( ctx )
			{
				const targets = [];
				const failRates = [];
				let phase = 0;
				let rayLengthKilometers = 1;
				let coneAngle = 5;

				function castAlong( aim, coneDir, distance, reach )
				{
					const origin = {
						x: aim.x + distance * coneDir.x,
						y: aim.y + distance * coneDir.y,
						z: aim.z + distance * coneDir.z,
					};
					const translation = {
						x: -( distance + reach ) * coneDir.x,
						y: -( distance + reach ) * coneDir.y,
						z: -( distance + reach ) * coneDir.z,
					};
					const result = ctx.physics.worldCastRayClosest( { origin, translation } );
					return {
						hit: result.hit,
						point: result.point,
						normal: result.normal,
					};
				}

				return {
					reset()
					{
						targets.length = 0;
						failRates.length = 0;
						phase = 0;
						rayLengthKilometers = 1;
						coneAngle = 5;

						const mesh = ctx.physics.createWaveMesh( {
							xCount: 8,
							zCount: 8,
							cellWidth: 0.5,
							amplitude: 0.25,
							rowFrequency: 0.2,
							columnFrequency: 0.2,
						} );

						for ( let index = 0; index < 5; index += 1 )
						{
							const x = ( index - 2 ) * 5;
							targets.push( { x, y: 2.5, z: 0 } );
							failRates.push( 0 );
						}

						ctx.physics.createSphereBody( {
							type: BodyType.static,
							position: { x: targets[0].x, y: 1, z: 0 },
							radius: 1,
							color: 0xca8359,
						} );
						ctx.physics.createCapsuleBody( {
							type: BodyType.static,
							position: { x: targets[1].x, y: 1, z: 0 },
							capsule: { center1: { x: -1, y: 0, z: 0 }, center2: { x: 1, y: 0, z: 0 }, radius: 0.7 },
							color: 0xb37656,
						} );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: targets[2].x, y: 1, z: 0 },
							size: { hx: 1, hy: 1, hz: 1 },
							color: 0x9c6a49,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: targets[3].x, y: 0, z: 0 },
							mesh,
							color: 0x7f8d96,
						} );
						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: targets[4].x, y: 0.75, z: 0 },
							size: { hx: 1.5, hy: 0.75, hz: 1.5 },
							color: 0x707a83,
						} );

						ctx.setCameraLookAt( { x: -22, y: 14, z: 24 }, { x: 0, y: 1, z: 0 } );
					},

					update()
					{
						phase += ( 2 * Math.PI ) / 180;
						const halfAngle = coneAngle * DEG_TO_RAD;
						const tilted = rotateVec3( axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, halfAngle ), { x: 0, y: 1, z: 0 } );
						const coneDir = rotateVec3( axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, phase ), tilted );
						const farDistance = 1000 * rayLengthKilometers;

						for ( let index = 0; index < targets.length; index += 1 )
						{
							const truth = castAlong( targets[index], coneDir, 50, 5 );
							const cast = castAlong( targets[index], coneDir, farDistance, 5 );
							let fail = 0;

							if ( cast.hit )
							{
								const error = truth.hit
									? Math.hypot(
										cast.point.x - truth.point.x,
										cast.point.y - truth.point.y,
										cast.point.z - truth.point.z
									)
									: 0;
								const color = error < 0.05 ? 0x7ee07a : 0xf2d66b;
								ctx.physics.addDebugPoint( cast.point, color );
								ctx.physics.addDebugLine(
									cast.point,
									{
										x: cast.point.x + 1.5 * cast.normal.x,
										y: cast.point.y + 1.5 * cast.normal.y,
										z: cast.point.z + 1.5 * cast.normal.z,
									},
									0xffffff
								);
							}
							else if ( truth.hit )
							{
								fail = 1;
								ctx.physics.addDebugPoint( truth.point, 0xd05c44 );
							}

							failRates[index] = 0.95 * failRates[index] + 0.05 * fail;
						}
					},

					buildUI( panel )
					{
						panel.add( "Ray km", rayLengthKilometers, { min: 1, max: 1000, step: 1 }, ( value ) => { rayLengthKilometers = value; } );
						panel.add( "Cone Deg", coneAngle, { min: 0, max: 12, step: 0.1 }, ( value ) => { coneAngle = value; } );
					},

					getStatusLines()
					{
						return [
							`origin distance: ${rayLengthKilometers.toFixed( 0 )} km, cone angle: ${coneAngle.toFixed( 1 )} deg`,
							`failures: ${failRates.map( ( value ) => `${Math.round( 100 * value )}%` ).join( " / " )}`,
							"green = accurate, yellow = drift, red = far-origin miss",
						];
					},
				};
			},
		},
	];
}
