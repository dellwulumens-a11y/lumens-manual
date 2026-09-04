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
    var socialLinks = [
      { label: "Facebook", href: "https://www.facebook.com/Lumensinc/", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v3H6v4h3v8h4v-8h3l1-4h-4V9c0-.7.3-1 1-1z"/></svg>' },
      { label: "Twitter", href: "https://twitter.com/LumensLadibug", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.95 4.57a9.8 9.8 0 0 1-2.83.78 4.94 4.94 0 0 0 2.17-2.72 9.86 9.86 0 0 1-3.13 1.2 4.92 4.92 0 0 0-8.39 4.48A13.97 13.97 0 0 1 1.67 3.15a4.9 4.9 0 0 0 1.52 6.57 4.9 4.9 0 0 1-2.23-.62v.06a4.92 4.92 0 0 0 3.95 4.83 4.93 4.93 0 0 1-2.22.08 4.93 4.93 0 0 0 4.6 3.42A9.88 9.88 0 0 1 0 19.54a13.94 13.94 0 0 0 7.55 2.21c9.06 0 14.01-7.5 14.01-14.01 0-.21 0-.42-.01-.63a10 10 0 0 0 2.4-2.54z"/></svg>' },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/lumens-digital-optics/", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.1 8.5H1.7V22h3.4V8.5zM3.4 3A2 2 0 1 0 3.4 7a2 2 0 0 0 0-4zM8.8 8.5h3.3v1.85h.05c.46-.87 1.58-2.25 3.88-2.25 4.15 0 4.92 2.73 4.92 6.28V22h-3.4v-6.75c0-1.61-.03-3.68-2.24-3.68-2.25 0-2.6 1.76-2.6 3.56V22H8.8V8.5z"/></svg>' },
      { label: "YouTube", href: "https://www.youtube.com/channel/UCOckQhSUhLgaAi0Jnsre6wA?sub_confirmation=1", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.7V8.3l6.3 3.7-6.3 3.7z"/></svg>' }
    ];
    var socialHtml = socialLinks.map(function (social) {
      return '<a href="' + social.href + '" aria-label="' + social.label + '" target="_blank" rel="noopener noreferrer">' + social.icon + '</a>';
    }).join("");
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
      '<div class="header-top container">' +
        '<div class="social-links">' + socialHtml + '</div>' +
        '<div class="header-utility"><a href="https://www.mylumens.com/en/ContactSales">Contact Sales</a><a href="https://www.mylumens.com/en/WheretoBuy">Where to Buy</a></div>' +
      '</div>' +
      '<div class="bar container">' +
        '<a class="logo" href="' + I18N.urlFor("index.html", lang) + '" aria-label="Lumens Manual Center">' +
          '<img src="https://www.mylumens.com/frontdesk/img/logo.png?s=1" alt="Lumens">' +
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
