export type SettingsSaveState = "saved" | "saving" | "pending" | "blocked";

type SettingsStorageScheduler = <T>(operation: () => Promise<T>) => Promise<T>;
const SETTINGS_STORAGE_QUEUE = Symbol.for("docwen-assistant.settings-storage-queue");

/** Share storage ordering across module reloads, scoped to this Vault's App. */
export function settingsStorageScheduler(host: object): SettingsStorageScheduler {
  const owner = host as { [SETTINGS_STORAGE_QUEUE]?: { tail: Promise<unknown> } };
  const queue = owner[SETTINGS_STORAGE_QUEUE] ??= { tail: Promise.resolve() };
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.tail.then(operation);
    queue.tail = result.catch(() => undefined);
    return result;
  };
}

/** Serializes immutable settings snapshots and retains the latest failed one. */
export class SettingsSaveCoordinator<T> {
  private queue: Promise<void> = Promise.resolve();
  private failedSave: { readonly generation: number; readonly snapshot: T } | null = null;
  private latestRequestedGeneration = 0;
  private state: SettingsSaveState = "saved";
  private pending = 0;

  constructor(
    private readonly persist: (snapshot: T) => Promise<void>,
    private readonly schedule: SettingsStorageScheduler = (operation) => this.queue.catch(() => undefined).then(operation),
  ) {}

  save(snapshot: T): Promise<void> {
    const generation = ++this.latestRequestedGeneration;
    this.state = "saving";
    this.pending += 1;
    const operation = this.schedule(async () => {
      try {
        await this.persist(snapshot);
        if (this.failedSave !== null && this.failedSave.generation <= generation) {
          this.failedSave = null;
        }
        this.state = generation === this.latestRequestedGeneration ? "saved" : "saving";
      } catch (error) {
        if (generation === this.latestRequestedGeneration) {
          this.failedSave = { generation, snapshot };
          this.state = "pending";
        } else {
          this.state = "saving";
        }
        throw error;
      } finally {
        this.pending -= 1;
      }
    });
    this.queue = operation;
    return operation;
  }

  retry(): Promise<void> {
    const failed = this.failedSave;
    if (failed === null || failed.generation !== this.latestRequestedGeneration) {
      return Promise.resolve();
    }
    return this.save(failed.snapshot);
  }

  getState(): SettingsSaveState {
    return this.state;
  }

  get hasPendingWork(): boolean {
    return this.pending > 0;
  }

  settle(): Promise<void> {
    return this.queue;
  }
}
