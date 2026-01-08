import path from "path"
import { $ } from "bun"
import type {
  Marketplace,
  MarketplaceSource as MarketplaceSourceTypes,
  InstalledPlugin,
  InstallOptions,
} from "./types.js"
import { PluginAdapter } from "./adapter.js"
import { MarketplaceSource } from "./source.js"
import {
  PluginInstallationError,
  PluginValidationError,
} from "./errors.js"
import { Global } from "../util/global.js"
import { BunProc } from "../bun/index.js"

/**
 * PluginInstaller
 *
 * Handles the actual installation of plugins:
 * - Copies files to installation directory
 * - Detects and translates Claude plugins
 * - Installs NPM dependencies
 * - Validates installation
 */
export namespace PluginInstaller {
  /**
   * Get the plugins installation directory
   */
  export function getPluginsDir(): string {
    return path.join(Global.Path.config, "plugins")
  }

  /**
   * Get installation path for a specific plugin
   */
  export function getPluginInstallPath(
    marketplaceName: string,
    pluginName: string
  ): string {
    return path.join(getPluginsDir(), marketplaceName, pluginName)
  }

  /**
   * Install a plugin from a marketplace
   */
  export async function install(
    marketplace: MarketplaceSourceTypes.LoadedMarketplace,
    plugin: Marketplace.PluginMetadata,
    options: InstallOptions = {}
  ): Promise<InstalledPlugin.Record> {
    const installPath = getPluginInstallPath(marketplace.manifest.name, plugin.name)

    try {
      // Get source path
      const sourcePath = MarketplaceSource.getPluginPath(marketplace, plugin)

      // Ensure plugins directory exists
      await $`mkdir -p ${path.dirname(installPath)}`.quiet()

      // Check if already installed
      const exists = await Bun.file(installPath).exists()
      if (exists && !options.force) {
        throw new PluginInstallationError(
          `Plugin already installed at ${installPath}. Use force option to reinstall.`
        )
      }

      // Remove existing installation if force
      if (exists && options.force) {
        await $`rm -rf ${installPath}`.quiet()
      }

      // Copy plugin files
      await copyPluginFiles(sourcePath, installPath)

      // Detect structure
      const detection = await PluginAdapter.detectStructure(installPath)

      // If Claude plugin, translate configuration
      if (detection.structure === "claude") {
        await translateClaudePlugin(installPath)
      }

      // Install NPM dependencies if plugin has them
      if (plugin.npm) {
        await installNpmDependencies(plugin.npm, plugin.version)
      }

      // Validate installation
      if (!options.skipValidation) {
        await validateInstallation(installPath, plugin)
      }

      // Create installation record
      const record: InstalledPlugin.Record = {
        name: plugin.name,
        marketplace: marketplace.manifest.name,
        version: plugin.version,
        installedAt: new Date(),
        status: "installed",
        path: installPath,
        structure: detection.structure,
      }

      return record
    } catch (error) {
      // Clean up on failure
      try {
        await $`rm -rf ${installPath}`.quiet()
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof PluginInstallationError || error instanceof PluginValidationError) {
        throw error
      }

      throw new PluginInstallationError(
        `Failed to install plugin ${plugin.name}`,
        { cause: error }
      )
    }
  }

  /**
   * Uninstall a plugin
   */
  export async function uninstall(
    record: InstalledPlugin.Record
  ): Promise<void> {
    try {
      // Remove plugin directory
      await $`rm -rf ${record.path}`.quiet()

      // Check if marketplace directory is empty and remove if so
      const marketplaceDir = path.dirname(record.path)
      const contents = await $`ls -A ${marketplaceDir}`.quiet().text()
      if (!contents.trim()) {
        await $`rmdir ${marketplaceDir}`.quiet()
      }
    } catch (error) {
      throw new PluginInstallationError(
        `Failed to uninstall plugin ${record.name}`,
        { cause: error }
      )
    }
  }

  /**
   * Copy plugin files from source to destination
   */
  async function copyPluginFiles(
    sourcePath: string,
    destPath: string
  ): Promise<void> {
    // Use rsync for efficient copying with symlink handling
    // Fallback to cp if rsync not available
    try {
      await $`rsync -av --copy-links ${sourcePath}/ ${destPath}/`.quiet()
    } catch {
      // Fallback to cp
      await $`cp -R ${sourcePath} ${destPath}`.quiet()
    }
  }

  /**
   * Translate Claude plugin to OpenCode format
   *
   * Creates .opencode/ directory with translated configuration
   */
  async function translateClaudePlugin(pluginPath: string): Promise<void> {
    // Adapt plugin (this translates settings.local.json)
    const adapted = await PluginAdapter.adaptPlugin(pluginPath)

    // Create .opencode directory if not exists
    const opencodeDir = path.join(pluginPath, ".opencode")
    await $`mkdir -p ${opencodeDir}`.quiet()

    // Write translated configuration
    if (Object.keys(adapted.config).length > 0) {
      const configPath = path.join(opencodeDir, "opencode.jsonc")
      await Bun.write(configPath, JSON.stringify(adapted.config, null, 2))
    }

    // Note: Agent and skill files remain in their original locations
    // The loaders will handle translation when loading them
  }

  /**
   * Install NPM dependencies for programmatic plugin
   */
  async function installNpmDependencies(
    npmPackage: string,
    version: string
  ): Promise<string> {
    return await BunProc.install(npmPackage, version)
  }

  /**
   * Validate plugin installation
   */
  async function validateInstallation(
    installPath: string,
    plugin: Marketplace.PluginMetadata
  ): Promise<void> {
    // Check that required files exist
    const checks: Array<{ path: string; required: boolean }> = []

    // Add agent checks
    for (const agentPath of plugin.agents) {
      checks.push({
        path: path.join(installPath, agentPath),
        required: true,
      })
    }

    // Add skill checks
    for (const skillPath of plugin.skills) {
      const skillMdPath = path.join(installPath, skillPath, "SKILL.md")
      checks.push({
        path: skillMdPath,
        required: true,
      })
    }

    // Add command checks
    for (const cmdPath of plugin.commands) {
      checks.push({
        path: path.join(installPath, cmdPath),
        required: true,
      })
    }

    // Validate all required files exist
    const missing: string[] = []
    for (const check of checks) {
      const exists = await Bun.file(check.path).exists()
      if (!exists && check.required) {
        missing.push(check.path)
      }
    }

    if (missing.length > 0) {
      throw new PluginValidationError(
        `Plugin validation failed. Missing files:\n${missing.join("\n")}`
      )
    }
  }

  /**
   * Update a plugin to a new version
   */
  export async function update(
    marketplace: MarketplaceSourceTypes.LoadedMarketplace,
    plugin: Marketplace.PluginMetadata,
    existingRecord: InstalledPlugin.Record
  ): Promise<InstalledPlugin.Record> {
    // Mark as updating
    existingRecord.status = "updating"

    try {
      // Install new version (force to overwrite)
      const newRecord = await install(marketplace, plugin, { force: true })

      // Update timestamps
      newRecord.installedAt = existingRecord.installedAt
      newRecord.updatedAt = new Date()

      return newRecord
    } catch (error) {
      // Restore status on failure
      existingRecord.status = "error"
      existingRecord.error = error instanceof Error ? error.message : String(error)

      throw error
    }
  }
}
