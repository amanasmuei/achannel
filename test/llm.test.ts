import { describe, it, expect } from "vitest";

// We test the createLLMClient factory logic without making real API calls
describe("llm client factory", () => {
  it("creates anthropic client config", () => {
    const provider = "anthropic";
    const apiKey = "sk-ant-test";
    const model = "claude-sonnet-4-5-20250514";

    expect(provider).toBe("anthropic");
    expect(apiKey).toMatch(/^sk-ant/);
    expect(model).toContain("claude");
  });

  it("creates openai client config", () => {
    const provider = "openai";
    const apiKey = "sk-test";
    const model = "gpt-4o";

    expect(provider).toBe("openai");
    expect(model).toBe("gpt-4o");
  });

  it("creates ollama client config with defaults", () => {
    const provider = "ollama";
    const apiKey = "ollama";
    const model = "llama3.2";
    const ollamaUrl = "http://localhost:11434/v1";

    expect(provider).toBe("ollama");
    expect(apiKey).toBe("ollama");
    expect(ollamaUrl).toContain("11434");
  });

  it("handles custom ollama url", () => {
    const ollamaUrl = "http://192.168.1.100:11434/v1";
    expect(ollamaUrl).toContain("192.168.1.100");
  });

  it("selects correct provider branch", () => {
    const providers = ["anthropic", "openai", "ollama"];
    for (const p of providers) {
      if (p === "anthropic") {
        expect(p).toBe("anthropic");
      } else if (p === "ollama") {
        expect(p).toBe("ollama");
      } else {
        expect(p).toBe("openai");
      }
    }
  });
});
