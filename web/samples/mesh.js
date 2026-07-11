import { Human } from "./human.js";
import { axisAngleToQuaternion, loadObjMesh } from "./helpers.js";
import buildingObjUrl from "../../data/meshes/building.obj?url";
import collisionMesh01Url from "../../data/meshes/collision_mesh_01.obj?url";
import voxelMesh01Url from "../../data/meshes/voxel_mesh_01.obj?url";
import voxelMesh02Url from "../../data/meshes/voxel_mesh_02.obj?url";
import voxelMesh03Url from "../../data/meshes/voxel_mesh_03.obj?url";
import voxelMesh04Url from "../../data/meshes/voxel_mesh_04.obj?url";

export function createMeshSamples( { BodyType } )
{
	function createSpawner( ctx, state )
	{
		return function spawn()
		{
			if ( state.bodyHandle !== 0 )
			{
				ctx.physics.destroyBody( state.bodyHandle );
				state.bodyHandle = 0;
			}

			switch ( state.shapeType )
			{
				case "sphere":
					state.bodyHandle = ctx.physics.createSphereBody( {
						type: BodyType.dynamic,
						position: state.position(),
						radius: state.sphereRadius ?? 0.5,
						rollingResistance: state.rollingResistance ?? 0.05,
						angularDamping: state.angularDamping ?? 0,
						color: state.color ?? 0xd67c42,
					} );
					break;

				case "capsule":
					state.bodyHandle = ctx.physics.createCapsuleBody( {
						type: BodyType.dynamic,
						position: state.position(),
						capsule: state.capsule,
						rollingResistance: state.rollingResistance ?? 0.05,
						angularDamping: state.angularDamping ?? 0,
						color: state.color ?? 0xd67c42,
					} );
					break;

				case "box":
					state.bodyHandle = ctx.physics.createBoxBody( {
						type: BodyType.dynamic,
						position: state.position(),
						size: state.boxSize ?? { hx: 0.5, hy: 0.5, hz: 0.5 },
						angularDamping: state.angularDamping ?? 0,
						color: state.color ?? 0xd67c42,
					} );
					break;

				case "cylinder":
				default:
					state.bodyHandle = ctx.physics.createCylinderBody( {
						type: BodyType.dynamic,
						position: state.position(),
						cylinder: state.cylinder ?? { height: 1, radius: 0.25, yOffset: 0, sides: 15 },
						rollingResistance: state.rollingResistance ?? 0.02,
						angularDamping: state.angularDamping ?? 0.1,
						color: state.color ?? 0xd67c42,
					} );
					break;
			}
		};
	}

	function addShapeButtons( panel, state, spawn )
	{
		panel.addButton( "Sphere", () =>
		{
			state.shapeType = "sphere";
			spawn();
		} );
		panel.addButton( "Capsule", () =>
		{
			state.shapeType = "capsule";
			spawn();
		} );
		panel.addButton( "Box", () =>
		{
			state.shapeType = "box";
			spawn();
		} );
		panel.addButton( "Cylinder", () =>
		{
			state.shapeType = "cylinder";
			spawn();
		} );
	}

	return [
		{
			key: "mesh-reflection",
			label: "Mesh / Reflection",
			description:
				"A browser port of the native mesh-reflection scene. It loads the building OBJ twice, mirrors one copy with a signed scale, and drops a few dynamic primitives plus a ragdoll line so we can sanity-check reflected meshes and surface material plumbing.",
			create( ctx )
			{
				const humanCount = 10;
				const humans = Array.from( { length: humanCount }, () => new Human() );
				let loadToken = 0;
				let disposed = false;
				let loading = false;
				let ready = false;
				let loadError = null;
				let meshScale = { x: -1, y: 1, z: 1 };
				let meshHandle = null;

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

				function buildMaterialIndices( rawMaterialIndices )
				{
					return rawMaterialIndices.map( ( materialIndex ) => materialIndex % 3 );
				}

				function addDynamicProps()
				{
					ctx.physics.createSphereBody( {
						type: BodyType.dynamic,
						position: { x: 6, y: 15, z: 0 },
						radius: 0.5,
						rollingResistance: 0.2,
						userMaterialId: 42,
						color: 0xe2864a,
					} );

					ctx.physics.createCapsuleBody( {
						type: BodyType.dynamic,
						position: { x: 9, y: 15, z: 0 },
						capsule: {
							center1: { x: -0.5, y: 0.5, z: 0 },
							center2: { x: 0.5, y: 0, z: 0 },
							radius: 0.25,
						},
						rollingResistance: 0.2,
						userMaterialId: 11,
						color: 0x4d90d4,
					} );

					ctx.physics.createBoxBody( {
						type: BodyType.dynamic,
						position: { x: 12, y: 15, z: 0 },
						size: { hx: 0.25, hy: 0.5, hz: 0.75 },
						userMaterialId: 555,
						color: 0xc77e4d,
					} );
				}

				function addHumans()
				{
					for ( let index = 0; index < humanCount; index += 1 )
					{
						humans[index].spawn( ctx, {
							x: -14.0 + 1.5 * index,
							y: 8.0,
							z: 0.0,
						}, 5.0, 1.0, 0.7, index, false );
					}
				}

				function rebuildScene( objMesh )
				{
					destroyHumans();
					ctx.physics.resetWorld();
					ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

					const gridMesh = ctx.physics.createGridMesh( {
						xCount: 20,
						zCount: 20,
						cellWidth: 2.0,
						materialCount: 2,
						identifyEdges: true,
					} );
					ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: { x: 0, y: 0, z: 0 },
						mesh: gridMesh,
						color: 0x75838d,
					} );

					const materialIndices = buildMaterialIndices( objMesh.materialIndices );
					meshHandle = ctx.physics.createCustomMesh( {
						vertices: objMesh.vertices,
						indices: objMesh.indices,
						materialIndices,
						materialCount: 3,
						identifyEdges: true,
						weldVertices: true,
						weldTolerance: 0.002,
					} );

					const meshMaterials = [
						{ friction: 0.6, restitution: 0.0, userMaterialId: 0, customColor: 0x7a858d },
						{ friction: 0.0, restitution: 0.95, userMaterialId: 1, customColor: 0xa1c4ff },
						{ friction: 0.2, restitution: 0.2, userMaterialId: 2, customColor: 0xb6c08d },
					];

					ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: { x: -10, y: 0, z: 0 },
						mesh: meshHandle,
						materials: meshMaterials,
						color: 0x79868f,
					} );

					ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: { x: 10, y: 0, z: 0 },
						mesh: meshHandle,
						scale: meshScale,
						materials: meshMaterials,
						color: 0x8a979f,
					} );

					addDynamicProps();
					addHumans();
					ready = true;
					ctx.setCameraLookAt( { x: 24, y: 18, z: 30 }, { x: 0, y: 6, z: 0 } );
				}

				function ensureLoaded()
				{
					const token = ++loadToken;
					loading = true;
					ready = false;
					loadError = null;
					loadObjMesh( buildingObjUrl )
						.then( ( objMesh ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							rebuildScene( objMesh );
						} )
						.catch( ( error ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							loadError = error;
						} )
						.finally( () =>
						{
							if ( token === loadToken )
							{
								loading = false;
							}
						} );
				}

				function setAxisSign( axis, sign )
				{
					meshScale = { ...meshScale, [axis]: sign };
					ensureLoaded();
				}

				return {
					reset()
					{
						disposed = false;
						ensureLoaded();
					},

					buildUI( panel )
					{
						panel.addButton( "Neg X", () => setAxisSign( "x", -1 ) );
						panel.addButton( "Pos X", () => setAxisSign( "x", 1 ) );
						panel.addButton( "Neg Y", () => setAxisSign( "y", -1 ) );
						panel.addButton( "Pos Y", () => setAxisSign( "y", 1 ) );
						panel.addButton( "Neg Z", () => setAxisSign( "z", -1 ) );
						panel.addButton( "Pos Z", () => setAxisSign( "z", 1 ) );
					},

					getStatusLines()
					{
						return [
							loading ? "mesh: loading OBJ..." : ready ? "mesh: ready" : loadError == null ? "mesh: pending" : `mesh load failed: ${loadError.message}`,
							`scale: (${meshScale.x.toFixed( 0 )}, ${meshScale.y.toFixed( 0 )}, ${meshScale.z.toFixed( 0 )})`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},

					dispose()
					{
						disposed = true;
						loadToken += 1;
						destroyHumans();
					},
				};
			},
		},
		{
			key: "mesh-grid",
			label: "Mesh / Grid",
			description:
				"A browser port of the native grid-mesh scene. A dynamic test body is spawned on a scaled triangle grid so we can sanity-check mesh contact, rolling resistance, and dynamic respawn behavior.",
			create( ctx )
			{
				const state = {
					bodyHandle: 0,
					shapeType: "cylinder",
					position: () => ( { x: 0.1, y: 1.0, z: -0.1 } ),
					sphereRadius: 0.5,
					capsule: {
						center1: { x: 0, y: 0, z: 1.276 },
						center2: { x: 0, y: 0, z: 0.476 },
						radius: 0.15,
					},
					boxSize: { hx: 0.5, hy: 0.5, hz: 0.5 },
					cylinder: { height: 1.0, radius: 0.25, yOffset: 0, sides: 15 },
					rollingResistance: 0.02,
					angularDamping: 0.1,
				};
				const spawn = createSpawner( ctx, state );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const gridMesh = ctx.physics.createGridMesh( {
							xCount: 20,
							zCount: 20,
							cellWidth: 1,
							materialCount: 0,
							identifyEdges: true,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							mesh: gridMesh,
							scale: { x: 2, y: 2, z: 2 },
							color: 0x75838d,
						} );

						spawn();
						ctx.setCameraLookAt( { x: 6, y: 6, z: 10 }, { x: 0, y: 0.5, z: 0 } );
					},

					buildUI( panel )
					{
						addShapeButtons( panel, state, spawn );
					},

					getStatusLines()
					{
						return [
							`shape: ${state.shapeType}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "mesh-big-box",
			label: "Mesh / Big Box",
			description:
				"A browser port of the native big-box mesh scene. A large static box mesh acts as the floor while a configurable dynamic body tests contact and settling against mesh triangles.",
			create( ctx )
			{
				const state = {
					bodyHandle: 0,
					shapeType: "cylinder",
					position: () => ( { x: 0.5, y: 0.0, z: 0.0 } ),
					sphereRadius: 0.5,
					capsule: {
						center1: { x: 0, y: 0, z: 1.276 },
						center2: { x: 0, y: 0, z: 0.476 },
						radius: 0.15,
					},
					boxSize: { hx: 0.5, hy: 0.5, hz: 0.5 },
					cylinder: { height: 0.3, radius: 0.15, yOffset: 0, sides: 32 },
					rollingResistance: 0.05,
					angularDamping: 0,
				};
				const spawn = createSpawner( ctx, state );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						const boxMesh = ctx.physics.createBoxMesh( {
							center: { x: 0, y: -1, z: 0 },
							extent: { x: 50, y: 1, z: 50 },
							identifyEdges: true,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							mesh: boxMesh,
							color: 0x75838d,
						} );

						spawn();
						ctx.setCameraLookAt( { x: 6, y: 5, z: 12 }, { x: 0, y: 0, z: 0 } );
					},

					buildUI( panel )
					{
						addShapeButtons( panel, state, spawn );
					},

					getStatusLines()
					{
						return [
							`shape: ${state.shapeType}`,
							"expected: the active body should settle and roll on a mesh-backed floor",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "mesh-box",
			label: "Mesh / Box",
			description:
				"A browser port of the native box-mesh scene. A rotated static box mesh behaves like a solid obstacle while different dynamic primitive types are dropped onto it for contact sanity checks.",
			create( ctx )
			{
				const state = {
					bodyHandle: 0,
					shapeType: "box",
					position()
					{
						return this.shapeType === "cylinder"
							? { x: 0, y: 1.0, z: 0 }
							: { x: 0, y: 1.5, z: 0 };
					},
					sphereRadius: 0.5,
					capsule: {
						center1: { x: -0.5, y: 0, z: 0 },
						center2: { x: 0.5, y: 0, z: 0 },
						radius: 0.1,
					},
					boxSize: { hx: 0.5, hy: 0.5, hz: 0.5 },
					cylinder: { height: 1.0, radius: 0.75, yOffset: 0, sides: 8 },
					rollingResistance: 0.02,
					angularDamping: 0.05,
				};
				const spawn = createSpawner( ctx, state );

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						ctx.physics.createGroundBox( {
							position: { x: 0, y: -0.5, z: 0 },
							size: { hx: 20, hy: 0.5, hz: 20 },
							color: 0x6f7f89,
						} );

						const boxMesh = ctx.physics.createBoxMesh( {
							center: { x: 0, y: 1, z: 0 },
							extent: { x: 1, y: 1, z: 1 },
							identifyEdges: true,
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: -1, z: 0 },
							rotation: axisAngleToQuaternion( { x: 0, y: 1, z: 0 }, 0.25 * Math.PI ),
							mesh: boxMesh,
							color: 0x75838d,
						} );

						spawn();
						ctx.setCameraLookAt( { x: 7, y: 6, z: 10 }, { x: 0, y: 1, z: 0 } );
					},

					buildUI( panel )
					{
						addShapeButtons( panel, state, spawn );
					},

					getStatusLines()
					{
						return [
							`shape: ${state.shapeType}`,
							"expected: the spawned primitive should collide with the rotated mesh box rather than pass through it",
							`bodies: ${ctx.physics.getBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "mesh-height-field",
			label: "Mesh / Height Field",
			description:
				"A browser-oriented port of the native height-field scene. We rebuild a grid or wave mesh and probe it with either a ray or a swept sphere so the sample doubles as both a rendering check and a collision-query regression test.",
			create( ctx )
			{
				let rowCount = 10;
				let columnCount = 10;
				let amplitude = 0.75;
				let radius = 0.2;
				let rayOrigin = { x: 5.5, y: 4.0, z: 1.01 };
				let rayTranslation = { x: 0.0, y: -8.0, z: 0.0 };
				let lastHit = null;
				let lastMode = "shape";

				function getScale()
				{
					return { x: 2.0, y: 2.0 * amplitude, z: 2.0 };
				}

				function getHalfExtents()
				{
					const scale = getScale();
					return {
						x: 0.5 * scale.x * ( columnCount - 1 ),
						z: 0.5 * scale.z * ( rowCount - 1 ),
					};
				}

				function rebuildScene()
				{
					ctx.physics.resetWorld();
					ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

					const scale = getScale();
					const mesh = amplitude === 0
						? ctx.physics.createGridMesh( {
							xCount: columnCount - 1,
							zCount: rowCount - 1,
							cellWidth: scale.x,
							materialCount: 0,
							identifyEdges: true,
						} )
						: ctx.physics.createWaveMesh( {
							xCount: columnCount - 1,
							zCount: rowCount - 1,
							cellWidth: scale.x,
							amplitude: scale.y,
							rowFrequency: 0.1,
							columnFrequency: 0.03333,
						} );

					ctx.physics.createMeshBody( {
						type: BodyType.static,
						position: { x: 0, y: 0, z: 0 },
						mesh,
						color: 0x75838d,
					} );
				}

				function clampProbe()
				{
					const half = getHalfExtents();
					rayOrigin.x = Math.max( -2.0 * radius - half.x, Math.min( 2.0 * radius + half.x, rayOrigin.x ) );
					rayOrigin.z = Math.max( -2.0 * radius - half.z, Math.min( 2.0 * radius + half.z, rayOrigin.z ) );
					rayTranslation.x = Math.max( -2.0 * half.x, Math.min( 2.0 * half.x, rayTranslation.x ) );
					rayTranslation.z = Math.max( -2.0 * half.z, Math.min( 2.0 * half.z, rayTranslation.z ) );
				}

				return {
					reset()
					{
						rebuildScene();
						clampProbe();
						ctx.setCameraLookAt( { x: 18, y: 18, z: 26 }, { x: 0, y: 0, z: 0 } );
					},

					update()
					{
						lastHit = null;
						const end = {
							x: rayOrigin.x + rayTranslation.x,
							y: rayOrigin.y + rayTranslation.y,
							z: rayOrigin.z + rayTranslation.z,
						};
						ctx.physics.addDebugPoint( rayOrigin, 0x6ee36a );
						ctx.physics.addDebugPoint( end, 0xff5555 );
						ctx.physics.addDebugLine( rayOrigin, end, radius === 0 ? 0x909090 : 0xf1d04e );

						if ( radius === 0 )
						{
							lastMode = "ray";
							const result = ctx.physics.worldCastRayClosest( { origin: rayOrigin, translation: rayTranslation } );
							if ( result.hit )
							{
								lastHit = result;
								ctx.physics.addDebugPoint( result.point, 0xf39c32 );
								ctx.physics.addDebugLine( result.point, {
									x: result.point.x + 0.5 * result.normal.x,
									y: result.point.y + 0.5 * result.normal.y,
									z: result.point.z + 0.5 * result.normal.z,
								}, 0xf39c32 );
							}
						}
						else
						{
							lastMode = "shape";
							const result = ctx.physics.worldCastShapeClosest( {
								points: [ rayOrigin ],
								radius,
								translation: rayTranslation,
								maxFraction: 1,
							} );
							const center = result.hit
								? {
									x: rayOrigin.x + result.fraction * rayTranslation.x,
									y: rayOrigin.y + result.fraction * rayTranslation.y,
									z: rayOrigin.z + result.fraction * rayTranslation.z,
								}
								: end;
							ctx.physics.addDebugPoint( center, 0xf39c32 );
							if ( result.hit )
							{
								lastHit = result;
								ctx.physics.addDebugLine( result.point, {
									x: result.point.x + 0.5 * result.normal.x,
									y: result.point.y + 0.5 * result.normal.y,
									z: result.point.z + 0.5 * result.normal.z,
								}, 0x6ee36a );
							}
						}
					},

					buildUI( panel )
					{
						panel.add( "Columns", columnCount, { min: 2, max: 120, step: 1 }, ( value ) =>
						{
							columnCount = Math.round( value );
							rebuildScene();
							clampProbe();
						} );
						panel.add( "Rows", rowCount, { min: 2, max: 120, step: 1 }, ( value ) =>
						{
							rowCount = Math.round( value );
							rebuildScene();
							clampProbe();
						} );
						panel.add( "Amplitude", amplitude, { min: 0, max: 2, step: 0.05 }, ( value ) =>
						{
							amplitude = value;
							rebuildScene();
							clampProbe();
						} );
						panel.add( "Ray X", rayOrigin.x, { min: -100, max: 100, step: 0.1 }, ( value ) =>
						{
							rayOrigin.x = value;
							clampProbe();
						} );
						panel.add( "Ray Z", rayOrigin.z, { min: -100, max: 100, step: 0.1 }, ( value ) =>
						{
							rayOrigin.z = value;
							clampProbe();
						} );
						panel.add( "Delta X", rayTranslation.x, { min: -100, max: 100, step: 0.1 }, ( value ) =>
						{
							rayTranslation.x = value;
							clampProbe();
						} );
						panel.add( "Delta Z", rayTranslation.z, { min: -100, max: 100, step: 0.1 }, ( value ) =>
						{
							rayTranslation.z = value;
							clampProbe();
						} );
						panel.add( "Radius", radius, { min: 0, max: 1, step: 0.05 }, ( value ) =>
						{
							radius = value;
							clampProbe();
						} );
					},

					getStatusLines()
					{
						return [
							`mode: ${lastMode}`,
							`grid: ${columnCount} x ${rowCount}`,
							`amplitude: ${amplitude.toFixed( 2 )}`,
							lastHit == null ? "hit: none" : `hit fraction: ${lastHit.fraction.toFixed( 3 )}`,
						];
					},
				};
			},
		},
		{
			key: "mesh-viewer",
			label: "Mesh / Viewer",
			description:
				"A browser port of the native mesh-viewer tool. It loads one of the voxel OBJ meshes with configurable build options so we can inspect ingestion behavior and basic scene rendering for those assets.",
			create( ctx )
			{
				const meshUrls = [ voxelMesh01Url, voxelMesh02Url, voxelMesh03Url, voxelMesh04Url ];
				let meshIndex = 0;
				let identifyEdges = true;
				let weldVertices = true;
				let useMedianSplit = true;
				let loading = false;
				let loadError = null;
				let triangleCount = 0;
				let vertexCount = 0;
				let buildMilliseconds = 0;
				let loadToken = 0;
				let disposed = false;

				function rebuild()
				{
					const token = ++loadToken;
					loading = true;
					loadError = null;
					loadObjMesh( meshUrls[meshIndex] )
						.then( ( mesh ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							const vertices = mesh.vertices.map( ( vertex ) => ( {
								x: 0.01 * vertex.x,
								y: 0.01 * vertex.y,
								z: 0.01 * vertex.z,
							} ) );
							const start = performance.now();
							rebuildGeometryScene( ctx, () =>
							{
								const customMesh = ctx.physics.createCustomMesh( {
									vertices,
									indices: mesh.indices,
									materialIndices: mesh.materialIndices,
									useMedianSplit,
									identifyEdges,
									weldVertices,
									weldTolerance: 0.0015,
								} );
								ctx.physics.createMeshBody( {
									type: BodyType.static,
									position: { x: 0, y: 0, z: 0 },
									mesh: customMesh,
									color: 0x7f8b93,
								} );
							} );
							buildMilliseconds = performance.now() - start;
							triangleCount = Math.floor( mesh.indices.length / 3 );
							vertexCount = vertices.length;
						} )
						.catch( ( error ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							loadError = error;
						} )
						.finally( () =>
						{
							if ( token === loadToken )
							{
								loading = false;
							}
						} );
				}

				return {
					reset()
					{
						disposed = false;
						rebuild();
						ctx.setCameraLookAt( { x: 24, y: 18, z: 30 }, { x: 0, y: 6, z: 0 } );
					},
					buildUI( panel )
					{
						panel.add( "Index", meshIndex, { min: 0, max: meshUrls.length - 1, step: 1 }, ( value ) =>
						{
							meshIndex = Math.round( value );
							rebuild();
						} );
						panel.addButton( identifyEdges ? "Edges: On" : "Edges: Off", () =>
						{
							identifyEdges = !identifyEdges;
							rebuild();
						} );
						panel.addButton( weldVertices ? "Weld: On" : "Weld: Off", () =>
						{
							weldVertices = !weldVertices;
							rebuild();
						} );
						panel.addButton( useMedianSplit ? "Median Split" : "SAH Binning", () =>
						{
							useMedianSplit = !useMedianSplit;
							rebuild();
						} );
					},
					getStatusLines()
					{
						return [
							loading ? "mesh: loading..." : loadError == null ? "mesh: ready" : `mesh load failed: ${loadError.message}`,
							`mesh index: ${meshIndex}`,
							triangleCount === 0 ? "triangle count: pending" : `triangle count: ${triangleCount}`,
							vertexCount === 0 ? "vertex count: pending" : `vertex count: ${vertexCount}`,
							`build time: ${buildMilliseconds.toFixed( 3 )} ms`,
						];
					},
					dispose()
					{
						disposed = true;
						loadToken += 1;
					},
				};
			},
		},
		{
			key: "mesh-creation-benchmark",
			label: "Mesh / Creation Benchmark",
			description:
				"A browser port of the native mesh-creation benchmark. It repeatedly builds and destroys several voxel OBJ meshes through the raw wasm API so we can regression-test custom mesh ingestion cost.",
			create( ctx )
			{
				const meshUrls = [ voxelMesh01Url, voxelMesh02Url, voxelMesh03Url, voxelMesh04Url ];
				let loading = false;
				let ready = false;
				let loadError = null;
				let loadedMeshes = [];
				let bestMilliseconds = Number.POSITIVE_INFINITY;
				let triangleCount = 0;

				async function ensureMeshes()
				{
					if ( ready || loading )
					{
						return;
					}

					loading = true;
					loadError = null;
					try
					{
						const meshes = await Promise.all( meshUrls.map( ( url ) => loadObjMesh( url ) ) );
						loadedMeshes = meshes.map( ( mesh ) => ( {
							vertices: mesh.vertices.map( ( vertex ) => ( {
								x: 0.01 * vertex.x,
								y: 0.01 * vertex.y,
								z: 0.01 * vertex.z,
							} ) ),
							indices: mesh.indices,
							materialIndices: mesh.materialIndices,
						} ) );
						triangleCount = loadedMeshes.reduce( ( sum, mesh ) => sum + Math.floor( mesh.indices.length / 3 ), 0 );
						ready = true;
					}
					catch ( error )
					{
						loadError = error;
					}
					finally
					{
						loading = false;
					}
				}

				function runBenchmark()
				{
					if ( ready !== true )
					{
						return;
					}

					const iterations = 10;
					for ( let iteration = 0; iteration < iterations; iteration += 1 )
					{
						const handles = [];
						const start = performance.now();

						for ( const mesh of loadedMeshes )
						{
							handles.push( ctx.physics.box3d.api.createMesh( {
								vertices: mesh.vertices,
								indices: mesh.indices,
								materialIndices: mesh.materialIndices,
								useMedianSplit: true,
								identifyEdges: false,
								weldVertices: true,
								weldTolerance: 0.0015,
							} ) );
						}

						const elapsed = performance.now() - start;
						bestMilliseconds = Math.min( bestMilliseconds, elapsed );

						for ( const handle of handles )
						{
							ctx.physics.box3d.api.destroyMesh( handle );
						}
					}
				}

				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );
						bestMilliseconds = Number.POSITIVE_INFINITY;
						triangleCount = 0;
						ready = false;
						loadError = null;
						loadedMeshes = [];
						ctx.setCameraLookAt( { x: 18, y: 12, z: 24 }, { x: 0, y: 0, z: 0 } );
						ensureMeshes().then( () =>
						{
							runBenchmark();
						} );
					},

					buildUI( panel )
					{
						panel.addButton( "Run Benchmark", async () =>
						{
							await ensureMeshes();
							runBenchmark();
						} );
					},

					getStatusLines()
					{
						return [
							loading ? "meshes: loading OBJ set..." : ready ? "meshes: ready" : loadError == null ? "meshes: pending" : `mesh load failed: ${loadError.message}`,
							triangleCount === 0 ? "triangle count: pending" : `triangle count: ${triangleCount}`,
							Number.isFinite( bestMilliseconds ) ? `best total time: ${bestMilliseconds.toFixed( 3 )} ms` : "best total time: pending",
							Number.isFinite( bestMilliseconds ) ? `best per mesh: ${( bestMilliseconds / meshUrls.length ).toFixed( 3 )} ms` : "best per mesh: pending",
						];
					},
				};
			},
		},
		{
			key: "mesh-hollow-box",
			label: "Mesh / Hollow Box",
			description:
				"A browser port of the native hollow-box mesh scene. Zero-gravity dynamic cylinders and capsules float inside a hollow triangle-mesh shell, making it a handy manifold and containment regression test.",
			create( ctx )
			{
				return {
					reset()
					{
						ctx.physics.setWorldOrigin( { x: 0, y: 0, z: 0 } );

						const hollowMesh = ctx.physics.createHollowBoxMesh( {
							center: { x: 0, y: 0, z: 0 },
							extent: { x: 10, y: 10, z: 10 },
						} );
						ctx.physics.createMeshBody( {
							type: BodyType.static,
							position: { x: 0, y: 0, z: 0 },
							mesh: hollowMesh,
							color: 0x75838d,
						} );

						const cylinderPositions = [
							{ x: 0.0, y: -10.2, z: 0.0 }, { x: 0.0, y: 9.2, z: 0.0 }, { x: -9.8, y: 0.0, z: 0.0 },
							{ x: 9.8, y: 0.0, z: 0.0 }, { x: 0.0, y: 0.0, z: -9.8 }, { x: 0.0, y: 0.0, z: 9.8 },
						];
						for ( const position of cylinderPositions )
						{
							ctx.physics.createCylinderBody( {
								type: BodyType.dynamic,
								position,
								cylinder: { height: 1.0, radius: 0.25, yOffset: 0, sides: 8 },
								density: 1,
								gravityScale: 0,
								enableSleep: false,
								color: 0xd98848,
							} );
						}

						const capsulePositions = [
							{ x: 0.0, y: -10.2, z: 2.0 }, { x: 0.0, y: 9.2, z: 2.0 },
							{ x: 0.0, y: -9.9, z: 4.0 }, { x: 0.0, y: 8.9, z: 4.0 },
							{ x: -9.8, y: 2.0, z: 0.0 }, { x: 9.8, y: 2.0, z: 0.0 },
							{ x: 0.0, y: 2.0, z: -9.8 }, { x: 0.0, y: 2.0, z: 9.8 },
						];
						for ( const position of capsulePositions )
						{
							ctx.physics.createCapsuleBody( {
								type: BodyType.dynamic,
								position,
								capsule: {
									center1: { x: 0, y: 0, z: 0 },
									center2: { x: 0, y: 1.0, z: 0 },
									radius: 0.25,
								},
								density: 1,
								gravityScale: 0,
								enableSleep: false,
								color: 0x4b8fd6,
							} );
						}

						ctx.setCameraLookAt( { x: 25, y: 15, z: 30 }, { x: 0, y: 0, z: 0 } );
					},

					getStatusLines()
					{
						const counters = ctx.physics.getWorldCounters();
						return [
							"expected: floating bodies should remain contained within the hollow mesh shell",
							`contacts: ${counters.contactCount}`,
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},
				};
			},
		},
		{
			key: "mesh-voxel",
			label: "Mesh / Voxel",
			description:
				"A browser port of the native voxel-mesh sample. It loads the dense voxel OBJ as triangle terrain, then drops a dynamic convex body onto it so we can sanity-check large-mesh contact stability.",
			create( ctx )
			{
				const origin = { x: 5000, y: 3500, z: -7000 };
				let loading = false;
				let ready = false;
				let loadError = null;
				let loadToken = 0;
				let disposed = false;

				function createProbeHull()
				{
					const rawPoints = [
						{ x: -3.13548756, y: 3.81141949, z: 237.289047 },
						{ x: -16.2333279, y: -23.4977913, z: 235.486603 },
						{ x: -13.8834839, y: 6.20244455, z: 23.7760544 },
						{ x: 14.0794125, y: 4.63170528, z: 24.9530792 },
						{ x: 3.98322797, y: -16.4192238, z: 236.704071 },
						{ x: -23.3520412, y: -3.26714420, z: 236.071594 },
						{ x: 13.4517860, y: -6.94963741, z: 24.4085312 },
						{ x: -5.24953651, y: 13.9316301, z: 24.5058060 },
						{ x: -4.65071201, y: -24.1484108, z: 235.974121 },
						{ x: -14.5111103, y: -5.37889385, z: 23.2315063 },
						{ x: 6.33307076, y: 13.2810068, z: 24.9935150 },
						{ x: 4.81784487, y: -14.6788225, z: 23.6787796 },
						{ x: -14.7180958, y: 4.46204281, z: 236.801331 },
						{ x: -23.9796677, y: -14.8484812, z: 235.527039 },
						{ x: 4.61085415, y: -4.83788204, z: 237.248611 },
						{ x: -6.76476669, y: -14.0281992, z: 23.1910706 },
					];

					const points = rawPoints.map( ( point ) => ( {
						x: 0.01 * point.y,
						y: 0.01 * point.z,
						z: 0.01 * point.x,
					} ) );
					const bounds = points.reduce(
						( result, point ) =>
						{
							result.min.x = Math.min( result.min.x, point.x );
							result.min.y = Math.min( result.min.y, point.y );
							result.min.z = Math.min( result.min.z, point.z );
							result.max.x = Math.max( result.max.x, point.x );
							result.max.y = Math.max( result.max.y, point.y );
							result.max.z = Math.max( result.max.z, point.z );
							return result;
						},
						{
							min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
							max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
						}
					);
					const center = {
						x: 0.5 * ( bounds.min.x + bounds.max.x ),
						y: 0.5 * ( bounds.min.y + bounds.max.y ),
						z: 0.5 * ( bounds.min.z + bounds.max.z ),
					};

					return {
						points: points.map( ( point ) => ( {
							x: point.x - center.x,
							y: point.y - center.y,
							z: point.z - center.z,
						} ) ),
						size: {
							x: bounds.max.x - bounds.min.x,
							y: bounds.max.y - bounds.min.y,
							z: bounds.max.z - bounds.min.z,
						},
					};
				}

				function ensureLoaded()
				{
					const token = ++loadToken;
					loading = true;
					ready = false;
					loadError = null;

					loadObjMesh( voxelMesh01Url )
						.then( ( objMesh ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							ctx.physics.resetWorld();
							ctx.physics.setWorldOrigin( origin );
							const vertices = objMesh.vertices.map( ( vertex ) => ( {
								x: 0.01 * vertex.y,
								y: 0.01 * vertex.z,
								z: 0.01 * vertex.x,
							} ) );
							const bounds = vertices.reduce(
								( result, vertex ) =>
								{
									result.min.x = Math.min( result.min.x, vertex.x );
									result.min.y = Math.min( result.min.y, vertex.y );
									result.min.z = Math.min( result.min.z, vertex.z );
									result.max.x = Math.max( result.max.x, vertex.x );
									result.max.y = Math.max( result.max.y, vertex.y );
									result.max.z = Math.max( result.max.z, vertex.z );
									return result;
								},
								{
									min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
									max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
								}
							);
							const center = {
								x: 0.5 * ( bounds.min.x + bounds.max.x ),
								y: 0.5 * ( bounds.min.y + bounds.max.y ),
								z: 0.5 * ( bounds.min.z + bounds.max.z ),
							};
							const probeHull = createProbeHull();

							const mesh = ctx.physics.createCustomMesh( {
								vertices,
								indices: objMesh.indices,
								materialIndices: objMesh.materialIndices,
								identifyEdges: true,
								weldVertices: true,
								weldTolerance: 0.002,
							} );

							ctx.physics.createMeshBody( {
								type: BodyType.static,
								position: origin,
								mesh,
								color: 0x75838d,
							} );

							ctx.physics.createHullBody( {
								type: BodyType.dynamic,
								position: {
									x: origin.x + center.x,
									y: origin.y + bounds.max.y + 0.5 * probeHull.size.y + 1.0,
									z: origin.z + center.z,
								},
								rotation: { x: 0.664546967, y: 0.669287264, z: 0.135021493, w: 0.303646326 },
								points: probeHull.points,
								rollingResistance: 0.1,
								color: 0xd98848,
							} );

							ready = true;
							ctx.setCameraLookAt(
								{ x: center.x - 26, y: center.y + 12, z: center.z + 18 },
								{ x: center.x, y: center.y, z: center.z }
							);
						} )
						.catch( ( error ) =>
						{
							if ( disposed || token !== loadToken )
							{
								return;
							}

							loadError = error;
						} )
						.finally( () =>
						{
							if ( token === loadToken )
							{
								loading = false;
							}
						} );
				}

				return {
					reset()
					{
						disposed = false;
						ensureLoaded();
					},

					getStatusLines()
					{
						return [
							loading ? "mesh: loading OBJ..." : ready ? "mesh: ready" : loadError == null ? "mesh: pending" : `mesh load failed: ${loadError.message}`,
							"expected: the dynamic hull should settle onto the dense voxel terrain",
							`awake bodies: ${ctx.physics.getWorldAwakeBodyCount()}`,
						];
					},

					dispose()
					{
						disposed = true;
						loadToken += 1;
					},
				};
			},
		},
	];
}
