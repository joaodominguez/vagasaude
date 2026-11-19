"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";

type SaveShareRowProps = {
  slug: string;
  url: string;
  title: string;
  summary: string;
};

/**
 * Linha «Salvar» + «Compartilhar» da coluna lateral. «Compartilhar» abre (na coluna, sem
 * pop-up que a barra lateral cortaria) as opções: compartilhamento nativo se existir,
 * WhatsApp, LinkedIn e copiar link.
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
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: summary, url });
    } catch {
      // cancelado pelo usuário
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
          Compartilhar
        </button>
      </div>
      {open && (
        <div id={panelId} className="share-panel" role="group" aria-label="Compartilhar vaga">
          {canNativeShare && (
            <button type="button" className="share-chip" onClick={nativeShare}>
              <Share2 size={15} aria-hidden="true" />
              Compartilhar…
            </button>
          )}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="share-chip">
            <MessageCircle size={15} aria-hidden="true" />
            WhatsApp
          </a>
          <a href={linkedinHref} target="_blank" rel="noopener noreferrer" className="share-chip">
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
