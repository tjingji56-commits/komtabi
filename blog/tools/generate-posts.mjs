// tools/generate-posts.mjs
import fs from "node:fs";
import path from "node:path";
import fetch from "node-fetch";

/**
 * 実行場所が
 * - ~/デスクトップ/blog でも
 * - ~/デスクトップ   でも
 * 動くように ROOT を自動判定
 */
const cwd = process.cwd();
const ROOT = fs.existsSync(path.join(cwd, "index.html"))
  ? cwd
  : fs.existsSync(path.join(cwd, "blog", "index.html"))
    ? path.join(cwd, "blog")
    : cwd;

const POSTS_DIR = path.join(ROOT, "posts");
const TEMPLATE_PATH = path.join(ROOT, "post-static.template.html");

const SITE_URL = process.env.SITE_URL || "https://komtabi.com";

// env (microCMS)
const SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_DOMAIN;
const API_KEY = process.env.MICROCMS_API_KEY;
const ENDPOINT = process.env.MICROCMS_ENDPOINT || "posts";
const LIMIT = 100;

// utilities
const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeTag = (s) => String(s ?? "").trim();
const normalizePref = (s) => String(s ?? "").trim();

const toYmdDots = (s) => {
  if (!s) return "";
  const str = String(s);
  // already YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(str)) return str;
  // YYYY-MM-DD or ISO
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return str;
};

const stripTags = (html) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildExcerpt = (post) => {
  const ex = String(post.excerpt ?? "").trim();
  if (ex) return ex;
  const plain = stripTags(post.content ?? post.body ?? "");
  if (plain) return plain.slice(0, 110);
  return "#コム旅の記事。旅の記録を写真と一緒にまとめています。";
};

