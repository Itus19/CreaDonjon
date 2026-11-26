"use client";

import { useState } from "react";
import EmptyState from "@/components/shell/EmptyState";
import { BoutonPetit, ChampListe, ChampTexte } from "@/components/rules/briques/ContexteBriques";
import { remplacerA, retirerA } from "@/lib/ui/briquesRegle";
import { LIBELLES_RUBRIQUES, idNouvelleOffre, libelleRichesse } from "@/lib/ui/carteTarifs";
import { CURRENCY_LABELS_FR } from "@/src/i18n/fr";
import { CURRENCY_ORDER } from "@/src/core/rules/currency";
import { PRICE_LIST_GROUPS, zPriceListBlockData, type PriceListBlockData, type PriceListGroup, type PriceListOffer } from "@/src/core/schemas/blocks/priceList";

const OPTIONS_RUBRIQUES = PRICE_LIST_GROUPS.map((g) => ({ value: g, label: LIBELLES_RUBRIQUES[g] }));
const OPTIONS_PIECES = CURRENCY_ORDER.map((c) => ({ value: c, label: CURRENCY_LABELS_FR[c] ?? c }));

/**
 * V3.2-9 (ADR 0110) — le bloc « Carte et tarifs » d'un lieu. Vide, il propose
 * de tirer la carte : le serveur la tire avec la richesse du lieu et la rend
 * sans l'écrire ; elle entre ici comme une modification ordinaire, que
 * l'enregistrement habituel du bloc écrit. Pleine, chaque offre se corrige à
 * la main : le wiki l'emporte sur le tirage.
 */
export default function PriceListBlockEditor({ data, onChange, blockId }: { data: PriceListBlockData; onChange: (d: PriceListBlockData) => void; blockId: string }) {
  const [tirage, setTirage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function tirerLaCarte() {
    setTirage(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/blocks/${blockId}/price-list-draw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "Impossible de tirer la carte.";
        setErreur(message);
        return;
      }
      const lue = typeof body === "object" && body !== null && "data" in body ? zPriceListBlockData.safeParse(body.data) : null;
      if (!lue?.success) {
        setErreur("La carte reçue est illisible.");
        return;
      }
      onChange(lue.data);
    } catch (e) {
      console.error("Tirage de la carte", e);
      setErreur("Le serveur ne répond pas.");
    } finally {
      setTirage(false);
    }
  }

  const majOffre = (i: number, offre: PriceListOffer) => onChange({ ...data, offers: remplacerA(data.offers, i, offre) });
  function ajouterOffre(rubrique: PriceListGroup) {
    onChange({ ...data, offers: [...data.offers, { id: idNouvelleOffre(data.offers, rubrique), label: "Nouvelle offre", group: rubrique, price: { amount: 1, coin: "sp" } }] });
  }

  if (data.offers.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <EmptyState
          title="Aucune offre sur cette carte"
          description="Le moteur peut la tirer avec le Menu de la Taverne et la richesse du lieu, ou tu peux la remplir à la main."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={tirerLaCarte}
                disabled={tirage}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {tirage ? "Tirage…" : "Tirer la carte"}
              </button>
              <BoutonPetit onClick={() => ajouterOffre("other")}>Ajouter une offre à la main</BoutonPetit>
            </div>
          }
        />
        {erreur && <p className="text-xs text-danger">{erreur}</p>}
      </div>
    );
  }

  const richesse = libelleRichesse(data.wealth);
  return (
    <div className="flex flex-col gap-3">
      {richesse && <p className="text-xs text-ink-muted">Établissement {richesse.toLowerCase()}</p>}
      {data.offers.map((offre, i) => (
        <div key={offre.id} className="grid grid-cols-2 items-end gap-2 rounded-md border border-edge/60 p-2 @md:grid-cols-[1fr_9rem_5rem_5rem_auto]">
          <div className="col-span-2 @md:col-span-1">
            <ChampTexte libelle="Offre" valeur={offre.label} onChange={(label) => majOffre(i, { ...offre, label })} />
          </div>
          <ChampListe libelle="Rubrique" valeur={offre.group} options={OPTIONS_RUBRIQUES} onChange={(g) => majOffre(i, { ...offre, group: PRICE_LIST_GROUPS.find((x) => x === g) ?? offre.group })} />
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
            Prix
            <input
              type="number"
              min={0}
              step="any"
              value={offre.price.amount}
              onChange={(e) => {
                const amount = Number(e.target.value);
                if (Number.isFinite(amount) && amount >= 0) majOffre(i, { ...offre, price: { ...offre.price, amount } });
              }}
              className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 font-mech text-sm text-ink outline-none"
            />
          </label>
          <ChampListe
            libelle="Pièce"
            valeur={offre.price.coin}
            options={OPTIONS_PIECES}
            onChange={(c) => majOffre(i, { ...offre, price: { ...offre.price, coin: CURRENCY_ORDER.find((x) => x === c) ?? offre.price.coin } })}
          />
          <button type="button" onClick={() => onChange({ ...data, offers: retirerA(data.offers, i) })} className="pb-2 text-xs text-danger hover:underline">
            Retirer
          </button>
        </div>
      ))}
      <div>
        <BoutonPetit onClick={() => ajouterOffre("other")}>Ajouter une offre</BoutonPetit>
      </div>
    </div>
  );
}
