-- V3-F2 — Annuler un tour du solo : une proposition défaite par l'annulation
-- d'un tour garde sa ligne (le journal et l'historique ne s'effacent jamais)
-- et passe au statut `reverted`, lisible tel quel dans le tiroir de
-- conséquences, sans recouper le journal.
alter table ai_proposals drop constraint if exists ai_proposals_status_check;
alter table ai_proposals
  add constraint ai_proposals_status_check
  check (status in ('pending', 'applied', 'rejected', 'failed', 'reverted'));
