#include "box3d/box3d.h"
#include "../shared/benchmarks.h"

#include <float.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

typedef struct HelloWorldState
{
	bool active;
	b3WorldId worldId;
	b3BodyId bodyId;
} HelloWorldState;

static HelloWorldState g_hello;

#define BOX3D_JS_MAX_WORLDS 128
#define BOX3D_JS_MAX_BODIES 8192
#define BOX3D_JS_MAX_JOINTS 8192
#define BOX3D_JS_MAX_SHAPES 32768
#define BOX3D_JS_MAX_MESHES 2048

typedef struct Box3DJsWorldSlot
{
	bool active;
	b3WorldId worldId;
} Box3DJsWorldSlot;

typedef struct Box3DJsBodySlot
{
	bool active;
	int worldHandle;
	b3BodyId bodyId;
} Box3DJsBodySlot;

typedef struct Box3DJsJointSlot
{
	bool active;
	int worldHandle;
	b3JointId jointId;
} Box3DJsJointSlot;

typedef struct Box3DJsShapeSlot
{
	bool active;
	int worldHandle;
	b3ShapeId shapeId;
} Box3DJsShapeSlot;

typedef struct Box3DJsMeshSlot
{
	bool active;
	b3MeshData* meshData;
} Box3DJsMeshSlot;

typedef struct Box3DJsCastClosestContext
{
	bool ignoreInitialOverlap;
	bool hit;
	b3Pos point;
	b3Vec3 normal;
	float fraction;
	int triangleIndex;
	int childIndex;
	uint64_t userMaterialId;
} Box3DJsCastClosestContext;

typedef struct Box3DJsPlaneGatherContext
{
	double* outValues;
	int capacity;
	int count;
} Box3DJsPlaneGatherContext;

typedef struct Box3DJsOverlapContext
{
	bool hit;
} Box3DJsOverlapContext;

EM_JS( int, Box3DJsInvokeCustomFilter, ( int worldHandle, int bodyHandleA, int bodyHandleB, uintptr_t userDataA, uintptr_t userDataB,
										 int isSensorA, int isSensorB, uint32_t userMaterialIdA, uint32_t userMaterialIdB ), {
	if ( typeof globalThis.__box3dCustomFilterDispatch !== "function" )
	{
		return 1;
	}

	return globalThis.__box3dCustomFilterDispatch(
		worldHandle,
		bodyHandleA,
		bodyHandleB,
		Number( userDataA ),
		Number( userDataB ),
		isSensorA !== 0,
		isSensorB !== 0,
		Number( userMaterialIdA ),
		Number( userMaterialIdB )
	) ? 1 : 0;
} );

static Box3DJsWorldSlot g_world_slots[BOX3D_JS_MAX_WORLDS];
static Box3DJsBodySlot g_body_slots[BOX3D_JS_MAX_BODIES];
static Box3DJsJointSlot g_joint_slots[BOX3D_JS_MAX_JOINTS];
static Box3DJsShapeSlot g_shape_slots[BOX3D_JS_MAX_SHAPES];
static int g_world_benchmark_helper_kinds[BOX3D_JS_MAX_WORLDS];
static Box3DJsMeshSlot g_mesh_slots[BOX3D_JS_MAX_MESHES];

void Box3DJsBeginBenchmarkTracking( int worldHandle );
void Box3DJsEndBenchmarkTracking( void );

static float Box3DJsCastClosestCallback( b3ShapeId shapeId, b3Pos point, b3Vec3 normal, float fraction, uint64_t materialId, int triangleIndex,
										 int childIndex, void* context )
{
	(void)shapeId;
	Box3DJsCastClosestContext* castContext = (Box3DJsCastClosestContext*)context;
	if ( castContext == NULL )
	{
		return 0.0f;
	}

	if ( castContext->ignoreInitialOverlap && fraction == 0.0f )
	{
		return -1.0f;
	}

	castContext->hit = true;
	castContext->point = point;
	castContext->normal = normal;
	castContext->fraction = fraction;
	castContext->triangleIndex = triangleIndex;
	castContext->childIndex = childIndex;
	castContext->userMaterialId = materialId;
	return fraction;
}

static bool Box3DJsGatherPlaneCallback( b3ShapeId shapeId, const b3PlaneResult* results, int planeCount, void* context )
{
	(void)shapeId;
	Box3DJsPlaneGatherContext* gatherContext = (Box3DJsPlaneGatherContext*)context;
	if ( gatherContext == NULL || gatherContext->outValues == NULL || results == NULL || planeCount <= 0 )
	{
		return true;
	}

	for ( int i = 0; i < planeCount && gatherContext->count < gatherContext->capacity; ++i )
	{
		const int base = 7 * gatherContext->count;
		gatherContext->outValues[base + 0] = results[i].plane.normal.x;
		gatherContext->outValues[base + 1] = results[i].plane.normal.y;
		gatherContext->outValues[base + 2] = results[i].plane.normal.z;
		gatherContext->outValues[base + 3] = results[i].plane.offset;
		gatherContext->outValues[base + 4] = results[i].point.x;
		gatherContext->outValues[base + 5] = results[i].point.y;
		gatherContext->outValues[base + 6] = results[i].point.z;
		gatherContext->count += 1;
	}

	return gatherContext->count < gatherContext->capacity;
}

static bool Box3DJsOverlapAnyCallback( b3ShapeId shapeId, void* context )
{
	(void)shapeId;
	Box3DJsOverlapContext* overlapContext = (Box3DJsOverlapContext*)context;
	if ( overlapContext != NULL )
	{
		overlapContext->hit = true;
	}

	return false;
}

static b3WorldTransform Box3DJsReadWorldTransform( const double* values7 )
{
	if ( values7 == NULL )
	{
		return b3WorldTransform_identity;
	}

	return (b3WorldTransform){
		.p = { values7[0], values7[1], values7[2] },
		.q = { { (float)values7[3], (float)values7[4], (float)values7[5] }, (float)values7[6] },
	};
}

static void Box3DJsWriteWorldManifold( const b3LocalManifold* manifold, b3WorldTransform frame, int capacity, double* outValues )
{
	if ( outValues == NULL )
	{
		return;
	}

	int totalCount = 14 + 9 * capacity;
	for ( int i = 0; i < totalCount; ++i )
	{
		outValues[i] = 0.0;
	}

	if ( manifold == NULL )
	{
		return;
	}

	b3Vec3 normal = b3RotateVector( frame.q, manifold->normal );
	b3Vec3 triangleNormal = b3RotateVector( frame.q, manifold->triangleNormal );
	outValues[0] = (double)manifold->pointCount;
	outValues[1] = normal.x;
	outValues[2] = normal.y;
	outValues[3] = normal.z;
	outValues[4] = triangleNormal.x;
	outValues[5] = triangleNormal.y;
	outValues[6] = triangleNormal.z;
	outValues[7] = (double)manifold->triangleIndex;
	outValues[8] = (double)manifold->i1;
	outValues[9] = (double)manifold->i2;
	outValues[10] = (double)manifold->i3;
	outValues[11] = manifold->squaredDistance;
	outValues[12] = (double)manifold->feature;
	outValues[13] = (double)manifold->triangleFlags;

	int pointCount = manifold->pointCount < capacity ? manifold->pointCount : capacity;
	for ( int i = 0; i < pointCount; ++i )
	{
		const b3LocalManifoldPoint* point = manifold->points + i;
		b3Pos worldPoint = b3TransformWorldPoint( frame, point->point );
		int base = 14 + 9 * i;
		outValues[base + 0] = worldPoint.x;
		outValues[base + 1] = worldPoint.y;
		outValues[base + 2] = worldPoint.z;
		outValues[base + 3] = point->separation;
		outValues[base + 4] = (double)point->pair.owner1;
		outValues[base + 5] = (double)point->pair.index1;
		outValues[base + 6] = (double)point->pair.owner2;
		outValues[base + 7] = (double)point->pair.index2;
		outValues[base + 8] = (double)point->triangleIndex;
	}
}

static b3HullData* Box3DJsCreateHullFromPoints( const float* points3, int pointCount )
{
	if ( points3 == NULL || pointCount <= 0 )
	{
		return NULL;
	}

	return b3CreateHull( (const b3Vec3*)points3, pointCount, pointCount );
}

static void ResetHelloState( void )
{
	g_hello.active = false;
	g_hello.worldId = b3_nullWorldId;
	g_hello.bodyId = b3_nullBodyId;
}

static void DestroyHelloState( void )
{
	if ( g_hello.active && b3World_IsValid( g_hello.worldId ) )
	{
		b3DestroyWorld( g_hello.worldId );
	}

	ResetHelloState();
}

static int AllocWorldSlot( b3WorldId worldId )
{
	for ( int i = 1; i < BOX3D_JS_MAX_WORLDS; ++i )
	{
		if ( g_world_slots[i].active == false )
		{
			g_world_slots[i].active = true;
			g_world_slots[i].worldId = worldId;
			return i;
		}
	}

	return 0;
}

static int AllocBodySlot( int worldHandle, b3BodyId bodyId )
{
	for ( int i = 1; i < BOX3D_JS_MAX_BODIES; ++i )
	{
		if ( g_body_slots[i].active == false )
		{
			g_body_slots[i].active = true;
			g_body_slots[i].worldHandle = worldHandle;
			g_body_slots[i].bodyId = bodyId;
			return i;
		}
	}

	return 0;
}

static int AllocJointSlot( int worldHandle, b3JointId jointId )
{
	for ( int i = 1; i < BOX3D_JS_MAX_JOINTS; ++i )
	{
		if ( g_joint_slots[i].active == false )
		{
			g_joint_slots[i].active = true;
			g_joint_slots[i].worldHandle = worldHandle;
			g_joint_slots[i].jointId = jointId;
			return i;
		}
	}

	return 0;
}

static int AllocShapeSlot( int worldHandle, b3ShapeId shapeId )
{
	for ( int i = 1; i < BOX3D_JS_MAX_SHAPES; ++i )
	{
		if ( g_shape_slots[i].active == false )
		{
			g_shape_slots[i].active = true;
			g_shape_slots[i].worldHandle = worldHandle;
			g_shape_slots[i].shapeId = shapeId;
			return i;
		}
	}

	return 0;
}

static int AllocMeshSlot( b3MeshData* meshData )
{
	for ( int i = 1; i < BOX3D_JS_MAX_MESHES; ++i )
	{
		if ( g_mesh_slots[i].active == false )
		{
			g_mesh_slots[i].active = true;
			g_mesh_slots[i].meshData = meshData;
			return i;
		}
	}

	return 0;
}

static b3WorldId LookupWorld( int worldHandle )
{
	if ( worldHandle <= 0 || worldHandle >= BOX3D_JS_MAX_WORLDS || g_world_slots[worldHandle].active == false )
	{
		return b3_nullWorldId;
	}

	return g_world_slots[worldHandle].worldId;
}

static int FindWorldHandle( b3WorldId worldId )
{
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	uint32_t packedWorldId = b3StoreWorldId( worldId );

	for ( int i = 1; i < BOX3D_JS_MAX_WORLDS; ++i )
	{
		if ( g_world_slots[i].active && b3StoreWorldId( g_world_slots[i].worldId ) == packedWorldId )
		{
			return i;
		}
	}

	return 0;
}

static b3BodyId LookupBody( int bodyHandle )
{
	if ( bodyHandle <= 0 || bodyHandle >= BOX3D_JS_MAX_BODIES || g_body_slots[bodyHandle].active == false )
	{
		return b3_nullBodyId;
	}

	return g_body_slots[bodyHandle].bodyId;
}

static int FindBodyHandle( b3BodyId bodyId )
{
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	for ( int i = 1; i < BOX3D_JS_MAX_BODIES; ++i )
	{
		if ( g_body_slots[i].active && B3_ID_EQUALS( g_body_slots[i].bodyId, bodyId ) )
		{
			return i;
		}
	}

	return 0;
}

int Box3DJsRegisterTrackedBody( int worldHandle, b3BodyId bodyId )
{
	int existingHandle = FindBodyHandle( bodyId );
	if ( existingHandle != 0 )
	{
		return existingHandle;
	}

	return AllocBodySlot( worldHandle, bodyId );
}

static b3JointId LookupJoint( int jointHandle )
{
	if ( jointHandle <= 0 || jointHandle >= BOX3D_JS_MAX_JOINTS || g_joint_slots[jointHandle].active == false )
	{
		return b3_nullJointId;
	}

	return g_joint_slots[jointHandle].jointId;
}

static b3ShapeId LookupShape( int shapeHandle )
{
	if ( shapeHandle <= 0 || shapeHandle >= BOX3D_JS_MAX_SHAPES || g_shape_slots[shapeHandle].active == false )
	{
		return b3_nullShapeId;
	}

	return g_shape_slots[shapeHandle].shapeId;
}

