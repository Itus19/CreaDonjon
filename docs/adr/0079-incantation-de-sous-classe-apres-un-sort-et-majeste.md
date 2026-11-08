# 0079 — Incantation d'une sous-classe, « après un sort lancé », sauvegarde de l'assaillant et échec d'office

**Date :** 2026-11-07
**Statut :** acceptée (V3.1-184 à 186 ; écrans choisis par l'auteur : 185 A, 184 A)

## Contexte

La Croisade des Ombres (V3.1-179) bute sur quatre règles que les briques ne savaient pas dire : un tiers de lanceur (Arnaqueur arcanique), une utilisation « aussitôt après avoir lancé un sort d'Enchantement ou d'Illusion par un emplacement » (Magie envoûtante), « l'assaillant réussit une sauvegarde de Charisme ou l'attaque rate » (Majesté souveraine), et « une créature Charmée par vous rate sa sauvegarde contre votre injonction » (Mante de majesté).

## Décision

1. **Incantation d'une sous-classe** : un bloc de règle `subclass_spellcasting` (caractéristique, `caster_weight` — le tiers s'ajoute à `full` et `half` —, table d'emplacements par niveau de classe, seules les lignes qui changent). À la résolution, la sous-classe **prête** son incantation à une classe qui n'en a pas (`classSpellcastingWithSubclass`) ; `computeSpellSlots` la lit ensuite comme une autre. Le formulaire de sous-classe la saisit (« Cette sous-classe lance des sorts »).
2. **« Après un sort lancé »** : le `trigger` d'une activation devient une union — `on: "roll"` (ADR 0075, inchangé) ou `on: "spell_cast"` (`schools`, `with_slot`). Ce n'est **pas** une réaction : aucune fenêtre, aucun jet figé. Après « Lancer », le résultat de l'outil de dés propose l'utilisation (« Aussitôt après : Envoûter » / « Passer ») ; « Utiliser » passe par la route d'activation, qui vérifie et dépense comme au clic. L'école se compare en anglais ou en français (les traductions écrivent « Enchantement »).
3. **Sauvegarde de l'assaillant** : une opération de réaction `attacker_save { ability, dc }` (sur une attaque). Le serveur lance la sauvegarde avec les bonus de l'assaillant (lus seulement si une réaction en a besoin) ; un échec pose `forcedMiss`, et l'attaque rate. Elle voyage dans le jet suspendu signé (ADR 0075).
4. **Échec d'office** : un bloc `forced_save_failures` (sorts, état de la cible, « imposé par la lanceuse »), saisi comme brique. Quand le MJ cible avec ce sort une créature qui remplit la condition, la sauvegarde n'est pas demandée : l'échec s'applique. La source d'un état se lit dans l'effet qui le pose (ADR 0073) ; un état posé à la main n'a pas de source.

## Conséquences

- Les sorts toujours préparés d'une sous-classe se lancent depuis l'onglet Actions ; le serveur les accepte (`canCastSpell`).
- « Pour la première fois d'un tour » se compte une fois par tour pour la porteuse (`limit: turn`), pas par assaillant.
- La proposition « après un sort » ne vise personne : en combat, la cible se joue au récit, comme une utilisation sans cible.
- Le repos recharge aussi les ressources déclarées par les règles (`trackersForRest`), défaut relevé en vérifiant V3.1-183.
