import { writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

/** Publish only a fully written, closed JSON file in the same directory. */
export function atomicPythonMetadata(filename, expression) {
  const pending = filename + ".pending";
  return [
    `with open(${JSON.stringify(pending)}, 'x') as metadata_file:`,
    ` json.dump(${expression}, metadata_file)`,
    `os.replace(${JSON.stringify(pending)}, ${JSON.stringify(filename)})`,
  ];
}

export async function writeTopologyDiagnostic(directory, mode, record) {
  const target = join(directory, mode + ".json");
  const pending = target + ".pending";
  await writeFile(pending, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  await rename(pending, target);
}

export function diagnosticError(error) {
  return error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.cause === undefined ? {} : { cause: diagnosticError(error.cause) }),
        ...(error instanceof AggregateError ? { errors: error.errors.map(diagnosticError) } : {}),
      }
    : { value: String(error) };
}
