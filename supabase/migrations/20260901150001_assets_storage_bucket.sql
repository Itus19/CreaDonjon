-- Lot I (retour utilisateur, 1 sept. : cartes) — active enfin la table
-- `assets` prevue depuis la migration 011 (`storage.sql`, "buckets prives,
-- URLs signees de courte duree : un bucket public reduirait a neant le
-- travail sur la visibilite") mais jamais cablee jusqu'ici. ADR 0017.
--
-- Chemin de stockage : `${worldId}/${assetId}.${ext}` — le dossier de
-- premier niveau porte le monde, jamais un id d'entite ou de bloc (un
-- asset peut changer de proprietaire logique sans jamais deplacer le
-- fichier). Bucket prive : `service_role` (confine a publicShare.ts,
-- CLAUDE.md regle 4 ter) N'EST PAS utilise ici — l'upload et la generation
-- d'URL signee passent par le client authentifie normal, gouvernes par les
-- policies storage.objects ci-dessous, jamais un contournement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Porte grossiere (repertoire = monde, RLS sur storage.objects ne connait
-- que le nom du fichier, jamais une jointure vers `assets.visibility_level`)
-- : n'importe quel membre du monde peut lire/ecrire N'IMPORTE QUEL objet de
-- CE dossier. La porte fine (qui a le droit de voir CET asset precis, selon
-- sa visibilite) reste `assets_select` (deja RLS depuis la migration
-- 20260804150001) — c'est CETTE ligne qu'interroge `storage.ts` avant de
-- generer une URL signee, jamais storage.objects directement.
create policy assets_bucket_select on storage.objects for select
  using (bucket_id = 'assets' and app.is_world_member((storage.foldername(name))[1]::uuid));

create policy assets_bucket_insert on storage.objects for insert
  with check (bucket_id = 'assets' and app.is_world_member((storage.foldername(name))[1]::uuid));

create policy assets_bucket_delete on storage.objects for delete
  using (bucket_id = 'assets' and app.is_world_member((storage.foldername(name))[1]::uuid));
