"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

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
          target="_blank"
          rel="noopener noreferrer"
          className="share-chip"
        >
          WhatsApp
        </a>
        <a
          href={linkedinHref}
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
