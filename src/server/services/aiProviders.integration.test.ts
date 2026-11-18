import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getReusableTestAccount, type ReusableAccount } from "../testUtils/reusableTestAccounts";

vi.mock("server-only", () => ({}));
const { getAiProvider, upsertAiProvider, deleteAiProvider } = await import("../repos/aiProviders");
const { resolveProviderForUser } = await import("../ai/resolveProvider");
const { chiffrerSecret } = await import("../ai/secrets");

/**
 * V3.1-224 (ADR 0103) — le fournisseur d'un compte est à lui seul.
 *
 * Ce que ce fichier prouve contre la vraie base : la RLS tient (personne ne
 * lit ni n'écrit la ligne d'un autre), et la résolution retombe proprement
 * quand il n'y a rien à résoudre.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY);

const typed = (a: ReusableAccount) => a.client as unknown as SupabaseClient<Database>;

describe.skipIf(!hasCreds)("le fournisseur d'IA d'un compte (V3.1-224, integration, base reelle)", () => {
  let admin: SupabaseClient<Database>;
  let moi: ReusableAccount;
  let autre: ReusableAccount;
  const CLE_CHIFFREMENT = "c".repeat(64);
  let avantCle: string | undefined;

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
    if (admin) await admin.from("ai_providers").delete().in("user_id", [moi.id, autre.id]);
  });

  it("chacun pose le sien, et ne voit que le sien", async () => {
    await upsertAiProvider(typed(moi), { userId: moi.id, label: "Le mien", baseUrl: "https://api.venice.ai/api/v1", model: "venice-uncensored", secret: chiffrerSecret("sk-a-moi") });
    await upsertAiProvider(typed(autre), { userId: autre.id, label: "Le sien", baseUrl: "https://api.exemple.net/v1", model: "autre-modele", secret: chiffrerSecret("sk-a-lui") });

    expect((await getAiProvider(typed(moi), moi.id))?.label).toBe("Le mien");
    // La RLS ne rend rien, même en demandant explicitement la ligne de l'autre.
    expect(await getAiProvider(typed(moi), autre.id)).toBeNull();
    expect(await getAiProvider(typed(autre), moi.id)).toBeNull();
  });

  it("personne ne peut écrire une ligne au nom d'un autre", async () => {
    await expect(
      upsertAiProvider(typed(autre), { userId: moi.id, label: "Volé", baseUrl: "https://api.exemple.net/v1", model: "x" }),
    ).rejects.toThrow();
    expect((await getAiProvider(typed(moi), moi.id))?.label).toBe("Le mien");
  });

  it("la résolution rend le fournisseur du compte, et le secret ne quitte jamais le serveur", async () => {
    const provider = await resolveProviderForUser(typed(moi), moi.id);
    expect(provider).not.toBeNull();
    // Ce que l'écran lit n'a aucune raison de contenir la clé : la ligne la porte chiffrée.
    const ligne = await getAiProvider(typed(moi), moi.id);
    expect(ligne?.secret).not.toContain("sk-a-moi");
    expect(ligne?.secret?.startsWith("v1:")).toBe(true);
  });

  it("une adresse devenue invalide en base ne se résout plus : on n'appelle pas n'importe quoi", async () => {
    // Écrite par le service role, qui contourne la RLS — le cas « quelqu'un a touché la base ».
    await admin.from("ai_providers").update({ base_url: "file:///etc/passwd" }).eq("user_id", moi.id);
    expect(await resolveProviderForUser(typed(moi), moi.id)).toBeNull();
    await admin.from("ai_providers").update({ base_url: "https://api.venice.ai/api/v1" }).eq("user_id", moi.id);
  });

  it("un secret indéchiffrable vaut « pas de fournisseur », jamais un appel sans clé", async () => {
    await admin.from("ai_providers").update({ secret: "v1:nawak:nawak:nawak" }).eq("user_id", moi.id);
    expect(await resolveProviderForUser(typed(moi), moi.id)).toBeNull();
  });

  it("retirer le sien le fait disparaître", async () => {
    await deleteAiProvider(typed(moi), moi.id);
    expect(await getAiProvider(typed(moi), moi.id)).toBeNull();
  });
});
