cmake_minimum_required(VERSION 3.22)

if(NOT DEFINED OUTPUT_FILE)
	message(FATAL_ERROR "OUTPUT_FILE is required")
endif()

if(NOT DEFINED HEADERS)
	message(FATAL_ERROR "HEADERS is required")
endif()

string(REPLACE "|" ";" HEADERS "${HEADERS}")

set(export_names "_malloc" "_free")

foreach(header IN LISTS HEADERS)
	file(READ "${header}" header_text)
	string(REPLACE "\r" " " header_text "${header_text}")
	string(REPLACE "\n" " " header_text "${header_text}")
	string(REGEX REPLACE "[ \t]+" " " header_text "${header_text}")

	string(REGEX MATCHALL "B3_API [^;]+;" declarations "${header_text}")
	foreach(declaration IN LISTS declarations)
		string(REGEX MATCH "B3_API [^()]*[ *](b3[A-Za-z0-9_]+)[ ]*\\(" function_match "${declaration}")
		if(function_match)
			string(REGEX REPLACE ".*[ *](b3[A-Za-z0-9_]+)[ ]*\\(" "\\1" function_name "${function_match}")
			list(APPEND export_names "_${function_name}")
		endif()
	endforeach()
endforeach()

list(APPEND export_names
	"_box3d_hello_init"
	"_box3d_hello_step"
	"_box3d_hello_get_body_transform"
	"_box3d_hello_destroy"
	"_box3d_hello_run_demo"
	"_box3d_js_create_world"
	"_box3d_js_destroy_world"
	"_box3d_js_step_world"
	"_box3d_js_set_world_contact_tuning"
	"_box3d_js_get_world_awake_body_count"
	"_box3d_js_get_world_counters"
	"_box3d_js_create_body"
	"_box3d_js_create_distance_joint"
	"_box3d_js_create_filter_joint"
	"_box3d_js_create_motor_joint"
	"_box3d_js_create_parallel_joint"
	"_box3d_js_create_prismatic_joint"
	"_box3d_js_create_revolute_joint"
	"_box3d_js_create_spherical_joint"
	"_box3d_js_create_weld_joint"
	"_box3d_js_create_wheel_joint"
	"_box3d_js_create_box"
	"_box3d_js_create_sphere"
	"_box3d_js_create_capsule"
	"_box3d_js_create_cylinder"
	"_box3d_js_create_hull"
	"_box3d_js_create_grid_mesh"
	"_box3d_js_create_wave_mesh"
	"_box3d_js_create_torus_mesh"
	"_box3d_js_create_box_mesh"
	"_box3d_js_create_hollow_box_mesh"
	"_box3d_js_create_platform_mesh"
	"_box3d_js_create_mesh"
	"_box3d_js_add_box_shape"
	"_box3d_js_add_sphere_shape"
	"_box3d_js_add_capsule_shape"
	"_box3d_js_add_mesh_shape"
	"_box3d_js_get_sensor_begin_event_count"
	"_box3d_js_get_sensor_begin_events"
	"_box3d_js_get_sensor_end_event_count"
	"_box3d_js_get_sensor_end_events"
	"_box3d_js_get_body_move_event_count"
	"_box3d_js_get_body_move_events"
	"_box3d_js_get_contact_begin_event_count"
	"_box3d_js_get_contact_begin_events"
	"_box3d_js_get_contact_end_event_count"
	"_box3d_js_get_contact_end_events"
	"_box3d_js_get_contact_hit_event_count"
	"_box3d_js_get_contact_hit_events"
	"_box3d_js_destroy_body"
	"_box3d_js_destroy_mesh"
	"_box3d_js_destroy_joint"
	"_box3d_js_get_body_transform"
	"_box3d_js_get_body_world_center"
	"_box3d_js_set_body_transform"
	"_box3d_js_get_body_linear_velocity"
	"_box3d_js_set_body_linear_velocity"
	"_box3d_js_get_body_angular_velocity"
	"_box3d_js_set_body_angular_velocity"
	"_box3d_js_set_body_motion_locks"
	"_box3d_js_apply_body_linear_impulse"
	"_box3d_js_set_body_gravity_scale"
	"_box3d_js_set_body_type"
	"_box3d_js_enable_body_sleep"
	"_box3d_js_set_body_awake"
	"_box3d_js_set_body_target_transform"
	"_box3d_js_disable_body"
	"_box3d_js_enable_body"
	"_box3d_js_wake_joint_bodies"
	"_box3d_js_get_distance_joint_current_length"
	"_box3d_js_set_distance_joint_length"
	"_box3d_js_enable_distance_joint_spring"
	"_box3d_js_set_distance_joint_spring_hertz"
	"_box3d_js_set_distance_joint_spring_damping_ratio"
	"_box3d_js_get_revolute_joint_angle"
	"_box3d_js_enable_revolute_joint_motor"
	"_box3d_js_set_revolute_joint_motor_speed"
	"_box3d_js_set_revolute_joint_max_motor_torque"
	"_box3d_js_enable_revolute_joint_spring"
	"_box3d_js_set_revolute_joint_target_angle"
	"_box3d_js_set_revolute_joint_spring_hertz"
	"_box3d_js_set_revolute_joint_spring_damping_ratio"
	"_box3d_js_set_weld_joint_linear_hertz"
	"_box3d_js_set_weld_joint_linear_damping_ratio"
	"_box3d_js_set_weld_joint_angular_hertz"
	"_box3d_js_set_weld_joint_angular_damping_ratio"
	"_box3d_js_set_motor_joint_max_spring_force"
	"_box3d_js_set_motor_joint_max_spring_torque"
	"_box3d_js_set_parallel_joint_spring_hertz"
	"_box3d_js_set_parallel_joint_spring_damping_ratio"
	"_box3d_js_get_joint_constraint_force_length"
	"_box3d_js_get_joint_constraint_torque_length"
	"_box3d_js_get_prismatic_joint_translation"
	"_box3d_js_enable_prismatic_joint_spring"
	"_box3d_js_set_prismatic_joint_spring_hertz"
	"_box3d_js_set_prismatic_joint_spring_damping_ratio"
	"_box3d_js_set_prismatic_joint_target_translation"
	"_box3d_js_enable_prismatic_joint_motor"
	"_box3d_js_set_prismatic_joint_motor_speed"
	"_box3d_js_set_prismatic_joint_max_motor_force"
	"_box3d_js_enable_spherical_joint_cone_limit"
	"_box3d_js_set_spherical_joint_cone_limit"
	"_box3d_js_enable_spherical_joint_twist_limit"
	"_box3d_js_set_spherical_joint_twist_limits"
	"_box3d_js_enable_spherical_joint_motor"
	"_box3d_js_set_spherical_joint_max_motor_torque"
	"_box3d_js_set_spherical_joint_motor_velocity"
	"_box3d_js_enable_spherical_joint_spring"
	"_box3d_js_set_spherical_joint_spring_hertz"
	"_box3d_js_set_spherical_joint_spring_damping_ratio"
	"_box3d_js_set_spherical_joint_target_rotation"
	"_box3d_js_enable_wheel_joint_suspension_limit"
	"_box3d_js_set_wheel_joint_suspension_limits"
	"_box3d_js_enable_wheel_joint_spin_motor"
	"_box3d_js_set_wheel_joint_max_spin_torque"
	"_box3d_js_set_wheel_joint_spin_motor_speed"
	"_box3d_js_enable_wheel_joint_suspension"
	"_box3d_js_set_wheel_joint_suspension_hertz"
	"_box3d_js_set_wheel_joint_suspension_damping_ratio"
	"_box3d_js_enable_wheel_joint_steering"
	"_box3d_js_set_wheel_joint_steering_hertz"
	"_box3d_js_set_wheel_joint_steering_damping_ratio"
	"_box3d_js_set_wheel_joint_target_steering_angle"
	"_box3d_js_enable_wheel_joint_steering_limit"
	"_box3d_js_set_wheel_joint_steering_limits"
	"_box3d_js_get_wheel_joint_steering_angle"
	"_box3d_js_explode_world"
	"_box3d_js_add_cylinder_shape"
	"_box3d_js_add_hull_shape"
	"_box3d_js_is_body_awake"
)

list(REMOVE_DUPLICATES export_names)
list(REMOVE_ITEM export_names "_b3InternalAssert")
list(REMOVE_ITEM export_names "_b3World_DumpShapeBounds")

if(BOX3D_DOUBLE_PRECISION)
	list(REMOVE_ITEM export_names "_b3CreateWorld")
	list(APPEND export_names "_b3CreateWorldDoublePrecision")
endif()

set(export_list "")
foreach(name IN LISTS export_names)
	if(export_list STREQUAL "")
		set(export_list "'${name}'")
	else()
		string(APPEND export_list ",'${name}'")
	endif()
endforeach()

file(WRITE "${OUTPUT_FILE}" "-sEXPORTED_FUNCTIONS=[${export_list}]\n")
