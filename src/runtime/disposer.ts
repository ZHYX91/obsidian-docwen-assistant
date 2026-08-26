/** Reverse-order, idempotent runtime rollback with per-cleanup isolation. */
export class RuntimeDisposer {
  private cleanups: Array<() => void> = [];
  private disposed = false;

  add(cleanup: () => void): void {
    if (this.disposed) {
      this.run(cleanup);
      return;
    }
    this.cleanups.push(cleanup);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const cleanups = this.cleanups.splice(0).reverse();
    for (const cleanup of cleanups) this.run(cleanup);
  }

  private run(cleanup: () => void): void {
    try {
      cleanup();
    } catch (error) {
      console.error("[DocWen Assistant] runtime cleanup failed", error);
    }
  }
}
