export interface QueueTask {
  id: string;
  name: string;
  priority: "high" | "medium" | "low";
  action: () => Promise<any>;
  verify?: (result: any) => Promise<boolean>;
  status: "pending" | "executing" | "completed" | "failed" | "cancelled";
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

export class TaskQueue {
  private static instance: TaskQueue;
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private currentActiveTask: QueueTask | null = null;

  private constructor() {}

  public static getInstance(): TaskQueue {
    if (!TaskQueue.instance) {
      TaskQueue.instance = new TaskQueue();
    }
    return TaskQueue.instance;
  }

  /**
   * Adds a task to the queue and triggers processing.
   */
  public enqueue(
    name: string,
    action: () => Promise<any>,
    options?: {
      id?: string;
      priority?: "high" | "medium" | "low";
      verify?: (result: any) => Promise<boolean>;
      maxRetries?: number;
    }
  ): string {
    const id = options?.id || "task_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
    const priority = options?.priority || "medium";
    const verify = options?.verify;
    const maxRetries = options?.maxRetries ?? 1;

    const task: QueueTask = {
      id,
      name,
      priority,
      action,
      verify,
      status: "pending",
      retryCount: 0,
      maxRetries,
      timestamp: Date.now()
    };

    this.queue.push(task);
    this.sortQueue();
    
    console.log(`[TaskQueue] Enqueued task "${name}" [ID: ${id}, Priority: ${priority}]`);
    
    // Non-blocking trigger of the queue processor
    this.processNext();

    return id;
  }

  /**
   * Cancels an active or pending task. Useful for conversation interruptions (Feature 4).
   */
  public cancelTask(id: string) {
    const task = this.queue.find((t) => t.id === id);
    if (task) {
      task.status = "cancelled";
      console.log(`[TaskQueue] Task "${task.name}" [ID: ${id}] cancelled.`);
    }

    if (this.currentActiveTask?.id === id) {
      console.log(`[TaskQueue] Cancelling currently executing task: "${this.currentActiveTask.name}"`);
      this.currentActiveTask.status = "cancelled";
      this.currentActiveTask = null;
      this.isProcessing = false;
      this.processNext();
    }
  }

  /**
   * Cancels all pending and active tasks of a lower/medium priority.
   * Useful when an urgent user interruption override occurs.
   */
  public cancelAllPending() {
    this.queue.forEach((task) => {
      if (task.status === "pending" || task.status === "executing") {
        task.status = "cancelled";
      }
    });
    this.currentActiveTask = null;
    this.isProcessing = false;
    console.log("[TaskQueue] All pending and running tasks cancelled successfully.");
  }

  /**
   * Get the current active task if any.
   */
  public getActiveTask(): QueueTask | null {
    return this.currentActiveTask;
  }

  /**
   * Sorting rule: high priority first, then medium, then low.
   * Tie-breaker: oldest timestamp first (FIFO).
   */
  private sortQueue() {
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    this.queue.sort((a, b) => {
      const weightA = priorityWeights[a.priority];
      const weightB = priorityWeights[b.priority];
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Sequential task execution loop.
   */
  private async processNext() {
    if (this.isProcessing) return;

    const nextTask = this.queue.find((t) => t.status === "pending");
    if (!nextTask) {
      this.isProcessing = false;
      this.currentActiveTask = null;
      return;
    }

    this.isProcessing = true;
    this.currentActiveTask = nextTask;
    nextTask.status = "executing";

    console.log(`[TaskQueue] Starting execution of task: "${nextTask.name}"`);

    try {
      let result = await nextTask.action();
      
      // Perform verification if defined
      let isVerified = true;
      if (nextTask.verify) {
        try {
          isVerified = await nextTask.verify(result);
          console.log(`[TaskQueue] Verification for "${nextTask.name}": ${isVerified ? "PASSED" : "FAILED"}`);
        } catch (vErr: any) {
          console.error(`[TaskQueue] Verification crash: ${vErr.message}`);
          isVerified = false;
        }
      }

      if (isVerified && (nextTask.status as string) !== "cancelled") {
        nextTask.status = "completed";
        console.log(`[TaskQueue] Task "${nextTask.name}" completed successfully.`);
      } else if ((nextTask.status as string) !== "cancelled") {
        throw new Error("Task execution failed verification criteria.");
      }
    } catch (err: any) {
      console.warn(`[TaskQueue] Error running task "${nextTask.name}": ${err.message}`);
      
      if (nextTask.retryCount < nextTask.maxRetries && (nextTask.status as string) !== "cancelled") {
        nextTask.retryCount++;
        nextTask.status = "pending"; // Re-queue for retry
        console.log(`[TaskQueue] Retrying task "${nextTask.name}" (Attempt ${nextTask.retryCount}/${nextTask.maxRetries})`);
      } else if ((nextTask.status as string) !== "cancelled") {
        nextTask.status = "failed";
        console.error(`[TaskQueue] Task "${nextTask.name}" permanently failed.`);
      }
    } finally {
      this.isProcessing = false;
      this.currentActiveTask = null;
      // Recurse to run next pending task
      setTimeout(() => this.processNext(), 10);
    }
  }

  public getQueueSnapshot(): QueueTask[] {
    return [...this.queue];
  }
}
