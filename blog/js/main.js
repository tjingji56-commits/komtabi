/* =========================
   data load
========================= */
const posts = Array.isArray(window.POSTS) ? window.POSTS : [];
const courses = Array.isArray(window.COURSES) ? window.COURSES : [];
const OFFICIAL_VISITED_PREFECTURES = Array.isArray(window.OFFICIAL_VISITED_PREFECTURES)
  ? window.OFFICIAL_VISITED_PREFECTURES
  : [];

/* =========================
   menu (hamburger)
========================= */
(() => {
  const btn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  if (!btn || !menu) return;

  const closeMenu = () => {
    btn.classList.remove("open");
    menu.classList.remove("open");
    document.body.style.overflow = "";
  };

  const openMenu = () => {
    btn.classList.add("open");
    menu.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  btn.addEventListener("click", () => {
    const isOpen = menu.classList.contains("open");
    if (isOpen) closeMenu();
    else openMenu();
  });

  // 背景クリックで閉じる
  menu.addEventListener("click", (e) => {
    if (e.target === menu) closeMenu();
  });

  // ESCで閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // メニュー内リンクを押したら閉じる
  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => closeMenu());
  });
})();

/* =========================
   utils
========================= */
const toDateValue = (s) => {
  try {
    if (!s) return 0;
    const str = String(s).trim();
    // 互換性重視：replaceAll を使わずに置換
    const iso = str.indexOf(".") !== -1 ? str.replace(/\./g, "-") : str;
    const t = Date.parse(iso);
    return isFinite(t) ? t : 0;
  } catch (e) {
    console.warn("toDateValue failed:", s, e);
    return 0;
  }
};

const sortByDateDesc = (arr) => {
  const list = Array.isArray(arr) ? arr : [];
  return list.slice().sort((a, b) => toDateValue(b && b.date) - toDateValue(a && a.date));
};

const normalizeTag = (t) => (t == null ? "" : String(t).trim());

const normalizePref = (name) => {
  if (!name) return "";
  let s = String(name).trim();
  s = s.replace(/\s+/g, "");
  // 末尾の 都/道/府/県 は外す（表示は県名だけで統一）
  s = s.replace(/(都|道|府|県)$/, "");

  const alias = {
    さいたま: "埼玉",
    サイタマ: "埼玉",
    とうきょう: "東京",
    トウキョウ: "東京",
    おおさか: "大阪",
    オオサカ: "大阪",
    ほっかいどう: "北海道",
    ホッカイドウ: "北海道",
  };

  if (alias[s]) s = alias[s];
  return s;
};

const isTopPage = () => {
  const path = location.pathname;
  return (
    path.endsWith("index.html") ||
    path === "/" ||
    path === "" ||
    path.endsWith("/")
  );
};

const postHasTag = (post, tag) => {
  if (!tag) return true;
  if (!post || !Array.isArray(post.tags)) return false;
  const tags = post.tags.map(normalizeTag).filter(Boolean);
  return tags.indexOf(tag) !== -1;
};

const buildTravelUrl = (prefRaw, tag) => {
  const u = new URL(location.href);
  u.searchParams.delete("pref");
  u.searchParams.delete("tag");

  if (prefRaw) u.searchParams.set("pref", prefRaw);
  if (tag) u.searchParams.set("tag", tag);

  // travel.html に正規化（indexなどからでも想定通りに）
  u.pathname = u.pathname.replace(/[^/]*$/, "travel.html");
  return u.toString();
};

