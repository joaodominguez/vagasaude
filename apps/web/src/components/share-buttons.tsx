"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { trackEvent } from "@/lib/track-event";

type ShareButtonsProps = {
  url: string;
  title: string;
  summary: string;
};

export function ShareButtons({ url, title, summary }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title} — ${summary}`);
  const whatsappHref = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("share", { method: "copy_link" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title, text: summary, url });
      trackEvent("share", { method: "native" });
    } catch {
      // user cancelled
    }
  }

  return (
    <div className="share-bar">
      <p className="share-bar-label">Partilhar vaga</p>
      <div className="share-bar-actions">
        <button type="button" className="share-chip" onClick={nativeShare}>
          <Share2 size={15} aria-hidden="true" />
          Partilhar
        </button>
        <a
          href={whatsappHref}
          onClick={() => trackEvent("share", { method: "whatsapp" })}
          target="_blank"
          rel="noopener noreferrer"
          className="share-chip"
        >
          WhatsApp
        </a>
        <a
          href={linkedinHref}
          onClick={() => trackEvent("share", { method: "linkedin" })}
          target="_blank"
          rel="noopener noreferrer"
          className="share-chip"
        >
          LinkedIn
        </a>
        <button type="button" className="share-chip" onClick={copyLink}>
          {copied ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Link2 size={15} aria-hidden="true" />
          )}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

type SaveShareRowProps = {
  slug: string;
  url: string;
  title: string;
  summary: string;
};

/**
 * Linha «Guardar» + «Partilhar» da coluna lateral. «Partilhar» abre (na coluna,
 * sem pop-up que a barra lateral cortaria) as opções: partilha nativa
 * se existir, WhatsApp, LinkedIn e copiar link.
 */
export function SaveShareRow({ slug, url, title, summary }: SaveShareRowProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );
  const panelId = useId();
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title} — ${summary}`);
  const whatsappHref = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      trackEvent("share", { method: "copy_link" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: summary, url });
      trackEvent("share", { method: "native" });
    } catch {
      // cancelado pelo utilizador
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <FavoriteButton
          slug={slug}
          size={18}
          withLabel
          className="detail-fav-button"
        />
        <button
          type="button"
          className="button button-secondary share-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Share2 size={18} aria-hidden="true" />
          Partilhar
        </button>
      </div>
      {open && (
        <div id={panelId} className="share-panel" role="group" aria-label="Partilhar vaga">
          {canNativeShare && (
            <button type="button" className="share-chip" onClick={nativeShare}>
              <Share2 size={15} aria-hidden="true" />
              Partilhar…
            </button>
          )}
          <a href={whatsappHref} onClick={() => trackEvent("share", { method: "whatsapp" })} target="_blank" rel="noopener noreferrer" className="share-chip">
            <MessageCircle size={15} aria-hidden="true" />
            WhatsApp
          </a>
          <a href={linkedinHref} onClick={() => trackEvent("share", { method: "linkedin" })} target="_blank" rel="noopener noreferrer" className="share-chip">
            LinkedIn
          </a>
          <button type="button" className="share-chip" onClick={copyLink} aria-live="polite">
            {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}
    </div>
  );
}
