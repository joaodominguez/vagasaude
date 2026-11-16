// Redes sociais do VagaSaúde PT (docs/REDES-SOCIAIS.md). Só aparecem as redes com link preenchido:
// quando uma conta nova estiver pronta, basta pôr o URL aqui.
const SOCIAL = [
  { name: "Telegram", url: "https://t.me/vagasaudept" },
  { name: "WhatsApp", url: "https://whatsapp.com/channel/0029VbDxb8A5PO0v9AeTbE32" },
  { name: "Instagram", url: "https://www.instagram.com/vagasaudept" },
  { name: "Facebook", url: "https://www.facebook.com/vagasaudept" },
] as const;

const PATHS: Record<(typeof SOCIAL)[number]["name"], string> = {
  Telegram:
    "M5.4 11.7l11.1-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.1-.9z",
  WhatsApp:
    "M12 5.2a6.8 6.8 0 0 0-5.9 10.2l-.9 3.3 3.4-.9A6.8 6.8 0 1 0 12 5.2zm3.9 9.6c-.2.5-1 .9-1.4 1-.4 0-.8.2-2.6-.5-2.2-.9-3.6-3.1-3.7-3.3-.1-.1-.9-1.2-.9-2.3s.6-1.6.8-1.8c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.6c.1.1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.5.7c.2.1.4.2.4.3.1.1.1.6-.1 1.1z",
  Instagram:
    "M12 7.1A4.9 4.9 0 1 0 12 17a4.9 4.9 0 0 0 0-9.9zm0 8.1A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm5.1-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0zM9 5h6a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4zm0 1.6A2.4 2.4 0 0 0 6.6 9v6A2.4 2.4 0 0 0 9 17.4h6a2.4 2.4 0 0 0 2.4-2.4V9A2.4 2.4 0 0 0 15 6.6H9z",
  Facebook:
    "M13.3 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.2 1.2-1.2h1.2V5.8c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.8H8.9V13h2v6h2.4z",
};

/** Linha "Siga-nos" com os ícones das redes que já existem (rodapé e menu do telemóvel). */
export function SocialLinks({ className = "" }: { className?: string }) {
  const active = SOCIAL.filter((s) => s.url);
  if (active.length === 0) return null;
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="text-sm text-muted">Siga-nos</span>
      <ul className="flex items-center gap-1.5">
        {active.map((s) => (
          <li key={s.name}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener"
              aria-label={`VagaSaúde no ${s.name}`}
              title={s.name}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-primary hover:text-primary"
            >
              <svg aria-hidden="true" viewBox="4 4 16 16" className="h-3.5 w-3.5" fill="currentColor">
                <path d={PATHS[s.name]} fillRule="evenodd" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
