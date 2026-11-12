import { listArticles } from "@/lib/news";
import { HeaderClient } from "./header-client";

/** Componente server: decide se il menu rimanda a Notizie (solo con articoli pubblicati). */
export function Header() {
  return <HeaderClient showNews={listArticles().length > 0} />;
}
