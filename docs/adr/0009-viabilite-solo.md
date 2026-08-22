# 0009 — Verdict du spike de viabilité du solo (V2-S1)

**Date :** 2026-08-22
**Statut :** acceptée

## Contexte

V2-S1 testait la thèse centrale de toute la conception de la V3 : un modèle local peut-il narrer un tour de jeu solo de façon satisfaisante quand le moteur calcule tout le déterministe (dés, dégâts, résolution) et que le modèle n'a plus qu'à raconter ? Vingt tours joués sur un écran jetable (`/spike-solo`, jamais persisté) : un lieu préparé (L'Ancre Rouillée), trois PNJ à personnalité codée en dur (pas le vrai bloc `personality` de V2-H1), un combat préparé via le générateur de rencontres (V1-E3), le fournisseur `gemma-4-e4b-uncensored-hauhaucs-aggressive` en local via LM Studio.

## Mesures objectives

| Mesure | Seuil | Résultat |
|---|---|---|
| Latence par tour | < 15 s | ~10 s en moyenne, max 14,4 s — dans le budget |
| Tokens d'entrée par tour | < 3 000 | ~1 400 en moyenne — dans le budget |
| Identifiants inventés acceptés | 0 | **0/20** — le garde-fou (enum fermé sur les trois PNJ réels) a tenu toute la session |
| Appels malformés | < 10 % | 2/20 au compteur brut ; **1/20 (5 %)** une fois retiré un échec d'infrastructure sans rapport avec la sortie du modèle (serveur LM Studio injoignable au tour 1) — dans le budget une fois cette distinction faite |

## Constats qualitatifs

- **Répétition verbatim.** La même réplique de PNJ ressort mot pour mot à deux reprises distinctes (tours 5-6, puis 14-15-16 trois fois de suite) — un signe net de bouclage du modèle, pas une impression subjective.
- **Dérive de personnage.** Un PNJ nomme Bram « ce chevalier », contredisant son identité établie (tavernier). Sœur Aude, prêtresse dévote dont la seule caractérisation écrite est la reconnaissance envers Bram, accepte une avance romantique puis un rendez-vous en chambre en quelques tours sans la moindre hésitation liée à ses vœux.
- **PNJ omniprésent, point de vue du joueur dilué.** Ktar continue de commenter la scène après que Bram a physiquement quitté la taverne pour le marché. Cause directe : le contexte ne suit aucun déplacement de scène, les PNJ « présents » restent une liste figée toute la session — un choix de portée délibérément minuscule du spike, mais qui pousse le modèle à faire vivre le même PNJ hors de propos plutôt que de rester silencieux.
- **Schéma de réaction trop rigide pour un PNJ incident.** `npc_reaction` ne peut référencer qu'un des trois identifiants fermés — aucune voie pour faire parler un personnage ponctuel (le marchand du marché) sans lui donner un identifiant. Le modèle a préféré recycler un PNJ déjà autorisé (Ktar) plutôt que de voix le marchand en prose libre (ce que le champ `narration` aurait pourtant permis sans risque d'hallucination).
- **Le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout.** La seule tentative d'injection d'un fait mécanique réel (tour 1, une attaque de monstre) a échoué avant d'atteindre le modèle (panne du serveur LM Studio, sans rapport avec la validation). Le joueur n'a pas recoché la case ensuite — le combat des tours 2 à 4 (jusqu'à la mise à mort du monstre) a donc été entièrement narré par le modèle sans qu'aucun dé réel ne soit lancé. La résolution mécanique elle-même fonctionne (vérifiée isolément avant le playtest), mais rien dans l'écran ne force son usage : la garantie « le modèle ne calcule rien » ne tient que si l'humain pense à toujours fournir le fait.

## Décision

**Repli sur le MJ assisté**, pas le MJ IA autonome — la ligne du tableau de S1 « mécanique solide, prose faible ». Les mesures objectives (identifiants, latence, tokens, taux de malformation) sont toutes dans le budget ; c'est la cohérence narrative dans la durée qui déçoit, à la taille de modèle disponible sur ce poste (7,5 milliards de paramètres, sans raisonnement). Le MJ assisté ne demande que des propositions courtes et ponctuelles, filtrées par un humain à chaque fois — un usage pour lequel un modèle de cette taille est nettement plus fiable qu'une narration continue livrée sans filet.

## Conséquences

- La V3 se conçoit comme un MJ assisté (propositions courtes que l'humain accepte, modifie ou ignore), pas une narration autonome continue.
- **Avant toute conclusion définitive** : reboucler spécifiquement le lien fait-mécanique → narration, jamais réellement exercé dans ce spike (panne d'infrastructure sur l'unique tentative). Un second passage court, ciblé sur ce seul point, est nécessaire.
- Points de conception à reporter dans V2-H1 / la vraie V3, indépendamment du choix solo/assisté :
  - un vrai suivi de scène (qui est présent recalculé selon le lieu réel du joueur, pas une liste figée) ;
  - un contexte de personnage qui se met à jour (PV, état), pas un instantané pris une fois au début ;
  - un mécanisme pour voix les PNJ incidents en prose libre sans leur donner un identifiant à risque d'hallucination ;
  - une consigne ou une contrainte d'interface qui force le passage par la résolution mécanique avant toute narration de combat, plutôt qu'une case à cocher facultative.
- Un modèle plus grand ou un fournisseur distant pourrait améliorer la prose seule — mais pas combler les trous d'intégration ci-dessus (scène, fait mécanique non forcé), qui sont indépendants du modèle utilisé.
