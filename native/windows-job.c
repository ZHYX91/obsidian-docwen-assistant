/*
 * Windows Machine lifetime owner for DocWen Assistant.
 * Derived from ZHYX91/docwen-openclaw native/windows-job.c at
 * d7ad7294b9cadcfea0d430d0dc42ea0bdb48fc10 (MIT, ZhengYX).
 * Adapted for the Assistant launch environment and fail-closed target errors.
 */
typedef void *HANDLE;
typedef void *LPVOID;
typedef const void *LPCVOID;
typedef unsigned long DWORD;
typedef unsigned int UINT;
typedef int BOOL;
typedef unsigned short WORD;
typedef unsigned long long ULONG_PTR;
typedef ULONG_PTR SIZE_T;
typedef long long LONGLONG;
typedef unsigned long long ULONGLONG;
typedef unsigned short WCHAR;
typedef WCHAR *LPWSTR;
typedef const WCHAR *LPCWSTR;
typedef unsigned char BYTE;

#define WINAPI __stdcall
#define TRUE 1
#define FALSE 0
#define INVALID_HANDLE_VALUE ((HANDLE)(long long)-1)
#define STD_INPUT_HANDLE ((DWORD)-10)
#define STD_OUTPUT_HANDLE ((DWORD)-11)
#define STD_ERROR_HANDLE ((DWORD)-12)
#define HANDLE_FLAG_INHERIT 0x00000001u
#define STARTF_USESTDHANDLES 0x00000100u
#define CREATE_SUSPENDED 0x00000004u
#define CREATE_UNICODE_ENVIRONMENT 0x00000400u
#define CREATE_NO_WINDOW 0x08000000u
#define EXTENDED_STARTUPINFO_PRESENT 0x00080000u
#define PROC_THREAD_ATTRIBUTE_JOB_LIST 0x0002000du
#define JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE 0x00002000u
#define JobObjectExtendedLimitInformation 9u
#define INFINITE 0xffffffffu
#define WAIT_OBJECT_0 0u
#define WRAPPER_ERROR 125u
#define TARGET_NOT_FOUND 126u
#define TARGET_FAILURE 127u
#define ERROR_FILE_NOT_FOUND 2u
#define ERROR_PATH_NOT_FOUND 3u
#define MAX_TARGET 16384u
#define MAX_COMMAND 32767u

__declspec(dllimport) HANDLE WINAPI CreateJobObjectW(LPVOID, LPCWSTR);
__declspec(dllimport) BOOL WINAPI SetInformationJobObject(HANDLE, int, LPVOID, DWORD);
__declspec(dllimport) BOOL WINAPI InitializeProcThreadAttributeList(LPVOID, DWORD, DWORD, SIZE_T *);
__declspec(dllimport) BOOL WINAPI UpdateProcThreadAttribute(LPVOID, DWORD, ULONG_PTR, LPVOID, SIZE_T, LPVOID, SIZE_T *);
__declspec(dllimport) void WINAPI DeleteProcThreadAttributeList(LPVOID);
__declspec(dllimport) HANDLE WINAPI GetProcessHeap(void);
__declspec(dllimport) LPVOID WINAPI HeapAlloc(HANDLE, DWORD, SIZE_T);
__declspec(dllimport) BOOL WINAPI HeapFree(HANDLE, DWORD, LPVOID);
__declspec(dllimport) BOOL WINAPI TerminateProcess(HANDLE, UINT);
__declspec(dllimport) BOOL WINAPI TerminateJobObject(HANDLE, UINT);
__declspec(dllimport) BOOL WINAPI CreateProcessW(LPCWSTR, LPWSTR, LPVOID, LPVOID, BOOL, DWORD, LPVOID, LPCWSTR, LPVOID, LPVOID);
__declspec(dllimport) DWORD WINAPI ResumeThread(HANDLE);
__declspec(dllimport) DWORD WINAPI WaitForSingleObject(HANDLE, DWORD);
__declspec(dllimport) BOOL WINAPI GetExitCodeProcess(HANDLE, DWORD *);
__declspec(dllimport) BOOL WINAPI CloseHandle(HANDLE);
__declspec(dllimport) HANDLE WINAPI GetStdHandle(DWORD);
__declspec(dllimport) BOOL WINAPI SetStdHandle(DWORD, HANDLE);
__declspec(dllimport) BOOL WINAPI SetHandleInformation(HANDLE, DWORD, DWORD);
__declspec(dllimport) DWORD WINAPI GetEnvironmentVariableW(LPCWSTR, LPWSTR, DWORD);
__declspec(dllimport) DWORD WINAPI GetLastError(void);
__declspec(dllimport) BOOL WINAPI SetEnvironmentVariableW(LPCWSTR, LPCWSTR);
__declspec(dllimport) void WINAPI ExitProcess(UINT);

