import type { ThreadGenerator } from "./Signal";

/**
 * Thread scheduler for managing animation generators
 */
export class ThreadScheduler {
  private threads: Set<ThreadGenerator> = new Set();
  private currentTime = 0;
  private lastUpdateTime = 0;
  private initialized = false;

  /**
   * Add a thread to the scheduler
   */
  public add(thread: ThreadGenerator): void {
    this.threads.add(thread);
  }

  /**
   * Remove a thread from the scheduler
   */
  public remove(thread: ThreadGenerator): void {
    this.threads.delete(thread);
  }

  /**
   * Update all threads with delta time
   */
  public update(time: number): void {
    // Calculate delta
    const delta = this.initialized ? time - this.lastUpdateTime : 0;

    this.lastUpdateTime = time;
    this.currentTime = time;
    this.initialized = true;

    const threadsToRemove: ThreadGenerator[] = [];

    for (const thread of this.threads) {
      const result = thread.next(delta);
      if (result.done) {
        threadsToRemove.push(thread);
      }
    }

    // Remove completed threads
    for (const thread of threadsToRemove) {
      this.threads.delete(thread);
    }
  }

  /**
   * Clear all threads
   */
  public clear(): void {
    this.threads.clear();
  }

  /**
   * Get current time
   */
  public getTime(): number {
    return this.currentTime;
  }

  /**
   * Reset time
   */
  public reset(): void {
    this.currentTime = 0;
    this.lastUpdateTime = 0;
    this.initialized = false;
  }

  /**
   * Check if scheduler has active threads
   */
  public hasActiveThreads(): boolean {
    return this.threads.size > 0;
  }
}