static int FindShapeHandle( b3ShapeId shapeId )
{
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		return 0;
	}

	for ( int i = 1; i < BOX3D_JS_MAX_SHAPES; ++i )
	{
		if ( g_shape_slots[i].active && B3_ID_EQUALS( g_shape_slots[i].shapeId, shapeId ) )
		{
			return i;
		}
	}

	return 0;
}

static b3MeshData* LookupMesh( int meshHandle )
{
	if ( meshHandle <= 0 || meshHandle >= BOX3D_JS_MAX_MESHES || g_mesh_slots[meshHandle].active == false )
	{
		return NULL;
	}

	return g_mesh_slots[meshHandle].meshData;
}

static void ReleaseBodiesForWorld( int worldHandle )
{
	for ( int i = 1; i < BOX3D_JS_MAX_BODIES; ++i )
	{
		if ( g_body_slots[i].active && g_body_slots[i].worldHandle == worldHandle )
		{
			g_body_slots[i].active = false;
			g_body_slots[i].worldHandle = 0;
			g_body_slots[i].bodyId = b3_nullBodyId;
		}
	}
}

static void ReleaseJointsForWorld( int worldHandle )
{
	for ( int i = 1; i < BOX3D_JS_MAX_JOINTS; ++i )
	{
		if ( g_joint_slots[i].active && g_joint_slots[i].worldHandle == worldHandle )
		{
			g_joint_slots[i].active = false;
			g_joint_slots[i].worldHandle = 0;
			g_joint_slots[i].jointId = b3_nullJointId;
		}
	}
}

static void ReleaseShapesForWorld( int worldHandle )
{
	for ( int i = 1; i < BOX3D_JS_MAX_SHAPES; ++i )
	{
		if ( g_shape_slots[i].active && g_shape_slots[i].worldHandle == worldHandle )
		{
			g_shape_slots[i].active = false;
			g_shape_slots[i].worldHandle = 0;
			g_shape_slots[i].shapeId = b3_nullShapeId;
		}
	}
}

static b3MotionLocks ReadMotionLocks( const int* locks6 )
{
	b3MotionLocks locks = { 0 };
	if ( locks6 == NULL )
	{
		return locks;
	}

	locks.linearX = locks6[0] != 0;
	locks.linearY = locks6[1] != 0;
	locks.linearZ = locks6[2] != 0;
	locks.angularX = locks6[3] != 0;
	locks.angularY = locks6[4] != 0;
	locks.angularZ = locks6[5] != 0;
	return locks;
}

static b3Filter ReadFilter( const int* filter3 )
{
	b3Filter filter = b3DefaultFilter();
	if ( filter3 == NULL )
	{
		return filter;
	}

	filter.categoryBits = (uint32_t)filter3[0];
	filter.maskBits = (uint32_t)filter3[1];
	filter.groupIndex = filter3[2];
	return filter;
}

static void ConfigureShapeDef( b3ShapeDef* shapeDef, float density, float friction, float restitution, float rollingResistance,
							   int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3, int isSensor,
							   int enableSensorEvents, int enableContactEvents, int enableHitEvents, int enableCustomFiltering,
							   int invokeContactCreation )
{
	shapeDef->density = density;
	shapeDef->userData = (void*)userData;
	shapeDef->baseMaterial.friction = friction;
	shapeDef->baseMaterial.restitution = restitution;
	shapeDef->baseMaterial.rollingResistance = rollingResistance;
	shapeDef->baseMaterial.userMaterialId = (uint32_t)userMaterialId;
	shapeDef->filter = ReadFilter( filter3 );
	shapeDef->baseMaterial.tangentVelocity = tangentVelocity3 != NULL ? (b3Vec3){ tangentVelocity3[0], tangentVelocity3[1], tangentVelocity3[2] } : b3Vec3_zero;
	shapeDef->enableCustomFiltering = enableCustomFiltering != 0;
	shapeDef->isSensor = isSensor != 0;
	shapeDef->enableSensorEvents = enableSensorEvents != 0;
	shapeDef->enableContactEvents = enableContactEvents != 0;
	shapeDef->enableHitEvents = enableHitEvents != 0;
	shapeDef->invokeContactCreation = invokeContactCreation != 0;
}

static bool Box3DJsCustomFilterCallback( b3ShapeId shapeIdA, b3ShapeId shapeIdB, void* context )
{
	int worldHandle = (int)(intptr_t)context;
	int bodyHandleA = FindBodyHandle( b3Shape_GetBody( shapeIdA ) );
	int bodyHandleB = FindBodyHandle( b3Shape_GetBody( shapeIdB ) );
	b3SurfaceMaterial materialA = b3Shape_GetSurfaceMaterial( shapeIdA );
	b3SurfaceMaterial materialB = b3Shape_GetSurfaceMaterial( shapeIdB );
	return Box3DJsInvokeCustomFilter(
		worldHandle,
		bodyHandleA,
		bodyHandleB,
		(uintptr_t)b3Shape_GetUserData( shapeIdA ),
		(uintptr_t)b3Shape_GetUserData( shapeIdB ),
		b3Shape_IsSensor( shapeIdA ) ? 1 : 0,
		b3Shape_IsSensor( shapeIdB ) ? 1 : 0,
		materialA.userMaterialId,
		materialB.userMaterialId
	) != 0;
}

static b3BodyId CreateBodyCommon( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4, const float* linearVelocity3,
								  const float* angularVelocity3, const int* locks6, int isBullet )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return b3_nullBodyId;
	}

	b3BodyDef bodyDef = b3DefaultBodyDef();
	bodyDef.type = (b3BodyType)bodyType;
	bodyDef.position = (b3Pos){ x, y, z };
	bodyDef.rotation = rotation4 != NULL ? (b3Quat){ { (float)rotation4[0], (float)rotation4[1], (float)rotation4[2] }, (float)rotation4[3] } : b3Quat_identity;
	bodyDef.linearVelocity = linearVelocity3 != NULL ? (b3Vec3){ linearVelocity3[0], linearVelocity3[1], linearVelocity3[2] } : b3Vec3_zero;
	bodyDef.angularVelocity = angularVelocity3 != NULL ? (b3Vec3){ angularVelocity3[0], angularVelocity3[1], angularVelocity3[2] } : b3Vec3_zero;
	bodyDef.motionLocks = ReadMotionLocks( locks6 );
	bodyDef.isBullet = isBullet != 0;

	return b3CreateBody( worldId, &bodyDef );
}

static void WriteTransform( double* out7, b3BodyId bodyId )
{
	b3Pos position = b3Body_GetPosition( bodyId );
	b3Quat rotation = b3Body_GetRotation( bodyId );

	out7[0] = position.x;
	out7[1] = position.y;
	out7[2] = position.z;
	out7[3] = rotation.v.x;
	out7[4] = rotation.v.y;
	out7[5] = rotation.v.z;
	out7[6] = rotation.s;
}

EMSCRIPTEN_KEEPALIVE int box3d_hello_init( void )
{
	DestroyHelloState();

	b3WorldDef worldDef = b3DefaultWorldDef();
	worldDef.gravity = (b3Vec3){ 0.0f, -10.0f, 0.0f };
	worldDef.workerCount = 1;

	g_hello.worldId = b3CreateWorld( &worldDef );
	if ( b3World_IsValid( g_hello.worldId ) == false )
	{
		ResetHelloState();
		return 0;
	}

	b3BodyDef groundBodyDef = b3DefaultBodyDef();
	groundBodyDef.position = (b3Pos){ 0.0f, -10.0f, 0.0f };
	b3BodyId groundId = b3CreateBody( g_hello.worldId, &groundBodyDef );

	b3BoxHull groundBox = b3MakeBoxHull( 50.0f, 10.0f, 50.0f );
	b3ShapeDef groundShapeDef = b3DefaultShapeDef();
	b3CreateHullShape( groundId, &groundShapeDef, &groundBox.base );

	b3BodyDef bodyDef = b3DefaultBodyDef();
	bodyDef.type = b3_dynamicBody;
	bodyDef.position = (b3Pos){ 0.0f, 4.0f, 0.0f };
	g_hello.bodyId = b3CreateBody( g_hello.worldId, &bodyDef );

	if ( b3Body_IsValid( g_hello.bodyId ) == false )
	{
		DestroyHelloState();
		return 0;
	}

	b3BoxHull dynamicBox = b3MakeCubeHull( 1.0f );
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	shapeDef.density = 1.0f;
	shapeDef.baseMaterial.friction = 0.3f;
	b3CreateHullShape( g_hello.bodyId, &shapeDef, &dynamicBox.base );

	g_hello.active = true;
	return 1;
}

EMSCRIPTEN_KEEPALIVE void box3d_hello_step( float timeStep, int subStepCount )
{
	if ( g_hello.active == false )
	{
		return;
	}

	b3World_Step( g_hello.worldId, timeStep, subStepCount );
}

EMSCRIPTEN_KEEPALIVE void box3d_hello_get_body_transform( double* out7 )
{
	if ( g_hello.active == false || out7 == NULL )
	{
		return;
	}

	WriteTransform( out7, g_hello.bodyId );
}

EMSCRIPTEN_KEEPALIVE void box3d_hello_destroy( void )
{
	DestroyHelloState();
}

