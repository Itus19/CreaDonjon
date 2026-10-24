import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { loadNotebookWorkspace } from "@/src/server/services/sharedNotes";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntities, ensureGeneratorToolsEntity } from "@/src/server/services/entities";
import { resolveGeneratorToolsForEntity } from "@/src/server/services/generators";
import { listCampaigns, getCampaignCharacters, resolveCampaignId } from "@/src/server/services/campaigns";
import { isSuperadmin } from "@/src/server/services/account";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getPartyCheckLines } from "@/src/server/services/partyProbabilities";
import { getTableParty } from "@/src/server/services/tableParty";
import { listMonstersForRuleset } from "@/src/server/services/encounters";
import { chargerAtelierRencontres } from "@/src/server/services/encounterWorkshop";
import { getActiveCombatForCampaign, getCombatDetail, listCombatsForCampaign, listConditionNames } from "@/src/server/services/combats";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { getCalendar } from "@/src/server/services/worlds";
import { lirePersonnalisation } from "@/src/server/services/personnalisation";
import { chargerPublication } from "@/src/server/services/publication";
import type { Locale } from "@/src/i18n/request";
import type { MjToolWindowData } from "@/components/shell/mjToolWindows";
import { MJ_TOOL_KEYS, type MjToolKey } from "@/components/shell/windowRefs";

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
      const party = selected ? await getPartyCheckLines(supabase, selected.id, locale) : [];
      data = { tool, hasCampaign: selected !== null, party };
      break;
    }

    case "rencontres": {
      const campaigns = await listCampaigns(supabase, world.id);
      const selected = campaigns[0] ?? null;
      const atelier = selected ? await chargerAtelierRencontres(supabase, selected, locale) : null;
      data = {
        tool,
        hasCampaign: selected !== null,
        campaignId: selected?.id ?? null,
        budgetTable: atelier?.budgetTable ?? null,
        budgetIsFallback: atelier?.budgetIsFallback ?? false,
        monsters: atelier?.monsters ?? [],
        savedEncounters: atelier?.savedEncounters ?? [],
        party: atelier?.party ?? [],
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
        // V3.1-62 (docs/CABLAGE.md, C4) : les PJ en un lot, plus une lecture par PJ ; en meme temps que le detail du combat actif.
        const [resolvedEntities, activeDetail] = await Promise.all([
          pcs.length > 0 ? listEntitiesByIds(supabase, pcs.map((c) => c.entity_id)) : Promise.resolve([]),
          active ? getCombatDetail(supabase, active.id) : Promise.resolve(null),
        ]);
        const entityById = new Map(resolvedEntities.map((e) => [e.id, e]));
        pcOptions = pcs
          .map((c) => entityById.get(c.entity_id))
          .filter((e): e is NonNullable<typeof e> => e !== undefined)
          .map((e) => ({ id: e.id, name: e.name }));
        activeCombat = activeDetail;
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

    case "table": {
      // V3.1-34 : chaque PJ résolu comme sa fiche (`getTableParty`), plus les états du ruleset.
      const campaigns = await listCampaigns(supabase, world.id);
      const selected = campaigns[0] ?? null;
      const [party, conditions] = selected
        ? await Promise.all([
            getTableParty(supabase, { worldId: world.id, campaignId: selected.id, locale }),
            listConditionNames(supabase, selected.rulesetId, locale),
          ])
        : [[], []];
      data = { tool, campaignId: selected?.id ?? null, party, conditions };
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
      const reglages = await lirePersonnalisation(supabase);
      data = { tool, ...reglages };
      break;
    }

    case "regles-actives": {
      data = { tool };
      break;
    }

    case "publication": {
      data = { tool, ...(await chargerPublication(supabase, world)) };
      break;
    }

    case "generateurs": {
      const entityId = await ensureGeneratorToolsEntity(supabase, world.id, user.id);
      const tools = await resolveGeneratorToolsForEntity(supabase, entityId);
      data = { tool, entityId, tools };
      break;
    }

    case "notes": {
      const notebook = await loadNotebookWorkspace(supabase, { worldId: world.id, userId: user.id });
      data = { tool, ...notebook };
      break;
    }

    case "calendrier-reel": {
      const campaignId = await resolveCampaignId(supabase, world.id);
      data = { tool, campaignId };
      break;
    }

    case "livre-de-sessions": {
      const [campaignId, calendar] = await Promise.all([resolveCampaignId(supabase, world.id), getCalendar(supabase, world.id)]);
      data = { tool, campaignId, calendar, currentUserId: user.id };
      break;
    }
  }

  return NextResponse.json(data, { status: 200 });
}
