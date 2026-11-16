import { describe, expect, it } from "vitest";
import { summarizeRequest, unansweredCount } from "./requestStatus";

const membres = [
  { user_id: "mj", role: "gm" },
  { user_id: "a", role: "player" },
  { user_id: "b", role: "player" },
];

describe("summarizeRequest", () => {
  it("compte les réponses (dates cochées ou « aucune date ») sur les personnes attendues", () => {
    const r = summarizeRequest({ members: membres, creatorId: "mj", availabilityUserIds: ["a", "a", "mj"], declinedUserIds: [] });
    expect(r).toEqual({ expected: ["a", "b", "mj"], responded: ["a", "mj"], missing: ["b"], ready: false });
  });

  it("« aucune date ne me va » compte comme une réponse ; tout le monde a répondu : prête à fixer", () => {
    const r = summarizeRequest({ members: membres, creatorId: "mj", availabilityUserIds: ["a", "mj"], declinedUserIds: ["b"] });
    expect(r.missing).toEqual([]);
    expect(r.ready).toBe(true);
  });

  it("un membre non attendu qui répond entre dans le décompte, sans rien manquer", () => {
    const r = summarizeRequest({ members: [...membres, { user_id: "mj2", role: "gm" }], creatorId: "mj", availabilityUserIds: ["mj2"], declinedUserIds: [] });
    expect(r.expected).toContain("mj2");
    expect(r.missing).toEqual(["a", "b", "mj"]);
  });

  it("une table vide n'est jamais « prête »", () => {
    expect(summarizeRequest({ members: [], creatorId: "mj", availabilityUserIds: [], declinedUserIds: [] }).ready).toBe(false);
  });
});

describe("unansweredCount", () => {
  it("compte les demandes où ce compte est attendu et n'a pas répondu", () => {
    const resumes = [
      { expected: ["a", "b"], responded: ["a"], missing: ["b"], ready: false },
      { expected: ["a", "b"], responded: [], missing: ["a", "b"], ready: false },
      { expected: ["a", "b"], responded: ["a", "b"], missing: [], ready: true },
    ];
    expect(unansweredCount(resumes, "b")).toBe(2);
    expect(unansweredCount(resumes, "a")).toBe(1);
    expect(unansweredCount(resumes, "intrus")).toBe(0);
  });
});
