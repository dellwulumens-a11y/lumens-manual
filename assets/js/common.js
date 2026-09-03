/* Lumens Manual Center — shared header, footer and language switching.
   Every page includes this after i18n.js and data.js, then calls
   LumensCommon.init(pageKey) once its own DOM is ready.
*/
(function (global) {
  var I18N = global.LumensI18n;
  var DATA = global.LumensData;

  // Cyclic color-coding for category/type cards — position-based (1st, 2nd, ...)
  // rather than tied to a specific id or name, so newly added product lines
  // or manual types automatically pick up a color with no code changes.
  var TAG_COLOR_COUNT = 7;
  function tagColorStyle(index) {
    var n = (index % TAG_COLOR_COUNT) + 1;
    return "--cat-color:var(--tag-" + n + ");--cat-color-soft:var(--tag-" + n + "-soft);";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderHeader(t, lang, pageKey) {
    var nav = [
      { key: "home", href: "index.html", label: t.nav.home },
      { key: "products", href: "products.html", label: t.nav.byProduct },
      { key: "types", href: "manual-types.html", label: t.nav.byType }
    ];
    var navHtml = nav.map(function (n) {
      var current = n.key === pageKey ? ' aria-current="page"' : "";
      return '<a href="' + I18N.urlFor(n.href, lang) + '"' + current + ">" + esc(n.label) + "</a>";
    }).join("");

    var langOptions = I18N.SUPPORTED.map(function (code) {
      var labels = { en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" };
      return '<option value="' + code + '"' + (code === lang ? " selected" : "") + ">" + labels[code] + "</option>";
    }).join("");

    return (
      '<div class="bar container">' +
        '<a class="logo" href="' + I18N.urlFor("index.html", lang) + '">' +
          '<span class="mark">L</span>' +
          '<span>Lumens<small>' + esc(t.site.tagline) + "</small></span>" +
        "</a>" +
        '<nav class="main-nav" id="mainNav">' + navHtml + "</nav>" +
        '<button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">' +
          '<svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" stroke-width="1.6"/></svg>' +
        "</button>" +
        '<div class="header-tools">' +
          '<form class="header-search" action="' + I18N.urlFor("search.html", lang) + '" role="search">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '<input type="search" name="q" placeholder="' + esc(t.common.searchPlaceholder) + '" aria-label="' + esc(t.search.inputLabel) + '">' +
          "</form>" +
          '<div class="lang-switch">' +
            '<select id="langSelect" aria-label="' + esc(t.common.language) + '">' + langOptions + "</select>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderFooter(t, lang, categories, types) {
    var catLinks = (categories || []).map(function (c) {
      return '<li><a href="' + I18N.urlFor("products.html", lang, { category: c.id }) + '">' + esc(I18N.pickLocale(c.name, lang)) + "</a></li>";
    }).join("");
    var typeLinks = (types || []).map(function (ty) {
      return '<li><a href="' + I18N.urlFor("manual-type-detail.html", lang, { type: ty.id }) + '">' + esc(I18N.pickLocale(ty.name, lang)) + "</a></li>";
    }).join("");

    return (
      '<div class="container">' +
        '<div class="footer-grid">' +
          "<div>" +
            '<h5>' + esc(t.site.name) + "</h5>" +
            '<p style="color:var(--ink-soft); font-size:13.5px; max-width:36ch;">' + esc(t.site.tagline) + "</p>" +
          "</div>" +
          "<div><h5>" + esc(t.footer.productLine) + '</h5><ul>' + catLinks + "</ul></div>" +
          "<div><h5>" + esc(t.footer.documentType) + '</h5><ul>' + typeLinks + "</ul></div>" +
        "</div>" +
        '<div class="footer-note">' + esc(t.footer.note) + "</div>" +
      "</div>"
    );
  }

  function wireHeader(lang) {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    var select = document.getElementById("langSelect");
    if (select) {
      select.addEventListener("change", function () {
        I18N.setLang(select.value);
        var url = new URL(global.location.href);
        url.searchParams.set("lang", select.value);
        global.location.href = url.pathname.split("/").pop() + url.search;
      });
    }
  }

  /**
   * Renders header/footer, resolves language + UI strings + shared data,
   * and returns { t, lang, categories, types, manualsIndex } for the page's
   * own render function to use.
   */
  function init(pageKey) {
    var lang = I18N.getLang();
    document.documentElement.lang = lang;

    return Promise.all([
      I18N.load(lang),
      DATA.getCategories(),
      DATA.getTypes(),
      DATA.getManualsIndex()
    ]).then(function (res) {
      var t = res[0], categories = res[1], types = res[2], manualsIndex = res[3];

      var headerEl = document.getElementById("site-header");
      if (headerEl) headerEl.innerHTML = renderHeader(t, lang, pageKey);
      var footerEl = document.getElementById("site-footer");
      if (footerEl) footerEl.innerHTML = renderFooter(t, lang, categories, types);
      wireHeader(lang);

      var titleEl = document.querySelector("title[data-i18n-site-name]");
      if (titleEl) titleEl.textContent = t.site.name;

      return { t: t, lang: lang, categories: categories, types: types, manualsIndex: manualsIndex, esc: esc };
    });
  }

  global.LumensCommon = { init: init, esc: esc, tagColorStyle: tagColorStyle };
})(window);
