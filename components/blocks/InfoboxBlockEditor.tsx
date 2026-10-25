"use client";

import ValeurAvecMentions from "./ValeurAvecMentions";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { InfoboxBlockData, InfoboxValue } from "@/src/core/schemas/blocks/infobox";
import { annonceReordonnancement } from "@/lib/ui/ficheBlocs";
import {
  ajouterLigne,
  deplacerLigne,
  modifierLigne,
  retirerLigne,
  suggererIntitules,
} from "@/lib/ui/encadre";

/**
 * V3.1-66 — le bloc Encadré. Les lignes se lisent comme dans le wiki
 * (intitulé à gauche, valeur à droite) et s'éditent sur place ; ⠿ les
 * réordonne (souris, toucher et clavier, comme les blocs) ; × retire au
 * survol ou au focus. Les intitulés proposés dépendent du genre de la fiche.
 *
 * La mention « @ » dans une valeur n'est PAS faite ici : elle demande une
 * forme de donnée que le schéma n'a pas encore (décision à part).
 */

/** × visible en permanence sur écran tactile (pas de survol), au survol ou au focus ailleurs. */
const REVELE_AU_SURVOL =
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

function idLigne(index: number): string {
  return `ligne-${index}`;
}

function indexDeLigne(id: string | number): number {
  return Number(String(id).replace("ligne-", ""));
}

function LigneEncadre({
  index,
  label,
  value,
  fiches,
  onLabel,
  onValue,
  onRemove,
  onLabelFocus,
  onLabelBlur,
}: {
  index: number;
  label: string;
  value: InfoboxValue;
  fiches: readonly OtherEntityOption[];
  onLabel: (v: string) => void;
  onValue: (v: InfoboxValue) => void;
  onRemove: () => void;
  onLabelFocus: () => void;
  onLabelBlur: () => void;
}) {
  const t = useTranslations("fiche.encadre");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idLigne(index),
  });
  const nom = label.trim();

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-baseline gap-2 border-b border-edge/40 py-1 last:border-b-0 ${
        isDragging ? "relative z-10 rounded-md bg-panel-raised shadow-2xl" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab px-1 text-sm text-ink-muted transition-colors hover:text-ink active:cursor-grabbing"
        title={t("poigneeTitre")}
        aria-label={nom ? t("poignee", { intitule: nom }) : t("poigneeSansNom")}
      >
        ⠿
      </button>
      <input
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        onFocus={onLabelFocus}
        onBlur={onLabelBlur}
        placeholder={t("intitulePlaceholder")}
        aria-label={t("intitule")}
        className="w-32 shrink-0 border-b border-transparent bg-transparent px-0.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-muted outline-none transition-colors placeholder:normal-case placeholder:tracking-normal hover:border-edge focus:border-accent focus:text-ink"
      />
      {/* V3.1-66 : « @ » cite une fiche (une vraie mention, comme dans le texte). */}
      <ValeurAvecMentions value={value} onChange={onValue} fiches={fiches} placeholder={t("valeurPlaceholder")} ariaLabel={t("valeur")} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={nom ? t("retirer", { intitule: nom }) : t("retirerSansNom")}
        className={`rounded-md px-1.5 text-sm text-ink-muted transition-colors hover:text-danger focus-visible:opacity-100 ${REVELE_AU_SURVOL}`}
      >
        ×
      </button>
    </li>
  );
}

export default function InfoboxBlockEditor({
  data,
  onChange,
  entityKind,
  otherEntities = [],
}: {
  data: InfoboxBlockData;
  onChange: (data: InfoboxBlockData) => void;
  /** Les fiches que « @ » peut citer (V3.1-66). */
  otherEntities?: readonly OtherEntityOption[];
  /** Genre de la fiche : choisit la liste d'intitulés proposés (aucun s'il n'a pas de liste). */
  entityKind?: string;
}) {
  const t = useTranslations("fiche.encadre");
  const dndId = useId();
  // Dernière ligne dont l'intitulé a le focus : les suggestions la remplissent au lieu d'en ajouter une.
  const [ligneActive, setLigneActive] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = data.entries.map((_, i) => idLigne(i));
  const libelles = Object.fromEntries(
    data.entries.map((e, i) => [idLigne(i), e.label.trim() || t("ligneSansNom")]),
  );
  const dire = (
    etape: "prise" | "deplace" | "posee" | "annulee",
    actif: string | number,
    cible: string | number | null,
  ) => {
    const a = annonceReordonnancement(
      etape,
      ids,
      libelles,
      String(actif),
      cible === null ? null : String(cible),
    );
    return a ? t(a.cle, { ligne: a.bloc, position: a.position, total: a.total }) : undefined;
  };
  const annonces: Announcements = {
    onDragStart: ({ active }) => dire("prise", active.id, active.id),
    onDragOver: ({ active, over }) => dire("deplace", active.id, over ? over.id : active.id),
    onDragEnd: ({ active, over }) => dire("posee", active.id, over ? over.id : active.id),
    onDragCancel: ({ active }) => dire("annulee", active.id, active.id),
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(deplacerLigne(data, indexDeLigne(active.id), indexDeLigne(over.id)));
  }

  const parGenre = t.raw("suggestions") as Record<string, string[]>;
  const saisie = ligneActive !== null ? (data.entries[ligneActive]?.label ?? "") : "";
  const autres = data.entries
    .filter((_, i) => i !== ligneActive)
    .map((e) => e.label)
    .filter((l) => l.trim() !== "");
  const suggestions = suggererIntitules(parGenre, entityKind, saisie, autres);

  function choisirSuggestion(intitule: string) {
    if (ligneActive !== null && data.entries[ligneActive]) {
      onChange(modifierLigne(data, ligneActive, { label: intitule }));
    } else {
      onChange(ajouterLigne(data, intitule));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {data.entries.length === 0 && <p className="text-sm text-ink-muted">{t("vide")}</p>}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: annonces,
          screenReaderInstructions: { draggable: t("instructions") },
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col">
            {data.entries.map((entry, index) => (
              <LigneEncadre
                key={index}
                index={index}
                label={entry.label}
                value={entry.value}
                fiches={otherEntities}
                onLabel={(label) => onChange(modifierLigne(data, index, { label }))}
                onValue={(value) => onChange(modifierLigne(data, index, { value }))}
                onRemove={() => onChange(retirerLigne(data, index))}
                onLabelFocus={() => setLigneActive(index)}
                onLabelBlur={() => setLigneActive((actuelle) => (actuelle === index ? null : actuelle))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        <button
          type="button"
          onClick={() => onChange(ajouterLigne(data))}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {t("ajouter")}
        </button>
        {suggestions.length > 0 && (
          <>
            <span>{t("suggestionsPour")}</span>
            {suggestions.map((intitule) => (
              <button
                key={intitule}
                type="button"
                // Garde le focus de l'intitulé en cours : sans cela, le clic le ferait perdre avant d'agir.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisirSuggestion(intitule)}
                className="rounded-full border border-dashed border-edge-strong px-2.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                {intitule}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
