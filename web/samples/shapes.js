import { DEG_TO_RAD, axisAngleToQuaternion } from "./helpers.js";

export function createShapeSamples( { BodyType } )
{
	const WIND_MAX_COUNT = 60;

	function lerpVec3( a, b, t )
	{
		return {
			x: a.x + ( b.x - a.x ) * t,
			y: a.y + ( b.y - a.y ) * t,
			z: a.z + ( b.z - a.z ) * t,
		};
	}

	function randomRange( min, max )
	{
		return min + Math.random() * ( max - min );
	}

	function randomVec3( min, max )
	{
		return {
			x: randomRange( min.x, max.x ),
			y: randomRange( min.y, max.y ),
			z: randomRange( min.z, max.z ),
		};
	}

	return [
		{
			key: "inclined-plane",
			label: "Shapes / Inclined Plane",
			description:
				"A sloped platform with boxes of increasing friction. This is a very nice browser sample because the result is visually immediate and does not require any extra host-side UI.",
			create( ctx )
			{
				const boxCount = 5;
				let trackedBody = 0;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 7.5, z: -5 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 40 * DEG_TO_RAD ),
							size: { hx: 16, hy: 0.5, hz: 10 },
							friction: 1,
							color: 0x72818c,
						} );

						for ( let index = 0; index < boxCount; index += 1 )
						{
							trackedBody = ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: -10 + 5 * index, y: 15.75, z: -10.6 },
								size: { hx: 1, hy: 1, hz: 1 },
								friction: ( index + 1 ) * ( index + 1 ) * 0.04,
								color: 0xd98848,
							} );
						}

						ctx.setCameraLookAt( { x: -45, y: 30, z: 46 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						const transform = ctx.physics.getBodyTransform( trackedBody );
						return [
							`boxes: ${boxCount}`,
							`last box x: ${transform.position.x.toFixed( 2 )}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "rolling-resistance",
			label: "Shapes / Rolling Resistance",
			description:
				"A shallow ramp with spheres and capsules that vary their rolling resistance. This is a strong browser showcase for capsule support and shared instanced geometry.",
			create( ctx )
			{
				const count = 5;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 2, z: -20 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 10 * DEG_TO_RAD ),
							size: { hx: 32, hy: 0.5, hz: 15 },
							color: 0x72818c,
						} );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: -25 + 5 * index, y: 8, z: -24 },
								radius: 1,
								rollingResistance: 0.05 * index,
								color: 0xc97846,
							} );
						}

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: 2 + 5 * index, y: 8, z: -24 },
								capsule: {
									center1: { x: -1, y: 0, z: 0 },
									center2: { x: 1, y: 0, z: 0 },
									radius: 0.5,
								},
								rollingResistance: 0.05 * index,
								color: 0xb46c43,
							} );
						}

						ctx.setCameraLookAt( { x: -45, y: 17, z: 60 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`rolling resistance range: 0.00 - 0.20`,
							`spheres + capsules: ${count * 2}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "high-resistance",
			label: "Shapes / High Resistance",
			description:
				"A row of tilted capsules with increasing rolling resistance. This is a very natural browser sample because it showcases capsule support, material variation, and shared instanced rendering at the same time.",
			create( ctx )
			{
				const count = 10;
				const rotation = axisAngleToQuaternion( { x: 0, y: 0, z: 1 }, 30 * DEG_TO_RAD );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position: { x: -22 + 5 * index, y: 1.5, z: 0 },
								rotation,
								capsule: {
									center1: { x: 0, y: -1, z: 0 },
									center2: { x: 0, y: 1, z: 0 },
									radius: 0.5,
								},
								rollingResistance: 0.2 * index,
								color: 0xc97945,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 5, z: 40 }, { x: 0, y: 7.5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`capsules: ${count}`,
							`rolling resistance range: 0.00 - 1.80`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "slide-twist",
			label: "Shapes / Slide Twist",
			description:
				"A tilted platform with a spinning box, matching the native sample. It is a compact way to show coupled angular and sliding motion without adding any new engine features.",
			create( ctx )
			{
				const orientation = axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 20 * DEG_TO_RAD );
				const rotatedYAxis = {
					x: 0,
					y: Math.cos( 20 * DEG_TO_RAD ),
					z: Math.sin( 20 * DEG_TO_RAD ),
				};

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: 0, y: 4, z: 0 },
							rotation: orientation,
							size: { hx: 10, hy: 0.5, hz: 10 },
							friction: 0.6,
							color: 0x72818c,
						} );

						ctx.physics.createBoxBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 5, z: 0 },
							rotation: orientation,
							size: { hx: 1, hy: 0.5, hz: 1 },
							friction: 0.3,
							angularVelocity: {
								x: 25 * rotatedYAxis.x,
								y: 25 * rotatedYAxis.y,
								z: 25 * rotatedYAxis.z,
							},
							color: 0xd07a45,
						} );

						ctx.setCameraLookAt( { x: -14, y: 9, z: 24 }, { x: 0, y: 5, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`tilt: 20 deg`,
							`initial spin: 25 rad/s`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "restitution",
			label: "Shapes / Restitution",
			description:
				"A row of falling shapes with increasing restitution. This is a strong candidate for later browser controls, but even the default sphere version already demonstrates the material gradient clearly.",
			create( ctx )
			{
				const count = 20;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						let restitution = 0;
						for ( let i = 0; i < count; i += 1 )
						{
							ctx.physics.createSphereBody( {
								type: BodyType.dynamic,
								position: { x: -1 * ( count - 1 ) + 2 * i, y: 40, z: 0 },
								radius: 0.5,
								restitution,
								color: 0xc26d44,
							} );
							restitution += 1 / ( count - 1 );
						}

						ctx.setCameraLookAt( { x: 0, y: 25, z: 85 }, { x: 0, y: 20, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`shape: sphere`,
							`restitution range: 0.00 - 1.00`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "static-invoke",
			label: "Shapes / Static Invoke",
			description:
				"A dynamic sphere meets a static sphere whose contact creation mode can stay passive. This mirrors the native optimization demo in a fixed browser-friendly setup.",
			create( ctx )
			{
				let created = false;

				function createStaticBody()
				{
					ctx.physics.createSphereBody( {
						type: BodyType.static,
						position: { x: 0, y: 0.5, z: 0 },
						radius: 0.5,
						invokeContactCreation: false,
						color: 0x7b8791,
					} );
					created = true;
				}

				return {
					reset()
					{
						created = false;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createSphereBody( {
							type: BodyType.dynamic,
							position: { x: 0.25, y: 1, z: 0 },
							radius: 0.5,
							rollingResistance: 0.2,
							color: 0xc97846,
						} );

						createStaticBody();
						ctx.setCameraLookAt( { x: 0, y: 25, z: 10 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`static invokeContactCreation: passive`,
							`static created: ${created ? "yes" : "no"}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "conveyor-belt",
			label: "Shapes / Conveyor Belt",
			description:
				"A rotated platform with local tangent velocity that pushes falling boxes along it. This gives us parity for one of the most obviously game-relevant material behaviors in the native samples.",
			create( ctx )
			{
				const count = 5;
				const platformRotation = axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, 0.2 );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						ctx.physics.createBoxBody( {
							type: BodyType.static,
							position: { x: -5, y: 5, z: 0 },
							rotation: platformRotation,
							size: { hx: 10, hy: 0.25, hz: 2 },
							friction: 0.8,
							tangentVelocity: { x: 2, y: 0, z: 0 },
							color: 0x75828b,
						} );

						for ( let index = 0; index < count; index += 1 )
						{
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: -10 + 2 * index, y: 7, z: 0 },
								size: { hx: 0.5, hy: 0.5, hz: 0.5 },
								color: 0xcf824d,
							} );
						}

						ctx.setCameraLookAt( { x: 0, y: 25, z: 40 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`tangent velocity: (2, 0, 0)`,
							`boxes: ${count}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "conveyor-mesh",
			label: "Shapes / Conveyor Mesh",
			description:
				"A browser port of the native multi-material conveyor mesh sample. The underlying custom mesh carries per-triangle material indices, and each material region applies its own tangent velocity through the wasm bridge.",
			create( ctx )
			{
				const vertices = [
					{ x: 2.16861, y: 1.0, z: -8.647873 },
					{ x: 2.16861, y: -1.0, z: -8.647873 },
					{ x: 2.076996, y: 1.0, z: 7.657975 },
					{ x: 2.076996, y: -1.0, z: 7.657975 },
					{ x: -4.037379, y: 1.0, z: -13.20873 },
					{ x: -4.037379, y: -1.0, z: -13.20873 },
					{ x: -4.037379, y: 1.0, z: 13.20873 },
					{ x: -4.037379, y: -1.0, z: 13.20873 },
					{ x: 7.00648, y: -1.0, z: 16.726564 },
					{ x: 7.00648, y: 1.0, z: 16.726564 },
					{ x: 6.719464, y: 1.0, z: 9.863844 },
					{ x: 6.719464, y: -1.0, z: 9.863844 },
					{ x: 16.463598, y: -1.0, z: 12.302612 },
					{ x: 16.463598, y: 1.0, z: 12.302612 },
					{ x: 10.010764, y: 1.0, z: 7.959058 },
					{ x: 10.010764, y: -1.0, z: 7.959058 },
					{ x: 16.463598, y: -1.0, z: -11.446518 },
					{ x: 16.463598, y: 1.0, z: -11.446518 },
					{ x: 9.855768, y: 1.0, z: -7.927011 },
					{ x: 9.855768, y: -1.0, z: -7.927011 },
					{ x: 7.919923, y: -1.0, z: -16.801933 },
					{ x: 7.919923, y: 1.0, z: -16.801933 },
					{ x: 6.476316, y: 1.0, z: -9.52032 },
					{ x: 6.476316, y: -1.0, z: -9.52032 },
				];
				const indices = [
					4, 2, 0, 3, 8, 7, 6, 5, 7, 5, 3, 7, 0, 3, 1, 1, 20, 23,
					2, 9, 10, 2, 11, 3, 7, 9, 6, 8, 15, 12, 14, 17, 18, 10, 15, 11,
					9, 14, 10, 8, 13, 9, 19, 20, 16, 12, 17, 13, 15, 16, 12, 14, 19, 15,
					18, 23, 19, 18, 21, 22, 16, 21, 17, 0, 21, 4, 1, 22, 0, 4, 20, 5,
					4, 6, 2, 3, 11, 8, 6, 4, 5, 5, 1, 3, 0, 2, 3, 1, 5, 20,
					2, 6, 9, 2, 10, 11, 7, 8, 9, 8, 11, 15, 14, 13, 17, 10, 14, 15,
					9, 13, 14, 8, 12, 13, 19, 23, 20, 12, 16, 17, 15, 19, 16, 14, 18, 19,
					18, 22, 23, 18, 17, 21, 16, 20, 21, 0, 22, 21, 1, 23, 22, 4, 21, 20,
				];
				const materialIndices = new Array( indices.length / 3 ).fill( 0 );

				// The OBJ top surface is six quads arranged around the conveyor loop.
				// Assign materials to those source quads directly and let Box3D carry
				// the material IDs through its internal triangle sorting.
				materialIndices[0] = 3;
				materialIndices[24] = 3;

				materialIndices[6] = 2;
				materialIndices[30] = 2;

				materialIndices[12] = 1;
				materialIndices[36] = 1;

				materialIndices[10] = 6;
				materialIndices[34] = 6;

				materialIndices[19] = 5;
				materialIndices[43] = 5;

				materialIndices[21] = 4;
				materialIndices[45] = 4;

				const regionVelocities = [
					{ x: 0.0, y: 0.0, z: 0.0 },
					{ x: 0.7, y: 0.0, z: -0.2 },
					{ x: 0.6, y: 0.0, z: 0.4 },
					{ x: 0.0, y: 0.0, z: 1.3 },
					{ x: -0.6, y: 0.0, z: 0.4 },
					{ x: -0.75, y: 0.0, z: -0.4 },
					{ x: 0.0, y: 0.0, z: -1.3 },
				];
				const regionColors = [
					0x008000,
					0xadff2f,
					0xf0fff0,
					0xff69b4,
					0xcd5c5c,
					0x4b0082,
					0xfffff0,
				];
				let conveyorBodyHandle = 0;
				const cylinderHandles = [];

				return {
					reset()
					{
						conveyorBodyHandle = 0;
						cylinderHandles.length = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );

						const conveyorMesh = ctx.physics.createCustomMesh( {
							vertices,
							indices,
							materialIndices,
							useMedianSplit: true,
							identifyEdges: true,
							weldVertices: true,
							weldTolerance: 0.002,
						} );

						conveyorBodyHandle = ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0.5, z: 6 },
							rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, 0.5 * Math.PI ),
							mesh: conveyorMesh,
							materials: regionVelocities.map( ( velocity, index ) => ( {
								friction: 0.8,
								tangentVelocity: {
									x: 2 * velocity.x,
									y: 2 * velocity.y,
									z: 2 * velocity.z,
								},
								customColor: regionColors[index],
								userMaterialId: index,
							} ) ),
							color: 0x7a858d,
						} );

						for ( let index = 0; index < 20; index += 1 )
						{
							cylinderHandles.push( ctx.physics.createCylinderBody( {
								type: BodyType.dynamic,
								position: { x: -8.5 + 0.9 * index, y: 1.5, z: -5.5 },
								cylinder: { height: 0.3, radius: 0.15, yOffset: 0, sides: 32 },
								friction: 0.8,
								enableSleep: false,
								color: 0xd28048,
							} ) );
						}

						ctx.setCameraLookAt( { x: 25.3, y: 12.8, z: 11.8 }, { x: 0, y: 1, z: 0 } );
					},

					getStatusLines()
					{
						const materialCount = conveyorBodyHandle === 0 ? 0 : ctx.physics.getBodyFirstShapeMeshMaterialCount( conveyorBodyHandle );
						const materialOne = conveyorBodyHandle === 0 || materialCount < 2
							? null
							: ctx.physics.getBodyFirstShapeMeshMaterial( conveyorBodyHandle, 1 );
						const trackedVelocity = cylinderHandles.length === 0
							? null
							: ctx.physics.getBodyLinearVelocity( cylinderHandles[0] );
						return [
							`mesh materials: ${materialCount}`,
							materialOne == null
								? "material[1] tangent: unavailable"
								: `material[1] tangent: (${materialOne.tangentVelocity.x.toFixed( 2 )}, ${materialOne.tangentVelocity.y.toFixed( 2 )}, ${materialOne.tangentVelocity.z.toFixed( 2 )})`,
							"expected: cylinder groups should move in visibly different directions on different mesh patches",
							trackedVelocity == null
								? "tracked cylinder speed: n/a"
								: `tracked cylinder speed: ${Math.hypot( trackedVelocity.x, trackedVelocity.y, trackedVelocity.z ).toFixed( 2 )}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "wind",
			label: "Shapes / Wind",
			description:
				"A browser port of the native suspended wind chain. It keeps the same sphere, capsule, and box variants, with aerodynamic forces applied per frame through the wasm bridge.",
			create( ctx )
			{
				const shapeTypes = [ "sphere", "capsule", "box" ];
				let shapeType = "box";
				let wind = { x: 6, y: 0, z: 0 };
				let drag = 1;
				let lift = 0.75;
				let count = 10;
				let noise = { x: 0, y: 0, z: 0 };
				let chainGroundHandle = 0;
				const bodyHandles = [];

				function clearChain()
				{
					for ( const bodyHandle of bodyHandles )
					{
						ctx.physics.destroyBody( bodyHandle );
					}
					bodyHandles.length = 0;

					if ( chainGroundHandle !== 0 )
					{
						ctx.physics.destroyBody( chainGroundHandle );
						chainGroundHandle = 0;
					}
				}

				function buildChain()
				{
					clearChain();

					const radius = 0.1;
					const verticalOffset = 2;
					chainGroundHandle = ctx.physics.createBody( {
						type: BodyType.static,
						position: { x: 0, y: 0, z: 0 },
					} );

					let previousBodyHandle = chainGroundHandle;
					let previousAnchorPosition = { x: 0, y: verticalOffset, z: 0 };
					for ( let index = 0; index < count; index += 1 )
					{
						const bodyHandle = ctx.physics.createBody( {
							type: BodyType.dynamic,
							position: { x: ( 2 * index + 1 ) * radius, y: verticalOffset, z: 0 },
							gravityScale: 0.5,
							enableSleep: false,
						} );

						if ( shapeType === "sphere" )
						{
							ctx.physics.addSphereShape( bodyHandle, {
								center: { x: 0, y: 0, z: 0 },
								radius,
								density: 20,
								color: 0xd07b45,
							} );
						}
						else if ( shapeType === "capsule" )
						{
							ctx.physics.addCapsuleShape( bodyHandle, {
								capsule: {
									center1: { x: -radius, y: 0, z: 0 },
									center2: { x: radius, y: 0, z: 0 },
									radius: 0.5 * radius,
								},
								density: 20,
								color: 0xd07b45,
							} );
						}
						else
						{
							ctx.physics.addHullShape( bodyHandle, {
								points: [
									{ x: -1.25 * radius, y: -0.75 * radius, z: -0.125 * radius },
									{ x: 1.25 * radius, y: -0.75 * radius, z: -0.125 * radius },
									{ x: 1.25 * radius, y: 0.75 * radius, z: -0.125 * radius },
									{ x: -1.25 * radius, y: 0.75 * radius, z: -0.125 * radius },
									{ x: -1.25 * radius, y: -0.75 * radius, z: 0.125 * radius },
									{ x: 1.25 * radius, y: -0.75 * radius, z: 0.125 * radius },
									{ x: 1.25 * radius, y: 0.75 * radius, z: 0.125 * radius },
									{ x: -1.25 * radius, y: 0.75 * radius, z: 0.125 * radius },
								],
								density: 20,
								color: 0xd07b45,
							} );
						}

						ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
							bodyA: previousBodyHandle,
							bodyB: bodyHandle,
							localFrameA: { p: previousAnchorPosition, q: { x: 0, y: 0, z: 0, w: 1 } },
							localFrameB: { p: { x: -radius, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
						} );
						previousBodyHandle = bodyHandle;
						previousAnchorPosition = { x: radius, y: 0, z: 0 };
						bodyHandles.push( bodyHandle );
					}
				}

				return {
					reset()
					{
						noise = { x: 0, y: 0, z: 0 };
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 20, hy: 0.5, hz: 20 } } );
						buildChain();
						ctx.setCameraLookAt( { x: 5, y: 1, z: 5 }, { x: 0, y: 1, z: 0 } );
					},

					update()
					{
						const speed = Math.hypot( wind.x, wind.y, wind.z );
						const direction = speed > 0.0001
							? { x: wind.x / speed, y: wind.y / speed, z: wind.z / speed }
							: { x: 0, y: 0, z: 0 };
						const effectiveWind = {
							x: speed * ( direction.x + noise.x ),
							y: speed * ( direction.y + noise.y ),
							z: speed * ( direction.z + noise.z ),
						};

						for ( const bodyHandle of bodyHandles )
						{
							ctx.physics.applyBodyWind( bodyHandle, effectiveWind, drag, lift, 10, true );
						}

						noise = lerpVec3(
							noise,
							randomVec3( { x: -0.3, y: -0.3, z: -0.3 }, { x: 0.3, y: 0.3, z: 0.3 } ),
							0.05
						);

						ctx.physics.addDebugLine(
							{ x: 0, y: 0.5, z: 0 },
							{ x: 0.2 * effectiveWind.x, y: 0.5 + 0.2 * effectiveWind.y, z: 0.2 * effectiveWind.z },
							0xff00ff
						);
					},

					buildUI( panel )
					{
						panel.addButton( "Next Shape", () =>
						{
							shapeType = shapeTypes[( shapeTypes.indexOf( shapeType ) + 1 ) % shapeTypes.length];
							buildChain();
						} );
						panel.add( "Wind", wind.x, { min: -50, max: 50, step: 0.5 }, ( value ) =>
						{
							wind = { ...wind, x: value };
						} );
						panel.add( "Drag", drag, { min: 0, max: 1, step: 0.01 }, ( value ) =>
						{
							drag = value;
						} );
						panel.add( "Lift", lift, { min: 0, max: 4, step: 0.01 }, ( value ) =>
						{
							lift = value;
						} );
						panel.add( "Count", count, { min: 1, max: WIND_MAX_COUNT, step: 1 }, ( value ) =>
						{
							count = Math.round( value );
							buildChain();
						} );
					},

					getStatusLines()
					{
						return [
							`shape: ${shapeType}`,
							`wind.x: ${wind.x.toFixed( 1 )}`,
							`drag/lift: ${drag.toFixed( 2 )} / ${lift.toFixed( 2 )}`,
							`links: ${bodyHandles.length}`,
						];
					},

					dispose()
					{
						clearChain();
					},
				};
			},
		},
		{
			key: "wind-drop",
			label: "Shapes / Wind Drop",
			description:
				"A browser port of the native aerodynamic drop sample. A thin hull falls with low gravity while wind drag and lift produce the same broad gliding behavior as the C sample.",
			create( ctx )
			{
				let bodyHandle = 0;
				let drag = 1;
				let lift = 4;

				return {
					reset()
					{
						const radius = 0.1;
						bodyHandle = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 15, hy: 0.5, hz: 15 } } );
						bodyHandle = ctx.physics.createHullBody( {
							type: BodyType.dynamic,
							position: { x: 0, y: 10, z: 0 },
							rotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.25 ),
							gravityScale: 0.5,
							points: [
								{ x: -4 * radius, y: -0.1 * radius, z: -4 * radius },
								{ x: 4 * radius, y: -0.1 * radius, z: -4 * radius },
								{ x: 4 * radius, y: 0.1 * radius, z: -4 * radius },
								{ x: -4 * radius, y: 0.1 * radius, z: -4 * radius },
								{ x: -4 * radius, y: -0.1 * radius, z: 4 * radius },
								{ x: 4 * radius, y: -0.1 * radius, z: 4 * radius },
								{ x: 4 * radius, y: 0.1 * radius, z: 4 * radius },
								{ x: -4 * radius, y: 0.1 * radius, z: 4 * radius },
							],
							density: 2,
							color: 0xce7a46,
						} );
						ctx.setCameraLookAt( { x: -14.1, y: 6.2, z: 14.1 }, { x: 0, y: 5, z: 0 } );
					},

					update()
					{
						ctx.physics.applyBodyWind( bodyHandle, { x: 0, y: 0, z: 0 }, drag, lift, 10, true );
					},

					buildUI( panel )
					{
						panel.add( "Drag", drag, { min: 0, max: 1, step: 0.01 }, ( value ) =>
						{
							drag = value;
						} );
						panel.add( "Lift", lift, { min: 0, max: 4, step: 0.01 }, ( value ) =>
						{
							lift = value;
						} );
					},

					getStatusLines()
					{
						return [
							`drag/lift: ${drag.toFixed( 2 )} / ${lift.toFixed( 2 )}`,
							`gravity scale: 0.50`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "wind-flap",
			label: "Shapes / Wind Flap",
			description:
				"A browser port of the native flapping-wing assembly. Two spring-driven wings are hinged to a central torso while wind is applied to the wing bodies each frame.",
			create( ctx )
			{
				const a = 0.4;
				let drag = 1;
				let lift = 2;
				let time = 0;
				let wingBodyHandle1 = 0;
				let wingBodyHandle2 = 0;
				let jointHandle1 = 0;
				let jointHandle2 = 0;

				return {
					reset()
					{
						time = 0;
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 50, hy: 0.5, hz: 50 } } );

						const y = 20;
						wingBodyHandle1 = ctx.physics.createCompoundBody( {
							type: BodyType.dynamic,
							position: { x: -2 * a, y, z: 0 },
							boxes: [ {
								size: { hx: 2 * a, hy: 0.01, hz: a },
								localRotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.1 ),
								density: 5,
								color: 0xd07a45,
							} ],
						} );

						wingBodyHandle2 = ctx.physics.createCompoundBody( {
							type: BodyType.dynamic,
							position: { x: 2 * a, y, z: 0 },
							boxes: [ {
								size: { hx: 2 * a, hy: 0.01, hz: a },
								localRotation: axisAngleToQuaternion( { x: 1, y: 0, z: 0 }, 0.1 ),
								density: 5,
								color: 0xd07a45,
							} ],
						} );

						const torsoBodyHandle = ctx.physics.createCapsuleBody( {
							type: BodyType.dynamic,
							position: { x: 0, y, z: 0 },
							capsule: {
								center1: { x: 0, y: 0, z: -a },
								center2: { x: 0, y: 0, z: a },
								radius: 0.25 * a,
							},
							density: 10,
							color: 0x78848d,
						} );

						jointHandle1 = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: torsoBodyHandle,
							bodyB: wingBodyHandle1,
							localFrameA: { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
							localFrameB: { p: { x: 2 * a, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
							enableSpring: true,
							hertz: 6,
							dampingRatio: 0.5,
							enableLimit: true,
							lowerAngle: -30 * DEG_TO_RAD,
							upperAngle: 30 * DEG_TO_RAD,
						} );

						jointHandle2 = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
							bodyA: torsoBodyHandle,
							bodyB: wingBodyHandle2,
							localFrameA: { p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
							localFrameB: { p: { x: -2 * a, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
							enableSpring: true,
							hertz: 6,
							dampingRatio: 0.5,
							enableLimit: true,
							lowerAngle: -30 * DEG_TO_RAD,
							upperAngle: 30 * DEG_TO_RAD,
						} );

						ctx.box3d.api.createFilterJoint( ctx.physics.worldHandle, {
							bodyA: wingBodyHandle1,
							bodyB: wingBodyHandle2,
						} );

						ctx.setCameraLookAt( { x: -37.3, y: 16.8, z: 53.2 }, { x: 0, y: 5, z: 10 } );
					},

					update( dt )
					{
						ctx.physics.applyBodyWind( wingBodyHandle1, { x: 0, y: 0, z: 0 }, drag, lift, 10, false );
						ctx.physics.applyBodyWind( wingBodyHandle2, { x: 0, y: 0, z: 0 }, drag, lift, 10, false );
						const angle = Math.sin( 10 * time );
						ctx.box3d.api.setRevoluteJointTargetAngle( jointHandle1, angle );
						ctx.box3d.api.setRevoluteJointTargetAngle( jointHandle2, -angle );
						time += dt;
					},

					buildUI( panel )
					{
						panel.add( "Drag", drag, { min: 0, max: 1, step: 0.01 }, ( value ) =>
						{
							drag = value;
						} );
						panel.add( "Lift", lift, { min: 0, max: 4, step: 0.01 }, ( value ) =>
						{
							lift = value;
						} );
					},

					getStatusLines()
					{
						return [
							`drag/lift: ${drag.toFixed( 2 )} / ${lift.toFixed( 2 )}`,
							`wing target: ${Math.sin( 10 * time ).toFixed( 2 )} rad`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "isotropic-friction",
			label: "Shapes / Isotropic Friction",
			description:
				"A circular launch pattern of boxes with matched orientation and velocity. It is a compact, visually rich sample and a good showcase for the host's transform throughput.",
			create( ctx )
			{
				const boxCount = 32;

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( { position: { x: 0, y: -0.5, z: 0 }, size: { hx: 100, hy: 0.5, hz: 100 } } );

						for ( let index = 0; index < boxCount; index += 1 )
						{
							const alpha = ( Math.PI / 16 ) * index;
							const cosine = Math.cos( alpha );
							const sine = Math.sin( alpha );
							ctx.physics.createBoxBody( {
								type: BodyType.dynamic,
								position: { x: 15 * cosine, y: 1, z: 15 * sine },
								rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, -alpha ),
								size: { hx: 1, hy: 1, hz: 1 },
								friction: 0.6,
								linearVelocity: { x: 25 * cosine, y: 0, z: 25 * sine },
								color: 0xd08149,
							} );
						}

						ctx.setCameraLookAt( { x: 95, y: 30, z: 110 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						return [
							`boxes: ${boxCount}`,
							`shared instanced bucket: yes`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
	];
}
