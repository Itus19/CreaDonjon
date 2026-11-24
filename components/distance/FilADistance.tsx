"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/shell/EmptyState";
import type { RemoteFeedMessage } from "@/src/core/remote/feed";
import type { RemoteRollRequestView } from "@/src/server/services/remotePlay";

/**
 * Le jeu à distance (ADR 0103) — le fil commun, à deux voix. Le MJ parle à
 * gauche, la joueuse qui lit à droite, les autres joueurs à gauche avec leur
 * nom. Un secret a un liseré pointillé de la couleur du MJ (comme un jet
 * secret du salon, `CarteJetSalon`) et dit pour qui il est.
 *
 * Une demande de jet est une carte DANS le message du MJ qui la porte
 * (variante 2 choisie par l'auteur, 23 nov.). Sa cible y répond : « Lancer »
 * ou « J'ai lancé à la main ». Les autres y lisent qui doit lancer.
 *
 * Présentationnel : la lecture et les gestes vivent dans `useTableADistance`.
 */

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function CarteDemande({
  demande,
  estCible,
  estMj,
  onRepondre,
  onAnnuler,
}: {
  demande: RemoteRollRequestView;
  estCible: boolean;
  estMj: boolean;
  onRepondre: (requestId: string, corps: { mode: "roll" } | { mode: "by_hand"; natural: number }) => Promise<string | null>;
  onAnnuler: (requestId: string) => Promise<string | null>;
}) {
  const t = useTranslations("distance");
  const [aLaMain, setALaMain] = useState(false);
  const [de, setDe] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enAttente = demande.status === "pending";
  const bonus = demande.bonus !== null ? ` · ${demande.bonus >= 0 ? "+" : ""}${demande.bonus}` : "";
  const dd = demande.dcShown !== null ? t("ddAnnonce", { dd: demande.dcShown }) : estMj && demande.dcHidden !== null ? t("ddCacheMj", { dd: demande.dcHidden }) : t("ddCache");
  const avantage = demande.advantage === "advantage" ? ` · ${t("avantage")}` : demande.advantage === "disadvantage" ? ` · ${t("desavantage")}` : "";

  async function repondre(corps: { mode: "roll" } | { mode: "by_hand"; natural: number }) {
    setEnvoi(true);
    setErreur(await onRepondre(demande.id, corps));
    setEnvoi(false);
  }

  const naturel = Number(de);
  const deValide = Number.isInteger(naturel) && naturel >= 1 && naturel <= 20;

  return (
    <div className={`mt-2 flex flex-col gap-2 rounded-md border-2 p-3 ${enAttente ? "border-accent bg-accent/10" : "border-edge bg-panel-sunken"}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong className="text-sm font-semibold text-accent">{t("jetDe", { jet: demande.label })}</strong>
        <span className="text-xs text-ink-soft">
          {estCible ? "" : `${demande.targetName} · `}
          {dd}
          {bonus}
          {avantage}
        </span>
      </div>

      {enAttente && estCible && !aLaMain && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={envoi}
            onClick={() => void repondre({ mode: "roll" })}
            className="min-h-11 flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {t("lancer")}
          </button>
          <button
            type="button"
            disabled={envoi}
            onClick={() => setALaMain(true)}
            className="min-h-11 flex-1 rounded-full border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {t("jaiLanceALaMain")}
          </button>
        </div>
      )}

      {enAttente && estCible && aLaMain && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (deValide) void repondre({ mode: "by_hand", natural: naturel });
          }}
        >
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            {t("leDeMontre")}
            <input
              autoFocus
              inputMode="numeric"
              value={de}
              onChange={(e) => setDe(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder={t("unAVingt")}
              aria-label={t("resultatDuDe")}
              className="min-h-11 w-20 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!deValide || envoi}
            className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {t("valider")}
          </button>
          <button type="button" onClick={() => setALaMain(false)} className="min-h-11 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            {t("retour")}
          </button>
        </form>
      )}

      {enAttente && !estCible && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">{t("enAttenteDe", { nom: demande.targetName })}</span>
          {estMj && (
            <button
              type="button"
              disabled={envoi}
              onClick={async () => {
                setEnvoi(true);
                setErreur(await onAnnuler(demande.id));
                setEnvoi(false);
              }}
              className="ml-auto rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
            >
              {t("retirerDemande")}
            </button>
          )}
        </div>
      )}

      {demande.status === "answered" && demande.total !== null && (
        <p className="text-sm text-ink">
          {t("resultat", { total: demande.total, naturel: demande.natural ?? "?" })}
          {demande.byHand ? ` · ${t("aLaMain")}` : ""}
        </p>
      )}
      {demande.status === "cancelled" && <p className="text-xs text-ink-muted">{t("demandeRetiree")}</p>}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  );
}

function Bulle({
  message,
  demande,
  viewerId,
  estMj,
  onRepondre,
  onAnnuler,
}: {
  message: RemoteFeedMessage;
  demande: RemoteRollRequestView | null;
  viewerId: string;
  estMj: boolean;
  onRepondre: (requestId: string, corps: { mode: "roll" } | { mode: "by_hand"; natural: number }) => Promise<string | null>;
  onAnnuler: (requestId: string) => Promise<string | null>;
}) {
  const t = useTranslations("distance");
  const aDroite = message.mine;
  const secret = message.secret;
  const pourQui =
    secret === null
      ? null
      : secret.kind === "gm_only"
        ? message.mine
          ? t("secretAuMj")
          : t("secretPourToiMj")
        : secret.names.length === 1 && !estMj && !message.mine
          ? t("secretPourToi")
          : t("secretPour", { noms: secret.names.join(", ") });

  // Une réponse de jet : une ligne compacte, jamais une bulle de prose.
  if (message.roll) {
    return (
      <p className={`text-xs text-ink-soft ${aDroite ? "self-end text-right" : "self-start"}`}>
        <span className={message.voice === "gm" ? "text-gm" : "text-players"}>{message.mine ? t("toi") : message.authorName}</span>
        {" · "}
        {t("ligneJet", { jet: message.roll.label, total: message.roll.total, naturel: message.roll.natural })}
        {message.roll.byHand ? ` · ${t("aLaMain")}` : ""}
      </p>
    );
  }

  return (
    <div
      className={`flex max-w-[88%] flex-col gap-0.5 rounded-lg px-3 py-2 text-sm leading-relaxed ${aDroite ? "self-end" : "self-start"} ${
        secret ? "border border-dashed border-gm bg-panel-raised" : aDroite ? "bg-players/15" : "border border-edge bg-panel"
      }`}
    >
      <span className="text-xs">
        <span className={message.voice === "gm" ? "text-gm" : "text-players"}>{message.mine ? t("toi") : message.authorName}</span>
        <span className="text-ink-muted"> · {heure(message.createdAt)}</span>
        {pourQui && <span className="text-gm"> · {pourQui}</span>}
      </span>
      {message.text && <p className="whitespace-pre-wrap break-words text-ink">{message.text}</p>}
      {demande && <CarteDemande demande={demande} estCible={demande.targetUserId === viewerId} estMj={estMj} onRepondre={onRepondre} onAnnuler={onAnnuler} />}
    </div>
  );
}

export default function FilADistance({
  feed,
  requests,
  viewerId,
  estMj,
  dernierLuAuChargement,
  onRepondre,
  onAnnuler,
}: {
  feed: RemoteFeedMessage[];
  requests: RemoteRollRequestView[];
  viewerId: string;
  estMj: boolean;
  /** Le dernier lu à l'ouverture de l'écran : le trait « depuis ta dernière visite » se pose après lui, et n'en bouge plus. */
  dernierLuAuChargement: number | null;
  onRepondre: (requestId: string, corps: { mode: "roll" } | { mode: "by_hand"; natural: number }) => Promise<string | null>;
  onAnnuler: (requestId: string) => Promise<string | null>;
}) {
  const t = useTranslations("distance");
  const basRef = useRef<HTMLDivElement | null>(null);
  const traitRef = useRef<HTMLDivElement | null>(null);
  const demandes = new Map(requests.map((r) => [r.id, r]));
  const premierNouveau = feed.findIndex((m) => !m.mine && m.seq > (dernierLuAuChargement ?? 0));
  const nouveaux = premierNouveau === -1 ? 0 : feed.slice(premierNouveau).filter((m) => !m.mine).length;
  const dejaPlace = useRef(false);

  // À l'ouverture : on arrive sur le premier message non lu ; ensuite, chaque message neuf fait descendre.
  useEffect(() => {
    if (!dejaPlace.current && traitRef.current) {
      traitRef.current.scrollIntoView({ block: "start" });
    } else {
      basRef.current?.scrollIntoView({ block: "end" });
    }
    dejaPlace.current = true;
  }, [feed.length]);

  if (feed.length === 0) {
    return <EmptyState title={t("filVideTitre")} description={estMj ? t("filVideMj") : t("filVideJoueur")} />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {feed.map((m, i) => (
        <div key={m.id} className="contents">
          {i === premierNouveau && dernierLuAuChargement !== null && (
            <div ref={traitRef} className="flex items-center gap-2 text-xs text-accent" role="separator">
              <span className="h-px flex-1 bg-accent" />
              {t("nouveauxDepuis", { n: nouveaux })}
              <span className="h-px flex-1 bg-accent" />
            </div>
          )}
          <Bulle message={m} demande={m.rollRequestId ? (demandes.get(m.rollRequestId) ?? null) : null} viewerId={viewerId} estMj={estMj} onRepondre={onRepondre} onAnnuler={onAnnuler} />
        </div>
      ))}
      <div ref={basRef} />
    </div>
  );
}
