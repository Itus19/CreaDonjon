import { describe, expect, it } from "vitest";
import { canActOnMemberAccount, isSyntheticAccountEmail } from "./memberAccountActions";

describe("isSyntheticAccountEmail", () => {
  it("reconnait les comptes « tag » et ceux crees par lien avant V3.1-10", () => {
    expect(isSyntheticAccountEmail("tag-0b6f@creadonjon.tag")).toBe(true);
    expect(isSyntheticAccountEmail("invite-12ab@creadonjon.invite")).toBe(true);
  });

  it("refuse un email reel, un domaine voisin ou l'absence d'email", () => {
    expect(isSyntheticAccountEmail("naivara@gmail.com")).toBe(false);
    expect(isSyntheticAccountEmail("x@creadonjon.tag.evil.com")).toBe(false);
    expect(isSyntheticAccountEmail("x@notcreadonjon.tag")).toBe(false);
    expect(isSyntheticAccountEmail(null)).toBe(false);
  });

  it("ignore la casse du domaine", () => {
    expect(isSyntheticAccountEmail("tag-1@CreaDonjon.TAG")).toBe(true);
  });
});

const MJ = { callerIsSuperadmin: false, callerManagesCampaign: true, targetIsMember: true, targetIsSyntheticAccount: true };

describe("canActOnMemberAccount (ADR 0052)", () => {
  it("un MJ agit sur un compte tag membre de sa campagne", () => {
    expect(canActOnMemberAccount({ ...MJ, action: "view_as" })).toEqual({ allowed: true });
    expect(canActOnMemberAccount({ ...MJ, action: "reset_password" })).toEqual({ allowed: true });
  });

  it("un MJ ne touche pas un compte qui n'est pas membre de cette campagne", () => {
    expect(canActOnMemberAccount({ ...MJ, targetIsMember: false, action: "reset_password" })).toEqual({ allowed: false, reason: "not_a_member" });
    expect(canActOnMemberAccount({ ...MJ, targetIsMember: false, action: "view_as" })).toEqual({ allowed: false, reason: "not_a_member" });
  });

  it("un non-MJ n'a aucun droit, membre ou pas", () => {
    expect(canActOnMemberAccount({ ...MJ, callerManagesCampaign: false, action: "reset_password" })).toEqual({ allowed: false, reason: "not_authorized" });
  });

  it("un MJ ne touche jamais un compte ordinaire (email reel)", () => {
    expect(canActOnMemberAccount({ ...MJ, targetIsSyntheticAccount: false, action: "reset_password" })).toEqual({ allowed: false, reason: "ordinary_account" });
    expect(canActOnMemberAccount({ ...MJ, targetIsSyntheticAccount: false, action: "view_as" })).toEqual({ allowed: false, reason: "ordinary_account" });
  });

  it("le superadmin agit partout, sans etre MJ ni que la cible soit membre", () => {
    const sa = { callerIsSuperadmin: true, callerManagesCampaign: false, targetIsMember: false, targetIsSyntheticAccount: true };
    expect(canActOnMemberAccount({ ...sa, action: "view_as" })).toEqual({ allowed: true });
    expect(canActOnMemberAccount({ ...sa, action: "reset_password" })).toEqual({ allowed: true });
  });

  it("« voir comme » reste impossible sur un compte ordinaire, meme pour le superadmin ; la reinitialisation forcee non", () => {
    const sa = { callerIsSuperadmin: true, callerManagesCampaign: false, targetIsMember: false, targetIsSyntheticAccount: false };
    expect(canActOnMemberAccount({ ...sa, action: "view_as" })).toEqual({ allowed: false, reason: "ordinary_account" });
    expect(canActOnMemberAccount({ ...sa, action: "reset_password" })).toEqual({ allowed: true });
  });
});
