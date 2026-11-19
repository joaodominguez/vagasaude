import { SocialIcon, TELEGRAM_URL, WHATSAPP_URL } from "@/components/social-links";

/** «Síguenos en Telegram» / «WhatsApp»: canales con las ofertas del día (junto a las alertas). */
export function SocialAlertLinks({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  const links = [
    { name: "Telegram" as const, url: TELEGRAM_URL, label: onDark ? "Ofertas del día en Telegram" : "Síguenos en Telegram" },
    { name: "WhatsApp" as const, url: WHATSAPP_URL, label: onDark ? "Ofertas por WhatsApp" : "También por WhatsApp" },
  ].filter((l) => l.url);
  if (links.length === 0) return null;
  return (
    <div className={`social-alert-links ${onDark ? "on-dark" : ""} ${className}`}>
      {links.map((l) => (
        <a key={l.name} href={l.url} target="_blank" rel="noopener">
          <SocialIcon name={l.name} className="h-[18px] w-[18px]" />
          {l.label}
        </a>
      ))}
    </div>
  );
}
