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
source SHA-256, generated PE SHA-256, byte length, x64 PE identity, zero COFF timestamp, exact Clang/LLD
identity and flags are pinned in `WINDOWS-BUILD.json`. `scripts/build-native-windows-owner.mjs`
reproduces the PE and generated TypeScript payload on the recorded Linux x64 LLVM toolchain. Two clean
build directories must produce identical bytes before the embedded payload is updated.

At runtime Assistant decodes the pinned bytes into a random owned temporary directory and verifies the
SHA-256 plus PE32+/x64/subsystem/timestamp identity both when materializing and before reuse. Failure to
create or verify that owner rejects the Machine launch; it never falls back to directly spawning
DocWen. The controller drops its private target-path environment variable before launching DocWen and
closes its duplicate stdin read handle before resuming the target, preserving the existing bounded
environment, cwd, Unicode path and real broken-pipe semantics.
