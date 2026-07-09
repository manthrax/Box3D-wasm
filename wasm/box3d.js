import createRawModule from "./box3d-raw.js";

export const BodyType = Object.freeze( {
	static: 0,
	kinematic: 1,
	dynamic: 2,
} );

function createRawNamespace( module )
{
	return new Proxy( {}, {
		get( _target, property )
		{
			if ( typeof property !== "string" )
			{
				return undefined;
			}

			if ( property in module )
			{
				const value = module[property];
				return typeof value === "function" ? value.bind( module ) : value;
			}

			const exportedName = property.startsWith( "_" ) ? property : `_${property}`;
			const value = module[exportedName];
			return typeof value === "function" ? value.bind( module ) : value;
		},
	} );
}

function writeNumberArray( module, values, valueType )
{
	const byteSize = valueType === "double" ? 8 : 4;
	const ptr = module._malloc( values.length * byteSize );

	if ( valueType === "double" && module.HEAPF64 != null )
	{
		module.HEAPF64.set( values, ptr >> 3 );
		return ptr;
	}

	if ( valueType === "float" && module.HEAPF32 != null )
	{
		module.HEAPF32.set( values, ptr >> 2 );
		return ptr;
	}

	if ( valueType === "i32" && module.HEAP32 != null )
	{
		module.HEAP32.set( values, ptr >> 2 );
		return ptr;
	}

	for ( let i = 0; i < values.length; i += 1 )
	{
		module.setValue( ptr + i * byteSize, values[i], valueType );
	}
	return ptr;
}

function readNumberArray( module, ptr, count, valueType )
{
	if ( valueType === "double" && module.HEAPF64 != null )
	{
		return Array.from( module.HEAPF64.subarray( ptr >> 3, ( ptr >> 3 ) + count ) );
	}

	if ( valueType === "float" && module.HEAPF32 != null )
	{
		return Array.from( module.HEAPF32.subarray( ptr >> 2, ( ptr >> 2 ) + count ) );
	}

	if ( valueType === "i32" && module.HEAP32 != null )
	{
		return Array.from( module.HEAP32.subarray( ptr >> 2, ( ptr >> 2 ) + count ) );
	}

	const byteSize = valueType === "double" ? 8 : 4;
	const result = [];
	for ( let i = 0; i < count; i += 1 )
	{
		result.push( module.getValue( ptr + i * byteSize, valueType ) );
	}
	return result;
}

function withOptionalArray( module, values, valueType, callback )
{
	if ( values == null )
	{
		return callback( 0 );
	}

	const ptr = writeNumberArray( module, values, valueType );
	try
	{
		return callback( ptr );
	}
	finally
	{
		module._free( ptr );
	}
}

function configureBody( module, api, bodyHandle, options )
{
	if ( bodyHandle === 0 )
	{
		return bodyHandle;
	}

	if ( options.gravityScale != null )
	{
		api.setBodyGravityScale( bodyHandle, options.gravityScale );
	}

	if ( options.enableSleep != null )
	{
		api.enableBodySleep( bodyHandle, options.enableSleep );
	}

	if ( options.enabled === false )
	{
		api.disableBody( bodyHandle );
	}

	return bodyHandle;
}

function getShapeOptions( options )
{
	return {
		filter: options.filter ?? null,
		isSensor: options.isSensor ?? false,
		enableSensorEvents: options.enableSensorEvents ?? false,
		enableContactEvents: options.enableContactEvents ?? false,
		enableHitEvents: options.enableHitEvents ?? false,
		userMaterialId: options.userMaterialId ?? 0,
		tangentVelocity: options.tangentVelocity ?? null,
		invokeContactCreation: options.invokeContactCreation ?? true,
	};
}

function flattenVec3Array( values = [] )
{
	return values.flatMap( ( value ) => [ value.x ?? 0, value.y ?? 0, value.z ?? 0 ] );
}

function getMotionLockValues( motionLocks )
{
	if ( motionLocks == null )
	{
		return null;
	}

	return [
		motionLocks.linearX ? 1 : 0,
		motionLocks.linearY ? 1 : 0,
		motionLocks.linearZ ? 1 : 0,
		motionLocks.angularX ? 1 : 0,
		motionLocks.angularY ? 1 : 0,
		motionLocks.angularZ ? 1 : 0,
	];
}

function getFilterValues( filter )
{
	if ( filter == null )
	{
		return null;
	}

	return [
		filter.categoryBits ?? 1,
		filter.maskBits ?? -1,
		filter.groupIndex ?? 0,
	];
}

