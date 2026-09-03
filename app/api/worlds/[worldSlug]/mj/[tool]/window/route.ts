import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntities, ensureGeneratorToolsEntity } from "@/src/server/services/entities";
import { resolveGeneratorToolsForEntity } from "@/src/server/services/generators";
import { listCampaigns, getCampaignCharacters } from "@/src/server/services/campaigns";
import { isSuperadmin } from "@/src/server/services/account";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getPartySkillProbabilities } from "@/src/server/services/partyProbabilities";
import { getEncounterBudgetTableForRuleset, listMonstersForRuleset, listSavedEncounters } from "@/src/server/services/encounters";
import { getActiveCombatForCampaign, getCombatDetail, listCombatsForCampaign, listConditionNames } from "@/src/server/services/combats";
import { getEntityById } from "@/src/server/repos/entities";
import { getCalendar } from "@/src/server/services/worlds";
import { resolveBackgroundSelection } from "@/src/server/services/backgroundImages";
import { listShareLinks } from "@/src/server/services/shareLinks";
import type { Locale } from "@/src/i18n/request";
import type { MjToolWindowData } from "@/components/shell/mjToolWindows";
import { MJ_TOOL_KEYS, type MjToolKey } from "@/components/shell/windowRefs";

const VALID_MODES = ["dark", "dim", "soft", "light"];

