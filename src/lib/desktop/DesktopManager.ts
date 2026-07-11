import { CommandPlanner, PlanResult, ExecutionLog } from "./CommandPlanner";
import { PermissionManager } from "./PermissionManager";
import { TaskManager, AutomationTask, AutomationStep } from "./TaskManager";
import { VerificationLayer } from "./VerificationLayer";

export class DesktopManager {
  private static instance: DesktopManager;

  private planner = CommandPlanner.getInstance();
  private permissionMgr = PermissionManager.getInstance();
  private taskMgr = TaskManager.getInstance();
  private verification = VerificationLayer.getInstance();

  private executionLogs: ExecutionLog[] = [];
  private favoriteApps: Map<string, number> = new Map();
  private activeFolders: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): DesktopManager {
    if (!DesktopManager.instance) {
      DesktopManager.instance = new DesktopManager();
    }
    return DesktopManager.instance;
  }

  /**
   * Safe natural language execution dispatch.
   */
  public async executeCommand(text: string, forceConfirm: boolean = false): Promise<PlanResult> {
    const result = await this.planner.planAndExecute(text, forceConfirm);
    
    if (result.log) {
      this.executionLogs.push(result.log);
      
      // Update local memory tracking on successful execution
      if (result.log.success && result.parsed) {
        const action = result.parsed.action;
        const args = result.parsed.args;

        if (action === "openApplication" && args.appName) {
          const app = args.appName;
          this.favoriteApps.set(app, (this.favoriteApps.get(app) || 0) + 1);
        }

        const pathKey = args.path || args.sourcePath || args.destPath;
        if (pathKey) {
          this.activeFolders.set(pathKey, (this.activeFolders.get(pathKey) || 0) + 1);
        }
      }
    }

    return result;
  }

  /**
   * Registers and schedules a multi-step sequential automation task.
   */
  public createSequenceTask(name: string, steps: AutomationStep[]): AutomationTask {
    return this.taskMgr.createAutomationTask(name, steps);
  }

  /**
   * Executes a scheduled task.
   */
  public async executeSequenceTask(id: string): Promise<AutomationTask> {
    return this.taskMgr.executeAutomationTask(id, async (step: AutomationStep) => {
      const start = Date.now();
      const textCommand = `Run action ${step.action} in module ${step.module}`;
      
      try {
        const planner = CommandPlanner.getInstance();
        // Since sequence steps are structured, we directly execute them by mapping
        // We can force confirm step executions in a sequence to keep things running
        const resResult = await (planner as any).executeModuleAction(step.module, step.action, step.params);
        
        // Auto verify
        const ver = await this.verification.verify(step.module, step.action, step.params);
        
        const success = resResult?.success !== false && ver.verified;
        
        this.executionLogs.push({
          timestamp: new Date().toISOString(),
          command: textCommand,
          module: step.module,
          action: step.action,
          executionTimeMs: Date.now() - start,
          success,
          errorDetails: !success ? (resResult?.message || ver.message) : undefined,
          verificationMessage: ver.message
        });

        return { success, message: resResult?.message || ver.message };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    });
  }

  /**
   * Retrieves log listings.
   */
  public getLogs(): ExecutionLog[] {
    return this.executionLogs;
  }

  /**
   * Aggregates and returns current desktop state recommendations for long-term memory.
   */
  public getMemoryRecommendations(): any {
    const favoriteApps = Array.from(this.favoriteApps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([app]) => app);

    const frequentlyUsedFolders = Array.from(this.activeFolders.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fPath]) => fPath);

    return {
      favoriteApps,
      frequentlyUsedFolders,
      recentCommands: this.executionLogs.slice(-10).map(l => l.command)
    };
  }
}
