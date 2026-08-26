import { LocalCliError, RemoteMachineError } from "../docwen";
import { VaultWriteError } from "../host/vault-write-transaction";

export function getErrorMessage(error: unknown): string {
  if (error instanceof RemoteMachineError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
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