const renderTagChips = (opts) => {
  const prefRaw = opts && opts.prefRaw ? opts.prefRaw : "";
  const prefNorm = opts && opts.prefNorm ? opts.prefNorm : "";
  const activeTag = opts && opts.activeTag ? opts.activeTag : "";

  const tagChipsEl = document.getElementById("tagChips");
  if (!tagChipsEl) return;

  tagChipsEl.innerHTML = "";

  // pref を選んでいるなら、その県の記事だけでタグ件数を作る
  const basePosts = prefNorm
    ? posts.filter((p) => normalizePref(p && p.prefecture) === prefNorm)
    : posts;

  const map = new Map();
  basePosts.forEach((p) => {
    if (!p || !Array.isArray(p.tags)) return;
    p.tags.forEach((t) => {
      const tag = normalizeTag(t);
      if (!tag) return;
      map.set(tag, (map.get(tag) || 0) + 1);
    });
  });

  const tags = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ja"));

  // 「すべて」
  const allBtn = document.createElement("a");
  allBtn.className = "tag-chip" + (activeTag ? "" : " active");
  allBtn.href = buildTravelUrl(prefRaw, "");
  allBtn.textContent = "すべて";
  tagChipsEl.appendChild(allBtn);

  tags.forEach(([tag, count]) => {
    const a = document.createElement("a");
    a.className = "tag-chip" + (tag === activeTag ? " active" : "");
    a.href = buildTravelUrl(prefRaw, tag);
    a.textContent = `#${tag} (${count})`;
    tagChipsEl.appendChild(a);
  });
};