struct IO_COUNTERS {
  ULONGLONG ReadOperationCount;
  ULONGLONG WriteOperationCount;
  ULONGLONG OtherOperationCount;
  ULONGLONG ReadTransferCount;
  ULONGLONG WriteTransferCount;
  ULONGLONG OtherTransferCount;
};

struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
  LONGLONG PerProcessUserTimeLimit;
  LONGLONG PerJobUserTimeLimit;
  DWORD LimitFlags;
  SIZE_T MinimumWorkingSetSize;
  SIZE_T MaximumWorkingSetSize;
  DWORD ActiveProcessLimit;
  ULONG_PTR Affinity;
  DWORD PriorityClass;
  DWORD SchedulingClass;
};

struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
  struct JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
  struct IO_COUNTERS IoInfo;
  SIZE_T ProcessMemoryLimit;
  SIZE_T JobMemoryLimit;
  SIZE_T PeakProcessMemoryUsed;
  SIZE_T PeakJobMemoryUsed;
};

struct STARTUPINFOW {
  DWORD cb;
  LPWSTR lpReserved;
  LPWSTR lpDesktop;
  LPWSTR lpTitle;
  DWORD dwX;
  DWORD dwY;
  DWORD dwXSize;
  DWORD dwYSize;
  DWORD dwXCountChars;
  DWORD dwYCountChars;
  DWORD dwFillAttribute;
  DWORD dwFlags;
  WORD wShowWindow;
  WORD cbReserved2;
  BYTE *lpReserved2;
  HANDLE hStdInput;
  HANDLE hStdOutput;
  HANDLE hStdError;
};

struct PROCESS_INFORMATION {
  HANDLE hProcess;
  HANDLE hThread;
  DWORD dwProcessId;
  DWORD dwThreadId;
};

struct STARTUPINFOEXW {
  struct STARTUPINFOW StartupInfo;
  LPVOID lpAttributeList;
};

_Static_assert(sizeof(struct JOBOBJECT_BASIC_LIMIT_INFORMATION) == 64, "basic limit size");
_Static_assert(sizeof(struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION) == 144, "extended limit size");
_Static_assert(sizeof(struct STARTUPINFOW) == 104, "startup size");
_Static_assert(sizeof(struct PROCESS_INFORMATION) == 24, "process info size");
_Static_assert(sizeof(struct STARTUPINFOEXW) == 112, "extended startup size");

static WCHAR target[MAX_TARGET];
static WCHAR commandLine[MAX_COMMAND];
static const WCHAR targetVariable[] = {'D','O','C','W','E','N','_','A','S','S','I','S','T','A','N','T','_','J','O','B','_','T','A','R','G','E','T',0};
static struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits;
static struct STARTUPINFOEXW startup;
static struct PROCESS_INFORMATION processInfo;

static void fail(HANDLE job, HANDLE process, HANDLE thread) {
  if (thread && thread != INVALID_HANDLE_VALUE) CloseHandle(thread);
  if (process && process != INVALID_HANDLE_VALUE) {
    TerminateProcess(process, WRAPPER_ERROR);
    WaitForSingleObject(process, 2000u);
    CloseHandle(process);
  }
  if (job && job != INVALID_HANDLE_VALUE) {
    TerminateJobObject(job, WRAPPER_ERROR);
    CloseHandle(job);
  }
  ExitProcess(WRAPPER_ERROR);
}

static void fail_target_create(HANDLE job, DWORD createError) {
  if (job && job != INVALID_HANDLE_VALUE) {
    TerminateJobObject(job, WRAPPER_ERROR);
    CloseHandle(job);
  }
  if (createError == ERROR_FILE_NOT_FOUND || createError == ERROR_PATH_NOT_FOUND) {
    ExitProcess(TARGET_NOT_FOUND);
  }
  ExitProcess(WRAPPER_ERROR);
}

static BOOL build_command_line(DWORD targetLength) {
  DWORD index = 0;
  if (targetLength + 16u >= MAX_COMMAND) return FALSE;
  commandLine[index++] = L'"';
  for (DWORD i = 0; i < targetLength; i++) {
    if (target[i] == L'"' || target[i] == 0) return FALSE;
    commandLine[index++] = target[i];
  }
  commandLine[index++] = L'"';
  commandLine[index++] = L' ';
  commandLine[index++] = L's';
  commandLine[index++] = L'e';
  commandLine[index++] = L'r';
  commandLine[index++] = L'v';
  commandLine[index++] = L'e';
  commandLine[index++] = L' ';
  commandLine[index++] = L'-';
  commandLine[index++] = L'-';
  commandLine[index++] = L's';
  commandLine[index++] = L't';
  commandLine[index++] = L'd';
  commandLine[index++] = L'i';
  commandLine[index++] = L'o';
  commandLine[index] = 0;
  return TRUE;
}

