"use client";

import EmptyState from "@/components/shell/EmptyState";
import { BoutonPetit, ChampTexte } from "@/components/rules/briques/ContexteBriques";
import { remplacerA, retirerA } from "@/lib/ui/briquesRegle";
import { ajouterPiece } from "@/src/core/rules/rooms";
import { ROOM_EXPOSURES, type Room, type RoomExposure, type RoomsBlockData } from "@/src/core/schemas/blocks/rooms";

/** ME-4 — ce que la météo atteint ; « par défaut » laisse le moteur déduire (dedans pour une pièce). */
export const EXPOSURE_LABELS: Record<RoomExposure, string> = { indoor: "Dedans", sheltered: "À l'abri", outdoor: "Dehors" };

function ChoixExposition({ libelle, valeur, defaut, onChange }: { libelle: string; valeur: RoomExposure | undefined; defaut: string; onChange: (v: RoomExposure | undefined) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
      {libelle}
      <select
        value={valeur ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : (e.target.value as RoomExposure))}
        className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
      >
        <option value="">{defaut}</option>
        {ROOM_EXPOSURES.map((x) => (
          <option key={x} value={x}>
            {EXPOSURE_LABELS[x]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * V3.2-19 — le bloc « Pièces » d'un lieu. Chaque pièce : un nom et deux ou
 * trois phrases. L'identifiant reste celui de la création, même si le nom
 * change : la scène solo y renvoie. Une pièce que la narration a inventée
 * arrive ici toute seule, après le contrôle du moteur ; elle se corrige
 * comme les autres, le wiki l'emporte.
 *
 * ME-4 : chaque pièce dit ce que la météo y atteint (dedans, à l'abri,
 * dehors), et l'espace principal du lieu aussi. Le solo s'en sert pour que
 * la pluie ne tombe pas dans la taverne.
 */
export default function RoomsBlockEditor({ data, onChange }: { data: RoomsBlockData; onChange: (d: RoomsBlockData) => void }) {
  const majPiece = (i: number, piece: Room) => onChange({ ...data, rooms: remplacerA(data.rooms, i, piece) });
  const ajouter = () => onChange(ajouterPiece(data, { name: "Nouvelle pièce", description: "" }));

  if (data.rooms.length === 0) {
    return (
      <EmptyState
        title="Aucune pièce décrite"
        description="Les espaces de ce lieu : la cuisine, les chambres, la cave. En partie solo, une pièce visitée s'ajoute aussi ici."
        action={<BoutonPetit onClick={ajouter}>Ajouter une pièce</BoutonPetit>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.rooms.map((piece, i) => (
        <div key={piece.id} className="flex flex-col gap-2 rounded-md border border-edge/60 p-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <ChampTexte libelle="Pièce" valeur={piece.name} onChange={(name) => majPiece(i, { ...piece, name })} />
            </div>
            <button type="button" onClick={() => onChange({ ...data, rooms: retirerA(data.rooms, i) })} className="pb-2 text-xs text-danger hover:underline">
              Retirer
            </button>
          </div>
          <ChoixExposition
            libelle="Météo"
            valeur={piece.exposure}
            defaut="Par défaut (dedans)"
            // `undefined` disparaît à l'enregistrement (JSON) : « par défaut » retire le champ.
            onChange={(exposure) => majPiece(i, { ...piece, exposure })}
          />
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">
            Description
            <textarea
              value={piece.description}
              maxLength={600}
              rows={2}
              onChange={(e) => majPiece(i, { ...piece, description: e.target.value })}
              className="w-full resize-y rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
          </label>
        </div>
      ))}
      <div>
        <BoutonPetit onClick={ajouter}>Ajouter une pièce</BoutonPetit>
      </div>
      <ChoixExposition
        libelle="Météo dans l'espace principal du lieu, hors des pièces"
        valeur={data.main_exposure}
        defaut="Par défaut (dedans, puisque le lieu a des pièces)"
        onChange={(main_exposure) => onChange({ ...data, main_exposure })}
      />
    </div>
  );
}