/* =========================
   index.html / travel.html
   post list
========================= */
(() => {
  const postList = document.getElementById("postList");
  if (!postList) return;

  const params = new URLSearchParams(location.search);

  const selectedPrefRaw = (params.get("pref") || "").trim();
  const selectedPref = normalizePref(selectedPrefRaw);

  const selectedTag = normalizeTag(params.get("tag") || "");
  const hasTag = !!selectedTag;

  const sortedPosts = sortByDateDesc(posts);

  // 絞り込み
  let displayPosts = sortedPosts;

  if (selectedPref) {
    displayPosts = displayPosts.filter((p) => normalizePref(p && p.prefecture) === selectedPref);
  }
  if (hasTag) {
    displayPosts = displayPosts.filter((p) => postHasTag(p, selectedTag));
  }

  const top = isTopPage();

  // ✅ トップは最新3件 + グリッド
  if (top) {
    postList.classList.add("post-list-grid");
    displayPosts = displayPosts.slice(0, 3);
  }

  // タグチップ（travel 用）
  renderTagChips({
    prefRaw: selectedPrefRaw,
    prefNorm: selectedPref,
    activeTag: selectedTag,
  });

  // タイトル表示（travel）
  const titleEl = document.querySelector(".page-title");
  if (titleEl && !top) {
    if (selectedPref && hasTag) {
      titleEl.textContent = `#${selectedPref} × #${selectedTag} の旅行記`;
    } else if (selectedPref) {
      titleEl.textContent = `#${selectedPref}の旅行記`;
    } else if (hasTag) {
      titleEl.textContent = `#${selectedTag}の旅行記`;
    }
  }

  // 県メタ情報（pref のときだけ表示）
  const meta = document.getElementById("prefMeta");
  if (meta) {
    meta.style.display = selectedPref ? "block" : "none";

    if (selectedPref) {
      const visitedSet = new Set(OFFICIAL_VISITED_PREFECTURES.map(normalizePref));
      const isVisited = visitedSet.has(selectedPref);

      const badge = document.getElementById("prefBadge");
      if (badge) {
        badge.textContent = isVisited ? "✅ 制覇済み" : "🕒 未制覇";
        badge.className = "pref-badge" + (isVisited ? " ok" : "");
      }

      const stat = document.getElementById("prefStat");
      if (stat) stat.textContent = `記事数：${displayPosts.length}件`;

      const latest = document.getElementById("prefLatest");
      if (latest) latest.textContent = `最新：${(displayPosts[0] && displayPosts[0].date) || "-"}`;
    }
  }

  // ✅ travel.html?pref= の「この県のモデルコース」
  const prefCourses = document.getElementById("prefCourses");
  const prefCourseList = document.getElementById("prefCourseList");
  const prefCourseMeta = document.getElementById("prefCourseMeta");

  if (prefCourses && prefCourseList) {
    if (!selectedPref) {
      prefCourses.style.display = "none";
    } else {
      const relatedCourses = courses.filter((c) => {
        const ps = (c && c.prefectures) ? c.prefectures : [];
        return Array.isArray(ps) && ps.map(normalizePref).indexOf(selectedPref) !== -1;
      });

      if (relatedCourses.length > 0) {
        prefCourses.style.display = "block";
        if (prefCourseMeta) prefCourseMeta.textContent = `${relatedCourses.length}件`;

        prefCourseList.innerHTML = relatedCourses
          .map((c) => {
            const prefText = ((c && c.prefectures) ? c.prefectures : [])
              .map(normalizePref)
              .filter(Boolean)
              .join("・");

            return `
              <article class="pref-course-card">
                <h3 class="pref-course-title">${c.title || ""}</h3>
                <div class="pref-course-meta">${c.days || ""} / ${c.area || ""} / ${prefText}</div>
                <p class="pref-course-desc">${c.desc || ""}</p>
              </article>
            `;
          })
          .join("");
      } else {
        prefCourses.style.display = "none";
      }
    }
  }

  // 描画
  postList.innerHTML = "";
  displayPosts.forEach((post) => {
    const pref = normalizePref(post && post.prefecture);
    const article = document.createElement("article");
    article.className = "post-card";

    const thumbHtml = post && post.thumbnail
      ? `
        <a href="post.html?id=${encodeURIComponent(post.id)}" class="post-thumb">
          <img src="${post.thumbnail}" alt="${post.title || ""}" loading="lazy">
        </a>`
      : "";

    article.innerHTML = `
      ${thumbHtml}
      <div class="post-head">
        <a class="post-pref" href="travel.html?pref=${encodeURIComponent(pref)}">${pref}</a>
        <time class="post-date">${post.date || ""}</time>
      </div>

      <h2 class="post-title">
        <a href="posts/${encodeURIComponent(post.id)}.html">${post.title || ""}</a>
      </h2>

      <p class="post-excerpt">${post.excerpt || ""}</p>
    `;

    postList.appendChild(article);
  });
})();
/* =========================
   index.html achievement (47 prefectures)
========================= */
(() => {
  const countEl = document.getElementById("visitedCount");
  const rateEl = document.getElementById("visitedRate");
  const latestEl = document.getElementById("latestVisitedPref");
  const chipsEl = document.getElementById("visitedChips");

  // index.html にしか無い要素なので、無ければ何もしない
  if (!countEl && !rateEl && !latestEl && !chipsEl) return;

  const visitedNormList = (Array.isArray(OFFICIAL_VISITED_PREFECTURES) ? OFFICIAL_VISITED_PREFECTURES : [])
    .map(normalizePref)
    .filter(Boolean);

  // 重複除去（念のため）
  const visitedUnique = Array.from(new Set(visitedNormList));
  const visitedSet = new Set(visitedUnique);

  const count = visitedUnique.length;
  const rate = Math.round((count / 47) * 100);

  if (countEl) countEl.textContent = String(count);
  if (rateEl) rateEl.textContent = String(rate);

  // 「最近の制覇」：旅行記の最新順で、制覇済み県が出てきた最初の県
  let latest = "-";
  const sorted = sortByDateDesc(posts);
  for (const p of sorted) {
    const pref = normalizePref(p && p.prefecture);
    if (pref && visitedSet.has(pref)) {
      latest = pref;
      break;
    }
  }
  // 旅行記がまだ無い場合は、公式リストの最後
  if (latest === "-" && visitedUnique.length) latest = visitedUnique[visitedUnique.length - 1];

  if (latestEl) latestEl.textContent = latest;

  // チップ（制覇済みの県）→ travel.html?pref= にリンク
  if (chipsEl) {
    chipsEl.innerHTML = "";
    visitedUnique.forEach((pref) => {
      const a = document.createElement("a");
      a.href = `travel.html?pref=${encodeURIComponent(pref)}`;
      a.textContent = pref;
      chipsEl.appendChild(a);
    });
  }
})();

