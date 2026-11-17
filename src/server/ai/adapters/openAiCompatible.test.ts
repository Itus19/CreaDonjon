import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { OpenAiCompatibleProvider } = await import("./openAiCompatible");

/**
 * LM Studio peut exiger un jeton (« Require Authentication » : en-tête
 * `Authorization: Bearer …`). Sans jeton configuré, rien ne change ; avec un
 * jeton, chaque appel le porte. Le jeton reste côté serveur (règle 1).
 */
function fetchFactice() {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], data: [{ embedding: [1] }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 })
  );
}
const enTetes = (f: ReturnType<typeof fetchFactice>, i = 0) => (f.mock.calls[i]![1].headers ?? {}) as Record<string, string>;

afterEach(() => vi.unstubAllGlobals());

describe("OpenAiCompatibleProvider — jeton d'accès", () => {
  it("sans jeton : aucun en-tête Authorization", async () => {
    const f = fetchFactice();
    vi.stubGlobal("fetch", f);
    await new OpenAiCompatibleProvider({ baseUrl: "http://x/v1", model: "m" }).complete({ messages: [{ role: "user", content: "a" }] });
    expect(enTetes(f).Authorization).toBeUndefined();
  });

  it("avec un jeton : Bearer sur la complétion et sur les plongements", async () => {
    const f = fetchFactice();
    vi.stubGlobal("fetch", f);
    const p = new OpenAiCompatibleProvider({ baseUrl: "http://x/v1", model: "m", apiKey: "jeton-factice" });
    await p.complete({ messages: [{ role: "user", content: "a" }] });
    await p.embed(["a"]);
    expect(enTetes(f, 0).Authorization).toBe("Bearer jeton-factice");
    expect(enTetes(f, 1).Authorization).toBe("Bearer jeton-factice");
  });
});
