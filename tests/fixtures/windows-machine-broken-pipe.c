// Controlled Windows pipe fixture for real inherited-handle closure.
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

static WCHAR root[32768], file[32768];
static void record(const char *event, int id) {
  swprintf_s(file, 32768, L"%ls\\trace.jsonl", root);
  FILE *out = NULL;
  if (_wfopen_s(&out, file, L"ab") || !out) ExitProcess(92);
  fprintf(out, "{\"event\":\"%s\",\"pid\":%lu,\"id\":%d}\n", event, GetCurrentProcessId(), id);
  fclose(out);
}
static int request(HANDLE input) {
  char header[1024], body[8192];
  DWORD count;
  unsigned used = 0;
  while (used < sizeof(header) - 1) {
    if (!ReadFile(input, header + used, 1, &count, NULL) || count != 1) ExitProcess(93);
    used++;
    if (used >= 4 && !memcmp(header + used - 4, "\r\n\r\n", 4)) break;
  }
  header[used] = 0;
  int length = atoi(header + strlen("Content-Length: "));
  if (length < 1 || length >= (int)sizeof(body)) ExitProcess(94);
  used = 0;
  while (used < (unsigned)length) {
    if (!ReadFile(input, body + used, (DWORD)length - used, &count, NULL) || !count) ExitProcess(95);
    used += count;
  }
  body[used] = 0;
  char *id = strstr(body, "\"id\":");
  if (!id) ExitProcess(96);
  return atoi(id + 5);
}
static void reply(HANDLE output, int id, const char *result) {
  char json[2048], header[128];
  DWORD count;
  int size = sprintf_s(json, sizeof(json), "{\"jsonrpc\":\"2.0\",\"id\":%d,\"result\":%s}", id, result);
  int prefix = sprintf_s(header, sizeof(header), "Content-Length: %d\r\n\r\n", size);
  if (!WriteFile(output, header, prefix, &count, NULL) || count != (DWORD)prefix) ExitProcess(97);
  if (!WriteFile(output, json, size, &count, NULL) || count != (DWORD)size) ExitProcess(98);
  record("reply_sent", id);
}
int main(void) {
  if (!GetEnvironmentVariableW(L"DOCWEN_DATA_DIR", root, 32768)) return 90;
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  int id = request(input);
  if (!CloseHandle(input)) return 99;
  SetStdHandle(STD_INPUT_HANDLE, INVALID_HANDLE_VALUE);
  record("stdin_closed", id);
  reply(output, id, "{\"protocol\":{\"name\":\"docwen.machine\",\"major\":2,\"minor\":0},\"server\":{\"name\":\"DocWen\",\"version\":\"0.13.0\"},\"artifact_bundle_schema\":\"docwen.artifact_bundle.v3\",\"methods\":[],\"features\":{\"progress\":true,\"cancellation\":true},\"max_concurrent_tasks\":1}");
  Sleep(INFINITE);
  return 0;
}
