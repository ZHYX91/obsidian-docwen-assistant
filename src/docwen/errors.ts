export type LocalCliErrorCode =
  | "cli_path_not_configured"
  | "cli_alias_not_found"
  | "cli_platform_unsupported"
  | "cli_not_found"
  | "cli_not_file"
  | "cli_not_executable"
  | "cli_wrong_filename"
  | "cli_spawn_failed"
  | "cli_timeout"
  | "cli_cancelled"
  | "cli_cleanup_failed"
  | "cli_output_limit"
  | "cli_invalid_envelope"
  | "cli_incompatible_version"
  | "cli_protocol_error"
  | "cli_integrity_error"
  | "cli_input_invalid"
  | "cli_health_failed"
  | "cli_commit_failed";

export class LocalCliError extends Error {
  constructor(
    readonly code: LocalCliErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "LocalCliError";
  }
}

export class RemoteMachineError extends Error {
  constructor(
    readonly category: string,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "RemoteMachineError";
  }
}
