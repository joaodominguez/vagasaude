import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { absoluteUrl } from "@/lib/seo";

export type BreadcrumbItem = { label: string; href?: string };

/**
 * Breadcrumb visibili + JSON-LD BreadcrumbList. L'ultimo elemento è la pagina
 * corrente (senza link). Offrono link interni indicizzabili verso le landing di categoria.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };

  return (
    <nav aria-label="Percorso di navigazione" className="mb-5 min-w-0 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight size={14} aria-hidden="true" className="shrink-0" />}
            {item.href && index < items.length - 1 ? (
              <Link href={item.href} className="font-semibold hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
