import path from "path"
import { Instance } from "../util/instance.js"
import type {
  Marketplace,
  MarketplaceSource as MarketplaceSourceTypes,
  SearchOptions,
  InstallOptions,
  InstalledPlugin,
} from "./types.js"
import { MarketplaceSource } from "./source.js"
import { PluginAdapter } from "./adapter.js"
import { marketplaceCache } from "./cache.js"
import {
  MarketplaceNotFoundError,
  PluginNotFoundError,
  PluginAlreadyInstalledError,
} from "./errors.js"
import { Global } from "../util/global.js"

/**
 * MarketplaceManager
 *
 * Central manager for all marketplace operations:
 * - Load and manage marketplace sources
 * - Search for plugins
 * - Install/uninstall plugins
 * - Track installed plugins
 */
export namespace MarketplaceManager {
  /**
   * Internal state with loaded marketplaces
   */
  interface State {
    marketplaces: MarketplaceSourceTypes.LoadedMarketplace[]
    installed: Map<string, InstalledPlugin.Record>
  }

  /**
   * Cached state
   */
  const state = Instance.state(async (): Promise<State> => {
    return {
      marketplaces: [],
      installed: new Map(),
    }
  })

  /**
   * Initialize marketplace manager
   *
   * Loads default marketplaces and installed plugins database
   */
  export async function init(): Promise<void> {
    // Phase 1: Basic initialization
    // Phase 2: Load default marketplaces from config
    // Phase 3: Load installed plugins database

    console.log("[Marketplace] Initialized")
  }

  /**
   * Add a marketplace source
   */
  export async function addMarketplace(
    source: MarketplaceSourceTypes.Config
  ): Promise<MarketplaceSourceTypes.LoadedMarketplace> {
    const cacheKey = `marketplace-${JSON.stringify(source)}`

    // Check cache first
    const cached = marketplaceCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Load marketplace
    const marketplace = await MarketplaceSource.load(source)

    // Cache it
    marketplaceCache.set(cacheKey, marketplace)

    // Add to state
    const currentState = await state()
    currentState.marketplaces.push(marketplace)

    console.log(`[Marketplace] Added: ${marketplace.manifest.name}`)

    return marketplace
  }

  /**
   * Remove a marketplace source
   */
  export async function removeMarketplace(
    marketplaceName: string
  ): Promise<void> {
    const currentState = await state()
    const index = currentState.marketplaces.findIndex(
      m => m.manifest.name === marketplaceName
    )

    if (index === -1) {
      throw new MarketplaceNotFoundError(`Marketplace not found: ${marketplaceName}`)
    }

    // Remove from cache
    await MarketplaceSource.remove(currentState.marketplaces[index].source)

    // Remove from state
    currentState.marketplaces.splice(index, 1)

    console.log(`[Marketplace] Removed: ${marketplaceName}`)
  }

  /**
   * List all loaded marketplaces
   */
  export async function listMarketplaces(): Promise<MarketplaceSourceTypes.LoadedMarketplace[]> {
    const currentState = await state()
    return currentState.marketplaces
  }

  /**
   * Update a marketplace (re-fetch from source)
   */
  export async function updateMarketplace(
    marketplaceName: string
  ): Promise<MarketplaceSourceTypes.LoadedMarketplace> {
    const currentState = await state()
    const marketplace = currentState.marketplaces.find(
      m => m.manifest.name === marketplaceName
    )

    if (!marketplace) {
      throw new MarketplaceNotFoundError(`Marketplace not found: ${marketplaceName}`)
    }

    // Re-fetch from source
    const updated = await MarketplaceSource.update(marketplace.source)

    // Update in state
    const index = currentState.marketplaces.indexOf(marketplace)
    currentState.marketplaces[index] = updated

    // Update cache
    const cacheKey = `marketplace-${JSON.stringify(marketplace.source)}`
    marketplaceCache.set(cacheKey, updated)

    console.log(`[Marketplace] Updated: ${marketplaceName}`)

    return updated
  }

  /**
   * Search for plugins across all marketplaces
   */
  export async function search(
    options: SearchOptions = {}
  ): Promise<Marketplace.PluginMetadata[]> {
    const currentState = await state()
    const { query, categories, structure, limit = 50, offset = 0 } = options

    // Collect all plugins
    let allPlugins: Marketplace.PluginMetadata[] = []

    for (const marketplace of currentState.marketplaces) {
      allPlugins.push(...marketplace.manifest.plugins)
    }

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase()
      allPlugins = allPlugins.filter(plugin => {
        const searchText = [
          plugin.name,
          plugin.description,
          ...plugin.keywords,
        ].join(" ").toLowerCase()

        return searchText.includes(lowerQuery)
      })
    }

