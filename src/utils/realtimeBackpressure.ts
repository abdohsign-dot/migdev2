/**
 * Real-time Backpressure Utility
 * 
 * Prevents UI overwhelm from rapid database changes by:
 * - Throttling updates (max updates per second)
 * - Batching updates (group multiple changes)
 * - Debouncing updates (wait for changes to settle)
 * - Queuing updates (process in order)
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Backpressure configuration
 */
export interface BackpressureConfig {
  maxUpdatesPerSecond?: number;  // Default: 10 updates/sec
  batchSize?: number;             // Default: 5 items per batch
  debounceMs?: number;            // Default: 100ms
  queueSize?: number;             // Default: 100 items
}

/**
 * Backpressure statistics
 */
export interface BackpressureStats {
  totalReceived: number;
  totalProcessed: number;
  totalQueued: number;
  currentQueueSize: number;
  droppedUpdates: number;
  averageLatencyMs: number;
}

/**
 * Throttle updates to prevent overwhelming the UI
 */
export class UpdateThrottler {
  private lastUpdateTime = 0;
  private minIntervalMs: number;
  private stats = {
    totalReceived: 0,
    totalProcessed: 0,
    droppedUpdates: 0,
    latencies: [] as number[],
  };

  constructor(maxUpdatesPerSecond: number = 10) {
    this.minIntervalMs = 1000 / maxUpdatesPerSecond;
  }

  /**
   * Check if update should be processed
   */
  shouldProcess(): boolean {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    if (timeSinceLastUpdate >= this.minIntervalMs) {
      this.lastUpdateTime = now;
      this.stats.totalProcessed++;
      return true;
    }

    this.stats.droppedUpdates++;
    return false;
  }

  /**
   * Record update received
   */
  recordReceived(): void {
    this.stats.totalReceived++;
  }

  /**
   * Get statistics
   */
  getStats(): Partial<BackpressureStats> {
    return {
      totalReceived: this.stats.totalReceived,
      totalProcessed: this.stats.totalProcessed,
      droppedUpdates: this.stats.droppedUpdates,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      totalReceived: 0,
      totalProcessed: 0,
      droppedUpdates: 0,
      latencies: [],
    };
  }
}

/**
 * Batch updates to reduce UI re-renders
 */
export class UpdateBatcher<T> {
  private batch: T[] = [];
  private batchSize: number;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private callback: (items: T[]) => void;
  private stats = {
    totalReceived: 0,
    totalBatches: 0,
    totalQueued: 0,
  };

  constructor(
    callback: (items: T[]) => void,
    batchSize: number = 5,
    debounceMs: number = 100
  ) {
    this.callback = callback;
    this.batchSize = batchSize;
    this.debounceMs = debounceMs;
  }

  /**
   * Add item to batch
   */
  add(item: T): void {
    this.stats.totalReceived++;
    this.batch.push(item);
    this.stats.totalQueued++;

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Process immediately if batch is full
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else {
      // Otherwise, debounce
      this.debounceTimer = setTimeout(() => {
        this.flush();
      }, this.debounceMs);
    }
  }

  /**
   * Flush batch immediately
   */
  flush(): void {
    if (this.batch.length === 0) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const itemsToProcess = [...this.batch];
    this.batch = [];
    this.stats.totalBatches++;

    try {
      this.callback(itemsToProcess);
    } catch (error) {
      console.error('Error processing batch:', error);
    }
  }

  /**
   * Get current batch size
   */
  getCurrentBatchSize(): number {
    return this.batch.length;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalReceived: this.stats.totalReceived,
      totalBatches: this.stats.totalBatches,
      currentQueueSize: this.batch.length,
      totalQueued: this.stats.totalQueued,
    };
  }

  /**
   * Reset
   */
  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.batch = [];
    this.stats = {
      totalReceived: 0,
      totalBatches: 0,
      totalQueued: 0,
    };
  }
}

/**
 * Queue updates with backpressure handling
 */
