import { z } from "zod"

/**
 * Marketplace Manifest Format
 *
 * Defines the structure of marketplace.json files that describe
 * available plugins in a marketplace repository.
 */
export namespace Marketplace {
  /**
   * Plugin metadata in marketplace.json
   */
  export const PluginMetadata = z.object({
    name: z.string().describe("Unique plugin identifier"),
    source: z.string().describe("Relative path to plugin directory"),
    description: z.string().describe("Brief plugin description"),
    version: z.string().describe("Semantic version (e.g., 1.0.0)"),
    author: z.object({
      name: z.string(),
      url: z.string().url().optional(),
    }).describe("Plugin author information"),
    homepage: z.string().url().optional().describe("Plugin homepage URL"),
    repository: z.string().url().optional().describe("Source repository URL"),
    license: z.string().optional().describe("License identifier (e.g., MIT)"),
    keywords: z.array(z.string()).default([]).describe("Search keywords"),
    category: z.string().optional().describe("Plugin category"),
    strict: z.boolean().default(false).describe("Strict mode validation"),
    agents: z.array(z.string()).default([]).describe("Paths to agent files"),
    skills: z.array(z.string()).default([]).describe("Paths to skill directories"),
    commands: z.array(z.string()).default([]).describe("Paths to command files"),
    npm: z.string().optional().describe("NPM package name for programmatic plugin"),
  })

  export type PluginMetadata = z.infer<typeof PluginMetadata>

  /**
   * Complete marketplace manifest
   */
  export const Manifest = z.object({
    name: z.string().describe("Marketplace name"),
    owner: z.object({
      name: z.string(),
      url: z.string().url().optional(),
    }).describe("Marketplace owner"),
    metadata: z.object({
      description: z.string(),
      version: z.string(),
    }).describe("Marketplace metadata"),
    plugins: z.array(PluginMetadata).describe("Available plugins"),
  })

  export type Manifest = z.infer<typeof Manifest>
}

/**
 * Marketplace Source Configuration
 *
 * Defines how to load marketplace manifests from various sources
 * (GitHub, Git, HTTPS, or local filesystem).
 */
export namespace MarketplaceSource {
  /**
   * GitHub repository source
   */
  export const GitHubSource = z.object({
    type: z.literal("github"),
    owner: z.string().describe("GitHub owner/org"),
    repo: z.string().describe("Repository name"),
    branch: z.string().default("main").describe("Branch to use"),
    manifestPath: z.string().default(".claude-plugin/marketplace.json").describe("Path to manifest"),
  })

  export type GitHubSource = z.infer<typeof GitHubSource>

  /**
   * Git repository source (SSH or HTTPS URL)
   */
  export const GitSource = z.object({
    type: z.literal("git"),
    url: z.string().describe("Git repository URL"),
    branch: z.string().default("main").describe("Branch to use"),
    manifestPath: z.string().default(".claude-plugin/marketplace.json").describe("Path to manifest"),
  })

  export type GitSource = z.infer<typeof GitSource>

  /**
   * HTTPS URL source
   */
  export const HttpsSource = z.object({
    type: z.literal("https"),
    url: z.string().url().describe("HTTPS URL to marketplace.json"),
  })

  export type HttpsSource = z.infer<typeof HttpsSource>

  /**
   * Local filesystem source
   */
  export const LocalSource = z.object({
    type: z.literal("local"),
    path: z.string().describe("Absolute or relative path to directory"),
    manifestPath: z.string().default(".claude-plugin/marketplace.json").describe("Path to manifest"),
  })

  export type LocalSource = z.infer<typeof LocalSource>

  /**
   * Union of all source types
   */
  export const Config = z.discriminatedUnion("type", [
    GitHubSource,
    GitSource,
    HttpsSource,
    LocalSource,
  ])

  export type Config = z.infer<typeof Config>

  /**
   * Loaded marketplace with metadata
   */
  export const LoadedMarketplace = z.object({
    source: Config,
    manifest: Marketplace.Manifest,
    cachedAt: z.date().describe("When marketplace was last cached"),
    path: z.string().describe("Local cache path"),
  })

  export type LoadedMarketplace = z.infer<typeof LoadedMarketplace>
}

/**
 * Installed Plugin Tracking
 *
 * Records which plugins are installed, their versions, and any errors.
 */
export namespace InstalledPlugin {
  /**
   * Installation status
   */
  export const Status = z.enum([
    "installed",
    "error",
    "updating",
  ])

