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

/**
 * ADR 0103 — l'adresse vient de l'utilisateur et notre serveur l'appelle :
 * aucune redirection suivie, un délai, et une raison lisible quand le
 * fournisseur refuse (crédit épuisé, clé fausse).
 */
describe("OpenAiCompatibleProvider — gardes d'un fournisseur distant", () => {
  const demande = { messages: [{ role: "user" as const, content: "a" }] };

  it("ne suit aucune redirection et borne la durée de l'appel", async () => {
    const f = fetchFactice();
    vi.stubGlobal("fetch", f);
    await new OpenAiCompatibleProvider({ baseUrl: "https://x.exemple/v1", model: "m" }).complete(demande);
    expect(f.mock.calls[0]![1].redirect).toBe("manual");
    expect(f.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });

  it("une redirection est un échec, jamais suivie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })));
    await expect(new OpenAiCompatibleProvider({ baseUrl: "https://x.exemple/v1", model: "m" }).complete(demande)).rejects.toMatchObject({ raison: "echec" });
  });

  it("un quota épuisé remonte comme tel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 })));
    await expect(new OpenAiCompatibleProvider({ baseUrl: "https://x.exemple/v1", model: "m" }).complete(demande)).rejects.toMatchObject({ raison: "quota" });
  });

  it("un délai dépassé remonte comme tel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("trop long", "TimeoutError"); }));
    await expect(new OpenAiCompatibleProvider({ baseUrl: "https://x.exemple/v1", model: "m" }).complete(demande)).rejects.toMatchObject({ raison: "delai" });
  });

  it("se dit local ou distant selon son adresse", () => {
    expect(new OpenAiCompatibleProvider({ baseUrl: "http://localhost:1234/v1", model: "m" }).capabilities().isLocal).toBe(true);
    expect(new OpenAiCompatibleProvider({ baseUrl: "https://api.venice.ai/api/v1", model: "m" }).capabilities().isLocal).toBe(false);
  });
});
