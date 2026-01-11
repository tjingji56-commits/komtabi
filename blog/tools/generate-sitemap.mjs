// tools/generate-sitemap.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SITE_URL = "https://komtabi.com"; // ←ここだけ自分のドメインに変える
const POSTS_JS_PATH = path.resolve("js/data/posts.js"); // 実ファイルの場所
const OUTPUT_PATH = path.resolve("sitemap.xml");

// 固定ページ（必要に応じて追加/削除OK）
const STATIC_PAGES = [
  "/index.html",
  "/travel.html",
  "/modelcourse.html",
  "/prefectures.html",
  "/contact.html",
];

// YYYY.MM.DD → YYYY-MM-DD に変換（失敗したら null）
const toISODate = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo}-${d}`;
};

const xmlEscape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const joinUrl = (base, p) => base.replace(/\/$/, "") + p;

// posts.js を「実行」して window.POSTS を取り出す
const code = fs.readFileSync(POSTS_JS_PATH, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const posts = sandbox.window.POSTS || [];
if (!Array.isArray(posts)) {
  throw new Error("window.POSTS が配列ではありません");
}

// url の組み立て
const urls = [];

// 固定ページ
for (const p of STATIC_PAGES) {
  urls.push({
    loc: joinUrl(SITE_URL, p),
    changefreq: "weekly",
    priority: p === "/index.html" ? "1.0" : "0.7",
  });
}

// 記事ページ（post.html?id=xxx）
for (const post of posts) {
  if (!post?.id) continue;

  const loc = `${SITE_URL.replace(/\/$/, "")}/post.html?id=${encodeURIComponent(
    post.id
  )}`;

  urls.push({
    loc,
    // sitemap の lastmod は ISO 形式が推奨
    lastmod: toISODate(post.date) || undefined,
    changefreq: "yearly",
    priority: "0.6",
  });
}

// （おまけ）県別ページも sitemap に入れたいなら uncomment
// const uniquePrefs = [...new Set(posts.map(p => p?.prefecture).filter(Boolean))];
// for (const pref of uniquePrefs) {
//   const loc = `${SITE_URL.replace(/\/$/, "")}/travel.html?pref=${encodeURIComponent(pref)}`;
//   urls.push({ loc, changefreq: "monthly", priority: "0.5" });
// }

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${xmlEscape(u.lastmod)}</lastmod>` : "";
      return `  <url>
    <loc>${xmlEscape(u.loc)}</loc>${lastmod}
    <changefreq>${xmlEscape(u.changefreq)}</changefreq>
    <priority>${xmlEscape(u.priority)}</priority>
  </url>`;
    })
    .join("\n") +
  `\n</urlset>\n`;

fs.writeFileSync(OUTPUT_PATH, xml, "utf8");
console.log(`✅ sitemap.xml を生成しました: ${OUTPUT_PATH}`);
console.log(`URLs: ${urls.length}`);