  export type Status = z.infer<typeof Status>

  /**
   * Installed plugin record
   */
  export const Record = z.object({
    name: z.string().describe("Plugin name"),
    marketplace: z.string().describe("Source marketplace name"),
    version: z.string().describe("Installed version"),
    installedAt: z.date().describe("Installation timestamp"),
    updatedAt: z.date().optional().describe("Last update timestamp"),
    status: Status.describe("Current status"),
    error: z.string().optional().describe("Error message if status is 'error'"),
    path: z.string().describe("Installation path"),
    structure: z.enum(["opencode", "claude"]).describe("Detected plugin structure"),
  })

  export type Record = z.infer<typeof Record>

  /**
   * Database of installed plugins
   */
  export const Database = z.object({
    version: z.string().default("1.0"),
    plugins: z.array(Record),
  })

  export type Database = z.infer<typeof Database>
}

/**
 * Plugin Structure Detection
 *
 * Determines whether a plugin follows Claude or OpenCode conventions.
 */
export namespace PluginStructure {
  /**
   * Structure indicators for detection
   */
  export const Indicators = z.object({
    // Directory indicators
    hasOpenCodeDir: z.boolean(),
    hasClaudeDir: z.boolean(),
    hasClaudePlugin: z.boolean(),

    // Agent indicators
    hasAgentsDir: z.boolean(),
    hasAgentDir: z.boolean(),

    // Skill indicators
    hasSkillsDir: z.boolean(),
    hasSkillDir: z.boolean(),

    // Command indicators
    hasCommandsDir: z.boolean(),
    hasCommandDir: z.boolean(),

    // Config indicators
    hasOpencodeJsonc: z.boolean(),
    hasSettingsLocal: z.boolean(),

    // Manifest indicators
    hasMarketplaceJson: z.boolean(),
    hasPackageJson: z.boolean(),
  })

  export type Indicators = z.infer<typeof Indicators>

  /**
   * Detection result with confidence score
   */
  export const DetectionResult = z.object({
    structure: z.enum(["opencode", "claude"]).describe("Detected structure type"),
    confidence: z.number().min(0).max(1).describe("Confidence score (0-1)"),
    indicators: Indicators.describe("Detailed detection indicators"),
  })

  export type DetectionResult = z.infer<typeof DetectionResult>
}

/**
 * Claude Configuration Translation
 *
 * Types for translating Claude settings to OpenCode format.
 */
export namespace ClaudeTranslation {
  /**
   * Claude settings.local.json structure
   */
  export const Settings = z.object({
    permissions: z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    }).optional(),
  })

  export type Settings = z.infer<typeof Settings>

  /**
   * Claude agent frontmatter
   */
  export const AgentFrontmatter = z.object({
    name: z.string(),
    description: z.string(),
    model: z.string().optional(),
    version: z.string().optional(),
    permissionMode: z.string().optional(),
    skills: z.string().optional(), // Comma-separated
    "allowed-tools": z.string().optional(),
  })

  export type AgentFrontmatter = z.infer<typeof AgentFrontmatter>

  /**
   * Translation result
   */
  export const TranslationResult = z.object({
    agents: z.array(z.object({
      path: z.string(),
      translated: z.record(z.any()),
    })),
    skills: z.array(z.object({
      path: z.string(),
      translated: z.record(z.any()),
    })),
    config: z.record(z.any()),
  })

  export type TranslationResult = z.infer<typeof TranslationResult>
}

/**
 * Cache Entry
 *
 * Individual cache entry with TTL support.
 */
export namespace Cache {
  export const Entry = z.object({
    key: z.string(),
    value: z.any(),
    createdAt: z.date(),
    ttl: z.number().describe("Time to live in milliseconds"),
  })

  export type Entry = z.infer<typeof Entry>

  export const Store = z.record(Entry)
  export type Store = z.infer<typeof Store>
}

/**
 * Search Options
 */
export const SearchOptions = z.object({
  query: z.string().optional(),
  categories: z.array(z.string()).optional(),
  structure: z.enum(["opencode", "claude"]).optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
})

export type SearchOptions = z.infer<typeof SearchOptions>

/**
 * Installation Options
 */
export const InstallOptions = z.object({
  force: z.boolean().default(false).describe("Force reinstall"),
  skipValidation: z.boolean().default(false).describe("Skip validation"),
})

export type InstallOptions = z.infer<typeof InstallOptions>
