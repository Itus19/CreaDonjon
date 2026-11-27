import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ABILITIES, SKILLS, type Ability, type Skill } from "@/src/core/rules/sheet";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { executeIntent, proposeIntentRequest, readClassifyContext, type IntentChoice } from "@/src/server/services/turnIntent";
import { applyRuntimeStateChange } from "@/src/server/services/runtimeState";
import type { CheckDetection } from "@/src/core/ai/checkClassify";
import { classifySoloAction } from "@/src/server/ai/soloClassify";
import type { AiProvider } from "@/src/server/ai/provider";
import { playTurn } from "@/src/server/services/turnLoop";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import type { Locale } from "@/src/i18n/request";
// La narration n'est appelee QU'APRES que playTurn a rendu son resultat,
// jamais avant (garde-fou de turnIntent.noAi.test.ts, desormais reecrit
// pour verifier cet ORDRE plutot que l'absence totale de ces imports).
import { resolveProviderForUser } from "@/src/server/ai/resolveProvider";
import { narrateSoloTurn, raisonSansNarration, detailSansNarration } from "@/src/server/ai/soloNarration";
import { anchorSketchesNamedInText } from "@/src/server/services/sceneSketches";
import { ensureNpcSheetsForPresents } from "@/src/server/services/npcSheet";
import { discoverWhoIsHere } from "@/src/server/services/soloScene";
import type { PendingTurnResponse, TurnOutcome } from "@/lib/solo/types";

const advantageField = z.enum(["normal", "advantage", "disadvantage"]);
const dcField = z.number().int().min(1).max(50).nullable();
const targetField = z.string().min(1).max(64).nullable();

/**
 * V3-B1 — Le tour part d'un CHOIX, jamais d'une phrase a interpreter ici.
 *
 * C'est ce qui rend impossible qu'un jet parte sans avoir ete montre : la
 * proposition est lue par le noyau pur cote client (`interpretIntent`),
 * affichee, corrigee au besoin, et seul le choix retenu arrive ici. Le
 * texte d'origine suit pour le journal, jamais pour etre re-devine.
 */
const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid().nullable(),
  worldSlug: z.string().min(1),
  text: z.string().min(1).max(500),
  corrected: z.boolean(),
  choice: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("weapon_attack"),
      actionId: z.string().min(1),
      targetId: targetField,
      advantage: advantageField,
      extra: z.literal("light").optional(),
    }),
    z.object({
      kind: z.literal("skill_check"),
      actionId: z.enum(SKILLS as [Skill, ...Skill[]]),
      targetId: targetField,
      advantage: advantageField,
      dc: dcField,
    }),
    z.object({
      kind: z.literal("ability_check"),
      actionId: z.enum(ABILITIES as [Ability, ...Ability[]]),
      targetId: targetField,
      advantage: advantageField,
      dc: dcField,
    }),
    z.object({
      kind: z.literal("saving_throw"),
      actionId: z.enum(ABILITIES as [Ability, ...Ability[]]),
      targetId: targetField,
      advantage: advantageField,
      dc: dcField,
    }),
    // V3.2-10 : un échange ne porte que l'identifiant de l'offre ou de l'objet — jamais un prix, relu par le serveur.
    z.object({
      kind: z.literal("trade"),
      direction: z.enum(["buy", "sell", "give", "settle"]),
      entryId: z.string().min(1).max(120),
      targetId: targetField,
      // V3.2-11 : « Mettre sur l'ardoise » — un achat consommé sur place, dû plutôt que payé.
      onTab: z.boolean().optional(),
    }),
    // V3.2-24 : « Sans jet » sur la pastille — la demande posée est abandonnée, la phrase se joue sans dé.
    z.object({ kind: z.literal("free"), sansJet: z.literal(true).optional() }),
  ]),
});

const isSkill = (id: string): id is Skill => (SKILLS as readonly string[]).includes(id);
const isAbility = (id: string): id is Ability => (ABILITIES as readonly string[]).includes(id);

/**
 * V3.2-24 (ADR 0113) — le classement du modèle remplace la lecture du
 * lexique. Le DD n'en fait pas partie : seul le palier passe, et c'est
 * `proposeIntentRequest` qui en tire le DD. La cible et l'avantage choisis
 * dans la barre sont gardés.
 */
function choiceFromDetection(choice: IntentChoice, detection: CheckDetection): IntentChoice {
  if (detection.kind === "none") return { kind: "free" };
  if (detection.kind === "trivial") return { kind: "free", sansJet: { raison: "evidente" } };
  const targetId = choice.kind === "free" || choice.kind === "trade" ? null : choice.targetId;
  const advantage = choice.kind === "free" || choice.kind === "trade" ? "normal" : choice.advantage;
  const { action, tier } = detection;
  if (action.kind === "skill_check" && isSkill(action.id)) return { kind: "skill_check", actionId: action.id, targetId, advantage, dc: null, tier };
  if (action.kind !== "skill_check" && isAbility(action.id)) return { kind: action.kind, actionId: action.id, targetId, advantage, dc: null, tier };
  return choice;
}

