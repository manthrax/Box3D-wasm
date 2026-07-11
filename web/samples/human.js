// Port of Erin Catto's human ragdoll assembly from shared/human.c

export const BoneId = {
	pelvis: 0,
	spine_01: 1,
	spine_02: 2,
	spine_03: 3,
	neck: 4,
	head: 5,
	thigh_l: 6,
	calf_l: 7,
	thigh_r: 8,
	calf_r: 9,
	upper_arm_l: 10,
	lower_arm_l: 11,
	upper_arm_r: 12,
	lower_arm_r: 13,
	count: 14,
};

const B3_DEG_TO_RAD = Math.PI / 180.0;

function offsetPos( pos, offset )
{
	return {
		x: pos.x + offset.x,
		y: pos.y + offset.y,
		z: pos.z + offset.z,
	};
}

export class Human
{
	constructor()
	{
		this.bones = Array.from( { length: BoneId.count }, () => ( {
			bodyHandle: 0,
			jointHandle: 0,
			anchorHandle: 0,
			anchorJointHandle: 0,
			localFrameA: null,
			localFrameB: null,
			referenceFrame: null,
			jointType: null,
			swingLimit: 0,
			twistLimit: null,
			jointFriction: 1.0,
			parentIndex: -1,
		} ) );
		this.filterJointHandles = [];
		this.frictionTorque = 0;
		this.isSpawned = false;
		this.motorsEnabled = true;
	}

	spawn( ctx, position, frictionTorque, hertz, dampingRatio, groupIndex, colorize )
	{
		const BodyType = ctx.box3d.BodyType;
		this.frictionTorque = frictionTorque;

		const shirtColor = 0x40e0d0; // medium turquoise
		const pantColor = 0x1e90ff;  // dodger blue
		const skinColors = [ 0xffdead, 0xffffe0, 0xcd853f, 0xd2b48c ]; // navajo white, light yellow, peru, tan
		const skinColor = skinColors[groupIndex % 4];

		const spawnBone = ( index, name, refFrame, capsule, color, filterGroupIndex ) =>
		{
			const bone = this.bones[index];
			bone.referenceFrame = refFrame;

			const bodyHandle = ctx.physics.createBody( {
				type: BodyType.dynamic,
				position: offsetPos( position, refFrame.p ),
				rotation: refFrame.q,
				name,
			} );
			bone.bodyHandle = bodyHandle;

			ctx.physics.addCapsuleShape( bodyHandle, {
				capsule,
				bodyType: BodyType.dynamic,
				density: 1.0,
				color: colorize ? color : 0xd66f3d,
				filter: {
					categoryBits: 0x0002,
					maskBits: 0xFFFF,
					groupIndex: filterGroupIndex,
				},
				roughness: 0.66,
				metalness: 0.05,
			} );
		};

		// 0: pelvis
		spawnBone(
			BoneId.pelvis,
			"pelvis",
			{ p: { x: 0.0, y: 0.932087, z: -0.051708 }, q: { x: 0.739169, y: 0.0, z: 0.0, w: 0.673520 } },
			{ center1: { x: 0.07, y: 0.0, z: -0.08 }, center2: { x: -0.07, y: 0.0, z: -0.08 }, radius: 0.13 },
			pantColor,
			0
		);

		// 1: spine_01
		spawnBone(
			BoneId.spine_01,
			"spine_01",
			{ p: { x: 0.0, y: 1.113505, z: -0.03481 }, q: { x: 0.739973, y: 0.0, z: 0.0, w: 0.672637 } },
			{ center1: { x: 0.06, y: 0.0, z: -0.052264 }, center2: { x: -0.06, y: 0.0, z: -0.052264 }, radius: 0.12 },
			shirtColor,
			-groupIndex
		);
		this.bones[BoneId.spine_01].parentIndex = BoneId.pelvis;
		this.bones[BoneId.spine_01].jointType = "spherical";
		this.bones[BoneId.spine_01].localFrameA = { p: { x: 0.0, y: 0.0, z: -0.182204 }, q: { x: -0.999999, y: 0.0, z: 0.0, w: 0.001194 } };
		this.bones[BoneId.spine_01].localFrameB = { p: { x: 0.0, y: 0.0, z: -0.007736 }, q: { x: -1.0, y: 0.0, z: 0.0, w: 0.0 } };
		this.bones[BoneId.spine_01].swingLimit = 25.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.spine_01].twistLimit = { x: -15.0 * B3_DEG_TO_RAD, y: 15.0 * B3_DEG_TO_RAD };

