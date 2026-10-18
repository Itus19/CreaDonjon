import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-85 — « Mot de passe oublié : même message pour un nom inconnu, un nom
 * connu, un email inconnu, un email connu. » La base est simulée : un compte
 * connu fait réussir l'appel, un inconnu le fait échouer, comme le ferait
 * n'importe quelle différence de comportement côté serveur. Le service ne
 * rend rien et ne lève jamais : l'action répond donc toujours pareil.
 */
const connus = { noms: new Set(["Ana"]), emails: new Set(["ana@exemple.fr"]) };
const sendPasswordResetEmail = vi.fn(async (_c: unknown, email: string) => ({ error: connus.emails.has(email) ? null : "User not found" }));
const requestPasswordResetByName = vi.fn(async (_c: unknown, nom: string) => {
  if (!connus.noms.has(nom)) throw new Error("aucun compte");
});
vi.mock("@/src/server/repos/accountAuth", () => ({
  sendPasswordResetEmail: (c: unknown, email: string) => sendPasswordResetEmail(c, email),
  requestPasswordResetByName: (c: unknown, nom: string) => requestPasswordResetByName(c, nom),
}));

const { demanderReinitialisation } = await import("./passwordReset");
const client = {} as SupabaseClient<Database>;

describe("demanderReinitialisation (V3.1-85)", () => {
  beforeEach(() => {
    sendPasswordResetEmail.mockClear();
    requestPasswordResetByName.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("nom connu, nom inconnu, email connu, email inconnu : la même issue, sans erreur", async () => {
    const issues = await Promise.all(
      ["Ana", "Personne", "ana@exemple.fr", "personne@exemple.fr"].map((x) => demanderReinitialisation(client, x, "https://site"))
    );
    expect(issues).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("un email part par le lien, avec la page de réinitialisation pour suite", async () => {
    await demanderReinitialisation(client, " ana@exemple.fr ", "https://site");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail.mock.calls[0][1]).toBe("ana@exemple.fr");
    expect(requestPasswordResetByName).not.toHaveBeenCalled();
  });

  it("un nom dépose la demande au MJ", async () => {
    await demanderReinitialisation(client, "Ana", "https://site");
    expect(requestPasswordResetByName).toHaveBeenCalledTimes(1);
    expect(requestPasswordResetByName.mock.calls[0][1]).toBe("Ana");
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("un nom trop long pour un compte : rien de déposé, même issue", async () => {
    await expect(demanderReinitialisation(client, "x".repeat(60), "https://site")).resolves.toBeUndefined();
    expect(requestPasswordResetByName).not.toHaveBeenCalled();
  });
});
