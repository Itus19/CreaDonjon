import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { insertAiProvider, getAiProviderById, listAiProvidersWithChoice, setAiProviderChoice, deleteAiProvider } = await import("../repos/aiProviders");
const { resolveProviderForUser } = await import("../ai/resolveProvider");
const { chiffrerSecret } = await import("../ai/secrets");

/**
 * V3.1-224 (ADR 0103), ADR 0108 — les fournisseurs d'un compte sont à lui seul.
 *
 * Ce que ce fichier prouve contre la vraie base : la RLS tient (personne ne
 * lit ni n'écrit la ligne d'un autre, et un choix ne peut pas désigner le
 * fournisseur d'un autre compte), et la résolution retombe proprement quand
 * il n'y a rien à résoudre.
 *
 * Coût (docs/QUOTAS.md T2) : une vingtaine de requêtes, deux comptes réutilisés.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const typed = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("les fournisseurs d'IA d'un compte (ADR 0103, 0108, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let moi: ReusableAccount;
  let autre: ReusableAccount;
  const CLE_CHIFFREMENT = "c".repeat(64);
  let avantCle: string | undefined;
  let monId = "";
  let sonId = "";

  beforeAll(async () => {
    admin = createSupabaseClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    [moi, autre] = await Promise.all([getReusableTestAccount(admin, "owner"), getReusableTestAccount(admin, "outsider")]);
    avantCle = process.env.AI_SECRETS_KEY;
    process.env.AI_SECRETS_KEY = CLE_CHIFFREMENT;
    await admin.from("ai_providers").delete().in("user_id", [moi.id, autre.id]);
  });

  afterAll(async () => {
    if (avantCle === undefined) delete process.env.AI_SECRETS_KEY;
    else process.env.AI_SECRETS_KEY = avantCle;
    // Les choix partent avec leurs fournisseurs (`on delete cascade`).
    if (admin) await admin.from("ai_providers").delete().in("user_id", [moi.id, autre.id]);
  });

  it("chacun pose les siens, et ne voit que les siens", async () => {
    monId = (
      await insertAiProvider(typed(moi), {
        userId: moi.id,
        label: "Le mien",
        baseUrl: "https://api.venice.ai/api/v1",
        models: ["venice-uncensored", "llama-3.3-70b"],
        secret: chiffrerSecret("sk-a-moi"),
      })
    ).id;
    sonId = (
      await insertAiProvider(typed(autre), { userId: autre.id, label: "Le sien", baseUrl: "https://api.exemple.net/v1", models: ["autre-modele"], secret: chiffrerSecret("sk-a-lui") })
    ).id;

    expect((await getAiProviderById(typed(moi), moi.id, monId))?.label).toBe("Le mien");
    // La RLS ne rend rien, même en demandant explicitement la ligne de l'autre.
    expect(await getAiProviderById(typed(moi), autre.id, sonId)).toBeNull();
    expect((await listAiProvidersWithChoice(typed(autre), moi.id)).providers).toEqual([]);
  });

  it("personne ne peut écrire une ligne au nom d'un autre", async () => {
    await expect(insertAiProvider(typed(autre), { userId: moi.id, label: "Volé", baseUrl: "https://api.exemple.net/v1", models: ["x"], secret: null })).rejects.toThrow();
    expect((await listAiProvidersWithChoice(typed(moi), moi.id)).providers).toHaveLength(1);
  });

  it("un choix ne peut pas désigner le fournisseur d'un autre compte", async () => {
    // Sinon, on ferait payer l'autre : sa clé servirait à nos appels.
    await expect(setAiProviderChoice(typed(moi), { userId: moi.id, providerId: sonId, model: "autre-modele" })).rejects.toThrow();
    expect((await listAiProvidersWithChoice(typed(moi), moi.id)).choice).toBeNull();
  });

  it("le choix enregistré se relit embarqué avec les fournisseurs", async () => {
    await setAiProviderChoice(typed(moi), { userId: moi.id, providerId: monId, model: "llama-3.3-70b" });
    const { providers, choice } = await listAiProvidersWithChoice(typed(moi), moi.id);
    expect(providers.map((p) => p.id)).toEqual([monId]);
    expect(choice).toEqual({ provider_id: monId, model: "llama-3.3-70b" });
  });

  it("la résolution rend le fournisseur du compte, et le secret ne quitte jamais le serveur", async () => {
    expect(await resolveProviderForUser(typed(moi), moi.id)).not.toBeNull();
    const ligne = await getAiProviderById(typed(moi), moi.id, monId);
    expect(ligne?.secret).not.toContain("sk-a-moi");
    expect(ligne?.secret?.startsWith("v1:")).toBe(true);
  });

  it("une adresse devenue invalide en base ne se résout plus : on n'appelle pas n'importe quoi", async () => {
    // Écrite par le service role, qui contourne la RLS : le cas « quelqu'un a touché la base ».
    await admin.from("ai_providers").update({ base_url: "file:///etc/passwd" }).eq("id", monId);
    expect(await resolveProviderForUser(typed(moi), moi.id)).toBeNull();
    await admin.from("ai_providers").update({ base_url: "https://api.venice.ai/api/v1" }).eq("id", monId);
  });

  it("un secret indéchiffrable vaut « pas de fournisseur », jamais un appel sans clé", async () => {
    await admin.from("ai_providers").update({ secret: "v1:nawak:nawak:nawak" }).eq("id", monId);
    expect(await resolveProviderForUser(typed(moi), moi.id)).toBeNull();
  });

  it("retirer un fournisseur emporte le choix qui le désignait", async () => {
    await deleteAiProvider(typed(moi), moi.id, monId);
    const { providers, choice } = await listAiProvidersWithChoice(typed(moi), moi.id);
    expect(providers).toEqual([]);
    expect(choice).toBeNull();
  });
});
