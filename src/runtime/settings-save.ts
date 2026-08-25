export type SettingsSaveState = "saved" | "saving" | "pending";

/** Serializes immutable settings snapshots and retains the latest failed one. */
export class SettingsSaveCoordinator<T> {
  private queue: Promise<void> = Promise.resolve();
  private failedSave: { readonly generation: number; readonly snapshot: T } | null = null;
  private latestRequestedGeneration = 0;
  private state: SettingsSaveState = "saved";

  constructor(private readonly persist: (snapshot: T) => Promise<void>) {}

  save(snapshot: T): Promise<void> {
    const generation = ++this.latestRequestedGeneration;
    this.state = "saving";
    const operation = this.queue.catch(() => undefined).then(async () => {
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
}