/* =========================
   post.html
   detail + hero + prev/next + breadcrumb + related
========================= */
(() => {
  const postTitleEl = document.getElementById("postTitle");
  if (!postTitleEl) return;

  const params = new URLSearchParams(location.search);
  const postId = params.get("id");

  if (!postId) {
  // 直アクセス対策：旅行記一覧へ
  location.replace("travel.html");
  return;
}

  const sortedPosts = sortByDateDesc(posts);
  const index = sortedPosts.findIndex((p) => p && p.id === postId);
  const post = sortedPosts[index];

  if (!post) {
    console.warn("post not found:", postId);
    return;
  }

  // ===== 基本表示 =====
  postTitleEl.textContent = post.title || "";
  document.title = `${post.title || "記事"} | #コム旅`;

  const dateEl = document.getElementById("postDate");
  const contentEl = document.getElementById("postContent");
  if (dateEl) dateEl.textContent = post.date || "";
  if (contentEl) contentEl.innerHTML = post.content || "";
    // ===== AdSense（本文末：短文は非表示）=====
  const adWrap = document.getElementById("ad-post-bottom");
  if (adWrap) {
    const plain = String(post.content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (plain.length >= 800) {
      adWrap.classList.remove("is-hidden");
      initAdsense(adWrap); // この枠だけpush
    } else {
      adWrap.classList.add("is-hidden");
    }
  }


  // ===== SEO/OGP/canonical/description =====
  const SITE_ORIGIN = location.origin;
  const postUrl = `${SITE_ORIGIN}/post.html?id=${encodeURIComponent(post.id)}`;

  const safeExcerpt =
    (post.excerpt && String(post.excerpt).trim()) ||
    String(post.content || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 110) ||
    "#コム旅の記事。旅の記録を写真と一緒にまとめています。";

  const setAttr = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
  };
  const setContent = (selector, value) => setAttr(selector, "content", value);

  setAttr("#canonicalLink", "href", postUrl);
  setAttr("#metaDesc", "content", safeExcerpt);

  setContent("#ogUrl", postUrl);
  setContent("#ogTitle", `${post.title || "記事"} | #コム旅`);
  setContent("#ogDesc", safeExcerpt);

  setContent("#twTitle", `${post.title || "記事"} | #コム旅`);
  setContent("#twDesc", safeExcerpt);

  const imgAbs = (src) => {
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith("/")) return `${SITE_ORIGIN}${src}`;
    return `${SITE_ORIGIN}/${src}`;
  };

  const ogImageUrl = imgAbs(post.thumbnail) || `${SITE_ORIGIN}/img/ogp.jpg`;
  setContent("#ogImage", ogImageUrl);
  setContent("#twImage", ogImageUrl);

  // ===== ヒーロー =====
  const hero = document.getElementById("postHero");
  const heroMedia = hero ? hero.querySelector(".post-hero-media") : null;
  if (hero && heroMedia && post.thumbnail) {
    heroMedia.innerHTML = `<img src="${post.thumbnail}" alt="${post.title || ""}" loading="lazy">`;
    hero.style.display = "block";
  } else if (hero) {
    hero.style.display = "none";
  }

  // ===== 記事タグ =====
  const postTagsEl = document.getElementById("postTags");
  const postTags = Array.isArray(post.tags) ? post.tags.map(normalizeTag).filter(Boolean) : [];

  if (postTagsEl) {
    postTagsEl.innerHTML = postTags
      .map((tag) => `
        <li class="post-tag">
          <a href="travel.html?tag=${encodeURIComponent(tag)}">#${tag}</a>
        </li>
      `)
      .join("");
  }

  // ===== パンくず（表示 + JSON-LD）=====
  const breadcrumbEl = document.getElementById("breadcrumb");
  const breadcrumbJsonEl = document.getElementById("breadcrumbJson");

  const prefNorm = normalizePref(post.prefecture);
  const travelPrefUrl = `travel.html?pref=${encodeURIComponent(prefNorm)}`;

  if (breadcrumbEl) {
    breadcrumbEl.innerHTML = `
      <a href="index.html">トップ</a>
      <span class="breadcrumb-sep">›</span>
      <a href="travel.html">旅行記</a>
      ${
        prefNorm
          ? `<span class="breadcrumb-sep">›</span><a href="${travelPrefUrl}">${prefNorm}</a>`
          : ""
      }
      <span class="breadcrumb-sep">›</span>
      <span aria-current="page">${post.title || ""}</span>
    `;
  }

  if (breadcrumbJsonEl) {
    const itemList = [
      { name: "トップ", url: `${SITE_ORIGIN}/index.html` },
      { name: "旅行記", url: `${SITE_ORIGIN}/travel.html` },
    ];

    if (prefNorm) {
      itemList.push({
        name: prefNorm,
        url: `${SITE_ORIGIN}/travel.html?pref=${encodeURIComponent(prefNorm)}`,
      });
    }

    itemList.push({ name: post.title || "記事", url: postUrl });

    const json = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: itemList.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };

    breadcrumbJsonEl.textContent = JSON.stringify(json);
  }

 // ===== 「一覧に戻る」導線（pref + 先頭tag で戻す）=====