    // Filter by categories
    if (categories && categories.length > 0) {
      allPlugins = allPlugins.filter(plugin =>
        plugin.category && categories.includes(plugin.category)
      )
    }

    // Filter by structure (Phase 1: basic implementation)
    // Full implementation in Phase 2 with actual structure detection

    // Sort by relevance (Phase 1: simple sort by name)
    allPlugins.sort((a, b) => a.name.localeCompare(b.name))

    // Pagination
    const paginated = allPlugins.slice(offset, offset + limit)

    return paginated
  }

  /**
   * Get plugin by name
   */
  export async function getPlugin(
    pluginName: string
  ): Promise<{ plugin: Marketplace.PluginMetadata; marketplace: MarketplaceSourceTypes.LoadedMarketplace } | null> {
    const currentState = await state()

    for (const marketplace of currentState.marketplaces) {
      const plugin = marketplace.manifest.plugins.find(p => p.name === pluginName)
      if (plugin) {
        return { plugin, marketplace }
      }
    }

    return null
  }

  /**
   * Install a plugin
   *
   * Phase 1: Basic structure
   * Phase 2: Full implementation with NPM integration
   */
  export async function install(
    pluginName: string,
    options: InstallOptions = {}
  ): Promise<InstalledPlugin.Record> {
    // Find plugin
    const result = await getPlugin(pluginName)
    if (!result) {
      throw new PluginNotFoundError(`Plugin not found: ${pluginName}`)
    }

    const { plugin, marketplace } = result

    // Check if already installed
    const currentState = await state()
    if (currentState.installed.has(pluginName) && !options.force) {
      throw new PluginAlreadyInstalledError(`Plugin already installed: ${pluginName}`)
    }

    // Phase 1: Basic installation placeholder
    // Phase 2: Actual installation with:
    // - Copy plugin files to installation directory
    // - Detect structure
    // - Translate if needed
    // - Validate
    // - Register with agent/skill/command loaders

    const installRecord: InstalledPlugin.Record = {
      name: pluginName,
      marketplace: marketplace.manifest.name,
      version: plugin.version,
      installedAt: new Date(),
      status: "installed",
      path: "", // Phase 2: actual path
      structure: "opencode", // Phase 2: detect actual structure
    }

    currentState.installed.set(pluginName, installRecord)

    console.log(`[Marketplace] Installed: ${pluginName}`)

    return installRecord
  }

  /**
   * Uninstall a plugin
   *
   * Phase 1: Basic structure
   * Phase 2: Full implementation
   */
  export async function uninstall(pluginName: string): Promise<void> {
    const currentState = await state()

    if (!currentState.installed.has(pluginName)) {
      throw new PluginNotFoundError(`Plugin not installed: ${pluginName}`)
    }

    // Phase 1: Remove from tracking
    currentState.installed.delete(pluginName)

    // Phase 2: Actual uninstallation:
    // - Remove plugin files
    // - Unregister from loaders
    // - Clean up cache

    console.log(`[Marketplace] Uninstalled: ${pluginName}`)
  }

  /**
   * List installed plugins
   */
  export async function listInstalled(): Promise<InstalledPlugin.Record[]> {
    const currentState = await state()
    return Array.from(currentState.installed.values())
  }

  /**
   * Update an installed plugin
   *
   * Phase 1: Basic structure
   * Phase 2: Full implementation
   */
  export async function updatePlugin(pluginName: string): Promise<InstalledPlugin.Record> {
    // Phase 1: Placeholder
    // Phase 2: Check for updates and reinstall if newer version available

    const currentState = await state()
    const installed = currentState.installed.get(pluginName)

    if (!installed) {
      throw new PluginNotFoundError(`Plugin not installed: ${pluginName}`)
    }

    console.log(`[Marketplace] Updated: ${pluginName}`)

    return installed
  }

  /**
   * Check for plugin updates
   */
  export async function checkUpdates(): Promise<Array<{
    plugin: string
    currentVersion: string
    latestVersion: string
  }>> {
    // Phase 1: Empty array
    // Phase 2: Compare installed versions with marketplace versions

    return []
  }
}
