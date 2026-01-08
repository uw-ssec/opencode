import path from "path"
import { exists } from "fs"
import { promisify } from "util"
import matter from "gray-matter"
import type { PluginStructure, ClaudeTranslation } from "./types.js"
import {
  StructureDetectionError,
  TranslationError,
} from "./errors.js"

const existsAsync = promisify(exists)

/**
 * PluginAdapter
 *
 * Detects plugin structure (Claude vs OpenCode) and translates
 * Claude plugins to OpenCode format on load.
 */
export namespace PluginAdapter {
  /**
   * Detect plugin structure by analyzing directory contents
   *
   * Scores various indicators to determine if plugin follows
   * Claude or OpenCode conventions.
   */
  export async function detectStructure(
    pluginPath: string
  ): Promise<PluginStructure.DetectionResult> {
    try {
      // Gather all indicators
      const indicators: PluginStructure.Indicators = {
        // Directory indicators
        hasOpenCodeDir: await existsAsync(path.join(pluginPath, ".opencode")),
        hasClaudeDir: await existsAsync(path.join(pluginPath, ".claude")),
        hasClaudePlugin: await existsAsync(path.join(pluginPath, ".claude-plugin")),

        // Agent indicators
        hasAgentsDir: await existsAsync(path.join(pluginPath, "agents")),
        hasAgentDir: await existsAsync(path.join(pluginPath, "agent")),

        // Skill indicators
        hasSkillsDir: await existsAsync(path.join(pluginPath, "skills")),
        hasSkillDir: await existsAsync(path.join(pluginPath, "skill")),

        // Command indicators
        hasCommandsDir: await existsAsync(path.join(pluginPath, "commands")),
        hasCommandDir: await existsAsync(path.join(pluginPath, "command")),

        // Config indicators
        hasOpencodeJsonc: await existsAsync(path.join(pluginPath, ".opencode", "opencode.jsonc")),
        hasSettingsLocal: await existsAsync(path.join(pluginPath, ".claude", "settings.local.json")),

        // Manifest indicators
        hasMarketplaceJson: await existsAsync(path.join(pluginPath, ".claude-plugin", "marketplace.json")),
        hasPackageJson: await existsAsync(path.join(pluginPath, "package.json")),
      }

      // Calculate confidence scores
      let opencodeScore = 0
      let claudeScore = 0
      let totalIndicators = 0

      // Strong indicators (weight: 3)
      if (indicators.hasOpenCodeDir) {
        opencodeScore += 3
        totalIndicators += 3
      }
      if (indicators.hasClaudeDir) {
        claudeScore += 3
        totalIndicators += 3
      }
      if (indicators.hasClaudePlugin) {
        claudeScore += 3
        totalIndicators += 3
      }

      // Medium indicators (weight: 2)
      if (indicators.hasOpencodeJsonc) {
        opencodeScore += 2
        totalIndicators += 2
      }
      if (indicators.hasSettingsLocal) {
        claudeScore += 2
        totalIndicators += 2
      }
      if (indicators.hasMarketplaceJson) {
        claudeScore += 2
        totalIndicators += 2
      }

      // Weak indicators (weight: 1)
      // OpenCode prefers singular names
      if (indicators.hasAgentDir) {
        opencodeScore += 1
        totalIndicators += 1
      }
      if (indicators.hasSkillDir) {
        opencodeScore += 1
        totalIndicators += 1
      }
      if (indicators.hasCommandDir) {
        opencodeScore += 1
        totalIndicators += 1
      }

      // Claude prefers plural names
      if (indicators.hasAgentsDir) {
        claudeScore += 1
        totalIndicators += 1
      }
      if (indicators.hasSkillsDir) {
        claudeScore += 1
        totalIndicators += 1
      }
      if (indicators.hasCommandsDir) {
        claudeScore += 1
        totalIndicators += 1
      }

      // Determine structure and confidence
      const structure = opencodeScore > claudeScore ? "opencode" : "claude"
      const maxScore = Math.max(opencodeScore, claudeScore)
      const confidence = totalIndicators > 0 ? maxScore / totalIndicators : 0.5

      return {
        structure,
        confidence,
        indicators,
      }
    } catch (error) {
      throw new StructureDetectionError(
        `Failed to detect plugin structure at ${pluginPath}`,
        { cause: error }
      )
    }
  }

  /**
   * Translate Claude permission format to OpenCode format
   *
   * Claude format: "Tool(command:pattern)" or "Tool"
   * OpenCode format: { tool: { pattern: action } }
   */
  export function translatePermissions(
    claudePermissions: {
      allow?: string[]
      deny?: string[]
    }
  ): Record<string, any> {
    const result: Record<string, any> = {}

    // Process allow permissions
    for (const perm of claudePermissions.allow || []) {
      const parsed = parseClaudePermission(perm, "allow")
      if (!parsed) continue

      const { tool, pattern, action } = parsed

      if (!result[tool]) {
        result[tool] = {}
      }

      if (typeof result[tool] === "object") {
        result[tool][pattern] = action
      }
    }

    // Process deny permissions
    for (const perm of claudePermissions.deny || []) {
      const parsed = parseClaudePermission(perm, "deny")
      if (!parsed) continue

      const { tool, pattern, action } = parsed

      if (!result[tool]) {
        result[tool] = {}
      }

      if (typeof result[tool] === "object") {
        result[tool][pattern] = action
      }
    }

    return result
  }