const backToList = document.getElementById("backToList");
const backToListBottom = document.getElementById("backToListBottom");

if (backToList || backToListBottom) {
  const firstTag = postTags.length ? postTags[0] : "";
  const url = buildTravelUrl(prefNorm, firstTag);

  if (backToList) backToList.href = url;
  if (backToListBottom) backToListBottom.href = url;
}
 
  // ===== 関連記事（共通タグが1つでもあれば候補）=====
  const relatedEl = document.getElementById("relatedPosts");
  if (relatedEl) {
    const related = sortByDateDesc(
      posts.filter((p) => {
        if (!p || p.id === post.id) return false;
        const tags = Array.isArray(p.tags) ? p.tags.map(normalizeTag).filter(Boolean) : [];
        return postTags.length > 0 && tags.some((t) => postTags.indexOf(t) !== -1);
      })
    ).slice(0, 3);

    if (related.length === 0) {
      relatedEl.innerHTML = `<p class="related-empty">関連記事はまだありません。</p>`;
    } else {
      relatedEl.innerHTML = related
        .map((p) => {
          const pref = normalizePref(p.prefecture);
          const tags = Array.isArray(p.tags) ? p.tags.map(normalizeTag).filter(Boolean) : [];
          const miniTags = tags.slice(0, 3)
            .map((t) => `<a href="travel.html?tag=${encodeURIComponent(t)}">#${t}</a>`)
            .join(" ");

          return `
            <article class="related-card">
              <a class="related-link" href="posts/${encodeURIComponent(p.id)}.html">
                ${p.thumbnail ? `<img class="related-thumb" src="${p.thumbnail}" alt="${p.title || ""}" loading="lazy">` : ""}
                <div class="related-body">
                  <div class="related-meta">
                    ${pref ? `<span class="related-pref">${pref}</span>` : ""}
                    <time class="related-date">${p.date || ""}</time>
                  </div>
                  <h3 class="related-post-title">${p.title || ""}</h3>
                  <div class="related-tags">${miniTags}</div>
                </div>
              </a>
            </article>
          `;
        })
        .join("");
    }
  }

  // ===== 前後記事ナビ =====
  const buildNav = (p, label) => {
    const pref = normalizePref(p.prefecture);
    return `
      <span class="nav-thumb">
        ${p.thumbnail ? `<img src="${p.thumbnail}" alt="${p.title || ""}">` : ""}
      </span>
      <div class="nav-body">
        <span class="nav-label">${label}</span>
        <span class="nav-pref">${pref}</span>
        <span class="nav-title">${p.title || ""}</span>
      </div>
    `;
  };

  const prevLink = document.getElementById("prevPost");
  const nextLink = document.getElementById("nextPost");

  if (prevLink) {
    const prev = sortedPosts[index - 1];
    if (prev) {
      prevLink.href = `posts/${encodeURIComponent(prev.id)}.html`;      prevLink.innerHTML = buildNav(prev, "前の記事");
      prevLink.style.display = "";
    } else {
      prevLink.style.display = "none";
    }
  }

  if (nextLink) {
    const next = sortedPosts[index + 1];
    if (next) {
      nextLink.href = `post.html?id=${encodeURIComponent(next.id)}`;
      nextLink.innerHTML = buildNav(next, "次の記事");
      nextLink.style.display = "";
    } else {
      nextLink.style.display = "none";
    }
  }
})();

