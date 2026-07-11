export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
  confirmationMessage?: string;
  confirmationToken?: string;
}

export class PermissionManager {
  private static instance: PermissionManager;
  private pendingConfirmations: Map<string, { action: string; args: any; timestamp: number }> = new Map();

  // Safe actions that can run immediately without explicit prompts
  private readonly safeActions: Set<string> = new Set([
    "openapp", "launchapp", "createfolder", "readfile", "getproperties", 
    "listfolder", "searchfiles", "searchfolders", "searchapplications", 
    "readclipboard", "writeclipboard", "copyclipboard", "takescreenshot", 
    "screenshot", "getvolume", "setvolume", "mute", "unmute", "getbrightness", 
    "setbrightness", "battery", "systemresources", "getnetworkinfo", "currenttime", 
    "windowminimize", "windowmaximize", "windowrestore", "windowarrange", "windowtile", "windowcascade"
  ]);

  // Destructive/Risky actions that require confirmation
  private readonly riskyActions: Set<string> = new Set([
    "deletefile", "deletefolder", "emptyrecyclebin", "shutdown", "restart", 
    "signout", "killprocess", "overwritefile", "modifysystemfolder", "sleep", "lockpc"
  ]);

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * Registers a new pending confirmation request that expires after a short period.
   */
  public registerPendingConfirmation(actionName: string, args: any): string {
    const token = "conf_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
    const cleanAction = actionName.toLowerCase().replace(/[\s_-]/g, "");
    
    this.pendingConfirmations.set(token, {
      action: cleanAction,
      args,
      timestamp: Date.now()
    });

    // Clean up expired entries (older than 15 seconds)
    const expiryLimit = 15000;
    for (const [key, val] of this.pendingConfirmations.entries()) {
      if (Date.now() - val.timestamp > expiryLimit) {
        this.pendingConfirmations.delete(key);
      }
    }

    return token;
  }

  /**
   * Verifies and consumes a pending confirmation request.
   * Returns true if valid, false if expired or invalid.
   */
  public consumeConfirmation(actionName: string, args: any, providedToken?: string): boolean {
    const cleanAction = actionName.toLowerCase().replace(/[\s_-]/g, "");
    const expiryLimit = 15000;

    // 1. If token is provided, validate directly
    if (providedToken && this.pendingConfirmations.has(providedToken)) {
      const conf = this.pendingConfirmations.get(providedToken)!;
      this.pendingConfirmations.delete(providedToken);
      if (Date.now() - conf.timestamp <= expiryLimit) {
        return true;
      }
    }

    // 2. Otherwise find an unexpired match by action (and params if possible)
    for (const [token, conf] of this.pendingConfirmations.entries()) {
      const isTimeValid = Date.now() - conf.timestamp <= expiryLimit;
      const isActionMatch = conf.action === cleanAction;

      if (isTimeValid && isActionMatch) {
        this.pendingConfirmations.delete(token);
        return true;
      }
    }

    return false;
  }

  /**
   * Helper to verify if a path targets an essential system folder.
   */
  public isPathCritical(targetPath: string): boolean {
    if (!targetPath) return false;
    const p = targetPath.toLowerCase().replace(/\\/g, "/").trim();
    
    // Check for drive roots (Windows roots e.g. "c:", "d:" or Linux "/")
    const rootMatch = p.match(/^([a-z]:)?\/$/i);
    if (rootMatch || p === "" || p === "/") {
      return true;
    }

    const criticalSubstrings = [
      "c:/windows",
      "c:/program files",
      "c:/program files (x86)",
      "c:/users/all users",
      "/usr",
      "/var",
      "/etc",
      "/boot",
      "/sys",
      "/proc",
      "/lib",
      "/bin"
    ];

    for (const sub of criticalSubstrings) {
      if (p.startsWith(sub)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates whether a command action can run or requires user consent.
   */
  public checkPermission(actionName: string, params: any = {}): PermissionCheckResult {
    const cleanAction = actionName.toLowerCase().replace(/[\s_-]/g, "");

    // 1. Check for system security override targeting critical folders
    const targetPath = params.path || params.sourcePath || params.destPath || params.targetPath;
    if (targetPath && this.isPathCritical(targetPath)) {
      if (cleanAction.includes("delete") || cleanAction.includes("modify") || cleanAction.includes("overwrite") || cleanAction.includes("write")) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: `Security Block: Destructive operations targeting system critical directories are strictly forbidden: "${targetPath}"`
        };
      }
    }

    // 2. Identify risky actions that must require explicit confirmation
    if (this.riskyActions.has(cleanAction)) {
      let confirmationMessage = `Are you sure you want to let Liya perform the action: ${actionName}?`;
      if (targetPath) {
        confirmationMessage = `Confirm action '${actionName}' on target path: "${targetPath}"?`;
      }
      return {
        allowed: true,
        requiresConfirmation: true,
        confirmationMessage
      };
    }

    // 3. Defaults to Safe action
    return {
      allowed: true,
      requiresConfirmation: this.safeActions.has(cleanAction) ? false : true, // Safe actions run immediately, others default to prompt
      confirmationMessage: `Confirm safe-default execution for action '${actionName}'?`
    };
  }
}
