import type { DocWenConnectionMode } from "../settings-model";

export type DocWenConnectionStatus =
  | { state: "unchecked" }
  | { state: "checking"; mode: DocWenConnectionMode }
  | { state: "connected"; mode: DocWenConnectionMode; productVersion: string }
  | { state: "error"; mode: DocWenConnectionMode; code: string };
