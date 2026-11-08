# 0080 — Les sorts d'une sous-classe lanceuse, et les sauvegardes contre vos sorts

**Date :** 2026-11-08
**Statut :** acceptée (V3.1-190 à 192 ; écrans approuvés tels qu'esquissés)

## Contexte

L'Arnaqueur arcanique de « DnD 2024 » lançait des sorts (ADR 0079) sans pouvoir les choisir, et deux de ses aptitudes restaient du texte : Embuscade magique (la cible a le désavantage à sa sauvegarde si l'Arnaqueur est Invisible) et Omniprésence (un second Croc-en-jambe de Frappe malicieuse, qui n'était pas jouable).

## Décision

1. **Le budget de sorts vient de la sous-classe.** `subclass_spellcasting` gagne `spell_list` (la liste où choisir : une clé de classe) et, par ligne, `cantrips` et `prepared` (absents : ceux de la ligne d'avant). `subclassSpellBudget` le lit ; l'étape Sorts de l'assistant (création et montée) s'en sert quand la classe n'incante pas elle-même. Une ligne qui ne change que le budget garde les emplacements d'avant.
2. **Une seule règle pour les sauvegardes contre vos sorts.** `forced_save_failures` s'élargit plutôt que d'ajouter un bloc : `outcome` (échec d'office, défaut, ou désavantage), une condition sur la cible ou sur la lanceuse, et tous les sorts si aucun n'est nommé. Les règles déjà écrites gardent leur sens. Le désavantage voyage dans la demande de sauvegarde (`roll_mode` dans son effet, sans migration) ; le serveur lance avec. L'éditeur l'appelle « Sauvegarde contre vos sorts ».
3. **Frappe malicieuse est une donnée du SRD**, jouable pour tout Roublard ; Omniprésence se dit avec les briques existantes (une utilisation de plus). Sa distance à la main du mage attend les positions du plan de combat (ADR 0077, branche V3.1-168 à 171).

## Conséquences

- Le dé d'Attaque sournoise auquel on renonce, la taille de la cible du Croc-en-jambe, la sauvegarde répétée du Poison et « pendant ce tour » d'Embuscade magique restent à la table, et les fiches le disent (`coverage`).
- Un sort lancé par l'activation d'un sort (Capacités, V3.1-166) ne propose pas encore « aussitôt après » (V3.1-184) : à reprendre.
