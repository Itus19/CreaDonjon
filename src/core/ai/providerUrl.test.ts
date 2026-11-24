import { describe, expect, it } from "vitest";
import { estAdresseLocale, verifierUrlFournisseur } from "./providerUrl";

/**
 * V3.1-224 (ADR 0103) — une adresse fournie par l'utilisateur sera appelée par
 * NOTRE serveur : c'est une SSRF par construction. Ces tests fixent ce qui
 * passe et ce qui ne passe pas, des deux côtés de la frontière.
 */
describe("l'adresse d'un fournisseur d'IA", () => {
  const prod = { adressesPriveesAutorisees: false };
  const local = { adressesPriveesAutorisees: true };

  it("accepte une adresse publique en https", () => {
    expect(verifierUrlFournisseur("https://api.venice.ai/api/v1", prod)).toEqual({ ok: true });
    expect(verifierUrlFournisseur("https://tunnel-de-gabriel.exemple.net/v1", prod)).toEqual({ ok: true });
  });

  it("refuse ce qui n'est pas http(s) — jamais file, data ni gopher", () => {
    for (const url of ["file:///etc/passwd", "data:text/plain,bonjour", "gopher://exemple.net", "ftp://exemple.net/v1"]) {
      expect(verifierUrlFournisseur(url, local)).toEqual({ ok: false, raison: "schema" });
    }
  });

  it("refuse http en production, l'accepte en local", () => {
    expect(verifierUrlFournisseur("http://api.exemple.net/v1", prod)).toEqual({ ok: false, raison: "http" });
    expect(verifierUrlFournisseur("http://localhost:1234/v1", local)).toEqual({ ok: true });
  });

  it("refuse les adresses locales et privées en production", () => {
    for (const hote of ["localhost", "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.106", "[::1]", "0.0.0.0"]) {
      expect(verifierUrlFournisseur(`https://${hote}/v1`, prod)).toEqual({ ok: false, raison: "privee" });
    }
  });

  it("refuse l'adresse des métadonnées d'instance, qui est le vrai butin d'une SSRF", () => {
    expect(verifierUrlFournisseur("https://169.254.169.254/latest/meta-data/", prod)).toEqual({ ok: false, raison: "privee" });
  });

  it("laisse passer les mêmes adresses quand le serveur tourne sur la machine du joueur", () => {
    for (const hote of ["localhost", "127.0.0.1", "192.168.1.106"]) {
      expect(verifierUrlFournisseur(`http://${hote}:1234/v1`, local)).toEqual({ ok: true });
    }
  });

  it("refuse ce qui n'est pas une adresse", () => {
    expect(verifierUrlFournisseur("", prod)).toEqual({ ok: false, raison: "illisible" });
    expect(verifierUrlFournisseur("api.venice.ai/v1", prod)).toEqual({ ok: false, raison: "illisible" });
  });

  it("refuse une adresse qui porte déjà des identifiants", () => {
    expect(verifierUrlFournisseur("https://moi:motdepasse@api.exemple.net/v1", prod)).toEqual({ ok: false, raison: "identifiants" });
  });
});

describe("un fournisseur local ou distant", () => {
  it("la machine et le réseau privé sont locaux", () => {
    expect(estAdresseLocale("http://localhost:1234/v1")).toBe(true);
    expect(estAdresseLocale("http://127.0.0.1:11434/v1")).toBe(true);
    expect(estAdresseLocale("http://192.168.1.20:1234/v1")).toBe(true);
  });

  it("une adresse publique est distante : le texte de la partie quitte la machine", () => {
    expect(estAdresseLocale("https://api.venice.ai/api/v1")).toBe(false);
    expect(estAdresseLocale("https://api.openai.com/v1")).toBe(false);
  });

  it("une adresse illisible compte comme distante, par prudence", () => {
    expect(estAdresseLocale("pas une adresse")).toBe(false);
  });
});
