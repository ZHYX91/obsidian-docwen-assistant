#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/fs.h>
#include <node_api.h>
#include <string.h>
#include <sys/syscall.h>
#include <unistd.h>

/* Node exposes rename(), but not RENAME_NOREPLACE. Never emulate the flag with
 * a separate existence check: another process can create an empty directory. */
static napi_value rename_directory(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2], result;
  char paths[2][PATH_MAX];
  if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok || argc != 2) {
    napi_throw_type_error(env, NULL, "Two absolute directory paths are required.");
    return NULL;
  }
  for (size_t i = 0; i < 2; i++) {
    size_t length, copied;
    if (napi_get_value_string_utf8(env, args[i], NULL, 0, &length) != napi_ok ||
        length == 0 || length >= PATH_MAX ||
        napi_get_value_string_utf8(env, args[i], paths[i], PATH_MAX, &copied) != napi_ok ||
        copied != length || strlen(paths[i]) != length || paths[i][0] != '/') {
      napi_throw_type_error(env, NULL, "Invalid absolute directory path.");
      return NULL;
    }
  }
  int error = syscall(SYS_renameat2, AT_FDCWD, paths[0], AT_FDCWD, paths[1],
                      RENAME_NOREPLACE) == 0 ? 0 : errno;
  if (napi_create_int32(env, error, &result) != napi_ok) return NULL;
  return result;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_value function;
  if (napi_create_function(env, "renameDirectory", NAPI_AUTO_LENGTH,
                           rename_directory, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "renameDirectory", function) != napi_ok) return NULL;
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
