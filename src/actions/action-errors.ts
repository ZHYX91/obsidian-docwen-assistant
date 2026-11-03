import { LocalCliError, RemoteMachineError } from "../docwen";
import { getFailureWarnings } from "../docwen/operation-outcome";
import { VaultWriteError } from "../host/vault-write-transaction";
import { t } from "../i18n";
import { diagnosticCode, diagnosticDetails } from "./diagnostic-details";

export function getErrorMessage(error: unknown): string {
  const code = getLocalErrorCode(error);
  const details = getErrorDetails(error);
  if (typeof details === "object" && details !== null && "outputState" in details && details.outputState === "unconfirmed") {
    return t("errorOutputUnconfirmed");
  }
  const recovery = getWindowsOwnerRecoveryMessage(code, details);
  if (recovery) return recovery;
  if (error instanceof RemoteMachineError) {
    if (error.category === "internal") return t("errorDocWenInternal");
    if (["unsupported", "unavailable", "dependency"].includes(error.category)) {
      return t("errorCapabilityUnavailable");
    }
    if (error.category === "timeout") return t("errorOperationTimeout");
    if (error.category === "conflict") return t("errorContentConflict");
  }
  if (code === "cli_incompatible_version") return t("settingsConnectionIncompatible");
  if (code === "cli_health_failed") return t("settingsConnectionHealthFailed");
  if (code === "cli_capability_unavailable") return t("errorCapabilityUnavailable");
  if (code === "cli_timeout") return t("errorOperationTimeout");
  if (code === "cli_output_filesystem_unsupported") return t("errorOutputFilesystemUnsupported");
  if (code === "cli_output_preflight_failed") return t("errorOutputPreflightFailed");
  if (["vault_target_changed", "vault_content_conflict"].includes(code)) {
    return t("errorContentConflict");
  }
  return t("errorOperationFailed");
}

export function getErrorDiagnostics(error: unknown): Record<string, unknown> {
  return {
    redacted: true,
    code: diagnosticCode(getLocalErrorCode(error)),
    message: getErrorMessage(error),
    details: diagnosticDetails(getErrorDetails(error)),
    warnings: getFailureWarnings(error),
  };
}

export function getLocalErrorCode(error: unknown): string {
  if (error instanceof LocalCliError || error instanceof RemoteMachineError || error instanceof VaultWriteError) {
    return error.code;
  }
  return "";
}

export function getErrorDetails(error: unknown): unknown {
  if (error instanceof LocalCliError || error instanceof RemoteMachineError || error instanceof VaultWriteError) {
    return error.details;
  }
  return null;
}

export function isCancellationError(error: unknown): boolean {
  return getLocalErrorCode(error) === "cli_cancelled" ||
    (error instanceof DOMException && error.name === "AbortError");
}

/** Use only observed owner failures; a target CreateProcess error is not an antivirus diagnosis. */
export function getWindowsOwnerRecoveryMessage(code: string, value: unknown): string | null {
  const details = diagnosticDetails(value);
  if (details.ownershipState !== "windows_job") return null;
  if (code === "cli_cleanup_failed") return t("errorWindowsOwnerCleanup");
  if (!["cli_spawn_failed", "cli_integrity_error"].includes(code)) return null;
  if (!["owner_materialize", "owner_verify", "owner_spawn", "owner_runtime"].includes(String(details.phase))) return null;
  return t("errorWindowsOwnerRecovery");
}
