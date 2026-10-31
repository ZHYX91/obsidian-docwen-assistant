# Linux atomic directory publication

DocWen Assistant publishes a complete conversion result with an atomic no-replace directory rename.
Windows uses the operating system's directory rename semantics. Linux x64 uses a minimal Node-API 8
helper that calls `renameat2(..., RENAME_NOREPLACE)`; it never emulates no-replace with an existence
check followed by ordinary `rename()`.

The C source and binary identity are pinned in `BUILD.json`. Source checks and the production
artifact check verify those digests and require the final `dist/main.js` to retain the exact
embedded payload. The helper was taken from the public
`ZHYX91/docwen-openclaw` repository at commit
`935f0a816da96c8f42a72ddba662d5556fa3ddd1`, where the source and compiled Linux x64 binary are
published together. Node-API 8 is independent of V8's ABI. At runtime Assistant requires Linux x64
and Node-API 8 or later, verifies the embedded binary SHA-256, writes it to an owned temporary
directory, loads it, and removes that temporary file before publication. Unsupported architectures,
runtimes, kernels, or filesystems fail closed before the prepared result becomes visible.

Node-API's ABI stability is a compatibility basis, not proof of loading inside Electron or Obsidian;
that remains a separate real-host acceptance item.

The binary bytes are embedded in the bundled `main.js`; no `.node` file is added to the plugin
installation or release asset inventory. The existing loose `main.js`, `manifest.json`, and
`styles.css` assets and the versioned manual-install ZIP contract therefore remain unchanged. This
boundary does not download code, invoke a compiler or shell at runtime, search for executables, or
depend on another repository at runtime.

## Windows Machine lifetime ownership

For automatic background connections, the controller queries the current user's fixed
`ZHYX.DocWen_sncv8jc4ytfdj` package family with Windows package APIs and launches the registered
package's `DocWenCLI.exe`. Missing or ambiguous registration fails closed; no arbitrary alias
reparse target, PATH search, or guessed installation directory is trusted. The public execution
alias must still be enabled for automatic discovery. Manual paths and GUI-control activation retain
their existing behavior. Both Machine modes use the same atomic Job membership and cleanup below.

Within one Windows plugin instance, GUI-control subprocesses and Machine sessions share a bounded,
cancellable queue. This also covers capability preload requests, so a GUI-control alias activation
cannot overlap a Machine Job attachment. Initial connection discovery awaits GUI-control completion
before checking Machine health. Waiting Machine requests are cancelled on unload. This coordination
does not claim control over independently launched processes outside the plugin.
If either client reports unconfirmed process cleanup, queued and subsequent starts fail closed with
the original cleanup error until the plugin is reloaded; freeing a queue slot never proves process exit.

Windows Machine sessions use a minimal x64 controller embedded in `main.js`. The controller creates
a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and passes that Job through
`PROC_THREAD_ATTRIBUTE_JOB_LIST` while `CreateProcessW` creates DocWen suspended. Membership is
therefore established at process creation rather than by scanning or acting on a historical PID.
After the direct DocWen process exits, the controller still owns the Job and terminates any remaining
members before it exits. Abnormal Assistant cleanup terminates only the currently held controller
process; closing its Job handle supplies the kill authority. There is no `taskkill /PID`, process-name
scan, sibling-repository lookup, runtime download, or runtime native compilation.

The adapted source is `windows-job.c`, derived under MIT from
`ZHYX91/docwen-openclaw@d7ad7294b9cadcfea0d430d0dc42ea0bdb48fc10`. Its import definition,
source SHA-256, generated PE SHA-256, byte length, x64 PE identity, zero COFF timestamp, exact MSVC
compiler/librarian/linker identity and flags are pinned in `WINDOWS-BUILD.json`.
`scripts/build-native-windows-owner.mjs` reproduces the PE and generated TypeScript payload on a
Windows x64 host with the recorded MSVC toolset. It searches installed Visual Studio instances for
that exact toolset and verifies all three recorded tool identities before compiling; a newer
installed toolset is not selected automatically. It resolves the x64 compiler tools directly
and does not download a toolchain. Two clean build directories must produce identical bytes before the
embedded payload is updated.

When target process creation fails, the controller emits only the fixed
`DOCWEN_OWNER_CREATE_ERROR:<Win32 code>` record. Assistant retains that numeric
startup error separately from the cleanup result. It never exports the target
path, command line or arbitrary stderr as shareable diagnostics.

