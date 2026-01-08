/**
 * OpenCode Marketplace
 *
 * Plugin marketplace system with support for:
 * - Multiple marketplace sources (GitHub, Git, HTTPS, local)
 * - Automatic Claude → OpenCode plugin translation
 * - Plugin search and discovery
 * - Installation and version management
 *
 * @module marketplace
 */

// Export all types
export type {
  Marketplace,
  MarketplaceSource,
  InstalledPlugin,
  PluginStructure,
  ClaudeTranslation,
  Cache,
  SearchOptions,
  InstallOptions,
} from "./types.js"

// Export manager (main API)
export { MarketplaceManager } from "./manager.js"

// Export source loader
export { MarketplaceSource } from "./source.js"

// Export adapter
export { PluginAdapter } from "./adapter.js"

// Export cache utilities
export {
  SimpleCache,
  marketplaceCache,
  pluginCache,
  startCacheCleanup,
  stopCacheCleanup,
  clearAllCaches,
} from "./cache.js"

// Export errors
export {
  MarketplaceError,
  MarketplaceNotFoundError,
  PluginNotFoundError,
  PluginAlreadyInstalledError,
  PluginInstallationError,
  PluginValidationError,
  StructureDetectionError,
  TranslationError,
  MarketplaceSourceError,
  CacheError,
  InvalidManifestError,
  NetworkError,
  GitOperationError,
} from "./errors.js"
