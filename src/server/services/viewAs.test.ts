import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * « Voir comme » (V3.1-12, ADR 0051) — deux défauts constatés le 19 octobre
 * en vérifiant V3.1-54 :
 * - abandonner sur la page « Confirmer » puis cliquer « Revenir à mon
 *   compte » déconnectait : la session courante était encore celle
 *   d'origine, le retour la fermait, ce qui révoquait le jeton mis de côté ;
 * - rien n'empêchait « Voir comme » sur son propre compte.
 */
const mint = vi.fn(async () => ({ ok: true as const, tokenHash: "h" }));
vi.mock("@/src/server/services/accountProvisioning", () => ({ mintSessionForInvitedAccount: () => mint() }));
vi.mock("@/src/server/services/account", () => ({ isSuperadmin: async () => true }));
vi.mock("@/src/server/services/campaigns", () => ({ decideMemberAccountAction: async () => ({ allowed: true }) }));
vi.mock("@/src/server/repos/campaigns", () => ({ getCampaignById: async () => ({ id: "c1", world_id: "w1" }) }));

const { startViewAs, captureReturnSession, returnFromViewAs } = await import("./viewAs");

/** Un jeton d'accès factice : seule la charge utile compte ici. */
function jeton(charge: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(charge)).toString("base64url")}.sig`;
}

function client(sessionCourante: string | null) {
  const appels: string[] = [];
  const auth = {
    getClaims: async () => {
      appels.push("getClaims");
      return sessionCourante ? { data: { claims: { session_id: sessionCourante } }, error: null } : { data: null, error: { message: "aucune session" } };
    },
    signOut: async () => {
      appels.push("signOut");
      return { error: null };
    },
    refreshSession: async (arg?: { refresh_token: string }) => {
      appels.push(arg ? `refresh:${arg.refresh_token}` : "refresh");
      return { data: { session: { refresh_token: "rt-neuf", access_token: jeton({ session_id: "s-origine" }) } }, error: null };
    },
  };
  return { supabase: { auth } as unknown as SupabaseClient<Database>, appels };
}

beforeEach(() => mint.mockClear());

describe("startViewAs", () => {
  it("refuse « Voir comme » sur son propre compte, avant tout autre contrôle", async () => {
    const { supabase } = client("s1");
    expect(await startViewAs(supabase, { callerId: "u1", targetUserId: "u1", campaignId: "c1" })).toEqual({ ok: false, reason: "self" });
    expect(await startViewAs(supabase, { callerId: "u1", targetUserId: "u1" })).toEqual({ ok: false, reason: "self" });
    expect(mint).not.toHaveBeenCalled();
  });

  it("laisse passer un autre compte autorisé", async () => {
    const { supabase } = client("s1");
    expect(await startViewAs(supabase, { callerId: "u1", targetUserId: "u2", campaignId: "c1" })).toEqual({ ok: true, tokenHash: "h" });
  });
});

describe("captureReturnSession", () => {
  it("rend le jeton de rafraîchissement ET l'identifiant de la session d'origine", async () => {
    const { supabase } = client("s1");
    expect(await captureReturnSession(supabase)).toEqual({ refreshToken: "rt-neuf", sessionId: "s-origine" });
  });
});

describe("returnFromViewAs", () => {
  it("confirmation abandonnée : la session courante EST celle d'origine, on ne la ferme pas", async () => {
    const { supabase, appels } = client("s-origine");
    expect(await returnFromViewAs(supabase, { refreshToken: "rt", sessionId: "s-origine" })).toEqual({ ok: true });
    expect(appels).not.toContain("signOut");
    expect(appels.filter((a) => a.startsWith("refresh"))).toEqual([]);
  });

  it("session empruntée : on la ferme, puis on reprend celle d'origine", async () => {
    const { supabase, appels } = client("s-empruntee");
    expect(await returnFromViewAs(supabase, { refreshToken: "rt", sessionId: "s-origine" })).toEqual({ ok: true });
    expect(appels.slice(1)).toEqual(["signOut", "refresh:rt"]);
  });

  it("cookie d'avant ce correctif (sans identifiant de session) : comportement d'origine", async () => {
    const { supabase, appels } = client("s-origine");
    expect(await returnFromViewAs(supabase, { refreshToken: "rt", sessionId: null })).toEqual({ ok: true });
    expect(appels).toEqual(["signOut", "refresh:rt"]);
  });
});
