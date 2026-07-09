export const DEG_TO_RAD = Math.PI / 180;

export function axisAngleToQuaternion( axis, radians )
{
	const halfAngle = radians * 0.5;
	const sine = Math.sin( halfAngle );
	return {
		x: axis.x * sine,
		y: axis.y * sine,
		z: axis.z * sine,
		w: Math.cos( halfAngle ),
	};
}

export function scalePoints( points, scale )
{
	return points.map( ( point ) => ( {
		x: point.x * scale,
		y: point.y * scale,
		z: point.z * scale,
	} ) );
}
