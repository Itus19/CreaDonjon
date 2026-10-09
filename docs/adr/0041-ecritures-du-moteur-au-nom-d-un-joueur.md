# 0041 — Les écritures du moteur au nom d'un joueur

**Date :** 2026-10-09
**Statut :** proposée — **en attente de l'auteur** (touche la règle absolue 2)

## Contexte

Quand un joueur cible un adversaire (V3.1-21), le serveur résout le jet par le moteur, puis doit écrire les PV et les états **d'un participant que le joueur n'a pas le droit d'écrire** (ADR 0040), ou soigner le PJ d'une autre joueuse. Le serveur agit avec le client Supabase **de l'utilisateur** : tout ce que ce client peut écrire, le joueur peut aussi l'écrire lui-même par l'API, avec n'importe quelle valeur. Une fonction `security definer` « appliquer des dégâts » ouverte aux joueurs leur permettrait de mettre un boss à 0 PV. Le seul client qui contourne la RLS, le service role, est **confiné à `publicShare.ts` par la règle absolue 2**.

## Options envisagées

- **A. Un second module privilégié**, `src/server/services/engineWrites.ts`, seul autorisé (avec `publicShare.ts`) à utiliser le service role, qui n'écrit que des changements produits par le moteur dans la même requête. Simple et sûr si le module reste petit — **mais modifie la règle absolue 2** et sa règle ESLint.
- **B. Des changements signés** : le serveur signe (HMAC, `pgcrypto`) chaque changement produit par le moteur ; une fonction `security definer` ne l'applique que si la signature est valide, avec une clé que seuls le serveur et la base connaissent. Garde la règle 2 intacte et la base reste la dernière barrière — plus complexe : une clé à poser hors Git dans la base (réglage manuel, aussi en cible locale) et à faire tourner.
- **C. Le MJ applique** : le jet du joueur crée une proposition que le MJ valide d'un toucher. Aucun privilège nouveau — mais un toucher du MJ par attaque, ce que la décision « tout se résout et s'applique seul » voulait éviter.

## Décision

**Recommandée : B.** Elle tient la règle 2 et laisse la base trancher. **A** est acceptable si l'auteur préfère la simplicité et amende la règle 2 (ADR et règle ESLint à jour). **C** reste le repli si aucune des deux n'est voulue.

En attendant : les jets du **MJ** se résolvent et s'appliquent seuls (il a le droit d'écrire partout) ; ceux d'un **joueur** sur sa propre fiche aussi ; ceux d'un joueur **sur une autre cible** affichent le verdict sans appliquer.

## Conséquences

Bloque V3.1-107 (cibler côté joueur) et le soin d'un autre PJ. Ne bloque ni le MJ, ni le solo, ni les sauvegardes demandées (V3.1-39 : c'est le propriétaire de la cible qui applique), ni les droits des joueurs (ADR 0043).