EMSCRIPTEN_KEEPALIVE float box3d_hello_run_demo( int stepCount )
{
	if ( box3d_hello_init() == 0 )
	{
		return 0.0f;
	}

	for ( int i = 0; i < stepCount; ++i )
	{
		box3d_hello_step( 1.0f / 60.0f, 4 );
	}

	double transform[7] = { 0 };
	box3d_hello_get_body_transform( transform );
	box3d_hello_destroy();
	return (float)transform[1];
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_world( float gravityX, float gravityY, float gravityZ, int workerCount )
{
	b3WorldDef worldDef = b3DefaultWorldDef();
	worldDef.gravity = (b3Vec3){ gravityX, gravityY, gravityZ };
	worldDef.workerCount = workerCount > 0 ? workerCount : 1;

	b3WorldId worldId = b3CreateWorld( &worldDef );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return AllocWorldSlot( worldId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_world_custom_filter_enabled( int worldHandle, int enabled )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	if ( enabled != 0 )
	{
		b3World_SetCustomFilterCallback( worldId, Box3DJsCustomFilterCallback, (void*)(intptr_t)worldHandle );
	}
	else
	{
		b3World_SetCustomFilterCallback( worldId, NULL, NULL );
	}
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_world_worker_count( int worldHandle, int workerCount )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	b3World_SetWorkerCount( worldId, workerCount > 0 ? workerCount : 1 );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_world_worker_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetWorkerCount( worldId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_body( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
											   const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_destroy_world( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	b3DestroyWorld( worldId );
	if ( g_world_benchmark_helper_kinds[worldHandle] == 5 )
	{
		DestroyTrees();
	}
	g_world_benchmark_helper_kinds[worldHandle] = 0;
	ReleaseJointsForWorld( worldHandle );
	ReleaseBodiesForWorld( worldHandle );
	ReleaseShapesForWorld( worldHandle );
	g_world_slots[worldHandle].active = false;
	g_world_slots[worldHandle].worldId = b3_nullWorldId;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_step_world( int worldHandle, float timeStep, int subStepCount )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	b3World_Step( worldId, timeStep, subStepCount );
}

enum
{
	BOX3D_JS_BENCHMARK_HELPER_JOINT_GRID = 1,
	BOX3D_JS_BENCHMARK_HELPER_WASHER = 2,
	BOX3D_JS_BENCHMARK_HELPER_LARGE_WORLD = 3,
	BOX3D_JS_BENCHMARK_HELPER_JUNKYARD = 4,
	BOX3D_JS_BENCHMARK_HELPER_TREES_100 = 5,
};

EMSCRIPTEN_KEEPALIVE int box3d_js_create_benchmark_helper( int worldHandle, int helperKind )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	switch ( helperKind )
	{
		case BOX3D_JS_BENCHMARK_HELPER_JOINT_GRID:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			CreateJointGrid( worldId );
			Box3DJsEndBenchmarkTracking();
			break;

		case BOX3D_JS_BENCHMARK_HELPER_WASHER:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			CreateWasher( worldId );
			Box3DJsEndBenchmarkTracking();
			break;

		case BOX3D_JS_BENCHMARK_HELPER_LARGE_WORLD:
			CreateLargeWorld( worldId );
			break;

		case BOX3D_JS_BENCHMARK_HELPER_JUNKYARD:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			CreateJunkyard( worldId );
			Box3DJsEndBenchmarkTracking();
			break;

		case BOX3D_JS_BENCHMARK_HELPER_TREES_100:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			CreateTrees100( worldId );
			Box3DJsEndBenchmarkTracking();
			break;

		default:
			return 0;
	}
	g_world_benchmark_helper_kinds[worldHandle] = helperKind;
	return 1;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_step_benchmark_helper( int worldHandle, int helperKind, int stepCount )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	switch ( helperKind )
	{
		case BOX3D_JS_BENCHMARK_HELPER_LARGE_WORLD:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			StepLargeWorld( worldId, stepCount );
			Box3DJsEndBenchmarkTracking();
			break;

		case BOX3D_JS_BENCHMARK_HELPER_JUNKYARD:
			Box3DJsBeginBenchmarkTracking( worldHandle );
			StepJunkyard( worldId, stepCount );
			Box3DJsEndBenchmarkTracking();
			break;

		default:
			break;
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_world_body_count( int worldHandle )
{
	int count = 0;
	for ( int i = 1; i < BOX3D_JS_MAX_BODIES; ++i )
	{
		if ( g_body_slots[i].active && g_body_slots[i].worldHandle == worldHandle )
		{
			count += 1;
		}
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_world_body_handles( int worldHandle, int* outHandles, int capacity )
{
	if ( outHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	int count = 0;
	for ( int i = 1; i < BOX3D_JS_MAX_BODIES && count < capacity; ++i )
	{
		if ( g_body_slots[i].active && g_body_slots[i].worldHandle == worldHandle )
		{
			outHandles[count++] = i;
		}
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_body_type( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return -1;
	}

	return (int)b3Body_GetType( bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_body_shape_count( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	return b3Body_GetShapeCount( bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_body_shape_handles( int bodyHandle, int* outHandles, int capacity )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || outHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	int shapeCount = b3Body_GetShapeCount( bodyId );
	if ( shapeCount <= 0 )
	{
		return 0;
	}

	b3ShapeId* shapeIds = (b3ShapeId*)malloc( (size_t)shapeCount * sizeof( b3ShapeId ) );
	if ( shapeIds == NULL )
	{
		return 0;
	}

	int copiedCount = b3Body_GetShapes( bodyId, shapeIds, shapeCount );
	int outCount = copiedCount < capacity ? copiedCount : capacity;
	for ( int i = 0; i < outCount; ++i )
	{
		int shapeHandle = FindShapeHandle( shapeIds[i] );
		if ( shapeHandle == 0 )
		{
			shapeHandle = AllocShapeSlot( FindWorldHandle( b3Shape_GetWorld( shapeIds[i] ) ), shapeIds[i] );
		}
		outHandles[i] = shapeHandle;
	}

	free( shapeIds );
	return outCount;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_type( int shapeHandle )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		return -1;
	}

	return (int)b3Shape_GetType( shapeId );
}

EMSCRIPTEN_KEEPALIVE uint32_t box3d_js_get_shape_color( int shapeHandle )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		return 0;
	}

	return b3Shape_GetSurfaceMaterial( shapeId ).customColor;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_shape_sphere( int shapeHandle, float* out4 )
{
	if ( out4 == NULL )
	{
		return;
	}

	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		memset( out4, 0, 4 * sizeof( float ) );
		return;
	}

	b3Sphere sphere = b3Shape_GetSphere( shapeId );
	out4[0] = sphere.center.x;
	out4[1] = sphere.center.y;
	out4[2] = sphere.center.z;
	out4[3] = sphere.radius;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_shape_capsule( int shapeHandle, float* out7 )
{
	if ( out7 == NULL )
	{
		return;
	}

	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		memset( out7, 0, 7 * sizeof( float ) );
		return;
	}

	b3Capsule capsule = b3Shape_GetCapsule( shapeId );
	out7[0] = capsule.center1.x;
	out7[1] = capsule.center1.y;
	out7[2] = capsule.center1.z;
	out7[3] = capsule.center2.x;
	out7[4] = capsule.center2.y;
	out7[5] = capsule.center2.z;
	out7[6] = capsule.radius;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_hull_point_count( int shapeHandle )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false )
	{
		return 0;
	}

	const b3HullData* hull = b3Shape_GetHull( shapeId );
	return hull != NULL ? hull->vertexCount : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_hull_points( int shapeHandle, float* outPoints3, int capacity )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || outPoints3 == NULL || capacity <= 0 )
	{
		return 0;
	}

	const b3HullData* hull = b3Shape_GetHull( shapeId );
	if ( hull == NULL )
	{
		return 0;
	}

	const b3Vec3* points = (const b3Vec3*)( (const char*)hull + hull->pointOffset );
	int count = hull->vertexCount < capacity ? hull->vertexCount : capacity;
	for ( int i = 0; i < count; ++i )
	{
		outPoints3[3 * i + 0] = points[i].x;
		outPoints3[3 * i + 1] = points[i].y;
		outPoints3[3 * i + 2] = points[i].z;
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_shape_mesh_scale( int shapeHandle, float* out3 )
{
	if ( out3 == NULL )
	{
		return;
	}

	out3[0] = 1.0f;
	out3[1] = 1.0f;
	out3[2] = 1.0f;

	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || b3Shape_GetType( shapeId ) != b3_meshShape )
	{
		return;
	}

	b3Mesh mesh = b3Shape_GetMesh( shapeId );
	out3[0] = mesh.scale.x;
	out3[1] = mesh.scale.y;
	out3[2] = mesh.scale.z;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_mesh_vertex_count( int shapeHandle )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || b3Shape_GetType( shapeId ) != b3_meshShape )
	{
		return 0;
	}

	b3Mesh mesh = b3Shape_GetMesh( shapeId );
	return mesh.data != NULL ? mesh.data->vertexCount : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_mesh_vertices( int shapeHandle, float* outVertices3, int capacity )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || b3Shape_GetType( shapeId ) != b3_meshShape || outVertices3 == NULL || capacity <= 0 )
	{
		return 0;
	}

	b3Mesh mesh = b3Shape_GetMesh( shapeId );
	if ( mesh.data == NULL )
	{
		return 0;
	}

	const b3Vec3* vertices = b3GetMeshVertices( mesh.data );
	if ( vertices == NULL )
	{
		return 0;
	}

	int count = mesh.data->vertexCount < capacity ? mesh.data->vertexCount : capacity;
	for ( int i = 0; i < count; ++i )
	{
		outVertices3[3 * i + 0] = vertices[i].x;
		outVertices3[3 * i + 1] = vertices[i].y;
		outVertices3[3 * i + 2] = vertices[i].z;
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_mesh_triangle_count( int shapeHandle )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || b3Shape_GetType( shapeId ) != b3_meshShape )
	{
		return 0;
	}

	b3Mesh mesh = b3Shape_GetMesh( shapeId );
	return mesh.data != NULL ? mesh.data->triangleCount : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_shape_mesh_triangles( int shapeHandle, int* outTriangles3, int capacity )
{
	b3ShapeId shapeId = LookupShape( shapeHandle );
	if ( b3Shape_IsValid( shapeId ) == false || b3Shape_GetType( shapeId ) != b3_meshShape || outTriangles3 == NULL || capacity <= 0 )
	{
		return 0;
	}

	b3Mesh mesh = b3Shape_GetMesh( shapeId );
	if ( mesh.data == NULL )
	{
		return 0;
	}

	const b3MeshTriangle* triangles = b3GetMeshTriangles( mesh.data );
	if ( triangles == NULL )
	{
		return 0;
	}

	int count = mesh.data->triangleCount < capacity ? mesh.data->triangleCount : capacity;
	for ( int i = 0; i < count; ++i )
	{
		outTriangles3[3 * i + 0] = triangles[i].index1;
		outTriangles3[3 * i + 1] = triangles[i].index2;
		outTriangles3[3 * i + 2] = triangles[i].index3;
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_world_contact_tuning( int worldHandle, float hertz, float dampingRatio, float contactSpeed )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	b3World_SetContactTuning( worldId, hertz, dampingRatio, contactSpeed );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_world_awake_body_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetAwakeBodyCount( worldId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_body_first_shape_mesh_material_count( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	int shapeCount = b3Body_GetShapeCount( bodyId );
	if ( shapeCount <= 0 )
	{
		return 0;
	}

	b3ShapeId shapeId = b3_nullShapeId;
	int copied = b3Body_GetShapes( bodyId, &shapeId, 1 );
	if ( copied <= 0 || b3Shape_IsValid( shapeId ) == false )
	{
		return 0;
	}

	return b3Shape_GetMeshMaterialCount( shapeId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_first_shape_mesh_material( int bodyHandle, int materialIndex, double* outValues8 )
{
	if ( outValues8 == NULL )
	{
		return;
	}

	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	int shapeCount = b3Body_GetShapeCount( bodyId );
	if ( shapeCount <= 0 )
	{
		return;
	}

	b3ShapeId shapeId = b3_nullShapeId;
	int copied = b3Body_GetShapes( bodyId, &shapeId, 1 );
	if ( copied <= 0 || b3Shape_IsValid( shapeId ) == false )
	{
		return;
	}

	int materialCount = b3Shape_GetMeshMaterialCount( shapeId );
	if ( materialIndex < 0 || materialIndex >= materialCount )
	{
		return;
	}

	b3SurfaceMaterial material = b3Shape_GetMeshSurfaceMaterial( shapeId, materialIndex );
	outValues8[0] = material.friction;
	outValues8[1] = material.restitution;
	outValues8[2] = material.rollingResistance;
	outValues8[3] = material.tangentVelocity.x;
	outValues8[4] = material.tangentVelocity.y;
	outValues8[5] = material.tangentVelocity.z;
	outValues8[6] = (double)material.userMaterialId;
	outValues8[7] = (double)material.customColor;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_world_counters( int worldHandle, int* out37 )
{
	if ( out37 == NULL )
	{
		return;
	}

	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		for ( int i = 0; i < 37; ++i )
		{
			out37[i] = 0;
		}
		return;
	}

	b3Counters counters = b3World_GetCounters( worldId );
	out37[0] = counters.bodyCount;
	out37[1] = counters.shapeCount;
	out37[2] = counters.contactCount;
	out37[3] = counters.jointCount;
	out37[4] = counters.islandCount;
	out37[5] = counters.stackUsed;
	out37[6] = counters.arenaCapacity;
	out37[7] = counters.staticTreeHeight;
	out37[8] = counters.treeHeight;
	out37[9] = counters.satCallCount;
	out37[10] = counters.satCacheHitCount;
	out37[11] = counters.byteCount;
	out37[12] = counters.taskCount;
	for ( int i = 0; i < 24; ++i )
	{
		out37[13 + i] = counters.colorCounts[i];
	}
}

EMSCRIPTEN_KEEPALIVE void box3d_js_world_cast_ray_closest( int worldHandle, const float* origin3, const float* translation3, const int* filter2, double* outValues10 )
{
	if ( outValues10 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 10; ++i )
	{
		outValues10[i] = 0.0;
	}

	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || origin3 == NULL || translation3 == NULL )
	{
		return;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3RayResult result = b3World_CastRayClosest( worldId, (b3Pos){ origin3[0], origin3[1], origin3[2] },
												 (b3Vec3){ translation3[0], translation3[1], translation3[2] }, filter );
	if ( result.hit == false )
	{
		return;
	}

	outValues10[0] = 1.0;
	outValues10[1] = result.point.x;
	outValues10[2] = result.point.y;
	outValues10[3] = result.point.z;
	outValues10[4] = result.normal.x;
	outValues10[5] = result.normal.y;
	outValues10[6] = result.normal.z;
	outValues10[7] = result.fraction;
	outValues10[8] = (double)result.triangleIndex;
	outValues10[9] = (double)result.childIndex;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_world_cast_shape_closest( int worldHandle, const float* points3, int pointCount, float radius, const float* translation3,
															 float maxFraction, const int* filter2, int ignoreInitialOverlap,
															 double* outValues10 )
{
	if ( outValues10 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 10; ++i )
	{
		outValues10[i] = 0.0;
	}

	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || points3 == NULL || pointCount <= 0 || translation3 == NULL )
	{
		return;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3ShapeProxy proxy = {
		.points = (const b3Vec3*)points3,
		.count = pointCount,
		.radius = radius,
	};

	Box3DJsCastClosestContext context = {
		.ignoreInitialOverlap = ignoreInitialOverlap != 0,
	};

	float clampedFraction = maxFraction;
	if ( clampedFraction < 0.0f )
	{
		clampedFraction = 0.0f;
	}
	else if ( clampedFraction > 1.0f )
	{
		clampedFraction = 1.0f;
	}

	b3Vec3 translation = {
		clampedFraction * translation3[0],
		clampedFraction * translation3[1],
		clampedFraction * translation3[2],
	};

	b3World_CastShape( worldId, b3Pos_zero, &proxy, translation, filter, Box3DJsCastClosestCallback, &context );
	if ( context.hit == false )
	{
		return;
	}

	outValues10[0] = 1.0;
	outValues10[1] = context.point.x;
	outValues10[2] = context.point.y;
	outValues10[3] = context.point.z;
	outValues10[4] = context.normal.x;
	outValues10[5] = context.normal.y;
	outValues10[6] = context.normal.z;
	outValues10[7] = context.fraction;
	outValues10[8] = (double)context.triangleIndex;
	outValues10[9] = (double)context.childIndex;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_world_overlap_shape( int worldHandle, const float* points3, int pointCount, float radius, const int* filter2 )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || points3 == NULL || pointCount <= 0 )
	{
		return 0;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3ShapeProxy proxy = {
		.points = (const b3Vec3*)points3,
		.count = pointCount,
		.radius = radius,
	};

	Box3DJsOverlapContext context = {
		.hit = false,
	};

	b3World_OverlapShape( worldId, b3Pos_zero, &proxy, filter, Box3DJsOverlapAnyCallback, &context );
	return context.hit ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_shape_distance( const float* pointsA3, int pointCountA, float radiusA, const double* transformA7,
												   const float* pointsB3, int pointCountB, float radiusB, const double* transformB7,
												   int useRadii, double* outValues12 )
{
	if ( outValues12 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 12; ++i )
	{
		outValues12[i] = 0.0;
	}

	if ( pointsA3 == NULL || pointCountA <= 0 || transformA7 == NULL || pointsB3 == NULL || pointCountB <= 0 || transformB7 == NULL )
	{
		return;
	}

	b3ShapeProxy proxyA = {
		.points = (const b3Vec3*)pointsA3,
		.count = pointCountA,
		.radius = radiusA,
	};

	b3ShapeProxy proxyB = {
		.points = (const b3Vec3*)pointsB3,
		.count = pointCountB,
		.radius = radiusB,
	};

	b3WorldTransform transformA = {
		(b3Pos){ transformA7[0], transformA7[1], transformA7[2] },
		(b3Quat){ { (float)transformA7[3], (float)transformA7[4], (float)transformA7[5] }, (float)transformA7[6] },
	};

	b3WorldTransform transformB = {
		(b3Pos){ transformB7[0], transformB7[1], transformB7[2] },
		(b3Quat){ { (float)transformB7[3], (float)transformB7[4], (float)transformB7[5] }, (float)transformB7[6] },
	};

	b3DistanceInput input = {
		.proxyA = proxyA,
		.proxyB = proxyB,
		.transform = b3InvMulWorldTransforms( transformA, transformB ),
		.useRadii = useRadii != 0,
	};

	b3SimplexCache cache = b3_emptyDistanceCache;
	b3DistanceOutput output = b3ShapeDistance( &input, &cache, NULL, 0 );

	b3Pos pointA = b3TransformWorldPoint( transformA, output.pointA );
	b3Pos pointB = b3TransformWorldPoint( transformA, output.pointB );
	b3Vec3 normal = b3RotateVector( transformA.q, output.normal );

	outValues12[0] = pointA.x;
	outValues12[1] = pointA.y;
	outValues12[2] = pointA.z;
	outValues12[3] = pointB.x;
	outValues12[4] = pointB.y;
	outValues12[5] = pointB.z;
	outValues12[6] = normal.x;
	outValues12[7] = normal.y;
	outValues12[8] = normal.z;
	outValues12[9] = output.distance;
	outValues12[10] = (double)output.iterations;
	outValues12[11] = (double)output.simplexCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_spheres( const float* sphereA4, const double* transformA7, const float* sphereB4, const double* transformB7,
													int pointCapacity, double* outValues )
{
	if ( sphereA4 == NULL || sphereB4 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3Sphere sphereA = { { sphereA4[0], sphereA4[1], sphereA4[2] }, sphereA4[3] };
	b3Sphere sphereB = { { sphereB4[0], sphereB4[1], sphereB4[2] }, sphereB4[3] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideSpheres( &manifold, pointCapacity, &sphereA, &sphereB, b3InvMulWorldTransforms( transformA, transformB ) );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_capsule_and_sphere( const float* capsuleA7, const double* transformA7, const float* sphereB4,
															   const double* transformB7, int pointCapacity, double* outValues )
{
	if ( capsuleA7 == NULL || sphereB4 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3Capsule capsuleA = { { capsuleA7[0], capsuleA7[1], capsuleA7[2] }, { capsuleA7[3], capsuleA7[4], capsuleA7[5] }, capsuleA7[6] };
	b3Sphere sphereB = { { sphereB4[0], sphereB4[1], sphereB4[2] }, sphereB4[3] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideCapsuleAndSphere( &manifold, pointCapacity, &capsuleA, &sphereB, b3InvMulWorldTransforms( transformA, transformB ) );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_hull_and_sphere( const float* pointsA3, int pointCountA, const double* transformA7, const float* sphereB4,
															const double* transformB7, int pointCapacity, double* outValues )
{
	if ( pointsA3 == NULL || pointCountA <= 0 || sphereB4 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3HullData* hullA = Box3DJsCreateHullFromPoints( pointsA3, pointCountA );
	if ( hullA == NULL )
	{
		return;
	}

	b3Sphere sphereB = { { sphereB4[0], sphereB4[1], sphereB4[2] }, sphereB4[3] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3SimplexCache cache = b3_emptyDistanceCache;
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		b3DestroyHull( hullA );
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideHullAndSphere( &manifold, pointCapacity, hullA, &sphereB, b3InvMulWorldTransforms( transformA, transformB ), &cache );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
	b3DestroyHull( hullA );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_capsules( const float* capsuleA7, const double* transformA7, const float* capsuleB7, const double* transformB7,
													 int pointCapacity, double* outValues )
{
	if ( capsuleA7 == NULL || capsuleB7 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3Capsule capsuleA = { { capsuleA7[0], capsuleA7[1], capsuleA7[2] }, { capsuleA7[3], capsuleA7[4], capsuleA7[5] }, capsuleA7[6] };
	b3Capsule capsuleB = { { capsuleB7[0], capsuleB7[1], capsuleB7[2] }, { capsuleB7[3], capsuleB7[4], capsuleB7[5] }, capsuleB7[6] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideCapsules( &manifold, pointCapacity, &capsuleA, &capsuleB, b3InvMulWorldTransforms( transformA, transformB ) );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_hull_and_capsule( const float* pointsA3, int pointCountA, const double* transformA7, const float* capsuleB7,
															 const double* transformB7, int pointCapacity, double* outValues )
{
	if ( pointsA3 == NULL || pointCountA <= 0 || capsuleB7 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3HullData* hullA = Box3DJsCreateHullFromPoints( pointsA3, pointCountA );
	if ( hullA == NULL )
	{
		return;
	}

	b3Capsule capsuleB = { { capsuleB7[0], capsuleB7[1], capsuleB7[2] }, { capsuleB7[3], capsuleB7[4], capsuleB7[5] }, capsuleB7[6] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3SimplexCache cache = b3_emptyDistanceCache;
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		b3DestroyHull( hullA );
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideHullAndCapsule( &manifold, pointCapacity, hullA, &capsuleB, b3InvMulWorldTransforms( transformA, transformB ), &cache );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
	b3DestroyHull( hullA );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_hulls( const float* pointsA3, int pointCountA, const double* transformA7, const float* pointsB3, int pointCountB,
												  const double* transformB7, int pointCapacity, double* outValues )
{
	if ( pointsA3 == NULL || pointCountA <= 0 || pointsB3 == NULL || pointCountB <= 0 || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3HullData* hullA = Box3DJsCreateHullFromPoints( pointsA3, pointCountA );
	b3HullData* hullB = Box3DJsCreateHullFromPoints( pointsB3, pointCountB );
	if ( hullA == NULL || hullB == NULL )
	{
		if ( hullA != NULL ) b3DestroyHull( hullA );
		if ( hullB != NULL ) b3DestroyHull( hullB );
		return;
	}

	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3SATCache cache = { 0 };
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		b3DestroyHull( hullA );
		b3DestroyHull( hullB );
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideHulls( &manifold, pointCapacity, hullA, hullB, b3InvMulWorldTransforms( transformA, transformB ), &cache );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
	b3DestroyHull( hullA );
	b3DestroyHull( hullB );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_sphere_and_triangle( const float* sphereA4, const double* transformA7, const float* triangleB9,
																const double* transformB7, int pointCapacity, double* outValues )
{
	if ( sphereA4 == NULL || triangleB9 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3Sphere sphereA = { { sphereA4[0], sphereA4[1], sphereA4[2] }, sphereA4[3] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3WorldTransform xf = b3InvMulWorldTransforms( transformA, transformB );
	b3Vec3 triangle[3] = {
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[0] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[1] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[2] ),
	};
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideSphereAndTriangle( &manifold, pointCapacity, &sphereA, triangle );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_capsule_and_triangle( const float* capsuleA7, const double* transformA7, const float* triangleB9,
																 const double* transformB7, int pointCapacity, double* outValues )
{
	if ( capsuleA7 == NULL || triangleB9 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3Capsule capsuleA = { { capsuleA7[0], capsuleA7[1], capsuleA7[2] }, { capsuleA7[3], capsuleA7[4], capsuleA7[5] }, capsuleA7[6] };
	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3WorldTransform xf = b3InvMulWorldTransforms( transformA, transformB );
	b3Vec3 triangle[3] = {
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[0] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[1] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[2] ),
	};
	b3SimplexCache cache = b3_emptyDistanceCache;
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideCapsuleAndTriangle( &manifold, pointCapacity, &capsuleA, triangle, &cache );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_collide_hull_and_triangle( const float* pointsA3, int pointCountA, const double* transformA7, const float* triangleB9,
															  const double* transformB7, int triangleFlags, int pointCapacity, double* outValues )
{
	if ( pointsA3 == NULL || pointCountA <= 0 || triangleB9 == NULL || transformA7 == NULL || transformB7 == NULL || pointCapacity <= 0 )
	{
		Box3DJsWriteWorldManifold( NULL, b3WorldTransform_identity, pointCapacity > 0 ? pointCapacity : 0, outValues );
		return;
	}

	b3HullData* hullA = Box3DJsCreateHullFromPoints( pointsA3, pointCountA );
	if ( hullA == NULL )
	{
		return;
	}

	b3WorldTransform transformA = Box3DJsReadWorldTransform( transformA7 );
	b3WorldTransform transformB = Box3DJsReadWorldTransform( transformB7 );
	b3WorldTransform xf = b3InvMulWorldTransforms( transformA, transformB );
	b3Vec3 triangle[3] = {
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[0] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[1] ),
		b3TransformPoint( xf, ((const b3Vec3*)triangleB9)[2] ),
	};
	b3SATCache cache = { 0 };
	b3LocalManifoldPoint* points = (b3LocalManifoldPoint*)malloc( (size_t)pointCapacity * sizeof( b3LocalManifoldPoint ) );
	if ( points == NULL )
	{
		b3DestroyHull( hullA );
		return;
	}

	b3LocalManifold manifold = { 0 };
	manifold.points = points;
	b3CollideHullAndTriangle( &manifold, pointCapacity, hullA, triangle[0], triangle[1], triangle[2], triangleFlags, &cache );
	Box3DJsWriteWorldManifold( &manifold, transformA, pointCapacity, outValues );
	free( points );
	b3DestroyHull( hullA );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_time_of_impact( const float* pointsA3, int pointCountA, float radiusA, const double* sweepA14,
												   const float* pointsB3, int pointCountB, float radiusB, const double* sweepB14,
												   float maxFraction, double* outValues12 )
{
	if ( outValues12 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 12; ++i )
	{
		outValues12[i] = 0.0;
	}

	if ( pointsA3 == NULL || pointCountA <= 0 || sweepA14 == NULL || pointsB3 == NULL || pointCountB <= 0 || sweepB14 == NULL )
	{
		return;
	}

	b3ShapeProxy proxyA = {
		.points = (const b3Vec3*)pointsA3,
		.count = pointCountA,
		.radius = radiusA,
	};

	b3ShapeProxy proxyB = {
		.points = (const b3Vec3*)pointsB3,
		.count = pointCountB,
		.radius = radiusB,
	};

	b3Sweep sweepA = {
		.localCenter = { (float)sweepA14[0], (float)sweepA14[1], (float)sweepA14[2] },
		.c1 = { sweepA14[3], sweepA14[4], sweepA14[5] },
		.c2 = { sweepA14[6], sweepA14[7], sweepA14[8] },
		.q1 = { { (float)sweepA14[9], (float)sweepA14[10], (float)sweepA14[11] }, (float)sweepA14[12] },
		.q2 = { { (float)sweepA14[13], (float)sweepA14[14], (float)sweepA14[15] }, (float)sweepA14[16] },
	};

	b3Sweep sweepB = {
		.localCenter = { (float)sweepB14[0], (float)sweepB14[1], (float)sweepB14[2] },
		.c1 = { sweepB14[3], sweepB14[4], sweepB14[5] },
		.c2 = { sweepB14[6], sweepB14[7], sweepB14[8] },
		.q1 = { { (float)sweepB14[9], (float)sweepB14[10], (float)sweepB14[11] }, (float)sweepB14[12] },
		.q2 = { { (float)sweepB14[13], (float)sweepB14[14], (float)sweepB14[15] }, (float)sweepB14[16] },
	};

	b3TOIInput input = {
		.proxyA = proxyA,
		.proxyB = proxyB,
		.sweepA = sweepA,
		.sweepB = sweepB,
		.maxFraction = maxFraction,
	};

	b3TOIOutput output = b3TimeOfImpact( &input );

	outValues12[0] = (double)output.state;
	outValues12[1] = output.point.x;
	outValues12[2] = output.point.y;
	outValues12[3] = output.point.z;
	outValues12[4] = output.normal.x;
	outValues12[5] = output.normal.y;
	outValues12[6] = output.normal.z;
	outValues12[7] = output.fraction;
	outValues12[8] = output.distance;
	outValues12[9] = (double)output.distanceIterations;
	outValues12[10] = (double)output.pushBackIterations;
	outValues12[11] = (double)output.rootIterations;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_body_cast_ray( int bodyHandle, const float* origin3, const float* translation3, const int* filter2, float maxFraction,
												  double* outValues9 )
{
	if ( outValues9 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 9; ++i )
	{
		outValues9[i] = 0.0;
	}

	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || origin3 == NULL || translation3 == NULL )
	{
		return;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3BodyCastResult result = b3Body_CastRay( bodyId, (b3Pos){ origin3[0], origin3[1], origin3[2] }, (b3Vec3){ translation3[0], translation3[1], translation3[2] },
											  filter, maxFraction, b3WorldTransform_identity );
	if ( result.hit == false )
	{
		return;
	}

	outValues9[0] = 1.0;
	outValues9[1] = result.point.x;
	outValues9[2] = result.point.y;
	outValues9[3] = result.point.z;
	outValues9[4] = result.fraction;
	outValues9[5] = (double)result.triangleIndex;
	outValues9[6] = result.normal.x;
	outValues9[7] = result.normal.y;
	outValues9[8] = result.normal.z;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_body_cast_shape( int bodyHandle, const double* bodyTransform7, const float* origin3, const float* points3, int pointCount,
													float radius, const float* translation3, const int* filter2, float maxFraction, int canEncroach,
													double* outValues9 )
{
	if ( outValues9 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 9; ++i )
	{
		outValues9[i] = 0.0;
	}

	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || bodyTransform7 == NULL || origin3 == NULL || points3 == NULL || pointCount <= 0 || translation3 == NULL )
	{
		return;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3ShapeProxy proxy = {
		.points = (const b3Vec3*)points3,
		.count = pointCount,
		.radius = radius,
	};

	b3WorldTransform bodyTransform = {
		(b3Pos){ bodyTransform7[0], bodyTransform7[1], bodyTransform7[2] },
		(b3Quat){ { (float)bodyTransform7[3], (float)bodyTransform7[4], (float)bodyTransform7[5] }, (float)bodyTransform7[6] },
	};

	b3BodyCastResult result = b3Body_CastShape(
		bodyId,
		(b3Pos){ origin3[0], origin3[1], origin3[2] },
		&proxy,
		(b3Vec3){ translation3[0], translation3[1], translation3[2] },
		filter,
		maxFraction,
		canEncroach != 0,
		bodyTransform
	);
	if ( result.hit == false )
	{
		return;
	}

	outValues9[0] = 1.0;
	outValues9[1] = result.point.x;
	outValues9[2] = result.point.y;
	outValues9[3] = result.point.z;
	outValues9[4] = result.fraction;
	outValues9[5] = (double)result.triangleIndex;
	outValues9[6] = result.normal.x;
	outValues9[7] = result.normal.y;
	outValues9[8] = result.normal.z;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_body_overlap_shape( int bodyHandle, const double* bodyTransform7, const float* origin3, const float* points3, int pointCount,
													  float radius, const int* filter2 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || bodyTransform7 == NULL || origin3 == NULL || points3 == NULL || pointCount <= 0 )
	{
		return 0;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3ShapeProxy proxy = {
		.points = (const b3Vec3*)points3,
		.count = pointCount,
		.radius = radius,
	};

	b3WorldTransform bodyTransform = {
		(b3Pos){ bodyTransform7[0], bodyTransform7[1], bodyTransform7[2] },
		(b3Quat){ { (float)bodyTransform7[3], (float)bodyTransform7[4], (float)bodyTransform7[5] }, (float)bodyTransform7[6] },
	};

	return b3Body_OverlapShape(
		bodyId,
		(b3Pos){ origin3[0], origin3[1], origin3[2] },
		&proxy,
		filter,
		bodyTransform
	) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_body_collide_mover( int bodyHandle, const double* bodyTransform7, const float* origin3, const float* capsule7, const int* filter2,
													  int maxPlanes, double* outPlanes7 )
{
	if ( outPlanes7 == NULL || maxPlanes <= 0 )
	{
		return 0;
	}

	for ( int i = 0; i < 7 * maxPlanes; ++i )
	{
		outPlanes7[i] = 0.0;
	}

	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || bodyTransform7 == NULL || origin3 == NULL || capsule7 == NULL )
	{
		return 0;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3Capsule mover = {
		{ capsule7[0], capsule7[1], capsule7[2] },
		{ capsule7[3], capsule7[4], capsule7[5] },
		capsule7[6],
	};

	b3WorldTransform bodyTransform = {
		(b3Pos){ bodyTransform7[0], bodyTransform7[1], bodyTransform7[2] },
		(b3Quat){ { (float)bodyTransform7[3], (float)bodyTransform7[4], (float)bodyTransform7[5] }, (float)bodyTransform7[6] },
	};

	b3BodyPlaneResult* bodyPlanes = malloc( (size_t)maxPlanes * sizeof( b3BodyPlaneResult ) );
	if ( bodyPlanes == NULL )
	{
		return 0;
	}

	int count = b3Body_CollideMover(
		bodyId,
		bodyPlanes,
		maxPlanes,
		(b3Pos){ origin3[0], origin3[1], origin3[2] },
		&mover,
		filter,
		bodyTransform
	);

	for ( int i = 0; i < count; ++i )
	{
		const int base = 7 * i;
		outPlanes7[base + 0] = bodyPlanes[i].result.plane.normal.x;
		outPlanes7[base + 1] = bodyPlanes[i].result.plane.normal.y;
		outPlanes7[base + 2] = bodyPlanes[i].result.plane.normal.z;
		outPlanes7[base + 3] = bodyPlanes[i].result.plane.offset;
		outPlanes7[base + 4] = bodyPlanes[i].result.point.x;
		outPlanes7[base + 5] = bodyPlanes[i].result.point.y;
		outPlanes7[base + 6] = bodyPlanes[i].result.point.z;
	}

	free( bodyPlanes );
	return count;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_world_collide_mover( int worldHandle, const double* origin3, const float* capsule7, const int* filter2, int maxPlanes,
													   double* outPlanes7 )
{
	if ( outPlanes7 == NULL || maxPlanes <= 0 )
	{
		return 0;
	}

	for ( int i = 0; i < 7 * maxPlanes; ++i )
	{
		outPlanes7[i] = 0.0;
	}

	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || origin3 == NULL || capsule7 == NULL )
	{
		return 0;
	}

	b3QueryFilter filter = b3DefaultQueryFilter();
	if ( filter2 != NULL )
	{
		filter.categoryBits = (uint64_t)(uint32_t)filter2[0];
		filter.maskBits = (uint64_t)(uint32_t)filter2[1];
	}

	b3Capsule mover = {
		{ capsule7[0], capsule7[1], capsule7[2] },
		{ capsule7[3], capsule7[4], capsule7[5] },
		capsule7[6],
	};

	Box3DJsPlaneGatherContext context = {
		.outValues = outPlanes7,
		.capacity = maxPlanes,
		.count = 0,
	};

	b3World_CollideMover( worldId, (b3Pos){ origin3[0], origin3[1], origin3[2] }, &mover, filter, Box3DJsGatherPlaneCallback, &context );
	return context.count;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_solve_planes( const float* targetDelta3, const double* planes7, int planeCount, double* outValues4 )
{
	if ( outValues4 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 4; ++i )
	{
		outValues4[i] = 0.0;
	}

	if ( planes7 == NULL || planeCount <= 0 )
	{
		return;
	}

	b3CollisionPlane* planes = malloc( (size_t)planeCount * sizeof( b3CollisionPlane ) );
	if ( planes == NULL )
	{
		return;
	}

	for ( int i = 0; i < planeCount; ++i )
	{
		const int base = 7 * i;
		planes[i].plane.normal = (b3Vec3){ (float)planes7[base + 0], (float)planes7[base + 1], (float)planes7[base + 2] };
		planes[i].plane.offset = (float)planes7[base + 3];
		planes[i].pushLimit = FLT_MAX;
		planes[i].push = 0.0f;
		planes[i].clipVelocity = true;
	}

	b3Vec3 targetDelta = b3Vec3_zero;
	if ( targetDelta3 != NULL )
	{
		targetDelta = (b3Vec3){ targetDelta3[0], targetDelta3[1], targetDelta3[2] };
	}

	b3PlaneSolverResult result = b3SolvePlanes( targetDelta, planes, planeCount );
	free( planes );

	outValues4[0] = result.delta.x;
	outValues4[1] = result.delta.y;
	outValues4[2] = result.delta.z;
	outValues4[3] = (double)result.iterationCount;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_box( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
											  const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float hx, float hy, float hz,
											  float density, float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3,
											  int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	b3BoxHull hull = b3MakeBoxHull( hx, hy, hz );
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateHullShape( bodyId, &shapeDef, &hull.base );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_sphere( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												 const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float radius, float density,
												 float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3,
												 int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	b3Sphere sphere = { { 0.0f, 0.0f, 0.0f }, radius };
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateSphereShape( bodyId, &shapeDef, &sphere );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_capsule( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												  const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, const float* capsule7,
												  float density, float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3,
												  int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false || capsule7 == NULL )
	{
		return 0;
	}

	b3Capsule capsule = {
		{ capsule7[0], capsule7[1], capsule7[2] },
		{ capsule7[3], capsule7[4], capsule7[5] },
		capsule7[6],
	};
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateCapsuleShape( bodyId, &shapeDef, &capsule );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_cylinder( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												   const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float height, float radius,
												   float yOffset, int sides, const float* scale3, float density, float friction, float restitution,
												   float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
												   int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	b3HullData* hull = b3CreateCylinder( height, radius, yOffset, sides );
	if ( hull == NULL )
	{
		b3DestroyBody( bodyId );
		return 0;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );

	if ( scale3 != NULL )
	{
		b3CreateTransformedHullShape( bodyId, &shapeDef, hull, b3Transform_identity, (b3Vec3){ scale3[0], scale3[1], scale3[2] } );
	}
	else
	{
		b3CreateHullShape( bodyId, &shapeDef, hull );
	}

	b3DestroyHull( hull );
	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_hull( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
											   const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, const float* points3,
											   int pointCount, int maxVertexCount, const float* scale3, float density, float friction, float restitution,
											   float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
											   int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false || points3 == NULL || pointCount <= 0 )
	{
		return 0;
	}

	const b3Vec3* points = (const b3Vec3*)points3;
	b3HullData* hull = b3CreateHull( points, pointCount, maxVertexCount > 0 ? maxVertexCount : pointCount );
	if ( hull == NULL )
	{
		b3DestroyBody( bodyId );
		return 0;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );

	if ( scale3 != NULL )
	{
		b3CreateTransformedHullShape( bodyId, &shapeDef, hull, b3Transform_identity, (b3Vec3){ scale3[0], scale3[1], scale3[2] } );
	}
	else
	{
		b3CreateHullShape( bodyId, &shapeDef, hull );
	}

	b3DestroyHull( hull );
	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_hull_data( const float* points3, int pointCount, int maxVertexCount )
{
	if ( points3 == NULL || pointCount <= 0 )
	{
		return 0;
	}

	b3HullData* hull = b3CreateHull( (const b3Vec3*)points3, pointCount, maxVertexCount > 0 ? maxVertexCount : pointCount );
	return (int)(intptr_t)hull;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_clone_and_transform_hull_data( int hullHandle, const double* transform7, const float* scale3 )
{
	if ( hullHandle == 0 )
	{
		return 0;
	}

	const b3HullData* hull = (const b3HullData*)(intptr_t)hullHandle;
	b3Transform transform = b3Transform_identity;
	if ( transform7 != NULL )
	{
		transform.p = (b3Pos){ transform7[0], transform7[1], transform7[2] };
		transform.q = (b3Quat){ { (float)transform7[3], (float)transform7[4], (float)transform7[5] }, (float)transform7[6] };
	}

	b3Vec3 scale = scale3 != NULL ? (b3Vec3){ scale3[0], scale3[1], scale3[2] } : b3Vec3_one;
	b3HullData* clone = b3CloneAndTransformHull( hull, transform, scale );
	return (int)(intptr_t)clone;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_destroy_hull_data( int hullHandle )
{
	if ( hullHandle == 0 )
	{
		return;
	}

	b3DestroyHull( (b3HullData*)(intptr_t)hullHandle );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_hull_surface_area( int hullHandle )
{
	if ( hullHandle == 0 )
	{
		return 0.0f;
	}

	return ( (const b3HullData*)(intptr_t)hullHandle )->surfaceArea;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_box_shape( int bodyHandle, float hx, float hy, float hz, const float* localPosition3,
												  const double* localRotation4, float density, float friction, float restitution,
												  float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
												  int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Transform transform = b3Transform_identity;
	if ( localPosition3 != NULL )
	{
		transform.p = (b3Pos){ localPosition3[0], localPosition3[1], localPosition3[2] };
	}
	if ( localRotation4 != NULL )
	{
		transform.q = (b3Quat){ { (float)localRotation4[0], (float)localRotation4[1], (float)localRotation4[2] }, (float)localRotation4[3] };
	}

	b3BoxHull hull = b3MakeTransformedBoxHull( hx, hy, hz, transform );
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateHullShape( bodyId, &shapeDef, &hull.base );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_sphere_shape( int bodyHandle, float centerX, float centerY, float centerZ, float radius, float density,
													 float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3,
													 int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Sphere sphere = { { centerX, centerY, centerZ }, radius };
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateSphereShape( bodyId, &shapeDef, &sphere );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_capsule_shape( int bodyHandle, const float* capsule7, float density, float friction, float restitution,
													  float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
													  int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || capsule7 == NULL )
	{
		return;
	}

	b3Capsule capsule = {
		{ capsule7[0], capsule7[1], capsule7[2] },
		{ capsule7[3], capsule7[4], capsule7[5] },
		capsule7[6],
	};
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3CreateCapsuleShape( bodyId, &shapeDef, &capsule );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_grid_mesh( int xCount, int zCount, float cellWidth, int materialCount, int identifyEdges )
{
	b3MeshData* mesh = b3CreateGridMesh( xCount, zCount, cellWidth, materialCount, identifyEdges != 0 );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_wave_mesh( int xCount, int zCount, float cellWidth, float amplitude, float rowFrequency,
													float columnFrequency )
{
	b3MeshData* mesh = b3CreateWaveMesh( xCount, zCount, cellWidth, amplitude, rowFrequency, columnFrequency );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_torus_mesh( int radialResolution, int tubularResolution, float radius, float thickness )
{
	b3MeshData* mesh = b3CreateTorusMesh( radialResolution, tubularResolution, radius, thickness );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_box_mesh( float centerX, float centerY, float centerZ, float extentX, float extentY, float extentZ,
												   int identifyEdges )
{
	b3MeshData* mesh = b3CreateBoxMesh( (b3Vec3){ centerX, centerY, centerZ }, (b3Vec3){ extentX, extentY, extentZ }, identifyEdges != 0 );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_hollow_box_mesh( float centerX, float centerY, float centerZ, float extentX, float extentY,
														  float extentZ )
{
	b3MeshData* mesh = b3CreateHollowBoxMesh( (b3Vec3){ centerX, centerY, centerZ }, (b3Vec3){ extentX, extentY, extentZ } );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_platform_mesh( float centerX, float centerY, float centerZ, float height, float topWidth,
														float bottomWidth )
{
	b3MeshData* mesh = b3CreatePlatformMesh( (b3Vec3){ centerX, centerY, centerZ }, height, topWidth, bottomWidth );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_mesh( const float* vertices3, int vertexCount, const int* indices3, int triangleCount,
											   unsigned char* materialIndices, int useMedianSplit, int identifyEdges, int weldVertices, float weldTolerance )
{
	if ( vertices3 == NULL || indices3 == NULL || vertexCount <= 0 || triangleCount <= 0 )
	{
		return 0;
	}

	b3MeshDef def = { 0 };
	def.vertexCount = vertexCount;
	def.vertices = (b3Vec3*)vertices3;
	def.triangleCount = triangleCount;
	def.indices = (int*)indices3;
	def.materialIndices = materialIndices;
	def.useMedianSplit = useMedianSplit != 0;
	def.identifyEdges = identifyEdges != 0;
	def.weldVertices = weldVertices != 0;
	def.weldTolerance = weldTolerance;

	b3MeshData* mesh = b3CreateMesh( &def, NULL, 0 );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_mesh_material_indices( int meshHandle, const unsigned char* materialIndices, int materialCount )
{
	b3MeshData* mesh = LookupMesh( meshHandle );
	if ( mesh == NULL || materialIndices == NULL || materialCount <= 0 || mesh->materialOffset == 0 )
	{
		return;
	}

	int copyCount = materialCount < mesh->triangleCount ? materialCount : mesh->triangleCount;
	unsigned char* destination = (unsigned char*)( (intptr_t)mesh + mesh->materialOffset );
	memcpy( destination, materialIndices, (size_t)copyCount * sizeof( unsigned char ) );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_destroy_mesh( int meshHandle )
{
	b3MeshData* mesh = LookupMesh( meshHandle );
	if ( mesh == NULL )
	{
		return;
	}

	b3DestroyMesh( mesh );
	g_mesh_slots[meshHandle].active = false;
	g_mesh_slots[meshHandle].meshData = NULL;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_mesh_shape( int bodyHandle, int meshHandle, const float* scale3, float density, float friction,
												   float restitution, float rollingResistance, int userMaterialId, intptr_t userData, const int* filter3, const float* tangentVelocity3,
												   const double* materials8, int materialCount, int isSensor, int enableSensorEvents, int enableContactEvents,
												   int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	b3MeshData* mesh = LookupMesh( meshHandle );
	if ( b3Body_IsValid( bodyId ) == false || mesh == NULL )
	{
		return;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );
	b3SurfaceMaterial* materials = NULL;
	if ( materials8 != NULL && materialCount > 0 )
	{
		materials = malloc( (size_t)materialCount * sizeof( b3SurfaceMaterial ) );
		if ( materials != NULL )
		{
			for ( int i = 0; i < materialCount; ++i )
			{
				const double* values = materials8 + i * 8;
				materials[i] = b3DefaultSurfaceMaterial();
				materials[i].friction = (float)values[0];
				materials[i].restitution = (float)values[1];
				materials[i].rollingResistance = (float)values[2];
				materials[i].tangentVelocity = (b3Vec3){ (float)values[3], (float)values[4], (float)values[5] };
				materials[i].userMaterialId = (uint64_t)values[6];
				materials[i].customColor = (uint32_t)values[7];
			}

			shapeDef.materials = materials;
			shapeDef.materialCount = materialCount;
		}
	}

	b3Vec3 scale = scale3 != NULL ? (b3Vec3){ scale3[0], scale3[1], scale3[2] } : b3Vec3_one;
	b3CreateMeshShape( bodyId, &shapeDef, mesh, scale );

	if ( materials != NULL )
	{
		free( materials );
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_contact_hit_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetContactEvents( worldId ).hitCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_contact_hit_events( int worldHandle, double* out10, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || out10 == NULL || capacity <= 0 )
	{
		return;
	}

	b3ContactEvents events = b3World_GetContactEvents( worldId );
	int count = capacity < events.hitCount ? capacity : events.hitCount;
	for ( int i = 0; i < count; ++i )
	{
		b3ContactHitEvent event = events.hitEvents[i];
		out10[10 * i + 0] = (double)FindBodyHandle( b3Shape_GetBody( event.shapeIdA ) );
		out10[10 * i + 1] = (double)FindBodyHandle( b3Shape_GetBody( event.shapeIdB ) );
		out10[10 * i + 2] = event.point.x;
		out10[10 * i + 3] = event.point.y;
		out10[10 * i + 4] = event.point.z;
		out10[10 * i + 5] = event.normal.x;
		out10[10 * i + 6] = event.normal.y;
		out10[10 * i + 7] = event.normal.z;
		out10[10 * i + 8] = event.approachSpeed;
		out10[10 * i + 9] = (double)event.userMaterialIdA;
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_contact_begin_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetContactEvents( worldId ).beginCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_contact_begin_events( int worldHandle, int* outPairs2, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || outPairs2 == NULL || capacity <= 0 )
	{
		return;
	}

	b3ContactEvents events = b3World_GetContactEvents( worldId );
	int count = capacity < events.beginCount ? capacity : events.beginCount;
	for ( int i = 0; i < count; ++i )
	{
		b3ContactBeginTouchEvent event = events.beginEvents[i];
		outPairs2[2 * i + 0] = FindBodyHandle( b3Shape_GetBody( event.shapeIdA ) );
		outPairs2[2 * i + 1] = FindBodyHandle( b3Shape_GetBody( event.shapeIdB ) );
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_contact_end_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetContactEvents( worldId ).endCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_contact_end_events( int worldHandle, int* outPairs2, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || outPairs2 == NULL || capacity <= 0 )
	{
		return;
	}

	b3ContactEvents events = b3World_GetContactEvents( worldId );
	int count = capacity < events.endCount ? capacity : events.endCount;
	for ( int i = 0; i < count; ++i )
	{
		b3ContactEndTouchEvent event = events.endEvents[i];
		outPairs2[2 * i + 0] = FindBodyHandle( b3Shape_GetBody( event.shapeIdA ) );
		outPairs2[2 * i + 1] = FindBodyHandle( b3Shape_GetBody( event.shapeIdB ) );
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_sensor_begin_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetSensorEvents( worldId ).beginCount;
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_sensor_end_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetSensorEvents( worldId ).endCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_sensor_begin_events( int worldHandle, int* outPairs2, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || outPairs2 == NULL || capacity <= 0 )
	{
		return;
	}

	b3SensorEvents events = b3World_GetSensorEvents( worldId );
	int count = capacity < events.beginCount ? capacity : events.beginCount;
	for ( int i = 0; i < count; ++i )
	{
		b3SensorBeginTouchEvent event = events.beginEvents[i];
		outPairs2[2 * i + 0] = FindBodyHandle( b3Shape_GetBody( event.sensorShapeId ) );
		outPairs2[2 * i + 1] = FindBodyHandle( b3Shape_GetBody( event.visitorShapeId ) );
	}
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_sensor_end_events( int worldHandle, int* outPairs2, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || outPairs2 == NULL || capacity <= 0 )
	{
		return;
	}

	b3SensorEvents events = b3World_GetSensorEvents( worldId );
	int count = capacity < events.endCount ? capacity : events.endCount;
	for ( int i = 0; i < count; ++i )
	{
		b3SensorEndTouchEvent event = events.endEvents[i];
		outPairs2[2 * i + 0] = FindBodyHandle( b3Shape_GetBody( event.sensorShapeId ) );
		outPairs2[2 * i + 1] = FindBodyHandle( b3Shape_GetBody( event.visitorShapeId ) );
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_get_body_move_event_count( int worldHandle )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return b3World_GetBodyEvents( worldId ).moveCount;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_move_events( int worldHandle, int* outPairs2, int capacity )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false || outPairs2 == NULL || capacity <= 0 )
	{
		return;
	}

	b3BodyEvents events = b3World_GetBodyEvents( worldId );
	int count = capacity < events.moveCount ? capacity : events.moveCount;
	for ( int i = 0; i < count; ++i )
	{
		outPairs2[2 * i + 0] = FindBodyHandle( events.moveEvents[i].bodyId );
		outPairs2[2 * i + 1] = events.moveEvents[i].fellAsleep ? 1 : 0;
	}
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_distance_joint( int worldHandle, int bodyHandleA, int bodyHandleB, double anchorAX, double anchorAY,
														 double anchorAZ, double anchorBX, double anchorBY, double anchorBZ, float length,
														 float minLength, float maxLength, float hertz, float dampingRatio, float lowerSpringForce,
														 float upperSpringForce, int enableSpring, int enableLimit )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3DistanceJointDef jointDef = b3DefaultDistanceJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	jointDef.base.localFrameA.p = b3Body_GetLocalPoint( bodyIdA, (b3Pos){ anchorAX, anchorAY, anchorAZ } );
	jointDef.base.localFrameB.p = b3Body_GetLocalPoint( bodyIdB, (b3Pos){ anchorBX, anchorBY, anchorBZ } );
	jointDef.length = length;
	jointDef.minLength = minLength;
	jointDef.maxLength = maxLength;
	jointDef.hertz = hertz;
	jointDef.dampingRatio = dampingRatio;
	jointDef.lowerSpringForce = lowerSpringForce;
	jointDef.upperSpringForce = upperSpringForce;
	jointDef.enableSpring = enableSpring != 0;
	jointDef.enableLimit = enableLimit != 0;

	b3JointId jointId = b3CreateDistanceJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_revolute_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
														 const double* localFrameB7, double anchorX, double anchorY, double anchorZ,
														 float lowerAngle, float upperAngle, float hertz, float dampingRatio,
														 float targetAngle, float motorSpeed, float maxMotorTorque, float constraintHertz,
														 float constraintDampingRatio, int enableSpring, int enableLimit, int enableMotor )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3Pos anchor = { anchorX, anchorY, anchorZ };
	b3RevoluteJointDef jointDef = b3DefaultRevoluteJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	else
	{
		jointDef.base.localFrameA.p = b3Body_GetLocalPoint( bodyIdA, anchor );
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	else
	{
		jointDef.base.localFrameB.p = b3Body_GetLocalPoint( bodyIdB, anchor );
	}
	jointDef.lowerAngle = lowerAngle;
	jointDef.upperAngle = upperAngle;
	jointDef.hertz = hertz;
	jointDef.dampingRatio = dampingRatio;
	if ( constraintHertz >= 0.0f )
	{
		jointDef.base.constraintHertz = constraintHertz;
	}
	if ( constraintDampingRatio >= 0.0f )
	{
		jointDef.base.constraintDampingRatio = constraintDampingRatio;
	}
	jointDef.targetAngle = targetAngle;
	jointDef.motorSpeed = motorSpeed;
	jointDef.maxMotorTorque = maxMotorTorque;
	jointDef.enableSpring = enableSpring != 0;
	jointDef.enableLimit = enableLimit != 0;
	jointDef.enableMotor = enableMotor != 0;

	b3JointId jointId = b3CreateRevoluteJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_weld_joint( int worldHandle, int bodyHandleA, int bodyHandleB, double anchorX, double anchorY,
													 double anchorZ, float linearHertz, float linearDampingRatio, float angularHertz,
													 float angularDampingRatio )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3Pos anchor = { anchorX, anchorY, anchorZ };
	b3WeldJointDef jointDef = b3DefaultWeldJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	jointDef.base.localFrameA.p = b3Body_GetLocalPoint( bodyIdA, anchor );
	jointDef.base.localFrameB.p = b3Body_GetLocalPoint( bodyIdB, anchor );
	jointDef.linearHertz = linearHertz;
	jointDef.linearDampingRatio = linearDampingRatio;
	jointDef.angularHertz = angularHertz;
	jointDef.angularDampingRatio = angularDampingRatio;

	b3JointId jointId = b3CreateWeldJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_filter_joint( int worldHandle, int bodyHandleA, int bodyHandleB )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3FilterJointDef jointDef = b3DefaultFilterJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;

	b3JointId jointId = b3CreateFilterJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_motor_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
													  const double* localFrameB7, float linearHertz, float linearDampingRatio,
													  float angularHertz, float angularDampingRatio, float maxVelocityForce,
													  float maxVelocityTorque, float maxSpringForce, float maxSpringTorque,
													  int collideConnected )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3MotorJointDef jointDef = b3DefaultMotorJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	jointDef.base.collideConnected = collideConnected != 0;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	jointDef.linearHertz = linearHertz;
	jointDef.linearDampingRatio = linearDampingRatio;
	jointDef.angularHertz = angularHertz;
	jointDef.angularDampingRatio = angularDampingRatio;
	jointDef.maxVelocityForce = maxVelocityForce;
	jointDef.maxVelocityTorque = maxVelocityTorque;
	jointDef.maxSpringForce = maxSpringForce;
	jointDef.maxSpringTorque = maxSpringTorque;

	b3JointId jointId = b3CreateMotorJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_parallel_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
														 const double* localFrameB7, float hertz, float dampingRatio,
														 float maxTorque, int collideConnected )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3ParallelJointDef jointDef = b3DefaultParallelJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	jointDef.base.collideConnected = collideConnected != 0;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	jointDef.hertz = hertz;
	jointDef.dampingRatio = dampingRatio;
	jointDef.maxTorque = maxTorque;

	b3JointId jointId = b3CreateParallelJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_prismatic_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
														  const double* localFrameB7, float lowerTranslation, float upperTranslation,
														  float hertz, float dampingRatio, float targetTranslation, float motorSpeed,
														  float maxMotorForce, int enableSpring, int enableLimit, int enableMotor,
														  float constraintHertz )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3PrismaticJointDef jointDef = b3DefaultPrismaticJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	jointDef.base.constraintHertz = constraintHertz;
	jointDef.lowerTranslation = lowerTranslation;
	jointDef.upperTranslation = upperTranslation;
	jointDef.hertz = hertz;
	jointDef.dampingRatio = dampingRatio;
	jointDef.targetTranslation = targetTranslation;
	jointDef.motorSpeed = motorSpeed;
	jointDef.maxMotorForce = maxMotorForce;
	jointDef.enableSpring = enableSpring != 0;
	jointDef.enableLimit = enableLimit != 0;
	jointDef.enableMotor = enableMotor != 0;

	b3JointId jointId = b3CreatePrismaticJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_spherical_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
														  const double* localFrameB7, float coneAngle, float lowerTwistAngle,
														  float upperTwistAngle, float hertz, float dampingRatio, float constraintHertz,
														  float constraintDampingRatio,
														  const float* motorVelocity3, float maxMotorTorque, const double* targetRotation4,
														  int enableSpring, int enableConeLimit, int enableTwistLimit, int enableMotor )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3SphericalJointDef jointDef = b3DefaultSphericalJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	jointDef.coneAngle = coneAngle;
	jointDef.lowerTwistAngle = lowerTwistAngle;
	jointDef.upperTwistAngle = upperTwistAngle;
	jointDef.hertz = hertz;
	jointDef.dampingRatio = dampingRatio;
	if ( constraintHertz >= 0.0f )
	{
		jointDef.base.constraintHertz = constraintHertz;
	}
	if ( constraintDampingRatio >= 0.0f )
	{
		jointDef.base.constraintDampingRatio = constraintDampingRatio;
	}
	jointDef.motorVelocity = motorVelocity3 != NULL ? (b3Vec3){ motorVelocity3[0], motorVelocity3[1], motorVelocity3[2] } : b3Vec3_zero;
	jointDef.maxMotorTorque = maxMotorTorque;
	jointDef.targetRotation =
		targetRotation4 != NULL ? (b3Quat){ { (float)targetRotation4[0], (float)targetRotation4[1], (float)targetRotation4[2] }, (float)targetRotation4[3] } : b3Quat_identity;
	jointDef.enableSpring = enableSpring != 0;
	jointDef.enableConeLimit = enableConeLimit != 0;
	jointDef.enableTwistLimit = enableTwistLimit != 0;
	jointDef.enableMotor = enableMotor != 0;

	b3JointId jointId = b3CreateSphericalJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_wheel_joint( int worldHandle, int bodyHandleA, int bodyHandleB, const double* localFrameA7,
													  const double* localFrameB7, float lowerSuspensionLimit, float upperSuspensionLimit,
													  float suspensionHertz, float suspensionDampingRatio, float spinSpeed,
													  float maxSpinTorque, float steeringHertz, float steeringDampingRatio,
													  float targetSteeringAngle, float maxSteeringTorque, float lowerSteeringLimit,
													  float upperSteeringLimit, int enableSuspensionSpring, int enableSuspensionLimit,
													  int enableSpinMotor, int enableSteering, int enableSteeringLimit,
													  int collideConnected )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	b3BodyId bodyIdA = LookupBody( bodyHandleA );
	b3BodyId bodyIdB = LookupBody( bodyHandleB );
	if ( b3World_IsValid( worldId ) == false || b3Body_IsValid( bodyIdA ) == false || b3Body_IsValid( bodyIdB ) == false )
	{
		return 0;
	}

	b3WheelJointDef jointDef = b3DefaultWheelJointDef();
	jointDef.base.bodyIdA = bodyIdA;
	jointDef.base.bodyIdB = bodyIdB;
	jointDef.base.collideConnected = collideConnected != 0;
	if ( localFrameA7 != NULL )
	{
		jointDef.base.localFrameA = (b3Transform){
			{ localFrameA7[0], localFrameA7[1], localFrameA7[2] },
			{ { (float)localFrameA7[3], (float)localFrameA7[4], (float)localFrameA7[5] }, (float)localFrameA7[6] },
		};
	}
	if ( localFrameB7 != NULL )
	{
		jointDef.base.localFrameB = (b3Transform){
			{ localFrameB7[0], localFrameB7[1], localFrameB7[2] },
			{ { (float)localFrameB7[3], (float)localFrameB7[4], (float)localFrameB7[5] }, (float)localFrameB7[6] },
		};
	}
	jointDef.lowerSuspensionLimit = lowerSuspensionLimit;
	jointDef.upperSuspensionLimit = upperSuspensionLimit;
	jointDef.suspensionHertz = suspensionHertz;
	jointDef.suspensionDampingRatio = suspensionDampingRatio;
	jointDef.spinSpeed = spinSpeed;
	jointDef.maxSpinTorque = maxSpinTorque;
	jointDef.steeringHertz = steeringHertz;
	jointDef.steeringDampingRatio = steeringDampingRatio;
	jointDef.targetSteeringAngle = targetSteeringAngle;
	jointDef.maxSteeringTorque = maxSteeringTorque;
	jointDef.lowerSteeringLimit = lowerSteeringLimit;
	jointDef.upperSteeringLimit = upperSteeringLimit;
	jointDef.enableSuspensionSpring = enableSuspensionSpring != 0;
	jointDef.enableSuspensionLimit = enableSuspensionLimit != 0;
	jointDef.enableSpinMotor = enableSpinMotor != 0;
	jointDef.enableSteering = enableSteering != 0;
	jointDef.enableSteeringLimit = enableSteeringLimit != 0;

	b3JointId jointId = b3CreateWheelJoint( worldId, &jointDef );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0;
	}

	return AllocJointSlot( worldHandle, jointId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_destroy_body( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3DestroyBody( bodyId );
	g_body_slots[bodyHandle].active = false;
	g_body_slots[bodyHandle].worldHandle = 0;
	g_body_slots[bodyHandle].bodyId = b3_nullBodyId;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_destroy_joint( int jointHandle, int wakeAttached )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3DestroyJoint( jointId, wakeAttached != 0 );
	g_joint_slots[jointHandle].active = false;
	g_joint_slots[jointHandle].worldHandle = 0;
	g_joint_slots[jointHandle].jointId = b3_nullJointId;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_transform( int bodyHandle, double* out7 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || out7 == NULL )
	{
		return;
	}

	WriteTransform( out7, bodyId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_world_center( int bodyHandle, double* out3 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || out3 == NULL )
	{
		return;
	}

	b3Pos center = b3Body_GetWorldCenter( bodyId );
	out3[0] = center.x;
	out3[1] = center.y;
	out3[2] = center.z;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_transform( int bodyHandle, const double* transform7 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || transform7 == NULL )
	{
		return;
	}

	b3Body_SetTransform(
		bodyId,
		(b3Pos){ transform7[0], transform7[1], transform7[2] },
		(b3Quat){ { (float)transform7[3], (float)transform7[4], (float)transform7[5] }, (float)transform7[6] }
	);
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_mass_data( int bodyHandle, double* outValues13 )
{
	if ( outValues13 == NULL )
	{
		return;
	}

	for ( int i = 0; i < 13; ++i )
	{
		outValues13[i] = 0.0;
	}

	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3MassData massData = b3Body_GetMassData( bodyId );
	outValues13[0] = massData.mass;
	outValues13[1] = massData.center.x;
	outValues13[2] = massData.center.y;
	outValues13[3] = massData.center.z;
	outValues13[4] = massData.inertia.cx.x;
	outValues13[5] = massData.inertia.cx.y;
	outValues13[6] = massData.inertia.cx.z;
	outValues13[7] = massData.inertia.cy.x;
	outValues13[8] = massData.inertia.cy.y;
	outValues13[9] = massData.inertia.cy.z;
	outValues13[10] = massData.inertia.cz.x;
	outValues13[11] = massData.inertia.cz.y;
	outValues13[12] = massData.inertia.cz.z;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_mass_data( int bodyHandle, const double* values13 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || values13 == NULL )
	{
		return;
	}

	b3MassData massData = {
		.mass = (float)values13[0],
		.center = { values13[1], values13[2], values13[3] },
		.inertia = {
			{ (float)values13[4], (float)values13[5], (float)values13[6] },
			{ (float)values13[7], (float)values13[8], (float)values13[9] },
			{ (float)values13[10], (float)values13[11], (float)values13[12] },
		},
	};
	b3Body_SetMassData( bodyId, massData );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_linear_velocity( int bodyHandle, float* out3 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || out3 == NULL )
	{
		return;
	}

	b3Vec3 velocity = b3Body_GetLinearVelocity( bodyId );
	out3[0] = velocity.x;
	out3[1] = velocity.y;
	out3[2] = velocity.z;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_linear_velocity( int bodyHandle, float x, float y, float z )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetLinearVelocity( bodyId, (b3Vec3){ x, y, z } );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_get_body_angular_velocity( int bodyHandle, float* out3 )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || out3 == NULL )
	{
		return;
	}

	b3Vec3 velocity = b3Body_GetAngularVelocity( bodyId );
	out3[0] = velocity.x;
	out3[1] = velocity.y;
	out3[2] = velocity.z;
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_angular_velocity( int bodyHandle, float x, float y, float z )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetAngularVelocity( bodyId, (b3Vec3){ x, y, z } );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_apply_body_linear_impulse( int bodyHandle, float x, float y, float z, double pointX, double pointY, double pointZ,
															  int wake )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_ApplyLinearImpulse( bodyId, (b3Vec3){ x, y, z }, (b3Pos){ pointX, pointY, pointZ }, wake != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_apply_body_wind( int bodyHandle, float windX, float windY, float windZ, float drag, float lift,
													float maxSpeed, int wake )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	int shapeCount = b3Body_GetShapeCount( bodyId );
	if ( shapeCount <= 0 )
	{
		return;
	}

	b3ShapeId* shapeIds = (b3ShapeId*)malloc( (size_t)shapeCount * sizeof( b3ShapeId ) );
	if ( shapeIds == NULL )
	{
		return;
	}

	int copied = b3Body_GetShapes( bodyId, shapeIds, shapeCount );
	b3Vec3 wind = { windX, windY, windZ };
	for ( int i = 0; i < copied; ++i )
	{
		if ( b3Shape_IsValid( shapeIds[i] ) )
		{
			b3Shape_ApplyWind( shapeIds[i], wind, drag, lift, maxSpeed, wake != 0 );
		}
	}

	free( shapeIds );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_gravity_scale( int bodyHandle, float gravityScale )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetGravityScale( bodyId, gravityScale );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_linear_damping( int bodyHandle, float linearDamping )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetLinearDamping( bodyId, linearDamping );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_angular_damping( int bodyHandle, float angularDamping )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetAngularDamping( bodyId, angularDamping );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_type( int bodyHandle, int bodyType )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetType( bodyId, (b3BodyType)bodyType );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_body_sleep( int bodyHandle, int enableSleep )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_EnableSleep( bodyId, enableSleep != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_awake( int bodyHandle, int awake )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetAwake( bodyId, awake != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_target_transform( int bodyHandle, const double* transform7, float timeStep, int wake )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || transform7 == NULL )
	{
		return;
	}

	b3WorldTransform target = {
		(b3Pos){ transform7[0], transform7[1], transform7[2] },
		(b3Quat){ { (float)transform7[3], (float)transform7[4], (float)transform7[5] }, (float)transform7[6] },
	};
	b3Body_SetTargetTransform( bodyId, target, timeStep, wake != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_disable_body( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_Disable( bodyId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_body( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_Enable( bodyId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_motion_locks( int bodyHandle, int linearX, int linearY, int linearZ, int angularX, int angularY,
														  int angularZ )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3MotionLocks locks = {
		linearX != 0,
		linearY != 0,
		linearZ != 0,
		angularX != 0,
		angularY != 0,
		angularZ != 0,
	};
	b3Body_SetMotionLocks( bodyId, locks );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_wake_joint_bodies( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3Joint_WakeBodies( jointId );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_distance_joint_current_length( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3DistanceJoint_GetCurrentLength( jointId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_distance_joint_length( int jointHandle, float length )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3DistanceJoint_SetLength( jointId, length );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_distance_joint_spring( int jointHandle, int enableSpring )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3DistanceJoint_EnableSpring( jointId, enableSpring != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_distance_joint_spring_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3DistanceJoint_SetSpringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_distance_joint_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3DistanceJoint_SetSpringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_revolute_joint_angle( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3RevoluteJoint_GetAngle( jointId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_revolute_joint_motor( int jointHandle, int enableMotor )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_EnableMotor( jointId, enableMotor != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_revolute_joint_motor_speed( int jointHandle, float motorSpeed )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_SetMotorSpeed( jointId, motorSpeed );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_revolute_joint_max_motor_torque( int jointHandle, float torque )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_SetMaxMotorTorque( jointId, torque );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_revolute_joint_spring( int jointHandle, int enableSpring )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_EnableSpring( jointId, enableSpring != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_revolute_joint_target_angle( int jointHandle, float targetAngle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_SetTargetAngle( jointId, targetAngle );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_revolute_joint_spring_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_SetSpringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_revolute_joint_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3RevoluteJoint_SetSpringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_weld_joint_linear_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WeldJoint_SetLinearHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_weld_joint_linear_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WeldJoint_SetLinearDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_weld_joint_angular_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WeldJoint_SetAngularHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_weld_joint_angular_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WeldJoint_SetAngularDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_motor_joint_max_spring_force( int jointHandle, float maxForce )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3MotorJoint_SetMaxSpringForce( jointId, maxForce );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_motor_joint_max_spring_torque( int jointHandle, float maxTorque )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3MotorJoint_SetMaxSpringTorque( jointId, maxTorque );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_parallel_joint_spring_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3ParallelJoint_SetSpringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_parallel_joint_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3ParallelJoint_SetSpringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_joint_constraint_force_length( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3Length( b3Joint_GetConstraintForce( jointId ) );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_joint_constraint_torque_length( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3Length( b3Joint_GetConstraintTorque( jointId ) );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_prismatic_joint_translation( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3PrismaticJoint_GetTranslation( jointId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_prismatic_joint_spring( int jointHandle, int enableSpring )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_EnableSpring( jointId, enableSpring != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_prismatic_joint_spring_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_SetSpringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_prismatic_joint_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_SetSpringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_prismatic_joint_target_translation( int jointHandle, float targetTranslation )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_SetTargetTranslation( jointId, targetTranslation );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_prismatic_joint_motor( int jointHandle, int enableMotor )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_EnableMotor( jointId, enableMotor != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_prismatic_joint_motor_speed( int jointHandle, float motorSpeed )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_SetMotorSpeed( jointId, motorSpeed );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_prismatic_joint_max_motor_force( int jointHandle, float maxMotorForce )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3PrismaticJoint_SetMaxMotorForce( jointId, maxMotorForce );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_spherical_joint_cone_limit( int jointHandle, int enableLimit )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_EnableConeLimit( jointId, enableLimit != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_cone_limit( int jointHandle, float angleRadians )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetConeLimit( jointId, angleRadians );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_spherical_joint_twist_limit( int jointHandle, int enableLimit )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_EnableTwistLimit( jointId, enableLimit != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_twist_limits( int jointHandle, float lowerLimitRadians, float upperLimitRadians )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetTwistLimits( jointId, lowerLimitRadians, upperLimitRadians );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_spherical_joint_motor( int jointHandle, int enableMotor )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_EnableMotor( jointId, enableMotor != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_max_motor_torque( int jointHandle, float maxMotorTorque )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetMaxMotorTorque( jointId, maxMotorTorque );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_motor_velocity( int jointHandle, float x, float y, float z )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetMotorVelocity( jointId, (b3Vec3){ x, y, z } );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_spherical_joint_spring( int jointHandle, int enableSpring )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_EnableSpring( jointId, enableSpring != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_spring_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetSpringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3SphericalJoint_SetSpringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_spherical_joint_target_rotation( int jointHandle, const double* rotation4 )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false || rotation4 == NULL )
	{
		return;
	}

	b3SphericalJoint_SetTargetRotation(
		jointId,
		(b3Quat){ { (float)rotation4[0], (float)rotation4[1], (float)rotation4[2] }, (float)rotation4[3] }
	);
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_wheel_joint_suspension_limit( int jointHandle, int enableLimit )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_EnableSuspensionLimit( jointId, enableLimit != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_suspension_limits( int jointHandle, float lower, float upper )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSuspensionLimits( jointId, lower, upper );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_wheel_joint_spin_motor( int jointHandle, int enableMotor )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_EnableSpinMotor( jointId, enableMotor != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_max_spin_torque( int jointHandle, float torque )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetMaxSpinTorque( jointId, torque );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_spin_motor_speed( int jointHandle, float speed )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSpinMotorSpeed( jointId, speed );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_wheel_joint_suspension( int jointHandle, int enableSuspension )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_EnableSuspension( jointId, enableSuspension != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_suspension_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSuspensionHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_suspension_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSuspensionDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_wheel_joint_steering( int jointHandle, int enableSteering )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_EnableSteering( jointId, enableSteering != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_steering_hertz( int jointHandle, float hertz )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSteeringHertz( jointId, hertz );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_steering_damping_ratio( int jointHandle, float dampingRatio )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSteeringDampingRatio( jointId, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_target_steering_angle( int jointHandle, float radians )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetTargetSteeringAngle( jointId, radians );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_enable_wheel_joint_steering_limit( int jointHandle, int enableLimit )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_EnableSteeringLimit( jointId, enableLimit != 0 );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_set_wheel_joint_steering_limits( int jointHandle, float lowerRadians, float upperRadians )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return;
	}

	b3WheelJoint_SetSteeringLimits( jointId, lowerRadians, upperRadians );
}

EMSCRIPTEN_KEEPALIVE float box3d_js_get_wheel_joint_steering_angle( int jointHandle )
{
	b3JointId jointId = LookupJoint( jointHandle );
	if ( b3Joint_IsValid( jointId ) == false )
	{
		return 0.0f;
	}

	return b3WheelJoint_GetSteeringAngle( jointId );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_explode_world( int worldHandle, float posX, float posY, float posZ, float radius, float falloff, float impulsePerArea )
{
	b3WorldId worldId = LookupWorld( worldHandle );
	if ( b3World_IsValid( worldId ) == false )
	{
		return;
	}

	b3ExplosionDef def = b3DefaultExplosionDef();
	def.position.x = posX;
	def.position.y = posY;
	def.position.z = posZ;
	def.radius = radius;
	def.falloff = falloff;
	def.impulsePerArea = impulsePerArea;

	b3World_Explode( worldId, &def );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_cylinder_shape( int bodyHandle, float height, float radius, float yOffset, int sides, const float* scale3,
													   float density, float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData,
													   const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
													   int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3HullData* hull = b3CreateCylinder( height, radius, yOffset, sides );
	if ( hull == NULL )
	{
		return;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );

	if ( scale3 != NULL )
	{
		b3CreateTransformedHullShape( bodyId, &shapeDef, hull, b3Transform_identity, (b3Vec3){ scale3[0], scale3[1], scale3[2] } );
	}
	else
	{
		b3CreateHullShape( bodyId, &shapeDef, hull );
	}

	b3DestroyHull( hull );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_hull_shape( int bodyHandle, const float* points3, int pointCount, int maxVertexCount, const float* scale3,
												   float density, float friction, float restitution, float rollingResistance, int userMaterialId, intptr_t userData,
												   const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
												   int enableContactEvents, int enableHitEvents, int enableCustomFiltering, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false || points3 == NULL || pointCount <= 0 )
	{
		return;
	}

	const b3Vec3* points = (const b3Vec3*)points3;
	b3HullData* hull = b3CreateHull( points, pointCount, maxVertexCount > 0 ? maxVertexCount : pointCount );
	if ( hull == NULL )
	{
		return;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, userData, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, enableCustomFiltering, invokeContactCreation );

	if ( scale3 != NULL )
	{
		b3CreateTransformedHullShape( bodyId, &shapeDef, hull, b3Transform_identity, (b3Vec3){ scale3[0], scale3[1], scale3[2] } );
	}
	else
	{
		b3CreateHullShape( bodyId, &shapeDef, hull );
	}

	b3DestroyHull( hull );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_is_body_awake( int bodyHandle )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	return b3Body_IsAwake( bodyId ) ? 1 : 0;
}
