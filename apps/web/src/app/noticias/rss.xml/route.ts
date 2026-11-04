import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import { listArticles, newsCategoryLabel, newsPath } from "@/lib/news";

export const dynamic = "force-static";
export const revalidate = 3600;

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const rfc822 = (date: string) => new Date(`${date}T08:00:00Z`).toUTCString();

export function GET() {
  const articles = listArticles().slice(0, 30);
  const feedUrl = absoluteUrl("/noticias/rss.xml");
  const lastBuild = articles[0] ? rfc822(articles[0].updated ?? articles[0].date) : new Date().toUTCString();
  const items = articles
    .map((article) => {
      const url = absoluteUrl(newsPath(article.slug));
      return `    <item>
      <title>${esc(article.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${rfc822(article.date)}</pubDate>
      <category>${esc(newsCategoryLabel(article.category))}</category>
      <description>${esc(article.description)}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`Notícias ${SITE_NAME}`)}</title>
    <link>${esc(absoluteUrl("/noticias"))}</link>
    <description>Notícias de emprego, concursos, salários e carreiras para profissionais de saúde em Portugal.</description>
    <language>pt-PT</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
