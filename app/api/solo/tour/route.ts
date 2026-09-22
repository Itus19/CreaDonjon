import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ABILITIES, SKILLS, type Ability, type Skill } from "@/src/core/rules/sheet";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { executeIntent } from "@/src/server/services/turnIntent";
import type { Locale } from "@/src/i18n/request";

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
    z.object({ kind: z.literal("free") }),
  ]),
});

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
} as const;
const REASON_MESSAGE = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  forbidden: "Vous n'avez pas le droit de jouer cette fiche.",
  item_not_found: "Cet objet n'est plus dans l'inventaire.",
  not_a_weapon: "Cet objet n'est pas une arme.",
  not_a_spellcaster: "Cette fiche ne lance pas de sorts.",
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
  const result = await executeIntent(supabase, {
    entityId: parsed.data.entityId,
    campaignId: parsed.data.campaignId,
    callerId: user.id,
    world: { id: world.id, slug: world.slug },
    locale,
    text: parsed.data.text,
    corrected: parsed.data.corrected,
    choice: parsed.data.choice,
  });

  if ("error" in result) {
    return NextResponse.json({ error: REASON_MESSAGE[result.error] }, { status: REASON_STATUS[result.error] });
  }
  return NextResponse.json(result, { status: 200 });
}
