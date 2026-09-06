import { LocalCliError, RemoteMachineError } from "../docwen";
import { VaultWriteError } from "../host/vault-write-transaction";
import { t } from "../i18n";

export function getErrorMessage(error: unknown): string {
  const code = getLocalErrorCode(error);
  if (code === "cli_incompatible_version") return t("settingsConnectionIncompatible");
  if (code === "cli_health_failed") return t("settingsConnectionHealthFailed");
  if (code === "cli_timeout") return t("errorOperationTimeout");
  if (["vault_target_changed", "vault_content_conflict"].includes(code)) {
    return t("errorContentConflict");
  }
  return t("errorOperationFailed");
}

export function getErrorDiagnostics(error: unknown): Record<string, unknown> {
  return {
    code: getLocalErrorCode(error),
    message: error instanceof Error ? error.message : String(error),
    details: getErrorDetails(error),
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
