# ADR 0107 — Un artéfact agit sur la fiche par un bloc « Objet équipable »

Date : 2026-11-24 · Ticket : AG-19 · Statut : accepté

## Contexte

Un objet du sac pouvait pointer vers une fiche du wiki (l'histoire du
collier) ou vers une règle (ses effets), jamais les deux. Parmi les objets
équipés, seules les armures changeaient la fiche. Le moteur savait compter
les modificateurs et les ressources d'un objet équipé (`EquippedItem`), mais
rien ne lui en donnait pour un artéfact du wiki. L'auteur a tranché le
23 novembre : la fiche d'artéfact garde son histoire et reçoit un bloc
« Objet équipable », avec les briques des dons.

## Options

1. Des effets écrits sur la fiche du wiki sans structure : deux façons de
   décrire un objet magique, le wiki devient un second moteur de règles.
2. Créer une règle par artéfact et la lier : l'artéfact unique de la
   campagne vivrait dans le ruleset, loin de son histoire.
3. **Un bloc de wiki typé, lu par le moteur** (retenu).

## Décision

- Bloc `equippable` (`src/core/schemas/blocks/equippable.ts`) :
  « seulement équipé », « harmonisation requise », modificateurs (`zModifier`,
  le schéma des dons : bonus, défenses, sens, vitesse…), sorts accordés
  (avec la caractéristique de l'objet et le lancement gratuit des dons) et
  actions à charges (nom, charges, recharge, description) : la seule brique
  nouvelle, rangée comme une ressource d'objet.
- `effetsDeLObjet` (pur, testé) traduit le bloc en `EquippedItem` :
  modificateurs en couche 6 (objets équipés, spec §B4), sorts, ressources
  `item.<objet>.<action>`. `characterSheet()` ignore désormais tout objet
  harmonisable non lié (`objetActif`), pour ses modificateurs comme pour ses
  ressources, et compte les sorts d'un objet actif.
- Le serveur (actions de fiche) et le navigateur (aperçu, via la réponse
  du ruleset résolu, clé de sélection `artifactIds`) lisent le bloc par la
  même requête, sous la RLS de la personne : un bloc qu'elle ne voit pas
  n'arrive pas, et l'objet ne lui apporte rien (règle 5). Une requête de plus,
  seulement si le sac contient un objet qui pointe vers une fiche du wiki.
- La case « Lié » apparaît sur un objet qui demande une harmonisation ; elle
  passe par l'action d'équipement existante (champ `attuned`).

## Conséquences

- Pas de migration : `blocks.block_type` n'a pas de liste fermée en base ;
  le schéma Zod du registre valide le contenu.
- Le bloc doit être visible du porteur (« Joueurs » ou plus) pour compter sur
  sa fiche. Un MJ qui cache le bloc cache aussi ses effets.
- L'action à charges est un compteur sur la fiche du porteur, avec son nom ;
  la description se lit sur la fiche de l'artéfact. Elle ne se « joue » pas
  encore comme une activation (cible, jet) : à faire quand un cas le
  demandera.
- Le nom affiché sur la fiche (source d'un bonus, sort accordé) est celui de
  la fiche d'artéfact telle que la personne la voit (nom pour la table, AG-12).
