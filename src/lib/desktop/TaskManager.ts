export interface AutomationStep {
  module: string;
  action: string;
  params: any;
  status?: "pending" | "running" | "completed" | "failed";
  error?: string;
}

export interface AutomationTask {
  id: string;
  name: string;
  steps: AutomationStep[];
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  currentStepIndex: number;
}

export class TaskManager {
  private static instance: TaskManager;
  private tasks: Map<string, AutomationTask> = new Map();

  private constructor() {}

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * Registers a new automation task sequence.
   */
  public createAutomationTask(name: string, steps: AutomationStep[]): AutomationTask {
    const id = "task_" + Math.random().toString(36).substring(2, 9);
    const task: AutomationTask = {
      id,
      name,
      steps: steps.map(step => ({ ...step, status: "pending" })),
      status: "idle",
      currentStepIndex: -1
    };
    this.tasks.set(id, task);
    return task;
  }

  /**
   * Returns all active automation tasks.
   */
  public getActiveTasks(): AutomationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Cancels/terminates a running automation task sequence.
   */
  public cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task && task.status === "running") {
      task.status = "cancelled";
      return true;
    }
    return false;
  }

  /**
   * Executes an automation task sequence.
   * Calls a dispatcher function for each step sequentially.
   */
  public async executeAutomationTask(id: string, stepDispatcher: (step: AutomationStep) => Promise<any>): Promise<AutomationTask> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Automation Task ${id} not found.`);
    }

    if (task.status === "running") {
      return task;
    }

    task.status = "running";
    console.log(`[TaskManager] Executing Task: "${task.name}" with ${task.steps.length} steps.`);

    for (let i = 0; i < task.steps.length; i++) {
      if ((task.status as string) === "cancelled") {
        break;
      }

      task.currentStepIndex = i;
      const step = task.steps[i];
      step.status = "running";

      try {
        const result = await stepDispatcher(step);
        if (result && result.success) {
          step.status = "completed";
        } else {
          step.status = "failed";
          step.error = result?.message || "Execution returned failure state.";
          task.status = "failed";
          console.error(`[TaskManager] Step failed: ${step.module}.${step.action}`, step.error);
          break; // Stop sequence on step failure to prevent cascading issues
        }
      } catch (err: any) {
        step.status = "failed";
        step.error = err.message;
        task.status = "failed";
        console.error(`[TaskManager] Step threw exception: ${step.module}.${step.action}`, err);
        break;
      }
    }

    if (task.status === "running") {
      task.status = "completed";
    }

    return task;
  }
}
