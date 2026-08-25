# 0011 — Fenêtres flottantes partagées entre Monde et Règles

**Date :** 2026-08-25
**Statut :** acceptée

## Contexte

`docs/BACKLOG_V2.md` (ticket V2-K1, refonte de la coquille) demande d'afficher une fiche d'entité et une fiche de règle en fenêtres flottantes simultanées. Or `Monde`, `Règles` et `MJ` sont trois routes Next.js distinctes, chacune avec son propre layout imbriqué : `DesktopWindows` (ADR-0006) ne vivait que sous `(monde)`, et `regles/[cle]/page.tsx` s'affichait en page pleine, jamais en fenêtre. Changer de section démonte donc l'arbre React de la précédente — tout état de fenêtre purement local à `(monde)/layout.tsx` disparaît au passage vers `Règles`.

## Options envisagées

- **A. Routes parallèles Next.js (`@sidebar`)** — le mécanisme du framework conçu pour exactement ce cas (chrome partagé, contenu latéral qui varie et se charge indépendamment par sous-route). Idiomatique, mais introduit un premier usage des routes parallèles dans le dépôt, et une hiérarchie de dossiers à double lecture.
- **B. Portails DOM (`createPortal`)** — une sidebar unique montée une fois, ciblée par portail depuis chaque section. Pas de nouveau concept Next.js, mais un timing client (montage/démontage de portail) à gérer, et un rendu qui ne peut jamais être fait pleinement côté serveur.
- **C. État partagé (contexte React) monté une fois au-dessus des trois sections, rendu dupliqué par section.** Chaque section garde son propre appel à un composant de rendu (`WindowsDesktop`), mais tous lisent le même état (positions, `?avec=`, cache des fiches secondaires) fourni par un fournisseur (`DesktopWindowsProvider`) monté dans `app/m/[worldSlug]/layout.tsx`, au-dessus des trois sections. MJ ne monte jamais ce rendu — ses écrans restent plein cadre, non demandés en fenêtre.

## Décision

**C.** Aucun nouveau concept Next.js à apprendre, aucune sidebar « virtuelle » à faire correspondre par timing client : chaque section continue de fournir sa propre sidebar et son propre appel de rendu, seul l'état qui doit survivre au changement de route (position, `?avec=`, données déjà récupérées) est remonté. `?avec=` distingue désormais une entité d'une entrée de règle par préfixe explicite (`entite:`/`regle:`), jamais par une recherche dans les deux tables.

Un piège trouvé en le construisant : une bascule Monde ↔ Règles ↔ MJ est une **navigation de page complète**, qui réinitialiserait `?avec=` si les liens de section ne le reportaient pas explicitement — `SectionToggle` replie donc la fenêtre primaire courante dans `avec` et reporte la liste complète vers la section cible avant de naviguer.

## Conséquences

- `components/shell/DesktopWindowsProvider.tsx` : état seul (positions, cache, `?avec=` parsé), monté une fois. `components/shell/WindowsDesktop.tsx` : rendu seul, monté par Monde et par Règles, jamais par MJ.
- `RegisterPrimaryWindow` et `useOpenEntityLink`/`useOpenRuleLink` sont génériques sur un `WindowRef` (`{kind: "entity" | "rule", key}`, `components/shell/windowRefs.ts`) plutôt que spécifiques à un type de fiche.
- Une fiche de règle a désormais deux chemins de rendu partageant le même composant (`RuleEntryView`) : rendu serveur pour la fenêtre primaire, récupération client (`/api/worlds/[worldSlug]/regles/[cle]/window`) pour une fenêtre secondaire — même motif que `EditEntityForm` pour les entités.
- MJ reste un plein cadre : y ajouter un jour des fenêtres nécessiterait de monter `WindowsDesktop` dans `mj/layout.tsx`, ce qui n'a pas été demandé et poserait la question de la largeur (les écrans MJ actuels dépassent la largeur fixe voulue pour une fenêtre, V2-K3).
- Piège à surveiller si une fenêtre secondaire est rouverte après un aller-retour de section : la clé d'effet qui déclenche la récupération des données doit dépendre de la composition de `avec` seule, jamais d'une clé combinant primaire + avec — sinon une référence qui passe de primaire à secondaire (même identifiant, même position dans la liste combinée) peut laisser la clé combinée inchangée et l'effet ne se redéclenche pas. Rencontré et corrigé pendant ce ticket.
