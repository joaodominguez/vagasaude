import { listArticles } from "@/lib/news";
import { HeaderClient } from "./header-client";

/** Componente de servidor: decide si el menú enlaza a Noticias (solo con artículos publicados). */
export function Header() {
  return <HeaderClient showNews={listArticles().length > 0} />;
}