At runtime Assistant decodes the pinned bytes into a random owned temporary directory and verifies the
SHA-256 plus PE32+/x64/subsystem/timestamp identity both when materializing and before reuse. Failure to
create or verify that owner rejects the Machine launch; it never falls back to directly spawning
DocWen. The controller drops its private target-path environment variable before launching DocWen and
closes its duplicate stdin read handle before resuming the target, preserving the existing bounded
environment, cwd, Unicode path and real broken-pipe semantics.

Controller exit 125 denotes an internal owner failure; exit 126 means target creation failed
because the executable was not found. After a target starts and its Job is successfully closed,
target exits 125 and 126 are mapped to ordinary target failure 127, so target errors cannot be
misreported as unconfirmed cleanup or a missing execution alias.

Windows CI provisions only the recorded release-family component from a fixed
Microsoft Build Tools bootstrapper. The bootstrapper size, SHA-256 and Microsoft
Authenticode signature must match before the official setup engine runs with its
default content validation. Installer failures and reboot-required results fail
the job. Discovery accepts either the existing Latest component or the recorded
family component. Directory names only identify candidates: servicing binaries
can live in a different base-patch directory. The compiler, librarian and linker
from one candidate must all match their recorded full identities exactly. Both independent rebuilds, build records and embedded bytes must
still match. Provisioning diagnostics retain the earliest error separately from
rebuild outputs.

## Linux Machine lifetime ownership

Linux x64 and arm64 content sessions use `linux-owner.c`, an MIT implementation shared with
DocWen for OpenClaw. The x64 `LINUX-OWNER-BUILD.json` and arm64 `LINUX-OWNER-BUILD.arm64.json` pin the
vendored source, compiler, flags, ELF hash and size. Their matching
`linux-native-owner-<arch>.ts` modules embed the exact bytes inside
`main.js`. No sibling repository, extra plugin asset or runtime compiler is needed.
Rebuild with `node scripts/build-native-linux-owner.mjs /absolute/owned/output` on
the corresponding native Linux architecture, then compare two clean builds with the recorded payload before updating it.

Two subreapers remain outside the business session. They adopt orphaned descendants
even after `setsid()` or double-fork, validate current wait-parenthood and signal
through pidfds. Only `ECHILD` confirms complete reaping; empty procfs listings,
old PID/start-time snapshots and ordinary process-name scans never grant authority.
Control loss and either supervisor's separate death trigger bounded cleanup. Loss of
proof stays unconfirmed; simultaneous destruction of both owners is outside this
guarantee. Mounted procfs and kernel pidfd support are required. The verified private
image is unlinked before the owner permits Machine startup, preserving real EPIPE.
Unknown Linux architectures fail before image writes or business spawn; there
is no JavaScript process-group/procfs fallback. ARM64 keeps its native 64 KiB
ELF alignment and an explicit 256 KiB image cap; x64 retains its 128 KiB cap.
Result-directory export continues to require the independent x64 publication
addon; health, proofreading and single-file numbering use either lifetime owner.

The Linux owner is statically linked with Ubuntu 24.04 `musl-tools`, without an
ELF interpreter, dynamic libc dependency or GLIBC version floor. The build receipt
records the musl package version and archive hash. [Upstream notices](MUSL-LICENSE.txt)
are preserved in the embedded module and the shipped `main.js` legal comment.

The native CI matrix independently rebuilds x64 and arm64 twice, compares both
records and embedded modules, runs real topology/ptrace cases and exercises the
actual MachineClient adapter on each native host. The reusable bootstrap workflow
collects new payloads before embedding; its observations do not establish later
production adapter, Core-pair or Obsidian acceptance.

`node scripts/check-linux-owner-topology.mjs /absolute/owned/owner /absolute/owned/diagnostics`
retains per-case JSON snapshots and the exact generated peer source. Snapshots include
the current stage, bounded stdout/stderr/control bytes, exit events, observed PID
lifetimes and process states, metadata publication and heartbeat bytes, plus original
and cleanup errors. CI uploads these sidecars even when the topology gate fails.
Metadata and owner-close waits each retain their six-second deadline. Normal exit
and root-crash peers wait for an explicit release after the live baseline has been
recorded; owned heartbeats and unrelated sentinels have no self-expiry. Double-fork
metadata is closed before an atomic same-directory rename makes it visible.
