import { describe, expect, it } from "vitest";
import {
  chatMessagesQuerySchema,
  entitiesSearchQuerySchema,
  entityCampaignQuerySchema,
  genealogyQuerySchema,
  journalQuerySchema,
  revisionsCompareQuerySchema,
  searchParamsToObject,
} from "@/lib/queryParams/schemas";

/**
 * Ces schemas remplacent des lectures manuelles de `searchParams`. Le risque
 * n'est pas qu'ils refusent trop peu, c'est qu'ils refusent trop : un repli
 * silencieux perdu en route change le comportement d'un ecran sans que rien
 * ne le signale. Chaque cas ci-dessous fixe le comportement de l'ancien code,
 * y compris ses bizarreries.
 */

const GUID = "3f8b8e2e-1c4a-4b6a-9f0e-1234567890ab";
const q = (search: string) => searchParamsToObject(new URLSearchParams(search));

describe("searchParamsToObject", () => {
  it("laisse une cle absente indefinie, pas nulle", () => {
    // C'est tout l'interet du passage par un objet : `get()` renvoie `null`,
    // et `Number(null)` vaut 0 — un parametre absent serait devenu un zero.
    expect(q("")).toEqual({});
    expect("limit" in q("")).toBe(false);
  });

  it("garde la valeur vide d'une cle presente", () => {
    expect(q("campaignId=")).toEqual({ campaignId: "" });
  });
});

describe("limite d'historique — bornee, jamais refusee", () => {
  const limit = (search: string) => chatMessagesQuerySchema.parse(q(search)).limit;

  it("retombe sur 50 quand elle est absente ou illisible", () => {
    expect(limit("")).toBe(50);
    expect(limit("limit=abc")).toBe(50);
  });

  it("ramene une valeur hors bornes dans les bornes, sans erreur", () => {
    expect(limit("limit=1000")).toBe(200);
    expect(limit("limit=-3")).toBe(1);
    expect(limit("limit=")).toBe(1); // Number("") vaut 0, borne a 1 — comportement d'origine
  });

  it("tronque une valeur decimale", () => {
    expect(limit("limit=2.7")).toBe(2);
  });
});

describe("identifiants", () => {
  it("refuse un identifiant mal forme au lieu de l'envoyer a Postgres", () => {
    // C'etait le constat B-06 : ce cas produisait un 500, pas un 400.
    expect(journalQuerySchema.safeParse(q("worldId=pasunguid")).success).toBe(false);
    expect(journalQuerySchema.safeParse(q("")).success).toBe(false);
    expect(journalQuerySchema.parse(q(`worldId=${GUID}`)).worldId).toBe(GUID);
  });

  it("traite `?campaignId=` comme une absence de campagne", () => {
    // Le client envoie `campaignId ?? ""` ; "" ne doit jamais descendre
    // jusqu'a une colonne uuid.
    expect(entityCampaignQuerySchema.parse(q("campaignId=")).campaignId).toBeUndefined();
    expect(entityCampaignQuerySchema.parse(q("")).campaignId).toBeUndefined();
    expect(entityCampaignQuerySchema.parse(q(`campaignId=${GUID}`)).campaignId).toBe(GUID);
    expect(entityCampaignQuerySchema.safeParse(q("campaignId=abc")).success).toBe(false);
  });
});

describe("profondeurs de graphe — repli, sans borne ajoutee", () => {
  it("retombe sur 2 quand la valeur est illisible", () => {
    // `String(undefined)` cote client donne litteralement "undefined".
    expect(genealogyQuerySchema.parse(q("depthUp=undefined")).depthUp).toBe(2);
    expect(genealogyQuerySchema.parse(q("")).depthDown).toBe(2);
  });

  it("ne borne pas une profondeur licite — ce serait un durcissement, pas ce ticket", () => {
    expect(genealogyQuerySchema.parse(q("depthUp=99")).depthUp).toBe(99);
  });
});

describe("comparaison de revisions", () => {
  it("refuse desormais un parametre absent", () => {
    // Avant : `Number(null)` valait 0, un entier — le controle passait et la
    // route partait comparer la revision numero zero.
    expect(revisionsCompareQuerySchema.safeParse(q("to=3")).success).toBe(false);
    expect(revisionsCompareQuerySchema.safeParse(q("from=1&to=3")).success).toBe(true);
  });

  it("refuse un numero non entier", () => {
    expect(revisionsCompareQuerySchema.safeParse(q("from=1.5&to=3")).success).toBe(false);
  });
});

describe("recherche par slug de monde", () => {
  it("accepte une recherche vide — `searchEntities` renvoie alors une liste vide", () => {
    expect(entitiesSearchQuerySchema.parse(q("")).q).toBe("");
    expect(entitiesSearchQuerySchema.parse(q("q=elfe")).q).toBe("elfe");
  });
});
