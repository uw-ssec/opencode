import { describe, it, expect, beforeEach } from "bun:test"
import { SimpleCache } from "../../src/marketplace/cache"

describe("SimpleCache", () => {
  let cache: SimpleCache

  beforeEach(() => {
    cache = new SimpleCache(1000) // 1 second TTL for testing
  })

  describe("basic operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")
    })

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined()
    })

    it("should check if key exists", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)
      expect(cache.has("nonexistent")).toBe(false)
    })

    it("should delete keys", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)

      cache.delete("key1")
      expect(cache.has("key1")).toBe(false)
    })

    it("should clear all entries", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")

      cache.clear()

      expect(cache.has("key1")).toBe(false)
      expect(cache.has("key2")).toBe(false)
    })
  })

  describe("TTL (Time To Live)", () => {
    it("should expire entries after TTL", async () => {
      cache.set("key1", "value1", 100) // 100ms TTL

      expect(cache.get("key1")).toBe("value1")

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(cache.get("key1")).toBeUndefined()
    })

    it("should use default TTL if not specified", async () => {
      const shortCache = new SimpleCache(100) // 100ms default TTL
      shortCache.set("key1", "value1")

      expect(shortCache.get("key1")).toBe("value1")

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(shortCache.get("key1")).toBeUndefined()
    })

    it("should allow custom TTL per entry", async () => {
      cache.set("short", "value", 100) // 100ms
      cache.set("long", "value", 500) // 500ms

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(cache.get("short")).toBeUndefined()
      expect(cache.get("long")).toBe("value")
    })
  })

  describe("cleanup", () => {
    it("should remove expired entries on cleanup", async () => {
      cache.set("key1", "value1", 100)
      cache.set("key2", "value2", 500)

      await new Promise(resolve => setTimeout(resolve, 150))

      cache.cleanup()

      const stats = cache.stats()
      expect(stats.activeEntries).toBe(1)
      expect(stats.expiredEntries).toBe(0) // Cleaned up
    })
  })

  describe("statistics", () => {
    it("should return correct stats", async () => {
      cache.set("key1", "value1", 100)
      cache.set("key2", "value2", 500)

      await new Promise(resolve => setTimeout(resolve, 150))

      const stats = cache.stats()

      expect(stats.totalEntries).toBe(2)
      expect(stats.activeEntries).toBe(1)
      expect(stats.expiredEntries).toBe(1)
    })
  })

  describe("keys", () => {
    it("should return all keys", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")

      const keys = cache.keys()

      expect(keys).toContain("key1")
      expect(keys).toContain("key2")
      expect(keys.length).toBe(2)
    })

    it("should return only active keys", async () => {
      cache.set("active", "value", 500)
      cache.set("expired", "value", 100)

      await new Promise(resolve => setTimeout(resolve, 150))

      const activeKeys = cache.activeKeys()

      expect(activeKeys).toContain("active")
      expect(activeKeys).not.toContain("expired")
      expect(activeKeys.length).toBe(1)
    })
  })

  describe("complex values", () => {
    it("should handle objects", () => {
      const obj = { foo: "bar", nested: { value: 123 } }
      cache.set("obj", obj)

      expect(cache.get("obj")).toEqual(obj)
    })

    it("should handle arrays", () => {
      const arr = [1, 2, 3, "four"]
      cache.set("arr", arr)

      expect(cache.get("arr")).toEqual(arr)
    })

    it("should handle null and undefined", () => {
      cache.set("null", null)
      cache.set("undefined", undefined)

      expect(cache.get("null")).toBeNull()
      expect(cache.get("undefined")).toBeUndefined()
    })
  })
})
