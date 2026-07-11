#include "box3d/box3d.h"

#include "../shared/benchmarks.h"

int Box3DJsRegisterTrackedBody( int worldHandle, b3BodyId bodyId );

static int g_box3d_js_tracking_world_handle = 0;

void Box3DJsBeginBenchmarkTracking( int worldHandle )
{
	g_box3d_js_tracking_world_handle = worldHandle;
}

void Box3DJsEndBenchmarkTracking( void )
{
	g_box3d_js_tracking_world_handle = 0;
}

static b3BodyId Box3DJsTrackedCreateBody( b3WorldId worldId, const b3BodyDef* def )
{
	b3BodyId bodyId = b3CreateBody( worldId, def );
	if ( g_box3d_js_tracking_world_handle != 0 )
	{
		Box3DJsRegisterTrackedBody( g_box3d_js_tracking_world_handle, bodyId );
	}

	return bodyId;
}

#define b3CreateBody Box3DJsTrackedCreateBody
#include "../shared/benchmarks.c"
#undef b3CreateBody