export class BackpressureQueue<T> {
  private queue: T[] = [];
  private maxQueueSize: number;
  private isProcessing = false;
  private callback: (item: T) => Promise<void>;
  private stats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalQueued: 0,
    droppedUpdates: 0,
  };

  constructor(
    callback: (item: T) => Promise<void>,
    maxQueueSize: number = 100
  ) {
    this.callback = callback;
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Add item to queue
   */
  async add(item: T): Promise<boolean> {
    this.stats.totalReceived++;

    // Check if queue is full
    if (this.queue.length >= this.maxQueueSize) {
      this.stats.droppedUpdates++;
      console.warn(`⚠️ Backpressure queue full (${this.maxQueueSize}), dropping update`);
      return false;
    }

    this.queue.push(item);
    this.stats.totalQueued++;

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.process();
    }

    return true;
  }

  /**
   * Process queue
   */
  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;

        try {
          await this.callback(item);
          this.stats.totalProcessed++;
        } catch (error) {
          console.error('Error processing queue item:', error);
          // Continue with next item
        }

        // Yield to event loop to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get statistics
   */
  getStats(): BackpressureStats {
    return {
      totalReceived: this.stats.totalReceived,
      totalProcessed: this.stats.totalProcessed,
      totalQueued: this.stats.totalQueued,
      currentQueueSize: this.queue.length,
      droppedUpdates: this.stats.droppedUpdates,
      averageLatencyMs: 0, // Would need timing data
    };
  }

  /**
   * Reset
   */
  reset(): void {
    this.queue = [];
    this.isProcessing = false;
    this.stats = {
      totalReceived: 0,
      totalProcessed: 0,
      totalQueued: 0,
      droppedUpdates: 0,
    };
  }
}

/**
 * Combined backpressure handler with throttling + batching
 */
export class CombinedBackpressureHandler<T> {
  private throttler: UpdateThrottler;
  private batcher: UpdateBatcher<T>;
  private stats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalQueued: 0,
    droppedUpdates: 0,
  };

  constructor(
    callback: (items: T[]) => void,
    config: BackpressureConfig = {}
  ) {
    const maxUpdatesPerSecond = config.maxUpdatesPerSecond ?? 10;
    const batchSize = config.batchSize ?? 5;
    const debounceMs = config.debounceMs ?? 100;

    this.throttler = new UpdateThrottler(maxUpdatesPerSecond);
    this.batcher = new UpdateBatcher(callback, batchSize, debounceMs);
  }

  /**
   * Handle incoming update
   */
  handle(item: T): void {
    this.stats.totalReceived++;
    this.throttler.recordReceived();

    if (this.throttler.shouldProcess()) {
      this.batcher.add(item);
      this.stats.totalProcessed++;
    } else {
      this.stats.droppedUpdates++;
    }
  }

  /**
   * Flush pending updates
   */
  flush(): void {
    this.batcher.flush();
  }

  /**
   * Get statistics
   */
  getStats(): BackpressureStats {
    const throttlerStats = this.throttler.getStats();
    const batcherStats = this.batcher.getStats();

    return {
      totalReceived: this.stats.totalReceived,
      totalProcessed: this.stats.totalProcessed,
      totalQueued: batcherStats.totalQueued,
      currentQueueSize: batcherStats.currentQueueSize,
      droppedUpdates: this.stats.droppedUpdates,
      averageLatencyMs: 0,
    };
  }

  /**
   * Reset
   */
  reset(): void {
    this.throttler.reset();
    this.batcher.reset();
    this.stats = {
      totalReceived: 0,
      totalProcessed: 0,
      totalQueued: 0,
      droppedUpdates: 0,
    };
  }
}

/**
 * Create a backpressure-aware callback wrapper
 */
export const createBackpressureCallback = <T>(
  callback: (payload: T) => void,
  config: BackpressureConfig = {}
) => {
  const handler = new CombinedBackpressureHandler(
    (items: T[]) => {
      items.forEach(item => {
        try {
          callback(item);
        } catch (error) {
          console.error('Error in backpressure callback:', error);
        }
      });
    },
    config
  );

  return {
    handle: (item: T) => handler.handle(item),
    flush: () => handler.flush(),
    getStats: () => handler.getStats(),
    reset: () => handler.reset(),
  };
};

/**
 * Debounce function for updates
 */
export const debounceUpdate = <T>(
  callback: (item: T) => void,
  delayMs: number = 100
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastItem: T;

  return (item: T) => {
    lastItem = item;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(lastItem);
      timeoutId = null;
    }, delayMs);
  };
};

/**
 * Rate limit function for updates
 */
export const rateLimitUpdate = <T>(
  callback: (item: T) => void,
  maxPerSecond: number = 10
) => {
  const throttler = new UpdateThrottler(maxPerSecond);

  return (item: T) => {
    throttler.recordReceived();
    if (throttler.shouldProcess()) {
      callback(item);
    }
  };
};
