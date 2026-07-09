#include "box3d/box3d.h"

#include <stdbool.h>
#include <stdlib.h>

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

typedef struct Box3DJsMeshSlot
{
	bool active;
	b3MeshData* meshData;
} Box3DJsMeshSlot;

static Box3DJsWorldSlot g_world_slots[BOX3D_JS_MAX_WORLDS];
static Box3DJsBodySlot g_body_slots[BOX3D_JS_MAX_BODIES];
static Box3DJsJointSlot g_joint_slots[BOX3D_JS_MAX_JOINTS];
static Box3DJsMeshSlot g_mesh_slots[BOX3D_JS_MAX_MESHES];

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

static b3JointId LookupJoint( int jointHandle )
{
	if ( jointHandle <= 0 || jointHandle >= BOX3D_JS_MAX_JOINTS || g_joint_slots[jointHandle].active == false )
	{
		return b3_nullJointId;
	}

	return g_joint_slots[jointHandle].jointId;
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
							   int userMaterialId, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
							   int enableContactEvents, int enableHitEvents, int invokeContactCreation )
{
	shapeDef->density = density;
	shapeDef->baseMaterial.friction = friction;
	shapeDef->baseMaterial.restitution = restitution;
	shapeDef->baseMaterial.rollingResistance = rollingResistance;
	shapeDef->baseMaterial.userMaterialId = (uint32_t)userMaterialId;
	shapeDef->filter = ReadFilter( filter3 );
	shapeDef->baseMaterial.tangentVelocity = tangentVelocity3 != NULL ? (b3Vec3){ tangentVelocity3[0], tangentVelocity3[1], tangentVelocity3[2] } : b3Vec3_zero;
	shapeDef->isSensor = isSensor != 0;
	shapeDef->enableSensorEvents = enableSensorEvents != 0;
	shapeDef->enableContactEvents = enableContactEvents != 0;
	shapeDef->enableHitEvents = enableHitEvents != 0;
	shapeDef->invokeContactCreation = invokeContactCreation != 0;
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

EMSCRIPTEN_KEEPALIVE int box3d_js_create_world( float gravityX, float gravityY, float gravityZ )
{
	b3WorldDef worldDef = b3DefaultWorldDef();
	worldDef.gravity = (b3Vec3){ gravityX, gravityY, gravityZ };
	worldDef.workerCount = 1;

	b3WorldId worldId = b3CreateWorld( &worldDef );
	if ( b3World_IsValid( worldId ) == false )
	{
		return 0;
	}

	return AllocWorldSlot( worldId );
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
	ReleaseJointsForWorld( worldHandle );
	ReleaseBodiesForWorld( worldHandle );
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

EMSCRIPTEN_KEEPALIVE int box3d_js_create_box( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
											  const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float hx, float hy, float hz,
											  float density, float friction, float restitution, float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3,
											  int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	b3BoxHull hull = b3MakeBoxHull( hx, hy, hz );
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3CreateHullShape( bodyId, &shapeDef, &hull.base );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_sphere( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												 const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float radius, float density,
												 float friction, float restitution, float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3,
												 int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int invokeContactCreation )
{
	b3BodyId bodyId = CreateBodyCommon( worldHandle, bodyType, x, y, z, rotation4, linearVelocity3, angularVelocity3, locks6, isBullet );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return 0;
	}

	b3Sphere sphere = { { 0.0f, 0.0f, 0.0f }, radius };
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3CreateSphereShape( bodyId, &shapeDef, &sphere );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_capsule( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												  const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, const float* capsule7,
												  float density, float friction, float restitution, float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3,
												  int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int invokeContactCreation )
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
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3CreateCapsuleShape( bodyId, &shapeDef, &capsule );

	return AllocBodySlot( worldHandle, bodyId );
}

EMSCRIPTEN_KEEPALIVE int box3d_js_create_cylinder( int worldHandle, int bodyType, double x, double y, double z, const double* rotation4,
												   const float* linearVelocity3, const float* angularVelocity3, const int* locks6, int isBullet, float height, float radius,
												   float yOffset, int sides, const float* scale3, float density, float friction, float restitution,
												   float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
												   int enableContactEvents, int enableHitEvents, int invokeContactCreation )
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
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );

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
											   float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
											   int enableContactEvents, int enableHitEvents, int invokeContactCreation )
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
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );

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

EMSCRIPTEN_KEEPALIVE void box3d_js_add_box_shape( int bodyHandle, float hx, float hy, float hz, const float* localPosition3,
												  const double* localRotation4, float density, float friction, float restitution,
												  float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
												  int enableContactEvents, int enableHitEvents, int invokeContactCreation )
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
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3CreateHullShape( bodyId, &shapeDef, &hull.base );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_sphere_shape( int bodyHandle, float centerX, float centerY, float centerZ, float radius, float density,
													 float friction, float restitution, float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3,
													 int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Sphere sphere = { { centerX, centerY, centerZ }, radius };
	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3CreateSphereShape( bodyId, &shapeDef, &sphere );
}

EMSCRIPTEN_KEEPALIVE void box3d_js_add_capsule_shape( int bodyHandle, const float* capsule7, float density, float friction, float restitution,
													  float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3, int isSensor, int enableSensorEvents,
													  int enableContactEvents, int enableHitEvents, int invokeContactCreation )
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
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
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
											   int useMedianSplit, int identifyEdges )
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
	def.useMedianSplit = useMedianSplit != 0;
	def.identifyEdges = identifyEdges != 0;

	b3MeshData* mesh = b3CreateMesh( &def, NULL, 0 );
	return mesh != NULL ? AllocMeshSlot( mesh ) : 0;
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
												   float restitution, float rollingResistance, int userMaterialId, const int* filter3, const float* tangentVelocity3,
												   int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents, int invokeContactCreation )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	b3MeshData* mesh = LookupMesh( meshHandle );
	if ( b3Body_IsValid( bodyId ) == false || mesh == NULL )
	{
		return;
	}

	b3ShapeDef shapeDef = b3DefaultShapeDef();
	ConfigureShapeDef( &shapeDef, density, friction, restitution, rollingResistance, userMaterialId, filter3, tangentVelocity3, isSensor, enableSensorEvents, enableContactEvents, enableHitEvents, invokeContactCreation );
	b3Vec3 scale = scale3 != NULL ? (b3Vec3){ scale3[0], scale3[1], scale3[2] } : b3Vec3_one;
	b3CreateMeshShape( bodyId, &shapeDef, mesh, scale );
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

EMSCRIPTEN_KEEPALIVE void box3d_js_set_body_gravity_scale( int bodyHandle, float gravityScale )
{
	b3BodyId bodyId = LookupBody( bodyHandle );
	if ( b3Body_IsValid( bodyId ) == false )
	{
		return;
	}

	b3Body_SetGravityScale( bodyId, gravityScale );
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
