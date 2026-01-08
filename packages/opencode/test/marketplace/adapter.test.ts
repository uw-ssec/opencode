import { describe, it, expect, beforeEach } from "bun:test"
import { PluginAdapter } from "../../src/marketplace/adapter"
import type { ClaudeTranslation } from "../../src/marketplace/types"

describe("PluginAdapter", () => {
  describe("translatePermissions", () => {
    it("should translate allow permissions", () => {
      const claudePermissions = {
        allow: [
          "Bash(git:*)",
          "WebFetch(domain:example.com)",
          "Read",
        ],
      }

      const result = PluginAdapter.translatePermissions(claudePermissions)

      expect(result).toEqual({
        bash: {
          "git *": "allow",
        },
        webfetch: {
          "domain example.com": "allow",
        },
        read: {
          "*": "allow",
        },
      })
    })

    it("should translate deny permissions", () => {
      const claudePermissions = {
        deny: [
          "Bash(rm:*)",
        ],
      }

      const result = PluginAdapter.translatePermissions(claudePermissions)

      expect(result).toEqual({
        bash: {
          "rm *": "deny",
        },
      })
    })

    it("should handle mixed allow and deny", () => {
      const claudePermissions = {
        allow: ["Bash(git:*)"],
        deny: ["Bash(rm:*)"],
      }

      const result = PluginAdapter.translatePermissions(claudePermissions)

      expect(result).toEqual({
        bash: {
          "git *": "allow",
          "rm *": "deny",
        },
      })
    })

    it("should handle empty permissions", () => {
      const claudePermissions = {}

      const result = PluginAdapter.translatePermissions(claudePermissions)

      expect(result).toEqual({})
    })
  })

  describe("translateAgentFrontmatter", () => {
    it("should translate basic agent frontmatter", () => {
      const claudeFrontmatter: ClaudeTranslation.AgentFrontmatter = {
        name: "test-agent",
        description: "Test agent description",
      }

      const result = PluginAdapter.translateAgentFrontmatter(claudeFrontmatter)

      expect(result).toMatchObject({
        name: "test-agent",
        description: "Test agent description",
        mode: "primary",
      })
    })

    it("should translate skills from comma-separated string to array", () => {
      const claudeFrontmatter: ClaudeTranslation.AgentFrontmatter = {
        name: "test-agent",
        description: "Test agent",
        skills: "skill1, skill2, skill3",
      }

      const result = PluginAdapter.translateAgentFrontmatter(claudeFrontmatter)

      expect(result.skills).toEqual(["skill1", "skill2", "skill3"])
    })

    it("should handle 'All tools' permission", () => {
      const claudeFrontmatter: ClaudeTranslation.AgentFrontmatter = {
        name: "test-agent",
        description: "Test agent",
        "allowed-tools": "All tools",
      }

      const result = PluginAdapter.translateAgentFrontmatter(claudeFrontmatter)

      expect(result.permission).toEqual({
        "*": "allow",
      })
    })

    it("should not include model if it's 'inherit'", () => {
      const claudeFrontmatter: ClaudeTranslation.AgentFrontmatter = {
        name: "test-agent",
        description: "Test agent",
        model: "inherit",
      }

      const result = PluginAdapter.translateAgentFrontmatter(claudeFrontmatter)

      expect(result.model).toBeUndefined()
    })

    it("should include model if it's not 'inherit'", () => {
      const claudeFrontmatter: ClaudeTranslation.AgentFrontmatter = {
        name: "test-agent",
        description: "Test agent",
        model: "anthropic/claude-3-opus",
      }

      const result = PluginAdapter.translateAgentFrontmatter(claudeFrontmatter)

      expect(result.model).toBe("anthropic/claude-3-opus")
    })
  })

  // Note: detectStructure and adaptPlugin tests would require filesystem mocking
  // or test fixtures. These will be added in Phase 2 with comprehensive testing.
})
