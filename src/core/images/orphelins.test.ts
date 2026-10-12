import { describe, expect, it } from "vitest";
import { trouverOrphelins } from "./orphelins";

const MAINTENANT = Date.parse("2026-10-12T12:00:00Z");
const VIEUX = "2026-09-01T10:00:00Z";
const RECENT = "2026-10-12T11:30:00Z"; // il y a 30 min

const asset = (id: string, cree = VIEUX, monde = "m1") => ({ id, world_id: monde, storage_path: `${monde}/${id}.webp`, byte_size: 100, created_at: cree });
const fichier = (chemin: string, cree = VIEUX) => ({ chemin, octets: 10, cree_le: cree });

const base = { assets: [], texteDesBlocs: "", idsDesignes: new Set<string>(), fichiers: [], maintenant: MAINTENANT, ageMinimumMs: 3_600_000 };

describe("trouverOrphelins", () => {
  it("une image designee par une table de liens n'est pas orpheline", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a")], idsDesignes: new Set(["a"]), fichiers: [fichier("m1/a.webp")] });
    expect(r.lignes).toEqual([]);
  });

  it("une image citee dans les donnees d'un bloc n'est pas orpheline", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a")], texteDesBlocs: '{"assetId":"a"}', fichiers: [fichier("m1/a.webp")] });
    expect(r.lignes).toEqual([]);
  });

  it("une image que rien ne designe est orpheline", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a")], fichiers: [fichier("m1/a.webp")] });
    expect(r.lignes.map((l) => l.id)).toEqual(["a"]);
  });

  it("une image de moins d'une heure est mise de cote (envoi peut-etre en cours)", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a", RECENT)], fichiers: [fichier("m1/a.webp", RECENT)] });
    expect(r.lignes).toEqual([]);
    expect(r.recents).toBe(1);
  });

  it("un fichier sans ligne assets est orphelin", () => {
    const r = trouverOrphelins({ ...base, fichiers: [fichier("m1/x.webp")] });
    expect(r.fichiers.map((f) => f.chemin)).toEqual(["m1/x.webp"]);
  });

  it("un fichier dont la ligne existe n'est pas un fichier sans ligne", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a")], idsDesignes: new Set(["a"]), fichiers: [fichier("m1/a.webp")] });
    expect(r.fichiers).toEqual([]);
  });

  it("un fichier recent sans ligne est mis de cote (la ligne arrive juste apres l'envoi)", () => {
    const r = trouverOrphelins({ ...base, fichiers: [fichier("m1/x.webp", RECENT)] });
    expect(r.fichiers).toEqual([]);
    expect(r.recents).toBe(1);
  });

  it("le marqueur de dossier vide du stockage n'est jamais un orphelin", () => {
    const r = trouverOrphelins({ ...base, fichiers: [fichier("m1/.emptyFolderPlaceholder")] });
    expect(r.fichiers).toEqual([]);
  });

  it("une date illisible est traitee comme recente : on n'efface pas ce qu'on ne sait pas dater", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("a", "pas une date")], fichiers: [fichier("m1/b.webp", "")] });
    expect(r.lignes).toEqual([]);
    expect(r.fichiers).toEqual([]);
    expect(r.recents).toBe(2);
  });

  it("les listes sont triees, pour une empreinte stable d'un passage a l'autre", () => {
    const r = trouverOrphelins({ ...base, assets: [asset("b"), asset("a")], fichiers: [fichier("m1/z.webp"), fichier("m1/y.webp"), fichier("m1/a.webp"), fichier("m1/b.webp")] });
    expect(r.lignes.map((l) => l.id)).toEqual(["a", "b"]);
    expect(r.fichiers.map((f) => f.chemin)).toEqual(["m1/y.webp", "m1/z.webp"]);
  });
});
