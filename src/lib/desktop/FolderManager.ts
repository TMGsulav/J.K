import fs from "fs";
import path from "path";
import { FileManager } from "../fileManager";

export class FolderManager {
  private static instance: FolderManager;
  private fileManager = FileManager.getInstance();

  private constructor() {}

  public static getInstance(): FolderManager {
    if (!FolderManager.instance) {
      FolderManager.instance = new FolderManager();
    }
    return FolderManager.instance;
  }

  /**
   * Creates a directory, including nested directories automatically.
   */
  public async createFolder(inputPath: string): Promise<any> {
    const resolvedPath = this.fileManager.resolveSystemPath(inputPath);
    try {
      if (fs.existsSync(resolvedPath)) {
        return { success: true, message: `Folder already exists: "${resolvedPath}"`, resolvedPath };
      }
      fs.mkdirSync(resolvedPath, { recursive: true });
      return { success: true, message: `Successfully created folder: "${path.basename(resolvedPath)}"`, resolvedPath };
    } catch (err: any) {
      return { success: false, message: `Failed to create folder: ${err.message}`, error: err.code };
    }
  }

  /**
   * Deletes a directory recursively.
   */
  public async deleteFolder(inputPath: string): Promise<any> {
    const resolvedPath = this.fileManager.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, message: `Folder does not exist: "${resolvedPath}"` };
      }
      fs.rmSync(resolvedPath, { recursive: true, force: true });
      return { success: true, message: `Successfully deleted folder: "${path.basename(resolvedPath)}"`, resolvedPath };
    } catch (err: any) {
      return { success: false, message: `Failed to delete folder: ${err.message}`, error: err.code };
    }
  }

  /**
   * Renames a directory.
   */
  public async renameFolder(inputPath: string, newName: string): Promise<any> {
    const resolvedPath = this.fileManager.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, message: `Folder does not exist: "${resolvedPath}"` };
      }
      const parentDir = path.dirname(resolvedPath);
      const newResolvedPath = path.join(parentDir, newName);
      fs.renameSync(resolvedPath, newResolvedPath);
      return { success: true, message: `Successfully renamed folder to "${newName}"`, resolvedPath: newResolvedPath };
    } catch (err: any) {
      return { success: false, message: `Failed to rename folder: ${err.message}`, error: err.code };
    }
  }

  /**
   * Moves a directory to a destination folder.
   */
  public async moveFolder(sourceInput: string, destInput: string): Promise<any> {
    const srcResolved = this.fileManager.resolveSystemPath(sourceInput);
    const destResolved = this.fileManager.resolveSystemPath(destInput);
    try {
      if (!fs.existsSync(srcResolved)) {
        return { success: false, message: `Source folder does not exist: "${srcResolved}"` };
      }
      const parentDir = path.dirname(destResolved);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.renameSync(srcResolved, destResolved);
      return { success: true, message: `Successfully moved folder to "${destResolved}"`, resolvedPath: destResolved };
    } catch (err: any) {
      return { success: false, message: `Failed to move folder: ${err.message}`, error: err.code };
    }
  }

  /**
   * Copies a directory recursively.
   */
  public async copyFolder(sourceInput: string, destInput: string): Promise<any> {
    const srcResolved = this.fileManager.resolveSystemPath(sourceInput);
    const destResolved = this.fileManager.resolveSystemPath(destInput);
    try {
      if (!fs.existsSync(srcResolved)) {
        return { success: false, message: `Source folder does not exist: "${srcResolved}"` };
      }
      if (!fs.existsSync(destResolved)) {
        fs.mkdirSync(destResolved, { recursive: true });
      }
      fs.cpSync(srcResolved, destResolved, { recursive: true });
      return { success: true, message: `Successfully copied folder to "${destResolved}"`, resolvedPath: destResolved };
    } catch (err: any) {
      return { success: false, message: `Failed to copy folder: ${err.message}`, error: err.code };
    }
  }

  /**
   * Lists the contents of a directory.
   */
  public async listFolderContents(inputPath: string): Promise<any> {
    const resolvedPath = this.fileManager.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, message: `Folder does not exist: "${resolvedPath}"` };
      }
      const items = fs.readdirSync(resolvedPath);
      const details = items.map((item) => {
        const itemPath = path.join(resolvedPath, item);
        const stats = fs.statSync(itemPath);
        return {
          name: item,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      });
      return {
        success: true,
        message: `Successfully listed ${items.length} items in "${path.basename(resolvedPath)}"`,
        resolvedPath,
        items: details
      };
    } catch (err: any) {
      return { success: false, message: `Failed to list folder contents: ${err.message}`, error: err.code };
    }
  }
}