/**
 * Donnees d'une fenetre secondaire d'outil MJ (`?avec=outil:...`, retour
 * utilisateur V2-M7 suite) — une seule route parametree par `tool` plutot
 * que neuf routes quasi identiques : chaque branche reprend EXACTEMENT les
 * memes appels de service que la page routee correspondante
 * (`app/m/[worldSlug]/mj/[tool]/page.tsx`), jamais une deuxieme logique de
 * resolution. "Un monde = une campagne" (V2-G1) : les outils lies a une
 * campagne (probabilites/rencontres/initiative) retombent sur la premiere
 * campagne du monde, sans selecteur — un ancien monde multi-campagnes
 * (jamais cree depuis cette decision) verrait simplement la premiere.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string; tool: string }> }) {
  const { worldSlug, tool: rawTool } = await params;
  if (!(MJ_TOOL_KEYS as readonly string[]).includes(rawTool)) {
    return NextResponse.json({ error: "Outil inconnu." }, { status: 404 });
  }
  const tool = rawTool as MjToolKey;

  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = (await getLocale()) as Locale;

  // Reserve au MJ reel de ce monde (retour utilisateur : "je ne comprend
  // pas pourquoi elle a un acces MJ" — meme bug que `mj/layout.tsx`, sur un
  // AUTRE chemin d'acces : une fenetre `avec=outil:...` peut s'ouvrir depuis
  // N'IMPORTE QUELLE section (Monde/Regles), jamais seulement `/mj/**` —
  // le layout ne suffit donc pas seul, cette route doit se proteger
  // elle-meme.
  const gm = user ? await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : false;
  if (!gm || !user) {
    return NextResponse.json({ error: "Réservé au MJ de ce monde." }, { status: 403 });
  }

  let data: MjToolWindowData;

  switch (tool) {
    case "chat": {
      const campaigns = await listCampaigns(supabase, world.id);
      data = { tool, campaignId: campaigns[0]?.id ?? null };
      break;
    }

    case "gestion-campagne": {
      const [entities, campaigns, defaultRulesetId, superadmin] = await Promise.all([
        listEntities(supabase, world.id, user?.id ?? null),
        listCampaigns(supabase, world.id),
        getWorldDefaultRulesetId(supabase, world.id),
        user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
      ]);
      data = {
        tool,
        defaultRulesetId,
        campaigns,
        worldEntities: entities.filter((e) => e.entity_kind === "character").map((e) => ({ id: e.id, name: e.name })),
        grantableEntities: entities.map((e) => ({ id: e.id, name: e.name })),
        canUseSoloMode: superadmin,
        // `gm` deja verifie true plus haut (403 sinon) — cette route entiere est reservee au MJ.
        canManage: true,
      };
      break;
    }

    case "journal-historique": {
      // Meme raison : `gm` deja verifie true plus haut.
      data = { tool, isGm: true };
      break;
    }

    case "probabilites": {
      const campaigns = await listCampaigns(supabase, world.id);
      const selected = campaigns[0] ?? null;
      const party = selected ? await getPartySkillProbabilities(supabase, selected.id, locale) : [];
      data = { tool, hasCampaign: selected !== null, party };
      break;
    }

    case "rencontres": {
      const campaigns = await listCampaigns(supabase, world.id);
      const selected = campaigns[0] ?? null;
      const [budgetResolution, monsters, savedEncounters] = selected
        ? await Promise.all([
            getEncounterBudgetTableForRuleset(supabase, selected.rulesetId),
            listMonstersForRuleset(supabase, selected.rulesetId, locale),
            listSavedEncounters(supabase, selected.id),
          ])
        : [null, [], []];
      data = {
        tool,
        hasCampaign: selected !== null,
        campaignId: selected?.id ?? null,
        budgetTable: budgetResolution?.rows ?? null,
        budgetIsFallback: budgetResolution?.isFallback ?? false,
        monsters,
        savedEncounters,
      };
      break;
    }

    case "initiative": {
      const campaigns = await listCampaigns(supabase, world.id);
      const selected = campaigns[0] ?? null;
      let activeCombat = null;
      let combats: Awaited<ReturnType<typeof listCombatsForCampaign>> = [];
      let pcOptions: { id: string; name: string }[] = [];
      let monsters: Awaited<ReturnType<typeof listMonstersForRuleset>> = [];
      let conditions: string[] = [];
      if (selected) {
        const [active, combatList, characters, monsterList, conditionList] = await Promise.all([
          getActiveCombatForCampaign(supabase, selected.id),
          listCombatsForCampaign(supabase, selected.id),
          getCampaignCharacters(supabase, selected.id),
          listMonstersForRuleset(supabase, selected.rulesetId, locale),
          listConditionNames(supabase, selected.rulesetId, locale),
        ]);
        combats = combatList;
        monsters = monsterList;
        conditions = conditionList;
        const pcs = characters.filter((c) => c.is_pc);
        const resolvedEntities = await Promise.all(pcs.map((c) => getEntityById(supabase, c.entity_id)));
        pcOptions = resolvedEntities.filter((e): e is NonNullable<typeof e> => e !== null).map((e) => ({ id: e.id, name: e.name }));
        activeCombat = active ? await getCombatDetail(supabase, active.id) : null;
      }
      data = {
        tool,
        hasCampaign: selected !== null,
        campaignId: selected?.id ?? null,
        initialCombat: activeCombat,
        savedCombats: combats,
        pcOptions,
        monsters,
        conditions,
      };
      break;
    }

    case "creation-personnage": {
      data = { tool, worldId: world.id };
      break;
    }

    case "calendrier": {
      const calendar = await getCalendar(supabase, world.id);
      data = { tool, calendar };
      break;
    }

    case "personnalisation": {
      const cookieStore = await cookies();
      const modeCookie = cookieStore.get("mode")?.value ?? "dark";
      const mode = VALID_MODES.includes(modeCookie) ? modeCookie : "dark";
      const contrast = cookieStore.get("contrast")?.value === "high" ? "high" : "off";
      const backgroundRef = cookieStore.get("background")?.value;
      const background = await resolveBackgroundSelection(supabase, backgroundRef);
      const bgBlurCookie = Number(cookieStore.get("bgBlur")?.value);
      const bgBlur = Number.isFinite(bgBlurCookie) && bgBlurCookie >= 0 && bgBlurCookie <= 40 ? bgBlurCookie : 20;
      data = {
        tool,
        mode,
        contrast,
        backgroundRef: background.ref,
        backgroundAvailableModes: background.availableModes,
        bgBlur,
      };
      break;
    }

    case "regles-actives": {
      data = { tool };
      break;
    }

    case "publication": {
      const links = await listShareLinks(supabase, world.id);
      data = { tool, worldId: world.id, links, wikiWelcomeMessage: world.wiki_welcome_message ?? "" };
      break;
    }

    case "generateurs": {
      const entityId = await ensureGeneratorToolsEntity(supabase, world.id, user.id);
      const tools = await resolveGeneratorToolsForEntity(supabase, entityId);
      data = { tool, entityId, tools };
      break;
    }
  }

  return NextResponse.json(data, { status: 200 });
}