const relAssetFromPosts = (src) => {
  const s = String(src ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s; // absolute
  if (s.startsWith("../")) return s;     // already relative from /posts
  if (s.startsWith("/")) return `${SITE_URL.replace(/\/$/, "")}${s}`; // absolute path -> absolute URL
  // "img/xxx" or "css/xxx" -> from /posts -> ../img/xxx
  return `../${s}`;
};

const postPageUrlAbs = (id) => `${SITE_URL.replace(/\/$/, "")}/posts/${encodeURIComponent(id)}.html`;

const buildBreadcrumbHtml = (title, pref) => {
  const prefNorm = normalizePref(pref);
  const prefCrumb = prefNorm
    ? ` <span class="breadcrumb-sep">›</span> <a href="../travel.html?pref=${encodeURIComponent(prefNorm)}">${escapeHtml(prefNorm)}</a>`
    : "";
  return `
    <a href="../index.html">トップ</a>
    <span class="breadcrumb-sep">›</span>
    <a href="../travel.html">旅行記</a>
    ${prefCrumb}
    <span class="breadcrumb-sep">›</span>
    <span aria-current="page">${escapeHtml(title)}</span>
  `.trim();
};

const buildBreadcrumbJson = (title, pref, id) => {
  const prefNorm = normalizePref(pref);
  const items = [
    { name: "トップ", url: `${SITE_URL.replace(/\/$/, "")}/index.html` },
    { name: "旅行記", url: `${SITE_URL.replace(/\/$/, "")}/travel.html` },
  ];
  if (prefNorm) {
    items.push({
      name: prefNorm,
      url: `${SITE_URL.replace(/\/$/, "")}/travel.html?pref=${encodeURIComponent(prefNorm)}`,
    });
  }
  items.push({ name: title, url: postPageUrlAbs(id) });

  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
  return JSON.stringify(json);
};

const buildTagsHtml = (tags) => {
  const arr = Array.isArray(tags) ? tags.map(normalizeTag).filter(Boolean) : [];
  if (arr.length === 0) return "";
  // タグ多すぎ対策：静的記事では表示数を上限 12 に（必要なら調整）
  const trimmed = arr.slice(0, 12);
  return trimmed
    .map(
      (t) => `
      <li class="post-tag">
        <a href="../travel.html?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>
      </li>`
    )
    .join("");
};

const buildBackToList = (pref, tags) => {
  const prefNorm = normalizePref(pref);
  const firstTag = Array.isArray(tags) ? normalizeTag(tags[0]) : "";
  const q = [];
  if (prefNorm) q.push(`pref=${encodeURIComponent(prefNorm)}`);
  if (firstTag) q.push(`tag=${encodeURIComponent(firstTag)}`);
  const qs = q.length ? `?${q.join("&")}` : "";
  return `../travel.html${qs}`;
};

const sortByDateDesc = (arr) => {
  const toKey = (p) => {
    const raw = p?.date ?? p?.publishedAt ?? p?.updatedAt ?? "";
    const m = String(raw).match(/^(\d{4})[.\-](\d{2})[.\-](\d{2})/);
    if (m) return `${m[1]}${m[2]}${m[3]}`;
    return "00000000";
  };
  return [...arr].sort((a, b) => (toKey(b)).localeCompare(toKey(a)));
};

const buildRelatedHtml = (allPosts, current) => {
  const curTags = Array.isArray(current.tags) ? current.tags.map(normalizeTag).filter(Boolean) : [];
  if (curTags.length === 0) return `<p class="related-empty">関連記事はまだありません。</p>`;

  const related = sortByDateDesc(
    allPosts.filter((p) => {
      if (!p || p.id === current.id) return false;
      const tags = Array.isArray(p.tags) ? p.tags.map(normalizeTag).filter(Boolean) : [];
      return tags.some((t) => curTags.includes(t));
    })
  ).slice(0, 3);

  if (related.length === 0) return `<p class="related-empty">関連記事はまだありません。</p>`;

  return related
    .map((p) => {
      const thumb = p.thumbnail ? `<img class="related-thumb" src="${relAssetFromPosts(p.thumbnail)}" alt="${escapeHtml(p.title)}" loading="lazy">` : "";
      const pref = normalizePref(p.prefecture);
      return `
        <article class="related-card">
          <a class="related-link" href="${encodeURIComponent(p.id)}.html">
            ${thumb}
            <div class="related-body">
              <div class="related-meta">
                ${pref ? `<span class="related-pref">${escapeHtml(pref)}</span>` : ""}
                <time class="related-date">${escapeHtml(toYmdDots(p.date))}</time>
              </div>
              <h3 class="related-post-title">${escapeHtml(p.title)}</h3>
            </div>
          </a>
        </article>
      `;
    })
    .join("");
};

// fetch microCMS with pagination
const fetchAllMicroCmsPosts = async () => {
  if (!SERVICE_DOMAIN || !API_KEY) {
    throw new Error("MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が未設定です");
  }

  let offset = 0;
  const all = [];

  while (true) {
    const url = `https://${SERVICE_DOMAIN}.microcms.io/api/v1/${ENDPOINT}?limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": API_KEY } });
    if (!res.ok) throw new Error(`microCMS fetch failed: ${res.status}`);

    const json = await res.json();
    const contents = json?.contents ?? [];
    all.push(...contents);

    if (contents.length < LIMIT) break;
    offset += LIMIT;
  }

  return all;
};

const mapMicroCmsPost = (p) => {
  const id = String(p.id ?? "").trim();
  const title = String(p.title ?? "").trim();
  const dateRaw = p.date ?? p.publishedAt ?? p.createdAt ?? p.updatedAt ?? "";
  const date = toYmdDots(dateRaw);
  const prefecture = p.prefecture ?? "";
  const thumbnail = p.thumbnail ?? p.eyecatch ?? "";
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const excerpt = p.excerpt ?? "";
  const content = p.content ?? p.body ?? "";

  return { id, title, date, prefecture, thumbnail, tags, excerpt, content };
};

if (!fs.existsSync(TEMPLATE_PATH)) {
  throw new Error(`テンプレが見つかりません: ${TEMPLATE_PATH}`);
}

const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
fs.mkdirSync(POSTS_DIR, { recursive: true });

// ---- main ----
const rawPosts = await fetchAllMicroCmsPosts();
const posts = rawPosts.map(mapMicroCmsPost).filter((p) => p.id && p.title);

const sorted = sortByDateDesc(posts);

for (let i = 0; i < sorted.length; i++) {
  const post = sorted[i];

  const canonical = postPageUrlAbs(post.id);
  const excerpt = buildExcerpt(post);

  let ogImage = `${SITE_URL.replace(/\/$/, "")}/img/ogp.jpg`;
  if (post.thumbnail) {
    if (/^https?:\/\//i.test(post.thumbnail)) {
      ogImage = post.thumbnail;
    } else {
      ogImage = `${SITE_URL.replace(/\/$/, "")}/${String(post.thumbnail).replace(/^\.?\//, "")}`;
    }
  }

  // ↓ この下に heroMedia / breadcrumb など続ける


  const heroMedia = post.thumbnail
    ? `<img src="${relAssetFromPosts(post.thumbnail)}" alt="${escapeHtml(post.title)}" loading="lazy">`
    : "";

  const breadcrumbHtml = buildBreadcrumbHtml(post.title, post.prefecture);
  const breadcrumbJson = buildBreadcrumbJson(post.title, post.prefecture, post.id);

  const tagsHtml = buildTagsHtml(post.tags);
  const backToList = buildBackToList(post.prefecture, post.tags);

  const prev = sorted[i - 1];
  const next = sorted[i + 1];

  const prevHref = prev ? `${encodeURIComponent(prev.id)}.html` : "#";
  const nextHref = next ? `${encodeURIComponent(next.id)}.html` : "#";
  const prevLabel = prev ? escapeHtml(prev.title) : "";
  const nextLabel = next ? escapeHtml(next.title) : "";

  const relatedHtml = buildRelatedHtml(posts, post);

  const html = template
    .replaceAll("{{TITLE}}", escapeHtml(post.title))
    .replaceAll("{{DATE}}", escapeHtml(post.date))
    .replaceAll("{{CONTENT_HTML}}", post.content ?? "")
    .replaceAll("{{CANONICAL}}", canonical)
    .replaceAll("{{EXCERPT}}", escapeHtml(excerpt))
    .replaceAll("{{OG_IMAGE}}", ogImage)
    .replaceAll("{{HERO_MEDIA}}", heroMedia)
    .replaceAll("{{TAGS_HTML}}", tagsHtml)
    .replaceAll("{{BREADCRUMB_HTML}}", breadcrumbHtml)
    .replaceAll("{{BREADCRUMB_JSON}}", breadcrumbJson)
    .replaceAll("{{BACK_TO_LIST}}", backToList)
    .replaceAll("{{RELATED_HTML}}", relatedHtml)
    .replaceAll("{{PREV_HREF}}", prev ? prevHref : "#")
    .replaceAll("{{NEXT_HREF}}", next ? nextHref : "#")
    .replaceAll("{{PREV_LABEL}}", prev ? `前：${prevLabel}` : "")
    .replaceAll("{{NEXT_LABEL}}", next ? `次：${nextLabel}` : "");

  fs.writeFileSync(path.join(POSTS_DIR, `${post.id}.html`), html, "utf-8");
}

console.log(`✅ posts generated: ${sorted.length} files -> ${POSTS_DIR}`);