/**
 * Les raisons viennent des deux resolveurs reutilises (`characterActions`,
 * `checkRolls`) ; aucune n'est reecrite ici. `not_a_spellcaster` ne peut pas
 * survenir sur ce chemin — aucun sort n'y passe encore — mais elle fait
 * partie de leur type, et lui donner un message honnete coute moins cher
 * que de la faire passer pour autre chose.
 */
const REASON_STATUS = {
  not_found: 404,
  forbidden: 403,
  item_not_found: 404,
  not_a_weapon: 400,
  not_a_spellcaster: 400,
  // V3.2-10 : les refus d'un échange (turnIntent.ts, `TradeErrorReason`).
  offer_not_found: 404,
  no_resale_price: 400,
  conflict: 409,
  trade_refused: 400,
  no_tab_here: 409,
  tab_full: 409,
  tab_services_only: 400,
} as const;
const REASON_MESSAGE = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  forbidden: "Vous n'avez pas le droit de jouer cette fiche.",
  item_not_found: "Cet objet n'est plus dans l'inventaire.",
  not_a_weapon: "Cet objet n'est pas une arme.",
  not_a_spellcaster: "Cette fiche ne lance pas de sorts.",
  offer_not_found: "Cette offre n'est plus à la carte du lieu.",
  no_resale_price: "Cet objet n'a pas de prix connu : il ne se vend pas au prix de la table.",
  conflict: "L'inventaire a changé entre-temps : réessaie.",
  trade_refused: "Le système monétaire du monde ne connaît pas la pièce de ce prix.",
  no_tab_here: "Rien n'est dû sur l'ardoise de ce lieu.",
  tab_full: "L'ardoise est pleine : règle-la avant d'y ajouter quelque chose.",
  tab_services_only: "Seul ce qui se consomme sur place va sur l'ardoise.",
} as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, parsed.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  const received = parsed.data.choice;
  let choice: IntentChoice = received.kind === "free" ? (received.sansJet ? { kind: "free", sansJet: { raison: "joueur" } } : { kind: "free" }) : received;

  // Le fournisseur du compte, résolu une seule fois pour le classement et la narration.
  let provider: AiProvider | null | undefined;
  const fournisseur = async () => {
    if (provider === undefined) provider = await resolveProviderForUser(supabase, user.id);
    return provider;
  };

  const campaignId = parsed.data.campaignId;
  if (campaignId && choice.kind === "free" && choice.sansJet?.raison === "joueur") {
    // V3.2-24 : « Sans jet » — la demande posée part, tracée au journal comme toute demande abandonnée.
    const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
    await applyRuntimeStateChange(supabase, { entityId: parsed.data.entityId, campaignId, patch: { pending_request: null }, note: "Demande abandonnée : jouée sans jet", sessionId, actor: "player", actorUserId: user.id });
  } else if (
    campaignId &&
    !parsed.data.corrected &&
    (choice.kind === "free" || ((choice.kind === "skill_check" || choice.kind === "ability_check" || choice.kind === "saving_throw") && choice.dc === null))
  ) {
    // V3.2-24 (ADR 0113) : faut-il un jet ? Le modèle CLASSE la phrase, il ne
    // raconte ni ne chiffre rien ; sans réponse utilisable, la lecture du
    // lexique (V3.2-21) reste. Un choix corrigé à la main, une attaque ou un
    // DD saisi ne lui sont pas soumis : le joueur a déjà décidé.
    const p = await fournisseur();
    if (p) {
      const contexte = await readClassifyContext(supabase, { entityId: parsed.data.entityId, campaignId });
      const detection = await classifySoloAction(supabase, p, { userId: user.id, campaignId, text: parsed.data.text, ...contexte });
      if (detection) choice = choiceFromDetection(choice, detection);
    }
  }

  const common = {
    entityId: parsed.data.entityId,
    callerId: user.id,
    world: { id: world.id, slug: world.slug },
    locale,
    text: parsed.data.text,
    corrected: parsed.data.corrected,
    choice,
  };

  // V3-B5 — un choix MECANIQUE en campagne ne se joue plus ici : il se
  // POSE. Rien n'est lance, rien n'est journalise au-dela de la demande
  // elle-meme ; c'est `POST .../encaisser` qui recevra le nombre annonce.
  // L'action libre garde son chemin d'avant ce ticket — rien a differer
  // quand aucun jet n'est en jeu.
  // V3.2-10 : un échange non plus — il se règle tout de suite, sans dé.
  if (choice.kind !== "free" && choice.kind !== "trade" && campaignId) {
    const outcome = await proposeIntentRequest(supabase, { ...common, campaignId, choice });
    if ("error" in outcome) {
      return NextResponse.json({ error: REASON_MESSAGE[outcome.error] }, { status: REASON_STATUS[outcome.error] });
    }
    if (outcome.kind === "pending") {
      const response: PendingTurnResponse = { pending: outcome.request };
      return NextResponse.json(response, { status: 200 });
    }
    // V3.2-24 : le pire jet atteint le DD — aucun dé, le tour se joue comme une action réussie.
    common.choice = { kind: "free", sansJet: { raison: "automatique", what: outcome.what, dc: outcome.dc } };
  }

  // Hors campagne, il n'y a ni scene, ni etat de jeu, ni session ou
  // journaliser : le tour se resout et s'affiche, mais ne change rien. La
  // boucle complete (V3-B2) demande une campagne, et le dit en ne
  // s'executant que la.
  const result = parsed.data.campaignId
    ? await playTurn(supabase, { ...common, campaignId: parsed.data.campaignId })
    : await (async () => {
        const record = await executeIntent(supabase, { ...common, campaignId: null });
        if ("error" in record) return record;
        const outcome: TurnOutcome = { record, changes: [], hints: [], ignored: [], time: null, narration: null };
        return outcome;
      })();

  if ("error" in result) {
    return NextResponse.json({ error: REASON_MESSAGE[result.error] }, { status: REASON_STATUS[result.error] });
  }

  // La narration : TOUJOURS apres, TOUJOURS best-effort. Le tour ci-dessus
  // est deja complet et journalise — un fournisseur injoignable, une
  // sortie invalide ou une limite de debit ne doit rien lui retirer
  // (specs/cible-locale-et-ia.md §4 : "aucune fonction essentielle ne doit
  // dependre du succes d'un appel").
  if (parsed.data.campaignId && result.record.eventId) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, parsed.data.campaignId);

    // V3-C2 — « le joueur l'a nommée explicitement » : vérifié sur SON
    // propre texte, avant la narration, pour qu'une esquisse tout juste
    // ancrée y participe déjà comme une vraie fiche. Best-effort, même
    // raison que la narration ci-dessous : jamais un tour cassé pour ça.
    try {
      await anchorSketchesNamedInText(supabase, {
        campaignId: parsed.data.campaignId,
        worldId: world.id,
        sessionId,
        callerId: user.id,
        text: parsed.data.text,
      });
    } catch (erreur) {
      // Ignoré volontairement : le tour ci-dessus est déjà acquis.
      console.error("Mémorisation de l'esquisse du tour impossible", erreur);
    }

    // V3.2-47 — rattrapage : les présents sans fiche allégée en reçoivent une
    // (Mabelle, ancrée avant que la fiche existe). Même discipline : best-effort.
    try {
      await ensureNpcSheetsForPresents(supabase, {
        campaignId: parsed.data.campaignId,
        worldId: world.id,
        actorEntityId: parsed.data.entityId,
        callerId: user.id,
      });
    } catch (erreur) {
      // Ignoré volontairement : le tour ci-dessus est déjà acquis ; retenté au tour suivant.
      console.error("Rattrapage des fiches allégées impossible", erreur);
    }

    // V3.2-53 — ceux qui partagent la pièce sont vus : leur fiche entre au Wiki.
    try {
      await discoverWhoIsHere(supabase, { campaignId: parsed.data.campaignId, callerId: user.id });
    } catch (erreur) {
      console.error("Découverte des présents du tour impossible", erreur);
    }

    try {
      // V3.1-224 (ADR 0103) : le fournisseur de CE compte ; sans lui, le tour reste joué, muet.
      const provider = await fournisseur();
      if (!provider) return NextResponse.json({ ...result, sansNarration: "aucun_fournisseur" }, { status: 200 });
      const viewer = await buildViewerForWorld(supabase, world.id, user.id);
      const outcome = await narrateSoloTurn(supabase, provider, {
        worldId: world.id,
        campaignId: parsed.data.campaignId,
        playerEntityId: parsed.data.entityId,
        viewer,
        userId: user.id,
        sessionId,
        fromEventId: result.record.eventId,
        playerAction: parsed.data.text,
        facts: result.record.facts,
        changes: result.changes,
        hints: result.hints,
      });
      if (outcome.ok) {
        result.narration = { text: outcome.narration!, npcReaction: outcome.npcReaction ?? null };
        // V3.2-18 : l'heure atteinte après la narration, pour l'en-tête.
        if (outcome.time) result.time = outcome.time;
        if (outcome.scene) result.scene = outcome.scene;
      } else {
        result.sansNarration = "inutilisable";
      }
    } catch (erreur) {
      // L'appel a echoue : le tour reste valide sans narration, jamais une
      // erreur renvoyee au joueur pour ca — seulement sa raison (V3.1-223).
      console.error("Narration du tour impossible", erreur);
      result.sansNarration = raisonSansNarration(erreur);
      result.sansNarrationDetail = detailSansNarration(erreur);
    }
  }

  return NextResponse.json(result, { status: 200 });
}
