import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import loadBox3D from "./generated/active/box3d.js";
import { createBodySamples } from "./samples/bodies.js";
import { createCompoundSamples } from "./samples/compound.js";
import { createContinuousSamples } from "./samples/continuous.js";
import { createEventSamples } from "./samples/events.js";
import { createJointSamples } from "./samples/joints.js";
import { createRobustnessSamples } from "./samples/robustness.js";
import { createWorldSamples } from "./samples/world.js";
import { createStackingSamples } from "./samples/stacking.js";
import { createShapeSamples } from "./samples/shapes.js";

if ( globalThis.__box3dWasmApp?.dispose instanceof Function )
{
	globalThis.__box3dWasmApp.dispose();
}

const DEFAULT_DYNAMIC_COLOR = 0xd66f3d;
const DEFAULT_STATIC_COLOR = 0x75838d;
const Y_AXIS = new THREE.Vector3( 0, 1, 0 );
const ZERO_VELOCITY = { x: 0, y: 0, z: 0 };
const LAST_SAMPLE_STORAGE_KEY = "box3d-wasm:last-sample";
const urlParams = new URLSearchParams( window.location.search );
const requestedSampleKey = urlParams.get( "sample" );
const cycleEnabled = [ "1", "true", "yes" ].includes( ( urlParams.get( "cycle" ) ?? "" ).toLowerCase() );
const cycleSeconds = Number.isFinite( Number( urlParams.get( "cycleSeconds" ) ) ) && Number( urlParams.get( "cycleSeconds" ) ) > 0
	? Number( urlParams.get( "cycleSeconds" ) )
	: 4;

class PhysicsScene
{
	constructor( box3d, scene )
	{
		this.box3d = box3d;
		this.scene = scene;
		this.worldOptions = {};
		this.worldHandle = box3d.api.createWorld( this.worldOptions );
		this.worldOrigin = { x: 0, y: 0, z: 0 };
		this.entries = [];
		this.geometryCache = new Map();
		this.instanceBuckets = new Map();
		this.bodyEntries = new Map();
		this.meshResources = new Set();
		this.tempObject = new THREE.Object3D();
		this.tempMatrix = new THREE.Matrix4();
		this.tempLocalObject = new THREE.Object3D();
	}

	dispose()
	{
		this.destroyWorld();

		for ( const geometry of this.geometryCache.values() )
		{
			geometry.dispose();
		}
		this.geometryCache.clear();
	}

	destroyWorld()
	{
		if ( this.worldHandle !== 0 )
		{
			this.box3d.api.destroyWorld( this.worldHandle );
			this.worldHandle = 0;
		}

		for ( const meshResource of this.meshResources )
		{
			this.box3d.api.destroyMesh( meshResource.handle );
		}
		this.meshResources.clear();

		for ( const bucket of this.instanceBuckets.values() )
		{
			this.scene.remove( bucket.mesh );
			bucket.material.dispose();
		}

		this.entries = [];
		this.bodyEntries.clear();
		this.instanceBuckets.clear();
	}

	resetWorld( options = this.worldOptions )
	{
		this.worldOptions = { ...options };
		this.destroyWorld();
		this.worldHandle = this.box3d.api.createWorld( this.worldOptions );
	}

	setWorldOrigin( origin )
	{
		this.worldOrigin = { x: origin.x, y: origin.y, z: origin.z };
	}

	setWorldContactTuning( tuning )
	{
		this.box3d.api.setWorldContactTuning(
			this.worldHandle,
			tuning.hertz ?? 30,
			tuning.dampingRatio ?? 10,
			tuning.contactSpeed ?? 3
		);
	}

	getBodyCount()
	{
		return this.bodyEntries.size;
	}

	getWorldAwakeBodyCount()
	{
		return this.box3d.api.getWorldAwakeBodyCount( this.worldHandle );
	}

	getWorldCounters()
	{
		return this.box3d.api.getWorldCounters( this.worldHandle );
	}

	getBodyTransform( bodyHandle )
	{
		return this.box3d.api.getBodyTransform( bodyHandle );
	}

	getBodyWorldCenter( bodyHandle )
	{
		return this.box3d.api.getBodyWorldCenter( bodyHandle );
	}

	getBodyLinearVelocity( bodyHandle )
	{
		return this.box3d.api.getBodyLinearVelocity( bodyHandle );
	}

	getBodyAngularVelocity( bodyHandle )
	{
		return this.box3d.api.getBodyAngularVelocity( bodyHandle );
	}

	getScenePositionFromWorld( position )
	{
		return new THREE.Vector3(
			position.x - this.worldOrigin.x,
			position.y - this.worldOrigin.y,
			position.z - this.worldOrigin.z
		);
	}

	getWorldPositionFromScene( vector )
	{
		return {
			x: vector.x + this.worldOrigin.x,
			y: vector.y + this.worldOrigin.y,
			z: vector.z + this.worldOrigin.z,
		};
	}

	createGroundBox( options )
	{
		return this.createBoxBody( { ...options, type: this.box3d.BodyType.static, density: 0 } );
	}