  /**
   * Parse a single Claude permission string
   *
   * Formats:
   * - "Bash(command:pattern)" → { tool: "bash", pattern: "command pattern", action: "allow" }
   * - "Bash" → { tool: "bash", pattern: "*", action: "allow" }
   * - "WebFetch(domain:example.com)" → { tool: "webfetch", pattern: "domain example.com", action: "allow" }
   */
  function parseClaudePermission(
    perm: string,
    defaultAction: "allow" | "deny" = "allow"
  ): { tool: string; pattern: string; action: string } | null {
    // Match patterns like "Tool(command:pattern)" or "Tool"
    const match = perm.match(/^(\w+)(?:\(([^:]+):(.+)\))?$/)
    if (!match) {
      console.warn(`Failed to parse Claude permission: ${perm}`)
      return null
    }

    const [_, toolName, cmd, pattern] = match

    // Normalize tool name to lowercase
    const tool = toolName.toLowerCase()

    // Build pattern
    let finalPattern = "*"
    if (cmd && pattern) {
      // Combine command and pattern (e.g., "git config:*" → "git config *")
      finalPattern = `${cmd} ${pattern}`
    }

    return {
      tool,
      pattern: finalPattern,
      action: defaultAction,
    }
  }

  /**
   * Translate Claude agent frontmatter to OpenCode format
   *
   * Key differences:
   * - Claude: skills as comma-separated string
   * - OpenCode: skills as array or separate loading
   * - Claude: "allowed-tools" field
   * - OpenCode: permissions object
   * - Claude: "permissionMode" field
   * - OpenCode: mode field
   */
  export function translateAgentFrontmatter(
    claudeFrontmatter: ClaudeTranslation.AgentFrontmatter
  ): Record<string, any> {
    const result: Record<string, any> = {
      name: claudeFrontmatter.name,
      description: claudeFrontmatter.description,
    }

    // Translate model
    if (claudeFrontmatter.model && claudeFrontmatter.model !== "inherit") {
      result.model = claudeFrontmatter.model
    }

    // Translate skills (comma-separated → array)
    if (claudeFrontmatter.skills) {
      result.skills = claudeFrontmatter.skills
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0)
    }

    // Set default mode (most Claude agents are primary)
    result.mode = "primary"

    // Default permission handling
    if (claudeFrontmatter["allowed-tools"] === "All tools") {
      result.permission = {
        "*": "allow",
      }
    } else if (claudeFrontmatter["allowed-tools"]) {
      // Parse specific tools
      const tools = claudeFrontmatter["allowed-tools"]
        .split(",")
        .map(t => t.trim().toLowerCase())

      result.permission = {}
      for (const tool of tools) {
        result.permission[tool] = "allow"
      }
    }

    return result
  }

  /**
   * Adapt a Claude plugin to OpenCode format
   *
   * This performs the actual translation on load:
   * 1. Detect structure
   * 2. If Claude, translate agents/skills/config
   * 3. Return adapted structure
   */
  export async function adaptPlugin(
    pluginPath: string,
    detectionResult?: PluginStructure.DetectionResult
  ): Promise<ClaudeTranslation.TranslationResult> {
    try {
      // Detect structure if not provided
      const detection = detectionResult || await detectStructure(pluginPath)

      // If OpenCode, no translation needed
      if (detection.structure === "opencode") {
        return {
          agents: [],
          skills: [],
          config: {},
        }
      }

      // Translate Claude plugin
      const result: ClaudeTranslation.TranslationResult = {
        agents: [],
        skills: [],
        config: {},
      }

      // Translate settings.local.json to config
      const settingsPath = path.join(pluginPath, ".claude", "settings.local.json")
      if (await existsAsync(settingsPath)) {
        try {
          const settingsContent = await Bun.file(settingsPath).text()
          const settings: ClaudeTranslation.Settings = JSON.parse(settingsContent)

          if (settings.permissions) {
            result.config.permission = translatePermissions(settings.permissions)
          }
        } catch (error) {
          console.warn(`Failed to parse Claude settings: ${error}`)
        }
      }

      // Note: Actual agent/skill translation happens during loading
      // The Plugin/Agent/Skill loaders will use these translation functions

      return result
    } catch (error) {
      throw new TranslationError(
        `Failed to adapt plugin at ${pluginPath}`,
        { cause: error }
      )
    }
  }

  /**
   * Validate translated plugin structure
   *
   * Ensures the adapted plugin is valid OpenCode format
   */
  export async function validateAdaptedPlugin(
    pluginPath: string,
    translationResult: ClaudeTranslation.TranslationResult
  ): Promise<boolean> {
    // Basic validation
    // In Phase 1, we keep this simple
    // Later phases will add comprehensive validation

    return true
  }
}
