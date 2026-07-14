set(BOX3D_WASM_PUBLIC_HEADERS
	${CMAKE_SOURCE_DIR}/include/box3d/base.h
	${CMAKE_SOURCE_DIR}/include/box3d/box3d.h
	${CMAKE_SOURCE_DIR}/include/box3d/collision.h
	${CMAKE_SOURCE_DIR}/include/box3d/math_functions.h
	${CMAKE_SOURCE_DIR}/include/box3d/types.h
)

set(BOX3D_WASM_EXPORTS_RESPONSE "${CMAKE_CURRENT_BINARY_DIR}/box3d_exports.rsp")
string(JOIN "|" BOX3D_WASM_PUBLIC_HEADERS_ARG ${BOX3D_WASM_PUBLIC_HEADERS})

set(BOX3D_WASM_DOUBLE_PRECISION OFF)
if(BOX3D_DOUBLE_PRECISION)
	set(BOX3D_WASM_DOUBLE_PRECISION ON)
endif()

execute_process(
	COMMAND ${CMAKE_COMMAND}
		-DOUTPUT_FILE=${BOX3D_WASM_EXPORTS_RESPONSE}
		-DHEADERS=${BOX3D_WASM_PUBLIC_HEADERS_ARG}
		-DBOX3D_DOUBLE_PRECISION=${BOX3D_WASM_DOUBLE_PRECISION}
		-P ${CMAKE_CURRENT_SOURCE_DIR}/GenerateExports.cmake
	COMMAND_ERROR_IS_FATAL ANY
)

set(BOX3D_WASM_FILES
	hello_world.c
	benchmark_helpers_bridge.c
	../shared/human.c
	../shared/utils.c
)

add_executable(box3d_wasm ${BOX3D_WASM_FILES})

set_target_properties(box3d_wasm PROPERTIES
	C_STANDARD 17
	C_STANDARD_REQUIRED YES
	C_EXTENSIONS NO
	OUTPUT_NAME "box3d-raw"
	SUFFIX ".js"
)

target_link_libraries(box3d_wasm PRIVATE box3d)

set(BOX3D_WASM_LINK_OPTIONS
	"--no-entry"
	"SHELL:-sALLOW_MEMORY_GROWTH=1"
	"SHELL:-sENVIRONMENT=web,worker"
	"SHELL:-sFILESYSTEM=0"
	"SHELL:-sMODULARIZE=1"
	"SHELL:-sEXPORT_ES6=1"
	"SHELL:-sEXPORT_NAME=Box3DRawModule"
	"@${BOX3D_WASM_EXPORTS_RESPONSE}"
	"SHELL:-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue']"
)

if(BOX3D_EMSCRIPTEN_PTHREADS)
	list(APPEND BOX3D_WASM_LINK_OPTIONS
		"SHELL:-pthread"
		"SHELL:-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency"
	)
endif()

target_link_options(box3d_wasm PRIVATE ${BOX3D_WASM_LINK_OPTIONS})

add_custom_command(TARGET box3d_wasm POST_BUILD
	COMMAND ${CMAKE_COMMAND} -E copy_if_different
		${CMAKE_CURRENT_SOURCE_DIR}/box3d.js
		$<TARGET_FILE_DIR:box3d_wasm>/box3d.js
	COMMAND ${CMAKE_COMMAND} -E copy_if_different
		${CMAKE_CURRENT_SOURCE_DIR}/demo.html
		$<TARGET_FILE_DIR:box3d_wasm>/demo.html
)

source_group(TREE "${CMAKE_SOURCE_DIR}" PREFIX "src" FILES ${BOX3D_WASM_FILES})
