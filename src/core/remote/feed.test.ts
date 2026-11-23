import { describe, expect, it } from "vitest";
import { buildRemoteFeed, rollCheckLabel, unreadCount, waitingList, zPlayStyle, zRemoteMessageInput, zRollRequestInput, type RemoteEvent, type RemoteRollRequest } from "./feed";

const MJ = "00000000-0000-4000-8000-00000000000a";
const LYRA = "00000000-0000-4000-8000-00000000000b";
const CORWIN = "00000000-0000-4000-8000-00000000000c";
const noms = { [MJ]: "MJ", [LYRA]: "Lyra", [CORWIN]: "Corwin" };

function ev(seq: number, partial: Partial<RemoteEvent>): RemoteEvent {
  return {
    id: `e${seq}`,
    seq,
    kind: "narration",
    actor: "gm",
    actorUserId: MJ,
    payload: { channel: "distance", text: `message ${seq}` },
    visibleTo: null,
    createdAt: `2026-11-23T18:0${seq}:00Z`,
    ...partial,
  };
}

describe("buildRemoteFeed", () => {
  it("garde les seuls messages du jeu à distance, dans l'ordre, avec leur voix", () => {
    const feed = buildRemoteFeed(
      [
        ev(2, { kind: "player_action", actor: "player", actorUserId: LYRA }),
        ev(1, {}),
        ev(3, { kind: "rule_application", payload: { note: "moteur" } }),
      ],
      { viewerId: LYRA, names: noms }
    );
    expect(feed.map((m) => [m.seq, m.voice, m.authorName, m.mine])).toEqual([
      [1, "gm", "MJ", false],
      [2, "player", "Lyra", true],
    ]);
  });

  it("nomme le secret : pour qui, ou au MJ seul", () => {
    const feed = buildRemoteFeed(
      [ev(1, { visibleTo: [LYRA] }), ev(2, { kind: "player_action", actor: "player", actorUserId: CORWIN, visibleTo: [] })],
      { viewerId: MJ, names: noms }
    );
    expect(feed[0].secret).toEqual({ kind: "players", names: ["Lyra"] });
    expect(feed[1].secret).toEqual({ kind: "gm_only" });
  });

  it("une réponse de jet porte son résultat", () => {
    const feed = buildRemoteFeed(
      [ev(1, { kind: "roll", actor: "player", actorUserId: LYRA, payload: { channel: "distance", text: "", roll: { requestId: "r1", label: "Acrobaties", natural: 14, total: 21, byHand: true } } })],
      { viewerId: MJ, names: noms }
    );
    expect(feed[0].roll).toEqual({ requestId: "r1", label: "Acrobaties", natural: 14, total: 21, byHand: true });
  });

  it("ignore un message mal formé plutôt que de casser le fil", () => {
    const feed = buildRemoteFeed([ev(1, { payload: { channel: "distance", text: 42 } })], { viewerId: MJ, names: noms });
    expect(feed).toEqual([]);
  });
});

describe("waitingList", () => {
  const demande = (target: string, status: RemoteRollRequest["status"] = "pending"): RemoteRollRequest => ({
    id: `r-${target}`,
    targetUserId: target,
    label: "Acrobaties",
    status,
  });

  it("un joueur qui a écrit après le dernier mot du MJ attend le MJ ; une demande en cours fait lancer", () => {
    const feed = buildRemoteFeed(
      [ev(1, {}), ev(2, { kind: "player_action", actor: "player", actorUserId: CORWIN })],
      { viewerId: MJ, names: noms }
    );
    expect(waitingList(feed, [demande(LYRA), demande(CORWIN, "answered")], noms)).toEqual([
      { userId: CORWIN, name: "Corwin", reason: "waits_for_gm" },
      { userId: LYRA, name: "Lyra", reason: "must_roll" },
    ]);
  });

  it("un message du MJ qui attend un joueur le fait répondre, jusqu'à ce qu'il écrive", () => {
    const avant = buildRemoteFeed([ev(1, { payload: { channel: "distance", text: "Et toi ?", awaiting: [LYRA, CORWIN] } })], { viewerId: MJ, names: noms });
    expect(waitingList(avant, [], noms).map((w) => [w.name, w.reason])).toEqual([
      ["Lyra", "must_reply"],
      ["Corwin", "must_reply"],
    ]);
    const apres = buildRemoteFeed(
      [ev(1, { payload: { channel: "distance", text: "Et toi ?", awaiting: [LYRA, CORWIN] } }), ev(2, { kind: "player_action", actor: "player", actorUserId: LYRA })],
      { viewerId: MJ, names: noms }
    );
    expect(waitingList(apres, [], noms).map((w) => [w.name, w.reason])).toEqual([
      ["Lyra", "waits_for_gm"],
      ["Corwin", "must_reply"],
    ]);
  });

  it("un mot au MJ seul ne fait pas attendre la table entière, mais le MJ le voit", () => {
    const feed = buildRemoteFeed([ev(1, {}), ev(2, { kind: "player_action", actor: "player", actorUserId: LYRA, visibleTo: [] })], { viewerId: MJ, names: noms });
    expect(waitingList(feed, [], noms)).toEqual([{ userId: LYRA, name: "Lyra", reason: "waits_for_gm" }]);
  });
});

describe("unreadCount", () => {
  it("compte les messages des autres après le dernier lu", () => {
    const feed = buildRemoteFeed(
      [ev(1, {}), ev(2, { kind: "player_action", actor: "player", actorUserId: LYRA }), ev(3, {}), ev(4, {})],
      { viewerId: LYRA, names: noms }
    );
    expect(unreadCount(feed, 1)).toBe(2);
    expect(unreadCount(feed, 4)).toBe(0);
    expect(unreadCount(feed, null)).toBe(3);
  });
});

describe("schémas d'entrée", () => {
  it("un message : texte borné, destinataires en uuid", () => {
    expect(zRemoteMessageInput.safeParse({ text: "Bonjour", visibleTo: null }).success).toBe(true);
    expect(zRemoteMessageInput.safeParse({ text: "", visibleTo: null }).success).toBe(false);
    expect(zRemoteMessageInput.safeParse({ text: "x".repeat(4001), visibleTo: null }).success).toBe(false);
    expect(zRemoteMessageInput.safeParse({ text: "x", visibleTo: ["pas-un-uuid"] }).success).toBe(false);
  });

  it("une demande de jet : compétence, caractéristique ou sauvegarde connue ; DD borné", () => {
    expect(zRollRequestInput.safeParse({ targetUserId: LYRA, check: { kind: "skill", key: "acrobatics" }, advantage: "none", dc: 15, dcHidden: true }).success).toBe(true);
    expect(zRollRequestInput.safeParse({ targetUserId: LYRA, check: { kind: "skill", key: "voler" }, advantage: "none", dc: null, dcHidden: true }).success).toBe(false);
    expect(zRollRequestInput.safeParse({ targetUserId: LYRA, check: { kind: "save", key: "dex" }, advantage: "none", dc: 41, dcHidden: false }).success).toBe(false);
  });

  it("la façon de jouer", () => {
    expect(zPlayStyle.options).toEqual(["table", "remote", "both"]);
  });
});

describe("rollCheckLabel", () => {
  it("nomme le jet en français", () => {
    expect(rollCheckLabel({ kind: "skill", key: "acrobatics" })).toBe("Acrobaties");
    expect(rollCheckLabel({ kind: "ability", key: "str" })).toBe("Force");
    expect(rollCheckLabel({ kind: "save", key: "wis" })).toBe("Sauvegarde de Sagesse");
  });
});