/* =========================
   prefectures.html map
========================= */
(() => {
  const japanMap = document.getElementById("japanMap");
  if (!japanMap) return;

  const visitedSet = new Set(OFFICIAL_VISITED_PREFECTURES.map(normalizePref));

  const prefCount = new Map();
  posts.forEach((p) => {
    const k = normalizePref(p && p.prefecture);
    if (!k) return;
    prefCount.set(k, (prefCount.get(k) || 0) + 1);
  });

  let tooltip = document.getElementById("mapTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "mapTooltip";
    document.body.appendChild(tooltip);
  }

  const paths = japanMap.querySelectorAll("path");
  paths.forEach((path) => {
    const name = normalizePref(path.dataset ? path.dataset.name : "");
    if (!name) return;

    if (visitedSet.has(name)) {
      path.classList.add("visited");
      path.style.cursor = "pointer";

      path.addEventListener("mouseenter", () => {
        tooltip.textContent = `${name}：${prefCount.get(name) || 0}件`;
        tooltip.classList.add("show");
      });
      path.addEventListener("mousemove", (e) => {
        tooltip.style.left = `${e.clientX + 12}px`;
        tooltip.style.top = `${e.clientY + 12}px`;
      });
      path.addEventListener("mouseleave", () => {
        tooltip.classList.remove("show");
      });
      path.addEventListener("click", () => {
        location.href = `travel.html?pref=${encodeURIComponent(name)}`;
      });
    } else {
      path.style.pointerEvents = "none";
    }
  });
})();

/* =========================
   modelcourse.html
========================= */
(() => {
  const courseList = document.getElementById("courseList");
  const areaFilter = document.getElementById("areaFilter");
  if (!courseList) return;

  const renderCourses = (area) => {
    courseList.innerHTML = "";

    const filtered = area === "all"
      ? courses
      : courses.filter((c) => c && c.area === area);

    filtered.forEach((course) => {
      const div = document.createElement("article");
      div.className = "course-card";

      const prefSet = new Set(((course && course.prefectures) ? course.prefectures : []).map(normalizePref));
      const relatedPosts = sortByDateDesc(
        posts.filter((p) => prefSet.has(normalizePref(p && p.prefecture)))
      );

      const relatedHtml =
        relatedPosts.length === 0
          ? `<p class="course-related-empty">関連する旅行記はありません</p>`
          : `
            <ul class="course-related">
              ${relatedPosts
                .map((p) => `<li><a href="posts/${encodeURIComponent(p.id)}.html">${p.title || ""}</a></li>`)
                .join("")}
            </ul>
          `;

      div.innerHTML = `
        <h2 class="course-title">${course.title || ""}</h2>
        <div class="course-meta">${course.days || ""} / ${course.area || ""}</div>
        <p class="course-desc">${course.desc || ""}</p>
        <div class="course-related-wrap">
          <h3 class="course-related-title">関連する旅行記</h3>
          ${relatedHtml}
        </div>
      `;

      courseList.appendChild(div);
    });
  };

  renderCourses("all");

  if (areaFilter) {
    const buttons = areaFilter.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderCourses(btn.dataset ? btn.dataset.area : "all");
      });
    });
  }
})();

/* =========================
   tags.html (tag list)
========================= */
(() => {
  const tagListEl = document.getElementById("tagList");
  if (!tagListEl) return;

  const map = new Map();
  posts.forEach((p) => {
    if (!p || !Array.isArray(p.tags)) return;
    p.tags.forEach((t) => {
      const tag = String(t).trim();
      if (!tag) return;
      map.set(tag, (map.get(tag) || 0) + 1);
    });
  });

  const tags = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ja"));

  tagListEl.innerHTML = tags
    .map(([tag, count]) => {
      return `
        <a class="tag-card" href="travel.html?tag=${encodeURIComponent(tag)}">
          <span class="tag-card-name">#${tag}</span>
          <span class="tag-card-count">${count}件</span>
        </a>
      `;
    })
    .join("");
})();

function initAdsense(root = document) {
  const adUnits = root.querySelectorAll("ins.adsbygoogle");
  if (!adUnits.length) return;

  adUnits.forEach((unit) => {
    if (unit.getAttribute("data-adsbygoogle-status") === "done") return;

    const wrap = unit.closest(".ad-wrap");
    if (wrap && (wrap.classList.contains("is-hidden") || wrap.style.display === "none")) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("Adsense push failed:", e);
    }
  });
}