void entry(void) {
  DWORD targetLength = GetEnvironmentVariableW(targetVariable, target, MAX_TARGET);
  if (targetLength == 0 || targetLength >= MAX_TARGET || !build_command_line(targetLength)) {
    ExitProcess(WRAPPER_ERROR);
  }
  if (!SetEnvironmentVariableW(targetVariable, (LPCWSTR)0)) ExitProcess(WRAPPER_ERROR);

  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  HANDLE error = GetStdHandle(STD_ERROR_HANDLE);
  if (!input || input == INVALID_HANDLE_VALUE || !output || output == INVALID_HANDLE_VALUE || !error || error == INVALID_HANDLE_VALUE) {
    ExitProcess(WRAPPER_ERROR);
  }
  if (!SetHandleInformation(input, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) ||
      !SetHandleInformation(output, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) ||
      !SetHandleInformation(error, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT)) {
    ExitProcess(WRAPPER_ERROR);
  }

  HANDLE job = CreateJobObjectW((LPVOID)0, (LPCWSTR)0);
  if (!job || job == INVALID_HANDLE_VALUE) ExitProcess(WRAPPER_ERROR);
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, (DWORD)sizeof(limits))) {
    fail(job, (HANDLE)0, (HANDLE)0);
  }

  /* Assign membership as part of process creation, not after it. If this
     controller dies during startup, no suspended child can escape the job. */
  SIZE_T attributeBytes = 0;
  InitializeProcThreadAttributeList((LPVOID)0, 1, 0, &attributeBytes);
  if (!attributeBytes) fail(job, (HANDLE)0, (HANDLE)0);
  HANDLE heap = GetProcessHeap();
  startup.lpAttributeList = HeapAlloc(heap, 0, attributeBytes);
  if (!startup.lpAttributeList ||
      !InitializeProcThreadAttributeList(startup.lpAttributeList, 1, 0, &attributeBytes) ||
      !UpdateProcThreadAttribute(startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_JOB_LIST,
                                 &job, sizeof(job), (LPVOID)0, (SIZE_T *)0)) {
    fail(job, (HANDLE)0, (HANDLE)0);
  }
  startup.StartupInfo.cb = (DWORD)sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = input;
  startup.StartupInfo.hStdOutput = output;
  startup.StartupInfo.hStdError = error;
  if (!CreateProcessW(
        target,
        commandLine,
        (LPVOID)0,
        (LPVOID)0,
        TRUE,
        CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT,
        (LPVOID)0,
        (LPCWSTR)0,
        &startup.StartupInfo,
        &processInfo)) {
    DWORD createError = GetLastError();
    fail_target_create(job, createError);
  }
  DeleteProcThreadAttributeList(startup.lpAttributeList);
  HeapFree(heap, 0, startup.lpAttributeList);
  startup.lpAttributeList = (LPVOID)0;

  /* Close the duplicate read end before the child can answer initialize.
     Its own handle-close barrier then proves that no extra reader remains. */
  CloseHandle(input);
  SetStdHandle(STD_INPUT_HANDLE, INVALID_HANDLE_VALUE);
  if (ResumeThread(processInfo.hThread) == 0xffffffffu) {
    TerminateJobObject(job, WRAPPER_ERROR);
    fail(job, processInfo.hProcess, processInfo.hThread);
  }
  CloseHandle(processInfo.hThread);
  processInfo.hThread = (HANDLE)0;

  if (WaitForSingleObject(processInfo.hProcess, INFINITE) != WAIT_OBJECT_0) {
    TerminateJobObject(job, WRAPPER_ERROR);
    fail(job, processInfo.hProcess, (HANDLE)0);
  }
  DWORD exitCode = WRAPPER_ERROR;
  if (!GetExitCodeProcess(processInfo.hProcess, &exitCode)) {
    fail(job, processInfo.hProcess, (HANDLE)0);
  }
  CloseHandle(processInfo.hProcess);
  processInfo.hProcess = (HANDLE)0;

  /* A direct child may have exited while descendants still hold inherited
     stdio. Job ownership survives that root exit, so terminate those members
     before the wrapper itself releases its stdout/stderr handles. */
  if (!TerminateJobObject(job, exitCode == 0 ? WRAPPER_ERROR : exitCode)) {
    fail(job, (HANDLE)0, (HANDLE)0);
  }
  CloseHandle(job);
  /* Keep controller failures distinct from a successfully launched target. */
  ExitProcess(exitCode == WRAPPER_ERROR || exitCode == TARGET_NOT_FOUND
    ? TARGET_FAILURE : exitCode);
}
