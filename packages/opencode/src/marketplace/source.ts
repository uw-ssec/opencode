import path from "path"
import { $ } from "bun"
import type { MarketplaceSource, Marketplace } from "./types.js"
import {
  MarketplaceSourceError,
  InvalidManifestError,
  NetworkError,
  GitOperationError,
} from "./errors.js"
import { Global } from "../util/global.js"

/**
 * MarketplaceSource
 *
 * Loads marketplace manifests from various sources:
 * - GitHub repositories
 * - Git repositories (SSH/HTTPS)
 * - HTTPS URLs
 * - Local filesystem
 */
export namespace MarketplaceSource {
  /**
   * Cache directory for downloaded marketplaces
   */
  function getCacheDir(): string {
    return path.join(Global.Path.cache, "marketplaces")
  }

  /**
   * Generate cache key for a marketplace source
   */
  function getCacheKey(source: MarketplaceSource.Config): string {
    switch (source.type) {
      case "github":
        return `github-${source.owner}-${source.repo}-${source.branch}`
      case "git":
        // Use hash of URL to avoid special characters
        const hash = Buffer.from(source.url).toString("base64url")
        return `git-${hash.substring(0, 16)}`
      case "https":
        const urlHash = Buffer.from(source.url).toString("base64url")
        return `https-${urlHash.substring(0, 16)}`
      case "local":
        return `local-${path.basename(source.path)}`
    }
  }

  /**
   * Get local path for cached marketplace
   */
  function getCachePath(source: MarketplaceSource.Config): string {
    const cacheDir = getCacheDir()
    const key = getCacheKey(source)
    return path.join(cacheDir, key)
  }

  /**
   * Load marketplace from GitHub repository
   */
  async function loadFromGitHub(
    source: MarketplaceSource.GitHubSource
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    const cachePath = getCachePath(source)
    const gitUrl = `https://github.com/${source.owner}/${source.repo}.git`

    try {
      // Check if already cloned
      const exists = await Bun.file(cachePath).exists()

      if (exists) {
        // Pull latest changes
        await $`git -C ${cachePath} fetch origin ${source.branch}`.quiet()
        await $`git -C ${cachePath} reset --hard origin/${source.branch}`.quiet()
      } else {
        // Clone repository
        await $`git clone --depth 1 --branch ${source.branch} ${gitUrl} ${cachePath}`.quiet()
      }

      // Load manifest
      const manifestPath = path.join(cachePath, source.manifestPath)
      const manifestContent = await Bun.file(manifestPath).text()
      const manifest = Marketplace.Manifest.parse(JSON.parse(manifestContent))

      return {
        source,
        manifest,
        cachedAt: new Date(),
        path: cachePath,
      }
    } catch (error) {
      throw new GitOperationError(
        `Failed to load marketplace from GitHub: ${source.owner}/${source.repo}`,
        { cause: error }
      )
    }
  }

  /**
   * Load marketplace from Git repository
   */
  async function loadFromGit(
    source: MarketplaceSource.GitSource
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    const cachePath = getCachePath(source)

    try {
      // Check if already cloned
      const exists = await Bun.file(cachePath).exists()

      if (exists) {
        // Pull latest changes
        await $`git -C ${cachePath} fetch origin ${source.branch}`.quiet()
        await $`git -C ${cachePath} reset --hard origin/${source.branch}`.quiet()
      } else {
        // Clone repository
        await $`git clone --depth 1 --branch ${source.branch} ${source.url} ${cachePath}`.quiet()
      }

      // Load manifest
      const manifestPath = path.join(cachePath, source.manifestPath)
      const manifestContent = await Bun.file(manifestPath).text()
      const manifest = Marketplace.Manifest.parse(JSON.parse(manifestContent))

      return {
        source,
        manifest,
        cachedAt: new Date(),
        path: cachePath,
      }
    } catch (error) {
      throw new GitOperationError(
        `Failed to load marketplace from Git: ${source.url}`,
        { cause: error }
      )
    }
  }

  /**
   * Load marketplace from HTTPS URL
   */
  async function loadFromHttps(
    source: MarketplaceSource.HttpsSource
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    const cachePath = getCachePath(source)

    try {
      // Fetch manifest from URL
      const response = await fetch(source.url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const manifestContent = await response.text()
      const manifest = Marketplace.Manifest.parse(JSON.parse(manifestContent))

      // Save to cache
      await Bun.write(
        path.join(cachePath, "marketplace.json"),
        manifestContent
      )

      return {
        source,
        manifest,
        cachedAt: new Date(),
        path: cachePath,
      }
    } catch (error) {
      throw new NetworkError(
        `Failed to load marketplace from HTTPS: ${source.url}`,
        { cause: error }
      )
    }
  }

  /**
   * Load marketplace from local filesystem
   */
  async function loadFromLocal(
    source: MarketplaceSource.LocalSource
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    try {
      // Resolve path (support relative paths)
      const absolutePath = path.isAbsolute(source.path)
        ? source.path
        : path.resolve(process.cwd(), source.path)

      // Load manifest
      const manifestPath = path.join(absolutePath, source.manifestPath)
      const manifestContent = await Bun.file(manifestPath).text()
      const manifest = Marketplace.Manifest.parse(JSON.parse(manifestContent))

      return {
        source,
        manifest,
        cachedAt: new Date(),
        path: absolutePath,
      }
    } catch (error) {
      throw new MarketplaceSourceError(
        `Failed to load marketplace from local path: ${source.path}`,
        { cause: error }
      )
    }
  }

  /**
   * Load marketplace from any source type
   */
  export async function load(
    source: MarketplaceSource.Config
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    try {
      // Ensure cache directory exists
      await $`mkdir -p ${getCacheDir()}`.quiet()

      // Load based on source type
      switch (source.type) {
        case "github":
          return await loadFromGitHub(source)
        case "git":
          return await loadFromGit(source)
        case "https":
          return await loadFromHttps(source)
        case "local":
          return await loadFromLocal(source)
        default:
          throw new MarketplaceSourceError(
            `Unknown marketplace source type: ${(source as any).type}`
          )
      }
    } catch (error) {
      if (
        error instanceof GitOperationError ||
        error instanceof NetworkError ||
        error instanceof MarketplaceSourceError
      ) {
        throw error
      }

      throw new MarketplaceSourceError(
        `Failed to load marketplace`,
        { cause: error }
      )
    }
  }

  /**
   * Update an existing marketplace (re-fetch from source)
   */
  export async function update(
    source: MarketplaceSource.Config
  ): Promise<MarketplaceSource.LoadedMarketplace> {
    // For now, update is the same as load (always fetches latest)
    // In the future, we might add incremental update logic
    return await load(source)
  }

  /**
   * Remove marketplace from cache
   */
  export async function remove(
    source: MarketplaceSource.Config
  ): Promise<void> {
    const cachePath = getCachePath(source)

    try {
      await $`rm -rf ${cachePath}`.quiet()
    } catch (error) {
      console.warn(`Failed to remove marketplace cache: ${error}`)
    }
  }

  /**
   * Get plugin path within marketplace
   */
  export function getPluginPath(
    marketplace: MarketplaceSource.LoadedMarketplace,
    plugin: Marketplace.PluginMetadata
  ): string {
    // Plugin source is relative to marketplace path
    return path.join(marketplace.path, plugin.source)
  }

  /**
   * Validate marketplace manifest
   */
  export function validateManifest(manifest: any): boolean {
    try {
      Marketplace.Manifest.parse(manifest)
      return true
    } catch (error) {
      throw new InvalidManifestError(
        `Invalid marketplace manifest`,
        { cause: error }
      )
    }
  }
}