		// 2: spine_02
		spawnBone(
			BoneId.spine_02,
			"spine_02",
			{ p: { x: 0.0, y: 1.194336, z: -0.027087 }, q: { x: 0.703611, y: 0.0, z: 0.0, w: 0.710586 } },
			{ center1: { x: 0.08, y: -0.015133, z: -0.091801 }, center2: { x: -0.08, y: -0.015133, z: -0.091801 }, radius: 0.10 },
			shirtColor,
			0
		);
		this.bones[BoneId.spine_02].parentIndex = BoneId.spine_01;
		this.bones[BoneId.spine_02].jointType = "spherical";
		this.bones[BoneId.spine_02].localFrameA = { p: { x: 0.0, y: -0.0, z: -0.088935 }, q: { x: -0.998619, y: -0.0, z: 0.0, w: -0.052540 } };
		this.bones[BoneId.spine_02].localFrameB = { p: { x: -0.0, y: 0.0, z: -0.008199 }, q: { x: -1.0, y: 0.0, z: 0.0, w: 0.0 } };
		this.bones[BoneId.spine_02].swingLimit = 25.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.spine_02].twistLimit = { x: -15.0 * B3_DEG_TO_RAD, y: 15.0 * B3_DEG_TO_RAD };

		// 3: spine_03
		spawnBone(
			BoneId.spine_03,
			"spine_03",
			{ p: { x: -0.0, y: 1.31043, z: -0.028232 }, q: { x: 0.669856, y: 0.000001, z: -0.000001, w: 0.742491 } },
			{ center1: { x: 0.11, y: -0.039753, z: -0.13 }, center2: { x: -0.11, y: -0.039753, z: -0.13 }, radius: 0.145 },
			shirtColor,
			0
		);
		this.bones[BoneId.spine_03].parentIndex = BoneId.spine_02;
		this.bones[BoneId.spine_03].jointType = "spherical";
		this.bones[BoneId.spine_03].localFrameA = { p: { x: -0.0, y: 0.0, z: -0.124298 }, q: { x: -0.998921, y: 0.000001, z: -0.000001, w: -0.046434 } };
		this.bones[BoneId.spine_03].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -1.0, y: 0.0, z: -0.000001, w: 0.0 } };
		this.bones[BoneId.spine_03].swingLimit = 15.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.spine_03].twistLimit = { x: -10.0 * B3_DEG_TO_RAD, y: 10.0 * B3_DEG_TO_RAD };

		// 4: neck
		spawnBone(
			BoneId.neck,
			"neck",
			{ p: { x: 0.0, y: 1.575582, z: -0.055837 }, q: { x: 0.879922, y: 0.0, z: 0.0, w: 0.475118 } },
			{ center1: { x: -0.000001, y: -0.0, z: -0.02 }, center2: { x: 0.0, y: -0.005, z: -0.08 }, radius: 0.07 },
			skinColor,
			0
		);
		this.bones[BoneId.neck].parentIndex = BoneId.spine_03;
		this.bones[BoneId.neck].jointType = "spherical";
		this.bones[BoneId.neck].localFrameA = { p: { x: 0.000001, y: -0.000259, z: -0.266585 }, q: { x: -0.942192, y: -0.000001, z: 0.0, w: 0.335074 } };
		this.bones[BoneId.neck].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -1.0, y: 0.0, z: -0.000001, w: 0.0 } };
		this.bones[BoneId.neck].swingLimit = 45.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.neck].twistLimit = { x: -15.0 * B3_DEG_TO_RAD, y: 15.0 * B3_DEG_TO_RAD };
		this.bones[BoneId.neck].jointFriction = 0.8;

		// 5: head
		spawnBone(
			BoneId.head,
			"head",
			{ p: { x: 0.0, y: 1.653348, z: -0.003241 }, q: { x: 0.750288, y: 0.0, z: 0.0, w: 0.661111 } },
			{ center1: { x: -0.000001, y: 0.016892, z: -0.05869 }, center2: { x: 0.0, y: -0.003629, z: -0.115072 }, radius: 0.0975 },
			skinColor,
			0
		);
		this.bones[BoneId.head].parentIndex = BoneId.neck;
		this.bones[BoneId.head].jointType = "spherical";
		this.bones[BoneId.head].localFrameA = { p: { x: 0.0, y: 0.001321, z: -0.093873 }, q: { x: -0.974301, y: -0.0, z: -0.0, w: -0.225251 } };
		this.bones[BoneId.head].localFrameB = { p: { x: 0.0, y: 0.001268, z: -0.005104 }, q: { x: -1.0, y: 0.0, z: -0.0, w: 0.0 } };
		this.bones[BoneId.head].swingLimit = 15.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.head].twistLimit = { x: -15.0 * B3_DEG_TO_RAD, y: 15.0 * B3_DEG_TO_RAD };
		this.bones[BoneId.head].jointFriction = 0.4;

		// 6: thigh_l
		spawnBone(
			BoneId.thigh_l,
			"thigh_l",
			{ p: { x: 0.090416, y: 0.986104, z: -0.03509 }, q: { x: -0.703287, y: -0.070715, z: 0.053866, w: 0.705327 } },
			{ center1: { x: 0.023719, y: 0.006008, z: -0.039068 }, center2: { x: -0.064492, y: -0.004664, z: -0.424718 }, radius: 0.09 },
			pantColor,
			-groupIndex
		);
		this.bones[BoneId.thigh_l].parentIndex = BoneId.pelvis;
		this.bones[BoneId.thigh_l].jointType = "spherical";
		this.bones[BoneId.thigh_l].localFrameA = { p: { x: 0.05, y: 0.011537, z: -0.055325 }, q: { x: -0.714896, y: -0.022305, z: -0.698361, w: -0.026790 } };
		this.bones[BoneId.thigh_l].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -0.002064, y: 0.758987, z: 0.017046, w: 0.650880 } };
		this.bones[BoneId.thigh_l].swingLimit = 10.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.thigh_l].twistLimit = { x: -60.0 * B3_DEG_TO_RAD, y: 40.0 * B3_DEG_TO_RAD };

		// 7: calf_l
		spawnBone(
			BoneId.calf_l,
			"calf_l",
			{ p: { x: 0.101198, y: 0.527027, z: -0.037374 }, q: { x: -0.653328, y: -0.066860, z: 0.058582, w: 0.751838 } },
			{ center1: { x: 0.001778, y: 0.0, z: 0.009841 }, center2: { x: -0.078577, y: 0.014707, z: -0.41816 }, radius: 0.075 },
			pantColor,
			0
		);
		this.bones[BoneId.calf_l].parentIndex = BoneId.thigh_l;
		this.bones[BoneId.calf_l].jointType = "revolute";
		this.bones[BoneId.calf_l].localFrameA = { p: { x: -0.069989, y: 0.000253, z: -0.453844 }, q: { x: -0.000677, y: 0.760087, z: 0.105674, w: 0.641171 } };
		this.bones[BoneId.calf_l].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -0.044589, y: 0.765540, z: 0.053368, w: 0.639619 } };
		this.bones[BoneId.calf_l].twistLimit = { x: -5.0 * B3_DEG_TO_RAD, y: 45.0 * B3_DEG_TO_RAD };

		// 8: thigh_r
		spawnBone(
			BoneId.thigh_r,
			"thigh_r",
			{ p: { x: -0.090416, y: 0.986104, z: -0.03509 }, q: { x: -0.703287, y: 0.070715, z: -0.053865, w: 0.705326 } },
			{ center1: { x: -0.023719, y: 0.006008, z: -0.039068 }, center2: { x: 0.064492, y: -0.004664, z: -0.424718 }, radius: 0.09 },
			pantColor,
			-groupIndex
		);
		this.bones[BoneId.thigh_r].parentIndex = BoneId.pelvis;
		this.bones[BoneId.thigh_r].jointType = "spherical";
		this.bones[BoneId.thigh_r].localFrameA = { p: { x: -0.05, y: 0.011537, z: -0.055326 }, q: { x: -0.039089, y: -0.714094, z: 0.043177, w: 0.697623 } };
		this.bones[BoneId.thigh_r].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: 0.758805, y: -0.019886, z: -0.651012, w: -0.001759 } };
		this.bones[BoneId.thigh_r].swingLimit = 10.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.thigh_r].twistLimit = { x: -30.0 * B3_DEG_TO_RAD, y: 60.0 * B3_DEG_TO_RAD };

		// 9: calf_r
		spawnBone(
			BoneId.calf_r,
			"calf_r",
			{ p: { x: -0.101198, y: 0.527027, z: -0.037373 }, q: { x: -0.653327, y: 0.066860, z: -0.058582, w: 0.751839 } },
			{ center1: { x: -0.00182, y: 0.0, z: 0.010071 }, center2: { x: 0.077883, y: 0.014825, z: -0.418047 }, radius: 0.075 },
			pantColor,
			0
		);
		this.bones[BoneId.calf_r].parentIndex = BoneId.thigh_r;
		this.bones[BoneId.calf_r].jointType = "revolute";
		this.bones[BoneId.calf_r].localFrameA = { p: { x: 0.069988, y: 0.000253, z: -0.453844 }, q: { x: 0.760086, y: -0.000675, z: -0.641171, w: -0.105676 } };
		this.bones[BoneId.calf_r].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: 0.76554, y: -0.044589, z: -0.639619, w: -0.053368 } };
		this.bones[BoneId.calf_r].twistLimit = { x: -45.0 * B3_DEG_TO_RAD, y: 5.0 * B3_DEG_TO_RAD };

		// 10: upper_arm_l
		spawnBone(
			BoneId.upper_arm_l,
			"upper_arm_l",
			{ p: { x: 0.20378, y: 1.484275, z: -0.115897 }, q: { x: 0.143082, y: 0.695980, z: -0.69013, w: 0.13733 } },
			{ center1: { x: 0.0, y: 0.0, z: 0.0 }, center2: { x: -0.091118, y: 0.037775, z: 0.229719 }, radius: 0.075 },
			shirtColor,
			0
		);
		this.bones[BoneId.upper_arm_l].parentIndex = BoneId.spine_03;
		this.bones[BoneId.upper_arm_l].jointType = "spherical";
		this.bones[BoneId.upper_arm_l].localFrameA = { p: { x: 0.20378, y: -0.069369, z: -0.181921 }, q: { x: -0.278486, y: 0.44560, z: -0.097014, w: 0.845266 } };
		this.bones[BoneId.upper_arm_l].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -0.201396, y: -0.001586, z: 0.901850, w: 0.382234 } };
		this.bones[BoneId.upper_arm_l].swingLimit = 60.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.upper_arm_l].twistLimit = { x: -5.0 * B3_DEG_TO_RAD, y: 5.0 * B3_DEG_TO_RAD };

		// 11: lower_arm_l
		spawnBone(
			BoneId.lower_arm_l,
			"lower_arm_l",
			{ p: { x: 0.305614, y: 1.242908, z: -0.117599 }, q: { x: 0.165048, y: 0.563437, z: -0.802002, w: 0.109959 } },
			{ center1: { x: 0.0, y: 0.0, z: 0.0 }, center2: { x: -0.142406, y: 0.039392, z: 0.261092 }, radius: 0.05 },
			skinColor,
			0
		);
		this.bones[BoneId.lower_arm_l].parentIndex = BoneId.upper_arm_l;
		this.bones[BoneId.lower_arm_l].jointType = "revolute";
		this.bones[BoneId.lower_arm_l].localFrameA = { p: { x: -0.095482, y: 0.039584, z: 0.240723 }, q: { x: 0.512487, y: -0.180629, z: 0.839474, w: 0.003742 } };
		this.bones[BoneId.lower_arm_l].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: 0.503803, y: -0.029831, z: 0.858168, w: 0.094017 } };
		this.bones[BoneId.lower_arm_l].twistLimit = { x: -5.0 * B3_DEG_TO_RAD, y: 60.0 * B3_DEG_TO_RAD };

		// 12: upper_arm_r
		spawnBone(
			BoneId.upper_arm_r,
			"upper_arm_r",
			{ p: { x: -0.20378, y: 1.484276, z: -0.115899 }, q: { x: 0.143083, y: -0.695978, z: 0.690132, w: 0.137329 } },
			{ center1: { x: 0.0, y: 0.0, z: 0.0 }, center2: { x: 0.091118, y: 0.037775, z: 0.229718 }, radius: 0.075 },
			shirtColor,
			0
		);
		this.bones[BoneId.upper_arm_r].parentIndex = BoneId.spine_03;
		this.bones[BoneId.upper_arm_r].jointType = "spherical";
		this.bones[BoneId.upper_arm_r].localFrameA = { p: { x: -0.203779, y: -0.069371, z: -0.181922 }, q: { x: -0.253621, y: -0.414842, z: 0.106962, w: 0.867261 } };
		this.bones[BoneId.upper_arm_r].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -0.201397, y: 0.001587, z: -0.901850, w: 0.382233 } };
		this.bones[BoneId.upper_arm_r].swingLimit = 60.0 * B3_DEG_TO_RAD;
		this.bones[BoneId.upper_arm_r].twistLimit = { x: -5.0 * B3_DEG_TO_RAD, y: 5.0 * B3_DEG_TO_RAD };

		// 13: lower_arm_r
		spawnBone(
			BoneId.lower_arm_r,
			"lower_arm_r",
			{ p: { x: -0.305614, y: 1.242907, z: -0.117599 }, q: { x: 0.165048, y: -0.563437, z: 0.802002, w: 0.109959 } },
			{ center1: { x: 0.0, y: 0.0, z: 0.0 }, center2: { x: 0.142406, y: 0.039392, z: 0.261092 }, radius: 0.05 },
			skinColor,
			0
		);
		this.bones[BoneId.lower_arm_r].parentIndex = BoneId.upper_arm_r;
		this.bones[BoneId.lower_arm_r].jointType = "revolute";
		this.bones[BoneId.lower_arm_r].localFrameA = { p: { x: 0.095484, y: 0.039585, z: 0.240723 }, q: { x: -0.180627, y: 0.512487, z: -0.003744, w: -0.839474 } };
		this.bones[BoneId.lower_arm_r].localFrameB = { p: { x: 0.0, y: 0.0, z: 0.0 }, q: { x: -0.029831, y: 0.503803, z: -0.094017, w: -0.858169 } };
		this.bones[BoneId.lower_arm_r].twistLimit = { x: -60.0 * B3_DEG_TO_RAD, y: 5.0 * B3_DEG_TO_RAD };

		// Create joints linking bones to parents
		for ( let i = 1; i < BoneId.count; i += 1 )
		{
			const bone = this.bones[i];
			const parent = this.bones[bone.parentIndex];

			if ( bone.jointType === "revolute" )
			{
				bone.jointHandle = ctx.box3d.api.createRevoluteJoint( ctx.physics.worldHandle, {
					bodyA: parent.bodyHandle,
					bodyB: bone.bodyHandle,
					localFrameA: bone.localFrameA,
					localFrameB: bone.localFrameB,
					enableLimit: true,
					lowerAngle: bone.twistLimit.x,
					upperAngle: bone.twistLimit.y,
					enableSpring: hertz > 0.0,
					hertz: hertz,
					dampingRatio: dampingRatio,
					enableMotor: true,
					maxMotorTorque: bone.jointFriction * frictionTorque,
				} );
			}
			else if ( bone.jointType === "spherical" )
			{
				bone.jointHandle = ctx.box3d.api.createSphericalJoint( ctx.physics.worldHandle, {
					bodyA: parent.bodyHandle,
					bodyB: bone.bodyHandle,
					localFrameA: bone.localFrameA,
					localFrameB: bone.localFrameB,
					enableConeLimit: true,
					coneAngle: bone.swingLimit,
					enableTwistLimit: true,
					lowerTwistAngle: bone.twistLimit.x,
					upperTwistAngle: bone.twistLimit.y,
					enableSpring: hertz > 0.0,
					hertz: hertz,
					dampingRatio: dampingRatio,
					enableMotor: true,
					maxMotorTorque: bone.jointFriction * frictionTorque,
				} );
			}
		}

		// Disable collision between thighs
		const filterJointHandle = ctx.box3d.api.createFilterJoint( ctx.physics.worldHandle, {
			bodyA: this.bones[BoneId.thigh_l].bodyHandle,
			bodyB: this.bones[BoneId.thigh_r].bodyHandle,
		} );
		this.filterJointHandles.push( filterJointHandle );

		this.isSpawned = true;
		this.motorsEnabled = true;
	}

	destroy( ctx )
	{
		if ( this.isSpawned === false )
		{
			return;
		}

		for ( const bone of this.bones )
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

		for ( const filterHandle of this.filterJointHandles )
		{
			ctx.box3d.api.destroyJoint( filterHandle );
		}

		this.filterJointHandles = [];
		this.isSpawned = false;
		this.motorsEnabled = false;
	}

	setVelocity( ctx, velocity )
	{
		for ( let i = 0; i < BoneId.count; i += 1 )
		{
			const bodyHandle = this.bones[i].bodyHandle;
			if ( bodyHandle !== 0 )
			{
				ctx.physics.box3d.api.setBodyLinearVelocity( bodyHandle, velocity );
			}
		}
	}

	setJointFrictionTorque( ctx, torque )
	{
		this.frictionTorque = torque;
		for ( let i = 1; i < BoneId.count; i += 1 )
		{
			const bone = this.bones[i];
			if ( bone.jointType === "revolute" )
			{
				ctx.box3d.api.setRevoluteJointMaxMotorTorque( bone.jointHandle, bone.jointFriction * torque );
			}
			else if ( bone.jointType === "spherical" )
			{
				ctx.box3d.api.setSphericalJointMaxMotorTorque( bone.jointHandle, bone.jointFriction * torque );
			}
		}
	}

	setJointSpringHertz( ctx, hertz )
	{
		for ( let i = 1; i < BoneId.count; i += 1 )
		{
			const bone = this.bones[i];
			if ( bone.jointType === "revolute" )
			{
				ctx.box3d.api.setRevoluteJointSpringHertz( bone.jointHandle, hertz );
			}
			else if ( bone.jointType === "spherical" )
			{
				ctx.box3d.api.setSphericalJointSpringHertz( bone.jointHandle, hertz );
			}
		}
	}

	setJointDampingRatio( ctx, dampingRatio )
	{
		for ( let i = 1; i < BoneId.count; i += 1 )
		{
			const bone = this.bones[i];
			if ( bone.jointType === "revolute" )
			{
				ctx.box3d.api.setRevoluteJointSpringDampingRatio( bone.jointHandle, dampingRatio );
			}
			else if ( bone.jointType === "spherical" )
			{
				ctx.box3d.api.setSphericalJointSpringDampingRatio( bone.jointHandle, dampingRatio );
			}
		}
	}

	setMotorsEnabled( ctx, enabled )
	{
		this.motorsEnabled = enabled;

		for ( let i = 1; i < BoneId.count; i += 1 )
		{
			const bone = this.bones[i];
			if ( bone.jointHandle === 0 )
			{
				continue;
			}

			if ( bone.jointType === "revolute" )
			{
				ctx.box3d.api.enableRevoluteJointMotor( bone.jointHandle, enabled );
				if ( enabled )
				{
					ctx.box3d.api.setRevoluteJointTargetAngle( bone.jointHandle, 0 );
				}
			}
			else if ( bone.jointType === "spherical" )
			{
				ctx.box3d.api.enableSphericalJointMotor( bone.jointHandle, enabled );
				if ( enabled )
				{
					ctx.box3d.api.setSphericalJointTargetRotation( bone.jointHandle, { x: 0, y: 0, z: 0, w: 1 } );
				}
			}
		}
	}

	drivePelvis( ctx, transform, timeStep )
	{
		const pelvisHandle = this.bones[BoneId.pelvis].bodyHandle;
		if ( pelvisHandle === 0 )
		{
			return;
		}

		ctx.physics.setBodyTargetTransform( pelvisHandle, transform, timeStep, true );
	}
}