	createBoxBody( options )
	{
		const size = options.size ?? { hx: 0.5, hy: 0.5, hz: 0.5 };
		const bodyHandle = this.box3d.api.createBox( this.worldHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "box",
			bodyType: options.type ?? this.box3d.BodyType.dynamic,
			geometrySignature: `box:${size.hx}:${size.hy}:${size.hz}`,
			geometryFactory: () => this.createBoxGeometry( size ),
			color: options.color ?? ( options.type === this.box3d.BodyType.static ? DEFAULT_STATIC_COLOR : DEFAULT_DYNAMIC_COLOR ),
			roughness: options.roughness ?? 0.72,
			metalness: options.metalness ?? 0.08,
			castShadow: options.type !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createBody( options )
	{
		return this.box3d.api.createBody( this.worldHandle, options );
	}

	addBoxShape( bodyHandle, options )
	{
		const size = options.size ?? { hx: 0.5, hy: 0.5, hz: 0.5 };
		this.box3d.api.addBoxShape( bodyHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "box",
			bodyType: options.bodyType ?? this.box3d.BodyType.static,
			geometrySignature: `box-shape:${size.hx}:${size.hy}:${size.hz}`,
			geometryFactory: () => this.createBoxGeometry( size ),
			localPosition: options.localPosition ?? null,
			localRotation: options.localRotation ?? null,
			color: options.color ?? DEFAULT_STATIC_COLOR,
			roughness: options.roughness ?? 0.72,
			metalness: options.metalness ?? 0.08,
			castShadow: options.bodyType !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	addSphereShape( bodyHandle, options )
	{
		const radius = options.radius ?? 0.5;
		this.box3d.api.addSphereShape( bodyHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "sphere",
			bodyType: options.bodyType ?? this.box3d.BodyType.static,
			geometrySignature: `sphere-shape:${radius}`,
			geometryFactory: () => this.createSphereGeometry( radius ),
			localPosition: options.center ?? null,
			color: options.color ?? DEFAULT_STATIC_COLOR,
			roughness: options.roughness ?? 0.66,
			metalness: options.metalness ?? 0.05,
			castShadow: options.bodyType !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	addCapsuleShape( bodyHandle, options )
	{
		const capsule = options.capsule ?? {
			center1: { x: 0, y: -0.5, z: 0 },
			center2: { x: 0, y: 0.5, z: 0 },
			radius: 0.5,
		};
		this.box3d.api.addCapsuleShape( bodyHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "capsule",
			bodyType: options.bodyType ?? this.box3d.BodyType.static,
			geometrySignature: [
				"capsule-shape",
				capsule.center1.x,
				capsule.center1.y,
				capsule.center1.z,
				capsule.center2.x,
				capsule.center2.y,
				capsule.center2.z,
				capsule.radius,
			].join( ":" ),
			geometryFactory: () => this.createCapsuleGeometry( capsule ),
			color: options.color ?? DEFAULT_STATIC_COLOR,
			roughness: options.roughness ?? 0.66,
			metalness: options.metalness ?? 0.05,
			castShadow: options.bodyType !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createCompoundBody( options )
	{
		const bodyType = options.type ?? this.box3d.BodyType.static;
		const bodyHandle = this.createBody( options );
		if ( bodyHandle === 0 )
		{
			return 0;
		}

		for ( const box of options.boxes ?? [] )
		{
			this.addBoxShape( bodyHandle, { ...box, bodyType } );
		}

		for ( const sphere of options.spheres ?? [] )
		{
			this.addSphereShape( bodyHandle, { ...sphere, bodyType } );
		}

		for ( const capsule of options.capsules ?? [] )
		{
			this.addCapsuleShape( bodyHandle, { ...capsule, bodyType } );
		}

		for ( const mesh of options.meshes ?? [] )
		{
			this.addMeshShape( bodyHandle, { ...mesh, bodyType } );
		}

		return bodyHandle;
	}

	createSphereBody( options )
	{
		const radius = options.radius ?? 0.5;
		const bodyHandle = this.box3d.api.createSphere( this.worldHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "sphere",
			bodyType: options.type ?? this.box3d.BodyType.dynamic,
			geometrySignature: `sphere:${radius}`,
			geometryFactory: () => new THREE.SphereGeometry( radius, 24, 16 ),
			color: options.color ?? DEFAULT_DYNAMIC_COLOR,
			roughness: options.roughness ?? 0.66,
			metalness: options.metalness ?? 0.05,
			castShadow: options.type !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createCapsuleBody( options )
	{
		const capsule = options.capsule ?? {
			center1: { x: 0, y: -0.5, z: 0 },
			center2: { x: 0, y: 0.5, z: 0 },
			radius: 0.5,
		};
		const bodyHandle = this.box3d.api.createCapsule( this.worldHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "capsule",
			bodyType: options.type ?? this.box3d.BodyType.dynamic,
			geometrySignature: [
				"capsule",
				capsule.center1.x,
				capsule.center1.y,
				capsule.center1.z,
				capsule.center2.x,
				capsule.center2.y,
				capsule.center2.z,
				capsule.radius,
			].join( ":" ),
			geometryFactory: () => this.createCapsuleGeometry( capsule ),
			color: options.color ?? DEFAULT_DYNAMIC_COLOR,
			roughness: options.roughness ?? 0.66,
			metalness: options.metalness ?? 0.05,
			castShadow: options.type !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createCylinderBody( options )
	{
		const cylinder = options.cylinder ?? { height: 1, radius: 0.5, yOffset: 0, sides: 12 };
		const scale = options.scale ?? { x: 1, y: 1, z: 1 };
		const bodyHandle = this.box3d.api.createCylinder( this.worldHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "cylinder",
			bodyType: options.type ?? this.box3d.BodyType.dynamic,
			geometrySignature: `cylinder:${cylinder.height}:${cylinder.radius}:${cylinder.yOffset}:${scale.x}:${scale.y}:${scale.z}:${cylinder.sides ?? 12}`,
			geometryFactory: () => this.createCylinderGeometry( cylinder, scale ),
			color: options.color ?? DEFAULT_DYNAMIC_COLOR,
			roughness: options.roughness ?? 0.68,
			metalness: options.metalness ?? 0.06,
			castShadow: options.type !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createHullBody( options )
	{
		const points = options.points ?? [];
		const scale = options.scale ?? { x: 1, y: 1, z: 1 };
		const bodyHandle = this.box3d.api.createHull( this.worldHandle, options );
		return this.addEntry( bodyHandle, {
			kind: "hull",
			bodyType: options.type ?? this.box3d.BodyType.dynamic,
			geometrySignature: `hull:${points.map( ( point ) => `${point.x},${point.y},${point.z}` ).join( ";" )}:${scale.x}:${scale.y}:${scale.z}`,
			geometryFactory: () => this.createHullGeometry( points, scale ),
			color: options.color ?? DEFAULT_DYNAMIC_COLOR,
			roughness: options.roughness ?? 0.7,
			metalness: options.metalness ?? 0.04,
			castShadow: options.type !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createGridMesh( options = {} )
	{
		const handle = this.box3d.api.createGridMesh( options );
		return this.registerMeshResource( handle, {
			signature: `grid:${options.xCount ?? 1}:${options.zCount ?? 1}:${options.cellWidth ?? 1}`,
			geometryFactory: () => this.createGridMeshGeometry( options ),
		} );
	}

	createWaveMesh( options = {} )
	{
		const handle = this.box3d.api.createWaveMesh( options );
		return this.registerMeshResource( handle, {
			signature: `wave:${options.xCount ?? 1}:${options.zCount ?? 1}:${options.cellWidth ?? 1}:${options.amplitude ?? 0}:${options.rowFrequency ?? 0}:${options.columnFrequency ?? 0}`,
			geometryFactory: () => this.createWaveMeshGeometry( options ),
		} );
	}

	createTorusMesh( options = {} )
	{
		const handle = this.box3d.api.createTorusMesh( options );
		return this.registerMeshResource( handle, {
			signature: `torus:${options.radialResolution ?? 12}:${options.tubularResolution ?? 16}:${options.radius ?? 1}:${options.thickness ?? 0.25}`,
			geometryFactory: () => this.createTorusMeshGeometry( options ),
		} );
	}

	createBoxMesh( options = {} )
	{
		const handle = this.box3d.api.createBoxMesh( options );
		return this.registerMeshResource( handle, {
			signature: `box-mesh:${options.center?.x ?? 0}:${options.center?.y ?? 0}:${options.center?.z ?? 0}:${options.extent?.x ?? 0.5}:${options.extent?.y ?? 0.5}:${options.extent?.z ?? 0.5}`,
			geometryFactory: () => this.createBoxMeshGeometry( options ),
		} );
	}

	createHollowBoxMesh( options = {} )
	{
		const handle = this.box3d.api.createHollowBoxMesh( options );
		return this.registerMeshResource( handle, {
			signature: `hollow-box-mesh:${options.center?.x ?? 0}:${options.center?.y ?? 0}:${options.center?.z ?? 0}:${options.extent?.x ?? 0.5}:${options.extent?.y ?? 0.5}:${options.extent?.z ?? 0.5}`,
			geometryFactory: () => this.createBoxMeshGeometry( options ),
		} );
	}

	createPlatformMesh( options = {} )
	{
		const handle = this.box3d.api.createPlatformMesh( options );
		return this.registerMeshResource( handle, {
			signature: `platform-mesh:${options.center?.x ?? 0}:${options.center?.y ?? 0}:${options.center?.z ?? 0}:${options.height ?? 1}:${options.topWidth ?? 1}:${options.bottomWidth ?? 1}`,
			geometryFactory: () => this.createPlatformMeshGeometry( options ),
		} );
	}

	createCustomMesh( options = {} )
	{
		const handle = this.box3d.api.createMesh( options );
		return this.registerMeshResource( handle, {
			signature: `custom-mesh:${( options.vertices ?? [] ).map( ( vertex ) => `${vertex.x ?? 0},${vertex.y ?? 0},${vertex.z ?? 0}` ).join( ";" )}:${( options.indices ?? [] ).join( "," )}`,
			geometryFactory: () => this.createCustomMeshGeometry( options ),
		} );
	}

	createMeshBody( options )
	{
		const bodyType = options.type ?? this.box3d.BodyType.static;
		const bodyHandle = this.createBody( options );
		if ( bodyHandle === 0 )
		{
			return 0;
		}

		this.addMeshShape( bodyHandle, { ...options, bodyType } );
		return bodyHandle;
	}

	addMeshShape( bodyHandle, options )
	{
		const meshResource = options.mesh ?? null;
		if ( meshResource?.handle == null )
		{
			return 0;
		}

		const scale = options.scale ?? { x: 1, y: 1, z: 1 };
		this.box3d.api.addMeshShape( bodyHandle, { ...options, meshHandle: meshResource.handle } );
		return this.addEntry( bodyHandle, {
			kind: "mesh",
			bodyType: options.bodyType ?? this.box3d.BodyType.static,
			geometrySignature: `${meshResource.signature}:${scale.x}:${scale.y}:${scale.z}`,
			geometryFactory: () => this.createScaledMeshGeometry( meshResource.geometryFactory, scale ),
			color: options.color ?? DEFAULT_STATIC_COLOR,
			roughness: options.roughness ?? 0.72,
			metalness: options.metalness ?? 0.08,
			castShadow: options.bodyType !== this.box3d.BodyType.static,
			receiveShadow: true,
		} );
	}

	createCapsuleGeometry( capsule )
	{
		const center1 = new THREE.Vector3( capsule.center1.x, capsule.center1.y, capsule.center1.z );
		const center2 = new THREE.Vector3( capsule.center2.x, capsule.center2.y, capsule.center2.z );
		const axis = center2.clone().sub( center1 );
		const length = axis.length();
		const geometry = new THREE.CapsuleGeometry( capsule.radius, length, 8, 16 );
		const midpoint = center1.clone().add( center2 ).multiplyScalar( 0.5 );

		if ( length > 1e-5 )
		{
			const rotation = new THREE.Quaternion().setFromUnitVectors( Y_AXIS, axis.normalize() );
			geometry.applyQuaternion( rotation );
		}

		geometry.translate( midpoint.x, midpoint.y, midpoint.z );
		return geometry;
	}

	createBoxGeometry( size )
	{
		return new THREE.BoxGeometry( size.hx * 2, size.hy * 2, size.hz * 2 );
	}

	createSphereGeometry( radius )
	{
		return new THREE.SphereGeometry( radius, 24, 16 );
	}

	createCylinderGeometry( cylinder, scale )
	{
		const geometry = new THREE.CylinderGeometry( cylinder.radius, cylinder.radius, cylinder.height, cylinder.sides ?? 12, 1 );
		geometry.scale( Math.abs( scale.x ?? 1 ), Math.abs( scale.y ?? 1 ), Math.abs( scale.z ?? 1 ) );
		if ( cylinder.yOffset != null && cylinder.yOffset !== 0 )
		{
			geometry.translate( 0, cylinder.yOffset, 0 );
		}
		return geometry;
	}

	createHullGeometry( points, scale )
	{
		const vertices = points.map(
			( point ) => new THREE.Vector3(
				(point.x ?? 0) * Math.abs( scale.x ?? 1 ),
				(point.y ?? 0) * Math.abs( scale.y ?? 1 ),
				(point.z ?? 0) * Math.abs( scale.z ?? 1 )
			)
		);
		return new ConvexGeometry( vertices );
	}

	createGridMeshGeometry( options )
	{
		const xCount = options.xCount ?? 1;
		const zCount = options.zCount ?? 1;
		const cellWidth = options.cellWidth ?? 1;
		const geometry = new THREE.PlaneGeometry( xCount * cellWidth, zCount * cellWidth, xCount, zCount );
		geometry.rotateX( -Math.PI * 0.5 );
		return geometry;
	}

	createWaveMeshGeometry( options )
	{
		const xCount = options.xCount ?? 1;
		const zCount = options.zCount ?? 1;
		const cellWidth = options.cellWidth ?? 1;
		const amplitude = options.amplitude ?? 0;
		const rowFrequency = options.rowFrequency ?? 0;
		const columnFrequency = options.columnFrequency ?? 0;
		const geometry = this.createGridMeshGeometry( { xCount, zCount, cellWidth } );
		const positions = geometry.attributes.position;
		const omegaZ = 2 * Math.PI * rowFrequency * cellWidth;
		const omegaX = 2 * Math.PI * columnFrequency * cellWidth;

		for ( let index = 0; index < positions.count; index += 1 )
		{
			const x = positions.getX( index );
			const z = positions.getZ( index );
			const ix = Math.round( ( x + 0.5 * xCount * cellWidth ) / cellWidth );
			const iz = Math.round( ( z + 0.5 * zCount * cellWidth ) / cellWidth );
			positions.setY( index, amplitude * Math.sin( omegaX * ix ) * Math.sin( omegaZ * iz ) );
		}

		positions.needsUpdate = true;
		geometry.computeVertexNormals();
		return geometry;
	}

	createTorusMeshGeometry( options )
	{
		return new THREE.TorusGeometry(
			options.radius ?? 1,
			options.thickness ?? 0.25,
			options.radialResolution ?? 12,
			options.tubularResolution ?? 16
		);
	}

	createBoxMeshGeometry( options )
	{
		const center = options.center ?? { x: 0, y: 0, z: 0 };
		const extent = options.extent ?? { x: 0.5, y: 0.5, z: 0.5 };
		const geometry = new THREE.BoxGeometry( extent.x * 2, extent.y * 2, extent.z * 2 );
		geometry.translate( center.x, center.y, center.z );
		return geometry;
	}

	createPlatformMeshGeometry( options )
	{
		const center = options.center ?? { x: 0, y: 0, z: 0 };
		const height = options.height ?? 1;
		const topWidth = options.topWidth ?? 1;
		const bottomWidth = options.bottomWidth ?? 1;
		const hb = 0.5 * bottomWidth;
		const ht = 0.5 * topWidth;
		const hy = 0.5 * height;
		return this.createCustomMeshGeometry( {
			vertices: [
				{ x: ht, y: hy, z: ht },
				{ x: -ht, y: hy, z: ht },
				{ x: -hb, y: -hy, z: hb },
				{ x: hb, y: -hy, z: hb },
				{ x: ht, y: hy, z: -ht },
				{ x: -ht, y: hy, z: -ht },
				{ x: -hb, y: -hy, z: -hb },
				{ x: hb, y: -hy, z: -hb },
			].map( ( vertex ) => ( {
				x: vertex.x + center.x,
				y: vertex.y + center.y,
				z: vertex.z + center.z,
			} ) ),
			indices: [
				0, 1, 3, 1, 2, 3,
				0, 4, 1, 1, 4, 5,
				0, 3, 7, 4, 0, 7,
				4, 7, 5, 6, 5, 7,
				1, 5, 2, 6, 2, 5,
				3, 2, 7, 6, 7, 2,
			],
		} );
	}

	createCustomMeshGeometry( options )
	{
		const geometry = new THREE.BufferGeometry();
		const vertices = options.vertices ?? [];
		const indices = options.indices ?? [];
		const positions = new Float32Array( vertices.length * 3 );

		for ( let index = 0; index < vertices.length; index += 1 )
		{
			const vertex = vertices[index];
			positions[3 * index + 0] = vertex.x ?? 0;
			positions[3 * index + 1] = vertex.y ?? 0;
			positions[3 * index + 2] = vertex.z ?? 0;
		}

		geometry.setAttribute( "position", new THREE.BufferAttribute( positions, 3 ) );
		geometry.setIndex( indices );
		geometry.computeVertexNormals();
		return geometry;
	}

	createScaledMeshGeometry( factory, scale )
	{
		const geometry = factory().clone();
		geometry.scale( scale.x ?? 1, scale.y ?? 1, scale.z ?? 1 );
		geometry.computeVertexNormals();
		return geometry;
	}

	registerMeshResource( handle, renderDefinition )
	{
		if ( handle === 0 )
		{
			return null;
		}

		const resource = {
			handle,
			signature: renderDefinition.signature,
			geometryFactory: renderDefinition.geometryFactory,
		};
		this.meshResources.add( resource );
		return resource;
	}

	addEntry( bodyHandle, renderDefinition )
	{
		if ( bodyHandle === 0 )
		{
			return 0;
		}

		const bucket = this.getOrCreateBucket( renderDefinition );
		const slot = this.reserveBucketSlot( bucket );
		const entry = {
			bodyHandle,
			bucket,
			slot,
			bodyType: renderDefinition.bodyType ?? this.box3d.BodyType.dynamic,
			localPosition: renderDefinition.localPosition ?? null,
			localRotation: renderDefinition.localRotation ?? null,
		};
		bucket.entries[slot] = entry;
		this.entries.push( entry );
		this.bodyEntries.set( bodyHandle, entry );
		this.syncEntry( entry );
		return bodyHandle;
	}

	getOrCreateBucket( renderDefinition )
	{
		const bucketKey = [
			renderDefinition.kind,
			renderDefinition.geometrySignature,
			renderDefinition.color,
			renderDefinition.roughness,
			renderDefinition.metalness,
			renderDefinition.castShadow ? 1 : 0,
			renderDefinition.receiveShadow ? 1 : 0,
		].join( "|" );

		if ( this.instanceBuckets.has( bucketKey ) )
		{
			return this.instanceBuckets.get( bucketKey );
		}

		const geometry = this.getOrCreateGeometry( renderDefinition.geometrySignature, renderDefinition.geometryFactory );
		const material = new THREE.MeshStandardMaterial( {
			color: renderDefinition.color,
			roughness: renderDefinition.roughness,
			metalness: renderDefinition.metalness,
		} );
		const mesh = new THREE.InstancedMesh( geometry, material, 16 );
		mesh.count = 0;
		mesh.castShadow = renderDefinition.castShadow;
		mesh.receiveShadow = renderDefinition.receiveShadow;
		mesh.frustumCulled = false;
		mesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.scene.add( mesh );

		const bucket = {
			key: bucketKey,
			geometry,
			material,
			mesh,
			count: 0,
			capacity: 16,
			entries: [],
		};
		this.instanceBuckets.set( bucketKey, bucket );
		return bucket;
	}

	reserveBucketSlot( bucket )
	{
		if ( bucket.count >= bucket.capacity )
		{
			this.growBucket( bucket );
		}

		const slot = bucket.count;
		bucket.count += 1;
		bucket.mesh.count = bucket.count;
		return slot;
	}

	growBucket( bucket )
	{
		const expandedMesh = new THREE.InstancedMesh( bucket.geometry, bucket.material, bucket.capacity * 2 );
		expandedMesh.count = bucket.count;
		expandedMesh.castShadow = bucket.mesh.castShadow;
		expandedMesh.receiveShadow = bucket.mesh.receiveShadow;
		expandedMesh.frustumCulled = false;
		expandedMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );

		for ( let index = 0; index < bucket.count; index += 1 )
		{
			bucket.mesh.getMatrixAt( index, this.tempMatrix );
			expandedMesh.setMatrixAt( index, this.tempMatrix );
		}

		this.scene.remove( bucket.mesh );
		this.scene.add( expandedMesh );
		bucket.mesh = expandedMesh;
		bucket.capacity *= 2;
	}

	getEntryFromIntersection( intersection )
	{
		if ( intersection?.object == null || intersection.instanceId == null )
		{
			return null;
		}

		for ( const bucket of this.instanceBuckets.values() )
		{
			if ( bucket.mesh === intersection.object )
			{
				return bucket.entries[intersection.instanceId] ?? null;
			}
		}

		return null;
	}

	raycastBodies( raycaster )
	{
		const intersections = raycaster.intersectObjects(
			Array.from( this.instanceBuckets.values(), ( bucket ) => bucket.mesh ),
			false
		);

		for ( const intersection of intersections )
		{
			const entry = this.getEntryFromIntersection( intersection );
			if ( entry != null && entry.bodyType !== this.box3d.BodyType.static )
			{
				return { entry, intersection };
			}
		}

		return null;
	}

	getOrCreateGeometry( key, factory )
	{
		if ( this.geometryCache.has( key ) )
		{
			return this.geometryCache.get( key );
		}

		const geometry = factory();
		this.geometryCache.set( key, geometry );
		return geometry;
	}

	step( deltaSeconds, subStepCount )
	{
		this.box3d.api.stepWorld( this.worldHandle, deltaSeconds, subStepCount );
		this.syncTransforms();
	}

	setBodyTransform( bodyHandle, transform )
	{
		this.box3d.api.setBodyTransform( bodyHandle, transform );
	}

	setBodyLinearVelocity( bodyHandle, velocity )
	{
		this.box3d.api.setBodyLinearVelocity( bodyHandle, velocity );
	}

	setBodyAngularVelocity( bodyHandle, velocity )
	{
		this.box3d.api.setBodyAngularVelocity( bodyHandle, velocity );
	}

	setBodyMotionLocks( bodyHandle, motionLocks )
	{
		this.box3d.api.setBodyMotionLocks( bodyHandle, motionLocks );
	}

	setBodyAwake( bodyHandle, awake = true )
	{
		this.box3d.api.setBodyAwake( bodyHandle, awake );
	}

	setBodyTargetTransform( bodyHandle, transform, timeStep, wake = true )
	{
		this.box3d.api.setBodyTargetTransform( bodyHandle, transform, timeStep, wake );
	}

	applyBodyLinearImpulse( bodyHandle, impulse, point, wake = true )
	{
		this.box3d.api.applyBodyLinearImpulse( bodyHandle, impulse, point, wake );
	}

	disableBody( bodyHandle )
	{
		this.box3d.api.disableBody( bodyHandle );
	}

	enableBody( bodyHandle )
	{
		this.box3d.api.enableBody( bodyHandle );
	}

	getSensorBeginEvents()
	{
		return this.box3d.api.getSensorBeginEvents( this.worldHandle );
	}

	getSensorEndEvents()
	{
		return this.box3d.api.getSensorEndEvents( this.worldHandle );
	}

	getBodyMoveEvents()
	{
		return this.box3d.api.getBodyMoveEvents( this.worldHandle );
	}

	getContactBeginEvents()
	{
		return this.box3d.api.getContactBeginEvents( this.worldHandle );
	}

	getContactEndEvents()
	{
		return this.box3d.api.getContactEndEvents( this.worldHandle );
	}

	getContactHitEvents()
	{
		return this.box3d.api.getContactHitEvents( this.worldHandle );
	}

	syncTransforms()
	{
		for ( const bucket of this.instanceBuckets.values() )
		{
			bucket.dirty = false;
		}

		for ( const entry of this.entries )
		{
			this.syncEntry( entry );
		}

		for ( const bucket of this.instanceBuckets.values() )
		{
			if ( bucket.dirty )
			{
				bucket.mesh.instanceMatrix.needsUpdate = true;
			}
		}
	}

	syncEntry( entry )
	{
		const transform = this.box3d.api.getBodyTransform( entry.bodyHandle );
		this.tempObject.position.set(
			transform.position.x - this.worldOrigin.x,
			transform.position.y - this.worldOrigin.y,
			transform.position.z - this.worldOrigin.z
		);
		this.tempObject.quaternion.set(
			transform.rotation.x,
			transform.rotation.y,
			transform.rotation.z,
			transform.rotation.w
		);
		this.tempObject.scale.setScalar( 1 );
		this.tempObject.updateMatrix();

		if ( entry.localPosition != null || entry.localRotation != null )
		{
			this.tempLocalObject.position.set(
				entry.localPosition?.x ?? 0,
				entry.localPosition?.y ?? 0,
				entry.localPosition?.z ?? 0
			);
			this.tempLocalObject.quaternion.set(
				entry.localRotation?.x ?? 0,
				entry.localRotation?.y ?? 0,
				entry.localRotation?.z ?? 0,
				entry.localRotation?.w ?? 1
			);
			this.tempLocalObject.scale.setScalar( 1 );
			this.tempLocalObject.updateMatrix();
			this.tempMatrix.multiplyMatrices( this.tempObject.matrix, this.tempLocalObject.matrix );
			entry.bucket.mesh.setMatrixAt( entry.slot, this.tempMatrix );
		}
		else
		{
			entry.bucket.mesh.setMatrixAt( entry.slot, this.tempObject.matrix );
		}
		entry.bucket.dirty = true;
	}
}

const canvas = document.querySelector( "#viewport" );
const sampleSelect = document.querySelector( "#sample-select" );
const restartButton = document.querySelector( "#restart-button" );
const pauseButton = document.querySelector( "#pause-button" );
const stepButton = document.querySelector( "#step-button" );
const statusLines = document.querySelector( "#status-lines" );
const sampleDescription = document.querySelector( "#sample-description" );
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragPlaneNormal = new THREE.Vector3();
const dragSceneTarget = new THREE.Vector3();
const dragSceneOffset = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog( 0xe8ddcc, 85, 260 );

const camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 5000 );
camera.position.set( 10, 7, 11 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 1, 0 );
controls.enableDamping = true;

scene.add( new THREE.HemisphereLight( 0xf4f0e7, 0x5d4d3c, 1.55 ) );
const sun = new THREE.DirectionalLight( 0xfff4dc, 1.8 );
sun.position.set( 9, 16, 7 );
sun.castShadow = true;
sun.shadow.mapSize.set( 2048, 2048 );
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
scene.add( sun );

const ground = new THREE.Mesh(
	new THREE.CircleGeometry( 160, 80 ),
	new THREE.MeshStandardMaterial( {
		color: 0xe1c7a0,
		roughness: 1,
		metalness: 0,
	} )
);
ground.rotation.x = -Math.PI * 0.5;
ground.position.y = -1.02;
ground.receiveShadow = true;
scene.add( ground );

const grid = new THREE.GridHelper( 160, 40, 0x8b7357, 0xb79f81 );
grid.position.y = -1;
scene.add( grid );

let paused = false;
let physicsScene = null;
let activeSampleFactory = null;
let activeSample = null;
let allSamples = [];
let box3d = null;
let sampleElapsedSeconds = 0;
let animationFrameHandle = 0;
let pointerDrag = null;
let allowSampleCameraReset = true;
let cycleAccumulatorSeconds = 0;

const appLifecycle = {
	disposed: false,
	dispose()
	{
		if ( this.disposed )
		{
			return;
		}

		this.disposed = true;

		if ( animationFrameHandle !== 0 )
		{
			cancelAnimationFrame( animationFrameHandle );
			animationFrameHandle = 0;
		}

		window.removeEventListener( "resize", resize );
		canvas.removeEventListener( "pointerdown", handlePointerDown );
		canvas.removeEventListener( "pointermove", handlePointerMove );
		canvas.removeEventListener( "pointerup", handlePointerUp );
		canvas.removeEventListener( "pointercancel", handlePointerUp );
		canvas.removeEventListener( "pointerleave", handlePointerUp );
		sampleSelect.replaceChildren();
		sampleSelect.onchange = null;
		restartButton.onclick = null;
		pauseButton.onclick = null;
		stepButton.onclick = null;
		stopPointerDrag();

		controls.dispose();
		physicsScene?.dispose();
		renderer.dispose();
	}
};

globalThis.__box3dWasmApp = appLifecycle;

function setCameraLookAt( position, target )
{
	if ( allowSampleCameraReset === false )
	{
		return;
	}

	camera.position.set( position.x, position.y, position.z );
	controls.target.set( target.x, target.y, target.z );
	controls.update();
}

function persistSelectedSample( sampleKey )
{
	try
	{
		window.localStorage?.setItem( LAST_SAMPLE_STORAGE_KEY, sampleKey );
	}
	catch
	{
		// Ignore storage failures in restricted environments.
	}
}

function readPersistedSample()
{
	try
	{
		return window.localStorage?.getItem( LAST_SAMPLE_STORAGE_KEY ) ?? null;
	}
	catch
	{
		return null;
	}
}

function updateUrlForSample( sampleKey )
{
	const nextParams = new URLSearchParams( window.location.search );
	nextParams.set( "sample", sampleKey );
	const nextQuery = nextParams.toString();
	const nextUrl = `${window.location.pathname}${nextQuery.length > 0 ? `?${nextQuery}` : ""}${window.location.hash}`;
	window.history.replaceState( null, "", nextUrl );
}

function updatePointerCoordinates( event )
{
	const rect = canvas.getBoundingClientRect();
	if ( rect.width <= 0 || rect.height <= 0 )
	{
		return false;
	}

	pointerNdc.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
	pointerNdc.y = -( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
	return true;
}

function getRaycastHit( event )
{
	if ( physicsScene == null || updatePointerCoordinates( event ) === false )
	{
		return null;
	}

	raycaster.setFromCamera( pointerNdc, camera );
	return physicsScene.raycastBodies( raycaster );
}

function stopPointerDrag()
{
	if ( pointerDrag == null )
	{
		return;
	}

	pointerDrag = null;
	controls.enabled = true;
	canvas.classList.remove( "is-dragging" );
}

function startPointerDrag( event )
{
	const hit = getRaycastHit( event );
	if ( hit == null )
	{
		return;
	}

	const transform = physicsScene.getBodyTransform( hit.entry.bodyHandle );
	const scenePosition = physicsScene.getScenePositionFromWorld( transform.position );
	dragSceneOffset.copy( hit.intersection.point ).sub( scenePosition );
	camera.getWorldDirection( dragPlaneNormal );
	dragPlane.setFromNormalAndCoplanarPoint( dragPlaneNormal, hit.intersection.point );

	pointerDrag = {
		bodyHandle: hit.entry.bodyHandle,
		targetScenePosition: scenePosition.clone(),
	};

	physicsScene.setBodyAwake( hit.entry.bodyHandle, true );

	controls.enabled = false;
	canvas.classList.add( "is-dragging" );
	if ( canvas.setPointerCapture != null )
	{
		canvas.setPointerCapture( event.pointerId );
	}
}

function updatePointerDrag( event )
{
	if ( pointerDrag == null || updatePointerCoordinates( event ) === false )
	{
		return;
	}

	raycaster.setFromCamera( pointerNdc, camera );
	if ( raycaster.ray.intersectPlane( dragPlane, dragSceneTarget ) == null )
	{
		return;
	}

	pointerDrag.targetScenePosition.copy( dragSceneTarget ).sub( dragSceneOffset );
}

function applyPointerDrag()
{
	if ( pointerDrag == null || physicsScene == null )
	{
		return;
	}

	const transform = physicsScene.getBodyTransform( pointerDrag.bodyHandle );
	physicsScene.setBodyAwake( pointerDrag.bodyHandle, true );
	physicsScene.setBodyLinearVelocity( pointerDrag.bodyHandle, ZERO_VELOCITY );
	physicsScene.setBodyAngularVelocity( pointerDrag.bodyHandle, ZERO_VELOCITY );
	physicsScene.setBodyTransform( pointerDrag.bodyHandle, {
		position: physicsScene.getWorldPositionFromScene( pointerDrag.targetScenePosition ),
		rotation: transform.rotation,
	} );
}

function handlePointerDown( event )
{
	if ( event.button !== 0 )
	{
		return;
	}

	startPointerDrag( event );
}

function handlePointerMove( event )
{
	updatePointerDrag( event );
}

function handlePointerUp()
{
	stopPointerDrag();
}

function resize()
{
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if ( width === 0 || height === 0 )
	{
		return;
	}

	renderer.setSize( width, height, false );
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
}

function renderStatus()
{
	if ( activeSample?.getStatusLines == null )
	{
		statusLines.textContent = "";
		return;
	}

	statusLines.replaceChildren(
		...activeSample.getStatusLines().map( ( line ) =>
		{
			const node = document.createElement( "div" );
			node.textContent = line;
			return node;
		} )
	);
}

function buildSampleContext()
{
	return {
		box3d,
		THREE,
		physics: physicsScene,
		setCameraLookAt,
	};
}

function resetActiveSample( options = {} )
{
	stopPointerDrag();
	physicsScene.resetWorld();
	allowSampleCameraReset = options.preserveCamera !== true;
	activeSample = activeSampleFactory.create( buildSampleContext() );
	sampleElapsedSeconds = 0;
	activeSample.reset();
	allowSampleCameraReset = true;
	physicsScene.syncTransforms();
	renderStatus();
	sampleDescription.textContent = activeSampleFactory.description;
	persistSelectedSample( activeSampleFactory.key );
	updateUrlForSample( activeSampleFactory.key );
}

function setActiveSampleFactory( sampleFactory, options = {} )
{
	if ( sampleFactory == null )
	{
		return;
	}

	activeSampleFactory = sampleFactory;
	sampleSelect.value = activeSampleFactory.key;
	cycleAccumulatorSeconds = 0;
	if ( cycleEnabled )
	{
		console.info( `[cycle] loading sample: ${activeSampleFactory.key}` );
	}
	resetActiveSample( options );
}

function selectNextSample( options = {} )
{
	if ( allSamples.length === 0 || activeSampleFactory == null )
	{
		return;
	}

	const currentIndex = allSamples.findIndex( ( sample ) => sample.key === activeSampleFactory.key );
	const nextIndex = currentIndex < 0 ? 0 : ( currentIndex + 1 ) % allSamples.length;
	setActiveSampleFactory( allSamples[nextIndex], options );
}

function stepSimulation()
{
	applyPointerDrag();

	if ( activeSample?.update != null )
	{
		activeSample.update( 1 / 60, sampleElapsedSeconds );
	}
	physicsScene.step( 1 / 60, 4 );
	sampleElapsedSeconds += 1 / 60;
	if ( cycleEnabled )
	{
		cycleAccumulatorSeconds += 1 / 60;
		if ( cycleAccumulatorSeconds >= cycleSeconds )
		{
			cycleAccumulatorSeconds = 0;
			selectNextSample();
		}
	}
	renderStatus();
}

function mountSamples()
{
	sampleSelect.replaceChildren();

	allSamples = [
		...createBodySamples( box3d ),
		...createCompoundSamples( box3d ),
		...createContinuousSamples( box3d ),
		...createEventSamples( box3d ),
		...createJointSamples( box3d ),
		...createRobustnessSamples( box3d ),
		...createWorldSamples( box3d ),
		...createStackingSamples( box3d ),
		...createShapeSamples( box3d ),
	];

	for ( const sample of allSamples )
	{
		const option = document.createElement( "option" );
		option.value = sample.key;
		option.textContent = sample.label;
		sampleSelect.append( option );
	}

	const initialSampleKey = requestedSampleKey ?? readPersistedSample();
	activeSampleFactory = allSamples.find( ( sample ) => sample.key === initialSampleKey ) ?? allSamples[0];
	sampleSelect.value = activeSampleFactory.key;

	sampleSelect.onchange = () =>
	{
		const nextSample = allSamples.find( ( sample ) => sample.key === sampleSelect.value ) ?? allSamples[0];
		setActiveSampleFactory( nextSample );
	};

	restartButton.onclick = () =>
	{
		resetActiveSample( { preserveCamera: true } );
	};

	pauseButton.onclick = () =>
	{
		paused = !paused;
		pauseButton.textContent = paused ? "Resume" : "Pause";
	};

	stepButton.onclick = () =>
	{
		if ( paused )
		{
			stepSimulation();
		}
	};
}

async function main()
{
	box3d = await loadBox3D();
	physicsScene = new PhysicsScene( box3d, scene );
	canvas.addEventListener( "pointerdown", handlePointerDown );
	canvas.addEventListener( "pointermove", handlePointerMove );
	canvas.addEventListener( "pointerup", handlePointerUp );
	canvas.addEventListener( "pointercancel", handlePointerUp );
	canvas.addEventListener( "pointerleave", handlePointerUp );
	mountSamples();
	resetActiveSample();
	cycleAccumulatorSeconds = 0;

	function frame()
	{
		if ( appLifecycle.disposed )
		{
			return;
		}

		animationFrameHandle = requestAnimationFrame( frame );
		resize();

		if ( paused === false )
		{
			stepSimulation();
		}

		controls.update();
		renderer.render( scene, camera );
	}

	frame();
}

window.addEventListener( "resize", resize );

main().catch( ( error ) =>
{
	console.error( error );
	statusLines.textContent = `Failed to load Box3D: ${error instanceof Error ? error.message : String( error )}`;
} );

if ( import.meta.hot )
{
	import.meta.hot.dispose( () =>
	{
		appLifecycle.dispose();
	} );
}