function createVanillaApi( module )
{
	const api = {
		isDoublePrecision()
		{
			return Boolean( module._b3IsDoublePrecision() );
		},

		createWorld( options = {} )
		{
			const gravity = options.gravity ?? { x: 0, y: -10, z: 0 };
			return module._box3d_js_create_world( gravity.x, gravity.y, gravity.z );
		},

		destroyWorld( worldHandle )
		{
			module._box3d_js_destroy_world( worldHandle );
		},

		stepWorld( worldHandle, timeStep = 1 / 60, subStepCount = 4 )
		{
			module._box3d_js_step_world( worldHandle, timeStep, subStepCount );
		},

		setWorldContactTuning( worldHandle, hertz, dampingRatio, contactSpeed )
		{
			module._box3d_js_set_world_contact_tuning( worldHandle, hertz, dampingRatio, contactSpeed );
		},

		getWorldAwakeBodyCount( worldHandle )
		{
			return module._box3d_js_get_world_awake_body_count( worldHandle );
		},

		getWorldCounters( worldHandle )
		{
			const ptr = module._malloc( 37 * 4 );
			try
			{
				module._box3d_js_get_world_counters( worldHandle, ptr );
				const values = readNumberArray( module, ptr, 37, "i32" );
				return {
					bodyCount: values[0],
					shapeCount: values[1],
					contactCount: values[2],
					jointCount: values[3],
					islandCount: values[4],
					stackUsed: values[5],
					arenaCapacity: values[6],
					staticTreeHeight: values[7],
					treeHeight: values[8],
					satCallCount: values[9],
					satCacheHitCount: values[10],
					byteCount: values[11],
					taskCount: values[12],
					colorCounts: values.slice( 13, 37 ),
				};
			}
			finally
			{
				module._free( ptr );
			}
		},

		createBody( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									module._box3d_js_create_body(
										worldHandle,
										type,
										position.x,
										position.y,
										position.z,
										rotationPtr,
										linearVelocityPtr,
										angularVelocityPtr,
										motionLocksPtr,
										isBullet
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createBox( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const size = options.size ?? { hx: 0.5, hy: 0.5, hz: 0.5 };
			const density = options.density ?? ( type === BodyType.dynamic ? 1 : 0 );
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );
			const filterValues = getFilterValues( shapeOptions.filter );

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
										withOptionalArray(
											module,
											shapeOptions.tangentVelocity == null
												? null
												: [
													shapeOptions.tangentVelocity.x ?? 0,
													shapeOptions.tangentVelocity.y ?? 0,
													shapeOptions.tangentVelocity.z ?? 0,
												],
											"float",
											( tangentVelocityPtr ) =>
												module._box3d_js_create_box(
													worldHandle,
													type,
													position.x,
													position.y,
													position.z,
													rotationPtr,
													linearVelocityPtr,
													angularVelocityPtr,
													motionLocksPtr,
													isBullet,
													size.hx,
													size.hy,
													size.hz,
													density,
													friction,
													restitution,
													rollingResistance,
													shapeOptions.userMaterialId,
													filterPtr,
													tangentVelocityPtr,
													shapeOptions.isSensor ? 1 : 0,
													shapeOptions.enableSensorEvents ? 1 : 0,
													shapeOptions.enableContactEvents ? 1 : 0,
													shapeOptions.enableHitEvents ? 1 : 0,
													shapeOptions.invokeContactCreation ? 1 : 0
												)
										)
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createSphere( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const radius = options.radius ?? 0.5;
			const density = options.density ?? ( type === BodyType.dynamic ? 1 : 0 );
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );
			const filterValues = getFilterValues( shapeOptions.filter );

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
										withOptionalArray(
											module,
											shapeOptions.tangentVelocity == null
												? null
												: [
													shapeOptions.tangentVelocity.x ?? 0,
													shapeOptions.tangentVelocity.y ?? 0,
													shapeOptions.tangentVelocity.z ?? 0,
												],
											"float",
											( tangentVelocityPtr ) =>
												module._box3d_js_create_sphere(
													worldHandle,
													type,
													position.x,
													position.y,
													position.z,
													rotationPtr,
													linearVelocityPtr,
													angularVelocityPtr,
													motionLocksPtr,
													isBullet,
													radius,
													density,
													friction,
													restitution,
													rollingResistance,
													shapeOptions.userMaterialId,
													filterPtr,
													tangentVelocityPtr,
													shapeOptions.isSensor ? 1 : 0,
													shapeOptions.enableSensorEvents ? 1 : 0,
													shapeOptions.enableContactEvents ? 1 : 0,
													shapeOptions.enableHitEvents ? 1 : 0,
													shapeOptions.invokeContactCreation ? 1 : 0
												)
										)
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createCapsule( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const capsule = options.capsule ?? {
				center1: { x: 0, y: -0.5, z: 0 },
				center2: { x: 0, y: 0.5, z: 0 },
				radius: 0.5,
			};
			const density = options.density ?? ( type === BodyType.dynamic ? 1 : 0 );
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );
			const filterValues = getFilterValues( shapeOptions.filter );
			const capsuleValues = [
				capsule.center1?.x ?? 0,
				capsule.center1?.y ?? -0.5,
				capsule.center1?.z ?? 0,
				capsule.center2?.x ?? 0,
				capsule.center2?.y ?? 0.5,
				capsule.center2?.z ?? 0,
				capsule.radius ?? 0.5,
			];

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									withOptionalArray( module, capsuleValues, "float", ( capsulePtr ) =>
										withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
											withOptionalArray(
												module,
												shapeOptions.tangentVelocity == null
													? null
													: [
														shapeOptions.tangentVelocity.x ?? 0,
														shapeOptions.tangentVelocity.y ?? 0,
														shapeOptions.tangentVelocity.z ?? 0,
													],
												"float",
												( tangentVelocityPtr ) =>
													module._box3d_js_create_capsule(
														worldHandle,
														type,
														position.x,
														position.y,
														position.z,
														rotationPtr,
														linearVelocityPtr,
														angularVelocityPtr,
														motionLocksPtr,
														isBullet,
														capsulePtr,
														density,
														friction,
														restitution,
														rollingResistance,
														shapeOptions.userMaterialId,
														filterPtr,
														tangentVelocityPtr,
														shapeOptions.isSensor ? 1 : 0,
														shapeOptions.enableSensorEvents ? 1 : 0,
														shapeOptions.enableContactEvents ? 1 : 0,
														shapeOptions.enableHitEvents ? 1 : 0,
														shapeOptions.invokeContactCreation ? 1 : 0
													)
											)
										)
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createCylinder( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const cylinder = options.cylinder ?? { height: 1, radius: 0.5, yOffset: 0, sides: 12 };
			const scale = options.scale ?? null;
			const density = options.density ?? ( type === BodyType.dynamic ? 1 : 0 );
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );
			const filterValues = getFilterValues( shapeOptions.filter );

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									withOptionalArray(
										module,
										scale == null ? null : [ scale.x ?? 1, scale.y ?? 1, scale.z ?? 1 ],
										"float",
										( scalePtr ) =>
											withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
												withOptionalArray(
													module,
													shapeOptions.tangentVelocity == null
														? null
														: [
															shapeOptions.tangentVelocity.x ?? 0,
															shapeOptions.tangentVelocity.y ?? 0,
															shapeOptions.tangentVelocity.z ?? 0,
														],
													"float",
													( tangentVelocityPtr ) =>
														module._box3d_js_create_cylinder(
															worldHandle,
															type,
															position.x,
															position.y,
															position.z,
															rotationPtr,
															linearVelocityPtr,
															angularVelocityPtr,
															motionLocksPtr,
															isBullet,
															cylinder.height ?? 1,
															cylinder.radius ?? 0.5,
															cylinder.yOffset ?? 0,
															cylinder.sides ?? 12,
															scalePtr,
															density,
															friction,
															restitution,
															rollingResistance,
															shapeOptions.userMaterialId,
															filterPtr,
															tangentVelocityPtr,
															shapeOptions.isSensor ? 1 : 0,
															shapeOptions.enableSensorEvents ? 1 : 0,
															shapeOptions.enableContactEvents ? 1 : 0,
															shapeOptions.enableHitEvents ? 1 : 0,
															shapeOptions.invokeContactCreation ? 1 : 0
														)
												)
											)
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createHull( worldHandle, options = {} )
		{
			const type = options.type ?? BodyType.dynamic;
			const position = options.position ?? { x: 0, y: 0, z: 0 };
			const rotation = options.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const linearVelocity = options.linearVelocity ?? null;
			const angularVelocity = options.angularVelocity ?? null;
			const motionLocks = options.motionLocks ?? null;
			const points = options.points ?? [];
			const maxVertexCount = options.maxVertexCount ?? points.length;
			const scale = options.scale ?? null;
			const density = options.density ?? ( type === BodyType.dynamic ? 1 : 0 );
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const isBullet = options.isBullet ? 1 : 0;
			const lockValues = getMotionLockValues( motionLocks );
			const filterValues = getFilterValues( shapeOptions.filter );
			const pointValues = flattenVec3Array( points );

			const bodyHandle = withOptionalArray( module, [ rotation.x, rotation.y, rotation.z, rotation.w ], "double", ( rotationPtr ) =>
				withOptionalArray(
					module,
					linearVelocity == null ? null : [ linearVelocity.x ?? 0, linearVelocity.y ?? 0, linearVelocity.z ?? 0 ],
					"float",
					( linearVelocityPtr ) =>
						withOptionalArray(
							module,
							angularVelocity == null ? null : [ angularVelocity.x ?? 0, angularVelocity.y ?? 0, angularVelocity.z ?? 0 ],
							"float",
							( angularVelocityPtr ) =>
								withOptionalArray( module, lockValues, "i32", ( motionLocksPtr ) =>
									withOptionalArray( module, pointValues, "float", ( pointsPtr ) =>
										withOptionalArray(
											module,
											scale == null ? null : [ scale.x ?? 1, scale.y ?? 1, scale.z ?? 1 ],
											"float",
											( scalePtr ) =>
												withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
													withOptionalArray(
														module,
														shapeOptions.tangentVelocity == null
															? null
															: [
																shapeOptions.tangentVelocity.x ?? 0,
																shapeOptions.tangentVelocity.y ?? 0,
																shapeOptions.tangentVelocity.z ?? 0,
															],
														"float",
														( tangentVelocityPtr ) =>
															module._box3d_js_create_hull(
																worldHandle,
																type,
																position.x,
																position.y,
																position.z,
																rotationPtr,
																linearVelocityPtr,
																angularVelocityPtr,
																motionLocksPtr,
																isBullet,
																pointsPtr,
																points.length,
																maxVertexCount,
																scalePtr,
																density,
																friction,
																restitution,
																rollingResistance,
																shapeOptions.userMaterialId,
																filterPtr,
																tangentVelocityPtr,
																shapeOptions.isSensor ? 1 : 0,
																shapeOptions.enableSensorEvents ? 1 : 0,
																shapeOptions.enableContactEvents ? 1 : 0,
																shapeOptions.enableHitEvents ? 1 : 0,
																shapeOptions.invokeContactCreation ? 1 : 0
															)
													)
												)
										)
									)
								)
						)
				)
			);
			return configureBody( module, api, bodyHandle, options );
		},

		createGridMesh( options = {} )
		{
			return module._box3d_js_create_grid_mesh(
				options.xCount ?? 1,
				options.zCount ?? 1,
				options.cellWidth ?? 1,
				options.materialCount ?? 0,
				options.identifyEdges === false ? 0 : 1
			);
		},

		createWaveMesh( options = {} )
		{
			return module._box3d_js_create_wave_mesh(
				options.xCount ?? 1,
				options.zCount ?? 1,
				options.cellWidth ?? 1,
				options.amplitude ?? 0,
				options.rowFrequency ?? 0,
				options.columnFrequency ?? 0
			);
		},

		createTorusMesh( options = {} )
		{
			return module._box3d_js_create_torus_mesh(
				options.radialResolution ?? 12,
				options.tubularResolution ?? 16,
				options.radius ?? 1,
				options.thickness ?? 0.25
			);
		},

		createBoxMesh( options = {} )
		{
			const center = options.center ?? { x: 0, y: 0, z: 0 };
			const extent = options.extent ?? { x: 0.5, y: 0.5, z: 0.5 };
			return module._box3d_js_create_box_mesh(
				center.x,
				center.y,
				center.z,
				extent.x,
				extent.y,
				extent.z,
				options.identifyEdges === false ? 0 : 1
			);
		},

		createHollowBoxMesh( options = {} )
		{
			const center = options.center ?? { x: 0, y: 0, z: 0 };
			const extent = options.extent ?? { x: 0.5, y: 0.5, z: 0.5 };
			return module._box3d_js_create_hollow_box_mesh(
				center.x,
				center.y,
				center.z,
				extent.x,
				extent.y,
				extent.z
			);
		},

		createPlatformMesh( options = {} )
		{
			const center = options.center ?? { x: 0, y: 0, z: 0 };
			return module._box3d_js_create_platform_mesh(
				center.x,
				center.y,
				center.z,
				options.height ?? 1,
				options.topWidth ?? 1,
				options.bottomWidth ?? 1
			);
		},

		createMesh( options = {} )
		{
			const vertices = options.vertices ?? [];
			const indices = options.indices ?? [];
			return withOptionalArray( module, flattenVec3Array( vertices ), "float", ( verticesPtr ) =>
				withOptionalArray( module, indices, "i32", ( indicesPtr ) =>
					module._box3d_js_create_mesh(
						verticesPtr,
						vertices.length,
						indicesPtr,
						Math.floor( indices.length / 3 ),
						options.useMedianSplit === false ? 0 : 1,
						options.identifyEdges ? 1 : 0
					)
				)
			);
		},

		getSensorBeginEvents( worldHandle )
		{
			const count = module._box3d_js_get_sensor_begin_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 2 * 4 );
			try
			{
				module._box3d_js_get_sensor_begin_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 2, "i32" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					events.push( {
						sensorBody: values[2 * index + 0],
						visitorBody: values[2 * index + 1],
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		getSensorEndEvents( worldHandle )
		{
			const count = module._box3d_js_get_sensor_end_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 2 * 4 );
			try
			{
				module._box3d_js_get_sensor_end_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 2, "i32" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					events.push( {
						sensorBody: values[2 * index + 0],
						visitorBody: values[2 * index + 1],
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		getBodyMoveEvents( worldHandle )
		{
			const count = module._box3d_js_get_body_move_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 2 * 4 );
			try
			{
				module._box3d_js_get_body_move_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 2, "i32" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					events.push( {
						body: values[2 * index + 0],
						fellAsleep: values[2 * index + 1] !== 0,
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		getContactBeginEvents( worldHandle )
		{
			const count = module._box3d_js_get_contact_begin_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 2 * 4 );
			try
			{
				module._box3d_js_get_contact_begin_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 2, "i32" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					events.push( {
						bodyA: values[2 * index + 0],
						bodyB: values[2 * index + 1],
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		getContactEndEvents( worldHandle )
		{
			const count = module._box3d_js_get_contact_end_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 2 * 4 );
			try
			{
				module._box3d_js_get_contact_end_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 2, "i32" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					events.push( {
						bodyA: values[2 * index + 0],
						bodyB: values[2 * index + 1],
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		getContactHitEvents( worldHandle )
		{
			const count = module._box3d_js_get_contact_hit_event_count( worldHandle );
			if ( count <= 0 )
			{
				return [];
			}

			const ptr = module._malloc( count * 10 * 8 );
			try
			{
				module._box3d_js_get_contact_hit_events( worldHandle, ptr, count );
				const values = readNumberArray( module, ptr, count * 10, "double" );
				const events = [];
				for ( let index = 0; index < count; index += 1 )
				{
					const offset = 10 * index;
					events.push( {
						bodyA: values[offset + 0],
						bodyB: values[offset + 1],
						point: { x: values[offset + 2], y: values[offset + 3], z: values[offset + 4] },
						normal: { x: values[offset + 5], y: values[offset + 6], z: values[offset + 7] },
						approachSpeed: values[offset + 8],
						userMaterialIdA: values[offset + 9],
					} );
				}
				return events;
			}
			finally
			{
				module._free( ptr );
			}
		},

		addBoxShape( bodyHandle, options = {} )
		{
			const size = options.size ?? { hx: 0.5, hy: 0.5, hz: 0.5 };
			const localPosition = options.localPosition ?? null;
			const localRotation = options.localRotation ?? null;
			const density = options.density ?? 0;
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const filterValues = getFilterValues( shapeOptions.filter );

			withOptionalArray(
				module,
				localPosition == null ? null : [ localPosition.x ?? 0, localPosition.y ?? 0, localPosition.z ?? 0 ],
				"float",
				( localPositionPtr ) =>
					withOptionalArray(
						module,
						localRotation == null ? null : [ localRotation.x ?? 0, localRotation.y ?? 0, localRotation.z ?? 0, localRotation.w ?? 1 ],
						"double",
						( localRotationPtr ) =>
							withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
								withOptionalArray(
									module,
									shapeOptions.tangentVelocity == null
										? null
										: [
											shapeOptions.tangentVelocity.x ?? 0,
											shapeOptions.tangentVelocity.y ?? 0,
											shapeOptions.tangentVelocity.z ?? 0,
										],
									"float",
									( tangentVelocityPtr ) =>
										module._box3d_js_add_box_shape(
											bodyHandle,
											size.hx,
											size.hy,
											size.hz,
											localPositionPtr,
											localRotationPtr,
											density,
											friction,
											restitution,
											rollingResistance,
											shapeOptions.userMaterialId,
											filterPtr,
											tangentVelocityPtr,
											shapeOptions.isSensor ? 1 : 0,
											shapeOptions.enableSensorEvents ? 1 : 0,
											shapeOptions.enableContactEvents ? 1 : 0,
											shapeOptions.enableHitEvents ? 1 : 0,
											shapeOptions.invokeContactCreation ? 1 : 0
										)
								)
							)
					)
			);
		},

		addSphereShape( bodyHandle, options = {} )
		{
			const center = options.center ?? { x: 0, y: 0, z: 0 };
			const radius = options.radius ?? 0.5;
			const density = options.density ?? 0;
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const filterValues = getFilterValues( shapeOptions.filter );

			withOptionalArray(
				module,
				filterValues,
				"i32",
				( filterPtr ) =>
					withOptionalArray(
						module,
						shapeOptions.tangentVelocity == null
							? null
							: [
								shapeOptions.tangentVelocity.x ?? 0,
								shapeOptions.tangentVelocity.y ?? 0,
								shapeOptions.tangentVelocity.z ?? 0,
							],
						"float",
						( tangentVelocityPtr ) =>
							module._box3d_js_add_sphere_shape(
								bodyHandle,
								center.x ?? 0,
								center.y ?? 0,
								center.z ?? 0,
								radius,
								density,
								friction,
								restitution,
								rollingResistance,
								shapeOptions.userMaterialId,
								filterPtr,
								tangentVelocityPtr,
								shapeOptions.isSensor ? 1 : 0,
								shapeOptions.enableSensorEvents ? 1 : 0,
								shapeOptions.enableContactEvents ? 1 : 0,
								shapeOptions.enableHitEvents ? 1 : 0,
								shapeOptions.invokeContactCreation ? 1 : 0
							)
					)
			);
		},

		addCapsuleShape( bodyHandle, options = {} )
		{
			const capsule = options.capsule ?? {
				center1: { x: 0, y: -0.5, z: 0 },
				center2: { x: 0, y: 0.5, z: 0 },
				radius: 0.5,
			};
			const density = options.density ?? 0;
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const shapeOptions = getShapeOptions( options );
			const filterValues = getFilterValues( shapeOptions.filter );
			const capsuleValues = [
				capsule.center1?.x ?? 0,
				capsule.center1?.y ?? -0.5,
				capsule.center1?.z ?? 0,
				capsule.center2?.x ?? 0,
				capsule.center2?.y ?? 0.5,
				capsule.center2?.z ?? 0,
				capsule.radius ?? 0.5,
			];

			withOptionalArray(
				module,
				capsuleValues,
				"float",
				( capsulePtr ) =>
					withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
						withOptionalArray(
							module,
							shapeOptions.tangentVelocity == null
								? null
								: [
									shapeOptions.tangentVelocity.x ?? 0,
									shapeOptions.tangentVelocity.y ?? 0,
									shapeOptions.tangentVelocity.z ?? 0,
								],
							"float",
							( tangentVelocityPtr ) =>
								module._box3d_js_add_capsule_shape(
									bodyHandle,
									capsulePtr,
									density,
									friction,
									restitution,
									rollingResistance,
									shapeOptions.userMaterialId,
									filterPtr,
									tangentVelocityPtr,
									shapeOptions.isSensor ? 1 : 0,
									shapeOptions.enableSensorEvents ? 1 : 0,
									shapeOptions.enableContactEvents ? 1 : 0,
									shapeOptions.enableHitEvents ? 1 : 0,
									shapeOptions.invokeContactCreation ? 1 : 0
								)
						)
					)
			);
		},

		addMeshShape( bodyHandle, options = {} )
		{
			const shapeOptions = getShapeOptions( options );
			const scale = options.scale ?? null;
			const density = options.density ?? 0;
			const friction = options.friction ?? 0.3;
			const restitution = options.restitution ?? 0;
			const rollingResistance = options.rollingResistance ?? 0;
			const filterValues = getFilterValues( shapeOptions.filter );

			withOptionalArray(
				module,
				scale == null ? null : [ scale.x ?? 1, scale.y ?? 1, scale.z ?? 1 ],
				"float",
				( scalePtr ) =>
					withOptionalArray( module, filterValues, "i32", ( filterPtr ) =>
						withOptionalArray(
							module,
							shapeOptions.tangentVelocity == null
								? null
								: [
									shapeOptions.tangentVelocity.x ?? 0,
									shapeOptions.tangentVelocity.y ?? 0,
									shapeOptions.tangentVelocity.z ?? 0,
								],
							"float",
							( tangentVelocityPtr ) =>
								module._box3d_js_add_mesh_shape(
									bodyHandle,
									options.meshHandle,
									scalePtr,
									density,
									friction,
									restitution,
									rollingResistance,
									shapeOptions.userMaterialId,
									filterPtr,
									tangentVelocityPtr,
									shapeOptions.isSensor ? 1 : 0,
									shapeOptions.enableSensorEvents ? 1 : 0,
									shapeOptions.enableContactEvents ? 1 : 0,
									shapeOptions.enableHitEvents ? 1 : 0,
									shapeOptions.invokeContactCreation ? 1 : 0
								)
						)
					)
			);
		},

		createDistanceJoint( worldHandle, options = {} )
		{
			const anchorA = options.anchorA ?? { x: 0, y: 0, z: 0 };
			const anchorB = options.anchorB ?? anchorA;
			return module._box3d_js_create_distance_joint(
				worldHandle,
				options.bodyA,
				options.bodyB,
				anchorA.x ?? 0,
				anchorA.y ?? 0,
				anchorA.z ?? 0,
				anchorB.x ?? 0,
				anchorB.y ?? 0,
				anchorB.z ?? 0,
				options.length ?? 1,
				options.minLength ?? ( options.length ?? 1 ),
				options.maxLength ?? ( options.length ?? 1 ),
				options.hertz ?? 0,
				options.dampingRatio ?? 0,
				options.lowerSpringForce ?? 0,
				options.upperSpringForce ?? 0,
				options.enableSpring ? 1 : 0,
				options.enableLimit ? 1 : 0
			);
		},

		createRevoluteJoint( worldHandle, options = {} )
		{
			const anchor = options.anchor ?? { x: 0, y: 0, z: 0 };
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					module._box3d_js_create_revolute_joint(
						worldHandle,
						options.bodyA,
						options.bodyB,
						frameAPtr,
						frameBPtr,
						anchor.x ?? 0,
						anchor.y ?? 0,
						anchor.z ?? 0,
						options.lowerAngle ?? 0,
						options.upperAngle ?? 0,
						options.hertz ?? 0,
						options.dampingRatio ?? 0,
						options.targetAngle ?? 0,
						options.motorSpeed ?? 0,
						options.maxMotorTorque ?? 0,
						options.constraintHertz ?? -1,
						options.constraintDampingRatio ?? -1,
						options.enableSpring ? 1 : 0,
						options.enableLimit ? 1 : 0,
						options.enableMotor ? 1 : 0
					)
				)
			);
		},

		createWeldJoint( worldHandle, options = {} )
		{
			const anchor = options.anchor ?? { x: 0, y: 0, z: 0 };
			return module._box3d_js_create_weld_joint(
				worldHandle,
				options.bodyA,
				options.bodyB,
				anchor.x ?? 0,
				anchor.y ?? 0,
				anchor.z ?? 0,
				options.linearHertz ?? 0,
				options.linearDampingRatio ?? 0,
				options.angularHertz ?? 0,
				options.angularDampingRatio ?? 0
			);
		},

		createFilterJoint( worldHandle, options = {} )
		{
			return module._box3d_js_create_filter_joint( worldHandle, options.bodyA, options.bodyB );
		},

		createMotorJoint( worldHandle, options = {} )
		{
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					module._box3d_js_create_motor_joint(
						worldHandle,
						options.bodyA,
						options.bodyB,
						frameAPtr,
						frameBPtr,
						options.linearHertz ?? 0,
						options.linearDampingRatio ?? 0,
						options.angularHertz ?? 0,
						options.angularDampingRatio ?? 0,
						options.maxVelocityForce ?? 0,
						options.maxVelocityTorque ?? 0,
						options.maxSpringForce ?? 0,
						options.maxSpringTorque ?? 0,
						options.collideConnected ? 1 : 0
					)
				)
			);
		},

		createParallelJoint( worldHandle, options = {} )
		{
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					module._box3d_js_create_parallel_joint(
						worldHandle,
						options.bodyA,
						options.bodyB,
						frameAPtr,
						frameBPtr,
						options.hertz ?? 0,
						options.dampingRatio ?? 0,
						options.maxTorque ?? 0,
						options.collideConnected ? 1 : 0
					)
				)
			);
		},

		createPrismaticJoint( worldHandle, options = {} )
		{
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					module._box3d_js_create_prismatic_joint(
						worldHandle,
						options.bodyA,
						options.bodyB,
						frameAPtr,
						frameBPtr,
						options.lowerTranslation ?? 0,
						options.upperTranslation ?? 0,
						options.hertz ?? 0,
						options.dampingRatio ?? 0,
						options.targetTranslation ?? 0,
						options.motorSpeed ?? 0,
						options.maxMotorForce ?? 0,
						options.enableSpring ? 1 : 0,
						options.enableLimit ? 1 : 0,
						options.enableMotor ? 1 : 0,
						options.constraintHertz ?? 0
					)
				)
			);
		},

		createSphericalJoint( worldHandle, options = {} )
		{
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const motorVelocity = options.motorVelocity ?? null;
			const targetRotation = options.targetRotation ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];
			const targetRotationValues = targetRotation == null ? null : [
				targetRotation.x ?? 0,
				targetRotation.y ?? 0,
				targetRotation.z ?? 0,
				targetRotation.w ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					withOptionalArray(
						module,
						motorVelocity == null ? null : [ motorVelocity.x ?? 0, motorVelocity.y ?? 0, motorVelocity.z ?? 0 ],
						"float",
						( motorVelocityPtr ) =>
							withOptionalArray( module, targetRotationValues, "double", ( targetRotationPtr ) =>
							module._box3d_js_create_spherical_joint(
								worldHandle,
								options.bodyA,
								options.bodyB,
								frameAPtr,
								frameBPtr,
								options.coneAngle ?? 0,
								options.lowerTwistAngle ?? 0,
								options.upperTwistAngle ?? 0,
								options.hertz ?? 0,
								options.dampingRatio ?? 0,
								options.constraintHertz ?? -1,
								options.constraintDampingRatio ?? -1,
								motorVelocityPtr,
								options.maxMotorTorque ?? 0,
								targetRotationPtr,
								options.enableSpring ? 1 : 0,
									options.enableConeLimit ? 1 : 0,
									options.enableTwistLimit ? 1 : 0,
									options.enableMotor ? 1 : 0
								)
							)
					)
				)
			);
		},

		createWheelJoint( worldHandle, options = {} )
		{
			const localFrameA = options.localFrameA ?? null;
			const localFrameB = options.localFrameB ?? null;
			const frameATransform = localFrameA == null ? null : [
				localFrameA.position?.x ?? localFrameA.p?.x ?? 0,
				localFrameA.position?.y ?? localFrameA.p?.y ?? 0,
				localFrameA.position?.z ?? localFrameA.p?.z ?? 0,
				localFrameA.rotation?.x ?? localFrameA.q?.x ?? localFrameA.q?.v?.x ?? 0,
				localFrameA.rotation?.y ?? localFrameA.q?.y ?? localFrameA.q?.v?.y ?? 0,
				localFrameA.rotation?.z ?? localFrameA.q?.z ?? localFrameA.q?.v?.z ?? 0,
				localFrameA.rotation?.w ?? localFrameA.q?.w ?? localFrameA.q?.s ?? 1,
			];
			const frameBTransform = localFrameB == null ? null : [
				localFrameB.position?.x ?? localFrameB.p?.x ?? 0,
				localFrameB.position?.y ?? localFrameB.p?.y ?? 0,
				localFrameB.position?.z ?? localFrameB.p?.z ?? 0,
				localFrameB.rotation?.x ?? localFrameB.q?.x ?? localFrameB.q?.v?.x ?? 0,
				localFrameB.rotation?.y ?? localFrameB.q?.y ?? localFrameB.q?.v?.y ?? 0,
				localFrameB.rotation?.z ?? localFrameB.q?.z ?? localFrameB.q?.v?.z ?? 0,
				localFrameB.rotation?.w ?? localFrameB.q?.w ?? localFrameB.q?.s ?? 1,
			];

			return withOptionalArray( module, frameATransform, "double", ( frameAPtr ) =>
				withOptionalArray( module, frameBTransform, "double", ( frameBPtr ) =>
					module._box3d_js_create_wheel_joint(
						worldHandle,
						options.bodyA,
						options.bodyB,
						frameAPtr,
						frameBPtr,
						options.lowerSuspensionLimit ?? 0,
						options.upperSuspensionLimit ?? 0,
						options.suspensionHertz ?? 0,
						options.suspensionDampingRatio ?? 0,
						options.spinSpeed ?? 0,
						options.maxSpinTorque ?? 0,
						options.steeringHertz ?? 0,
						options.steeringDampingRatio ?? 0,
						options.targetSteeringAngle ?? 0,
						options.maxSteeringTorque ?? 0,
						options.lowerSteeringLimit ?? 0,
						options.upperSteeringLimit ?? 0,
						options.enableSuspensionSpring ? 1 : 0,
						options.enableSuspensionLimit ? 1 : 0,
						options.enableSpinMotor ? 1 : 0,
						options.enableSteering ? 1 : 0,
						options.enableSteeringLimit ? 1 : 0,
						options.collideConnected ? 1 : 0
					)
				)
			);
		},

		destroyJoint( jointHandle, wakeAttached = false )
		{
			module._box3d_js_destroy_joint( jointHandle, wakeAttached ? 1 : 0 );
		},

		wakeJointBodies( jointHandle )
		{
			module._box3d_js_wake_joint_bodies( jointHandle );
		},

		getDistanceJointCurrentLength( jointHandle )
		{
			return module._box3d_js_get_distance_joint_current_length( jointHandle );
		},

		setDistanceJointLength( jointHandle, length )
		{
			module._box3d_js_set_distance_joint_length( jointHandle, length );
		},

		enableDistanceJointSpring( jointHandle, enableSpring )
		{
			module._box3d_js_enable_distance_joint_spring( jointHandle, enableSpring ? 1 : 0 );
		},

		setDistanceJointSpringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_distance_joint_spring_hertz( jointHandle, hertz );
		},

		setDistanceJointSpringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_distance_joint_spring_damping_ratio( jointHandle, dampingRatio );
		},

		getRevoluteJointAngle( jointHandle )
		{
			return module._box3d_js_get_revolute_joint_angle( jointHandle );
		},

		enableRevoluteJointMotor( jointHandle, enableMotor )
		{
			module._box3d_js_enable_revolute_joint_motor( jointHandle, enableMotor ? 1 : 0 );
		},

		setRevoluteJointMotorSpeed( jointHandle, motorSpeed )
		{
			module._box3d_js_set_revolute_joint_motor_speed( jointHandle, motorSpeed );
		},

		setRevoluteJointMaxMotorTorque( jointHandle, torque )
		{
			module._box3d_js_set_revolute_joint_max_motor_torque( jointHandle, torque );
		},

		enableRevoluteJointSpring( jointHandle, enableSpring )
		{
			module._box3d_js_enable_revolute_joint_spring( jointHandle, enableSpring ? 1 : 0 );
		},

		setRevoluteJointTargetAngle( jointHandle, targetAngle )
		{
			module._box3d_js_set_revolute_joint_target_angle( jointHandle, targetAngle );
		},

		setRevoluteJointSpringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_revolute_joint_spring_hertz( jointHandle, hertz );
		},

		setRevoluteJointSpringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_revolute_joint_spring_damping_ratio( jointHandle, dampingRatio );
		},

		setWeldJointLinearHertz( jointHandle, hertz )
		{
			module._box3d_js_set_weld_joint_linear_hertz( jointHandle, hertz );
		},

		setWeldJointLinearDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_weld_joint_linear_damping_ratio( jointHandle, dampingRatio );
		},

		setWeldJointAngularHertz( jointHandle, hertz )
		{
			module._box3d_js_set_weld_joint_angular_hertz( jointHandle, hertz );
		},

		setWeldJointAngularDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_weld_joint_angular_damping_ratio( jointHandle, dampingRatio );
		},

		setMotorJointMaxSpringForce( jointHandle, maxForce )
		{
			module._box3d_js_set_motor_joint_max_spring_force( jointHandle, maxForce );
		},

		setMotorJointMaxSpringTorque( jointHandle, maxTorque )
		{
			module._box3d_js_set_motor_joint_max_spring_torque( jointHandle, maxTorque );
		},

		setParallelJointSpringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_parallel_joint_spring_hertz( jointHandle, hertz );
		},

		setParallelJointSpringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_parallel_joint_spring_damping_ratio( jointHandle, dampingRatio );
		},

		getJointConstraintForceLength( jointHandle )
		{
			return module._box3d_js_get_joint_constraint_force_length( jointHandle );
		},

		getJointConstraintTorqueLength( jointHandle )
		{
			return module._box3d_js_get_joint_constraint_torque_length( jointHandle );
		},

		getPrismaticJointTranslation( jointHandle )
		{
			return module._box3d_js_get_prismatic_joint_translation( jointHandle );
		},

		enablePrismaticJointSpring( jointHandle, enableSpring )
		{
			module._box3d_js_enable_prismatic_joint_spring( jointHandle, enableSpring ? 1 : 0 );
		},

		setPrismaticJointSpringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_prismatic_joint_spring_hertz( jointHandle, hertz );
		},

		setPrismaticJointSpringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_prismatic_joint_spring_damping_ratio( jointHandle, dampingRatio );
		},

		setPrismaticJointTargetTranslation( jointHandle, targetTranslation )
		{
			module._box3d_js_set_prismatic_joint_target_translation( jointHandle, targetTranslation );
		},

		enablePrismaticJointMotor( jointHandle, enableMotor )
		{
			module._box3d_js_enable_prismatic_joint_motor( jointHandle, enableMotor ? 1 : 0 );
		},

		setPrismaticJointMotorSpeed( jointHandle, motorSpeed )
		{
			module._box3d_js_set_prismatic_joint_motor_speed( jointHandle, motorSpeed );
		},

		setPrismaticJointMaxMotorForce( jointHandle, maxMotorForce )
		{
			module._box3d_js_set_prismatic_joint_max_motor_force( jointHandle, maxMotorForce );
		},

		enableSphericalJointConeLimit( jointHandle, enableLimit )
		{
			module._box3d_js_enable_spherical_joint_cone_limit( jointHandle, enableLimit ? 1 : 0 );
		},

		setSphericalJointConeLimit( jointHandle, angleRadians )
		{
			module._box3d_js_set_spherical_joint_cone_limit( jointHandle, angleRadians );
		},

		enableSphericalJointTwistLimit( jointHandle, enableLimit )
		{
			module._box3d_js_enable_spherical_joint_twist_limit( jointHandle, enableLimit ? 1 : 0 );
		},

		setSphericalJointTwistLimits( jointHandle, lowerLimitRadians, upperLimitRadians )
		{
			module._box3d_js_set_spherical_joint_twist_limits( jointHandle, lowerLimitRadians, upperLimitRadians );
		},

		enableSphericalJointMotor( jointHandle, enableMotor )
		{
			module._box3d_js_enable_spherical_joint_motor( jointHandle, enableMotor ? 1 : 0 );
		},

		setSphericalJointMaxMotorTorque( jointHandle, maxMotorTorque )
		{
			module._box3d_js_set_spherical_joint_max_motor_torque( jointHandle, maxMotorTorque );
		},

		setSphericalJointMotorVelocity( jointHandle, velocity )
		{
			module._box3d_js_set_spherical_joint_motor_velocity( jointHandle, velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0 );
		},

		enableSphericalJointSpring( jointHandle, enableSpring )
		{
			module._box3d_js_enable_spherical_joint_spring( jointHandle, enableSpring ? 1 : 0 );
		},

		setSphericalJointSpringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_spherical_joint_spring_hertz( jointHandle, hertz );
		},

		setSphericalJointSpringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_spherical_joint_spring_damping_ratio( jointHandle, dampingRatio );
		},

		setSphericalJointTargetRotation( jointHandle, rotation )
		{
			withOptionalArray( module, [ rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0, rotation.w ?? 1 ], "double", ( rotationPtr ) =>
			{
				module._box3d_js_set_spherical_joint_target_rotation( jointHandle, rotationPtr );
			} );
		},

		enableWheelJointSuspensionLimit( jointHandle, enableLimit )
		{
			module._box3d_js_enable_wheel_joint_suspension_limit( jointHandle, enableLimit ? 1 : 0 );
		},

		setWheelJointSuspensionLimits( jointHandle, lower, upper )
		{
			module._box3d_js_set_wheel_joint_suspension_limits( jointHandle, lower, upper );
		},

		enableWheelJointSpinMotor( jointHandle, enableMotor )
		{
			module._box3d_js_enable_wheel_joint_spin_motor( jointHandle, enableMotor ? 1 : 0 );
		},

		setWheelJointMaxSpinTorque( jointHandle, torque )
		{
			module._box3d_js_set_wheel_joint_max_spin_torque( jointHandle, torque );
		},

		setWheelJointSpinMotorSpeed( jointHandle, speed )
		{
			module._box3d_js_set_wheel_joint_spin_motor_speed( jointHandle, speed );
		},

		enableWheelJointSuspension( jointHandle, enableSuspension )
		{
			module._box3d_js_enable_wheel_joint_suspension( jointHandle, enableSuspension ? 1 : 0 );
		},

		setWheelJointSuspensionHertz( jointHandle, hertz )
		{
			module._box3d_js_set_wheel_joint_suspension_hertz( jointHandle, hertz );
		},

		setWheelJointSuspensionDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_wheel_joint_suspension_damping_ratio( jointHandle, dampingRatio );
		},

		enableWheelJointSteering( jointHandle, enableSteering )
		{
			module._box3d_js_enable_wheel_joint_steering( jointHandle, enableSteering ? 1 : 0 );
		},

		setWheelJointSteeringHertz( jointHandle, hertz )
		{
			module._box3d_js_set_wheel_joint_steering_hertz( jointHandle, hertz );
		},

		setWheelJointSteeringDampingRatio( jointHandle, dampingRatio )
		{
			module._box3d_js_set_wheel_joint_steering_damping_ratio( jointHandle, dampingRatio );
		},

		setWheelJointTargetSteeringAngle( jointHandle, radians )
		{
			module._box3d_js_set_wheel_joint_target_steering_angle( jointHandle, radians );
		},

		enableWheelJointSteeringLimit( jointHandle, enableLimit )
		{
			module._box3d_js_enable_wheel_joint_steering_limit( jointHandle, enableLimit ? 1 : 0 );
		},

		setWheelJointSteeringLimits( jointHandle, lowerRadians, upperRadians )
		{
			module._box3d_js_set_wheel_joint_steering_limits( jointHandle, lowerRadians, upperRadians );
		},

		getWheelJointSteeringAngle( jointHandle )
		{
			return module._box3d_js_get_wheel_joint_steering_angle( jointHandle );
		},

		destroyBody( bodyHandle )
		{
			module._box3d_js_destroy_body( bodyHandle );
		},

		destroyMesh( meshHandle )
		{
			module._box3d_js_destroy_mesh( meshHandle );
		},

		getBodyTransform( bodyHandle )
		{
			const ptr = module._malloc( 7 * 8 );
			try
			{
				module._box3d_js_get_body_transform( bodyHandle, ptr );
				const values = readNumberArray( module, ptr, 7, "double" );
				return {
					position: { x: values[0], y: values[1], z: values[2] },
					rotation: { x: values[3], y: values[4], z: values[5], w: values[6] },
				};
			}
			finally
			{
				module._free( ptr );
			}
		},

		getBodyWorldCenter( bodyHandle )
		{
			const ptr = module._malloc( 3 * 8 );
			try
			{
				module._box3d_js_get_body_world_center( bodyHandle, ptr );
				const values = readNumberArray( module, ptr, 3, "double" );
				return { x: values[0], y: values[1], z: values[2] };
			}
			finally
			{
				module._free( ptr );
			}
		},

		setBodyTransform( bodyHandle, transform )
		{
			const position = transform.position ?? { x: 0, y: 0, z: 0 };
			const rotation = transform.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const ptr = writeNumberArray( module, [
				position.x,
				position.y,
				position.z,
				rotation.x,
				rotation.y,
				rotation.z,
				rotation.w,
			], "double" );
			try
			{
				module._box3d_js_set_body_transform( bodyHandle, ptr );
			}
			finally
			{
				module._free( ptr );
			}
		},

		getBodyLinearVelocity( bodyHandle )
		{
			const ptr = module._malloc( 3 * 4 );
			try
			{
				module._box3d_js_get_body_linear_velocity( bodyHandle, ptr );
				const values = readNumberArray( module, ptr, 3, "float" );
				return { x: values[0], y: values[1], z: values[2] };
			}
			finally
			{
				module._free( ptr );
			}
		},

		setBodyLinearVelocity( bodyHandle, velocity )
		{
			module._box3d_js_set_body_linear_velocity( bodyHandle, velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0 );
		},

		getBodyAngularVelocity( bodyHandle )
		{
			const ptr = module._malloc( 3 * 4 );
			try
			{
				module._box3d_js_get_body_angular_velocity( bodyHandle, ptr );
				const values = readNumberArray( module, ptr, 3, "float" );
				return { x: values[0], y: values[1], z: values[2] };
			}
			finally
			{
				module._free( ptr );
			}
		},

		setBodyAngularVelocity( bodyHandle, velocity )
		{
			module._box3d_js_set_body_angular_velocity( bodyHandle, velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0 );
		},

		setBodyMotionLocks( bodyHandle, motionLocks )
		{
			module._box3d_js_set_body_motion_locks(
				bodyHandle,
				motionLocks.linearX ? 1 : 0,
				motionLocks.linearY ? 1 : 0,
				motionLocks.linearZ ? 1 : 0,
				motionLocks.angularX ? 1 : 0,
				motionLocks.angularY ? 1 : 0,
				motionLocks.angularZ ? 1 : 0
			);
		},

		applyBodyLinearImpulse( bodyHandle, impulse, point, wake = true )
		{
			module._box3d_js_apply_body_linear_impulse(
				bodyHandle,
				impulse.x ?? 0,
				impulse.y ?? 0,
				impulse.z ?? 0,
				point.x ?? 0,
				point.y ?? 0,
				point.z ?? 0,
				wake ? 1 : 0
			);
		},

		setBodyGravityScale( bodyHandle, gravityScale )
		{
			module._box3d_js_set_body_gravity_scale( bodyHandle, gravityScale );
		},

		setBodyType( bodyHandle, bodyType )
		{
			module._box3d_js_set_body_type( bodyHandle, bodyType );
		},

		enableBodySleep( bodyHandle, enableSleep )
		{
			module._box3d_js_enable_body_sleep( bodyHandle, enableSleep ? 1 : 0 );
		},

		setBodyAwake( bodyHandle, awake = true )
		{
			module._box3d_js_set_body_awake( bodyHandle, awake ? 1 : 0 );
		},

		setBodyTargetTransform( bodyHandle, transform, timeStep, wake = true )
		{
			const position = transform.position ?? { x: 0, y: 0, z: 0 };
			const rotation = transform.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
			const ptr = writeNumberArray( module, [
				position.x,
				position.y,
				position.z,
				rotation.x,
				rotation.y,
				rotation.z,
				rotation.w,
			], "double" );
			try
			{
				if ( typeof module._box3d_js_set_body_target_transform === "function" )
				{
					module._box3d_js_set_body_target_transform( bodyHandle, ptr, timeStep, wake ? 1 : 0 );
					return;
				}

				// HMR can briefly pair a newer wrapper with an older raw module.
				// Falling back to the regular transform setter keeps samples usable.
				module._box3d_js_set_body_transform( bodyHandle, ptr );
			}
			finally
			{
				module._free( ptr );
			}
		},

		disableBody( bodyHandle )
		{
			module._box3d_js_disable_body( bodyHandle );
		},

		enableBody( bodyHandle )
		{
			module._box3d_js_enable_body( bodyHandle );
		},
	};

	return api;
}

export async function loadBox3D( options = {} )
{
	const moduleFactory = options.moduleFactory ?? createRawModule;
	const module = await moduleFactory( options.moduleOptions ?? {} );

	return {
		module,
		raw: createRawNamespace( module ),
		api: createVanillaApi( module ),
		BodyType,
	};
}

export default loadBox3D;
