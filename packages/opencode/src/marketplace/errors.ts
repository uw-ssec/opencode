import { NamedError } from "../util/error.js"

/**
 * Base marketplace error
 */
export const MarketplaceError = NamedError.create("MarketplaceError")

/**
 * Marketplace not found error
 */
export const MarketplaceNotFoundError = NamedError.create(
  "MarketplaceNotFoundError",
  "Marketplace not found or not loaded"
)

/**
 * Plugin not found error
 */
export const PluginNotFoundError = NamedError.create(
  "PluginNotFoundError",
  "Plugin not found in any marketplace"
)

/**
 * Plugin already installed error
 */
export const PluginAlreadyInstalledError = NamedError.create(
  "PluginAlreadyInstalledError",
  "Plugin is already installed"
)

/**
 * Plugin installation failed error
 */
export const PluginInstallationError = NamedError.create(
  "PluginInstallationError",
  "Failed to install plugin"
)

/**
 * Plugin validation error
 */
export const PluginValidationError = NamedError.create(
  "PluginValidationError",
  "Plugin validation failed"
)

/**
 * Structure detection error
 */
export const StructureDetectionError = NamedError.create(
  "StructureDetectionError",
  "Failed to detect plugin structure"
)

/**
 * Translation error
 */
export const TranslationError = NamedError.create(
  "TranslationError",
  "Failed to translate plugin format"
)

/**
 * Marketplace source error
 */
export const MarketplaceSourceError = NamedError.create(
  "MarketplaceSourceError",
  "Failed to load marketplace from source"
)

/**
 * Cache error
 */
export const CacheError = NamedError.create(
  "CacheError",
  "Cache operation failed"
)

/**
 * Invalid manifest error
 */
export const InvalidManifestError = NamedError.create(
  "InvalidManifestError",
  "Invalid marketplace manifest format"
)

/**
 * Network error
 */
export const NetworkError = NamedError.create(
  "NetworkError",
  "Network request failed"
)

/**
 * Git operation error
 */
export const GitOperationError = NamedError.create(
  "GitOperationError",
  "Git operation failed"
)
