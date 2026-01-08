import type { Cache } from "./types.js"
import { CacheError } from "./errors.js"

/**
 * SimpleCache
 *
 * In-memory cache with TTL (Time To Live) support.
 * Entries automatically expire after their TTL.
 */
export class SimpleCache {
  private store: Map<string, Cache.Entry> = new Map()

  /**
   * Default TTL: 1 hour (in milliseconds)
   */
  private defaultTTL: number = 60 * 60 * 1000

  /**
   * Create a new cache with optional default TTL
   */
  constructor(defaultTTL?: number) {
    if (defaultTTL !== undefined) {
      this.defaultTTL = defaultTTL
    }
  }

  /**
   * Set a cache entry
   */
  set(key: string, value: any, ttl?: number): void {
    const entry: Cache.Entry = {
      key,
      value,
      createdAt: new Date(),
      ttl: ttl !== undefined ? ttl : this.defaultTTL,
    }

    this.store.set(key, entry)
  }

  /**
   * Get a cache entry (returns undefined if expired or not found)
   */
  get(key: string): any | undefined {
    const entry = this.store.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: Cache.Entry): boolean {
    const now = Date.now()
    const expiresAt = entry.createdAt.getTime() + entry.ttl

    return now > expiresAt
  }

  /**
   * Check if cache has a key (and it's not expired)
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  stats(): {
    totalEntries: number
    activeEntries: number
    expiredEntries: number
  } {
    let activeEntries = 0
    let expiredEntries = 0

    for (const entry of this.store.values()) {
      if (this.isExpired(entry)) {
        expiredEntries++
      } else {
        activeEntries++
      }
    }

    return {
      totalEntries: this.store.size,
      activeEntries,
      expiredEntries,
    }
  }

  /**
   * Get all keys (including expired ones)
   */
  keys(): string[] {
    return Array.from(this.store.keys())
  }

  /**
   * Get active keys (excluding expired ones)
   */
  activeKeys(): string[] {
    const keys: string[] = []

    for (const [key, entry] of this.store.entries()) {
      if (!this.isExpired(entry)) {
        keys.push(key)
      }
    }

    return keys
  }
}

/**
 * Global marketplace cache instance
 *
 * Used for caching marketplace manifests and plugin metadata.
 * TTL: 1 hour (marketplaces don't change frequently)
 */
export const marketplaceCache = new SimpleCache(60 * 60 * 1000)

/**
 * Plugin metadata cache
 *
 * Used for caching plugin detection results and metadata.
 * TTL: 5 minutes (plugins may change during development)
 */
export const pluginCache = new SimpleCache(5 * 60 * 1000)

/**
 * Setup automatic cache cleanup
 *
 * Runs cleanup every 10 minutes to remove expired entries
 */
let cleanupInterval: Timer | null = null

export function startCacheCleanup(): void {
  if (cleanupInterval) {
    return // Already running
  }

  cleanupInterval = setInterval(() => {
    marketplaceCache.cleanup()
    pluginCache.cleanup()
  }, 10 * 60 * 1000) // 10 minutes
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  marketplaceCache.clear()
  pluginCache.clear()
}
