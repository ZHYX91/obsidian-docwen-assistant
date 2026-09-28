# Linux atomic directory publication

DocWen Assistant publishes a complete conversion result with an atomic no-replace directory rename.
Windows uses the operating system's directory rename semantics. Linux x64 uses a minimal Node-API 8
helper that calls `renameat2(..., RENAME_NOREPLACE)`; it never emulates no-replace with an existence
check followed by ordinary `rename()`.

The C source and binary identity are pinned in `BUILD.json`. The helper was taken from the public
`ZHYX91/docwen-openclaw` repository at commit
`935f0a816da96c8f42a72ddba662d5556fa3ddd1`, where the source and compiled Linux x64 binary are
published together. Node-API 8 is independent of V8's ABI. At runtime Assistant requires Linux x64
and Node-API 8 or later, verifies the embedded binary SHA-256, writes it to an owned temporary
directory, loads it, and removes that temporary file before publication. Unsupported architectures,
runtimes, kernels, or filesystems fail closed before the prepared result becomes visible.

The binary bytes are embedded in the bundled `main.js`; no `.node` file is added to the plugin
installation or release asset inventory. The existing loose `main.js`, `manifest.json`, and
`styles.css` assets and the versioned manual-install ZIP contract therefore remain unchanged. This
boundary does not download code, invoke a compiler or shell at runtime, search for executables, or
depend on another repository at runtime.
