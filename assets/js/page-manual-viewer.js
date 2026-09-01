/* Lumens Manual Center — manual-viewer.html
   Loads a manual's HTML fragment at runtime, builds a table of contents
   from its headings, and offers print / save-as-PDF via the browser's
   native print dialog (see @media print in style.css).
*/
(function () {
  var I18N = window.LumensI18n;
  var DATA = window.LumensData;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    var params = new URL(location.href).searchParams;
    var productId = params.get("product");
    var typeId = params.get("type");
    var wantLang = params.get("lang") || lang;

    var found = DATA.findProduct(ctx.categories, productId);
    var type = DATA.findType(ctx.types, typeId);
    var body = document.getElementById("viewerBody");

    if (!found || !type) {
      body.innerHTML = '<p class="state-msg">' + esc(t.common.loadError) + "</p>";
      return;
    }
    var product = found.product, category = found.category;

    var availableLangs = DATA.langsForManual(ctx.manualsIndex, productId, typeId);
    var entry = DATA.manualEntry(ctx.manualsIndex, productId, typeId, wantLang);
    if (!entry && availableLangs.length) {
      // fall back to any available language rather than a dead page
      entry = DATA.manualEntry(ctx.manualsIndex, productId, typeId, availableLangs[0]);
      wantLang = availableLangs[0];
    }

    // breadcrumb
    var bc = document.getElementById("breadcrumbTrail");
    bc.innerHTML =
      '<a href="' + I18N.urlFor("products.html", lang) + '">' + esc(t.breadcrumb.products) + "</a>" +
      '<span class="sep">/</span>' +
      '<a href="' + I18N.urlFor("products.html", lang, { category: category.id }) + '">' + esc(I18N.pickLocale(category.name, lang)) + "</a>" +
      '<span class="sep">/</span>' +
      '<a href="' + I18N.urlFor("product-detail.html", lang, { id: product.id }) + '">' + esc(product.model) + "</a>" +
      '<span class="sep">/</span>' +
      '<span class="current">' + esc(I18N.pickLocale(type.name, lang)) + "</span>";

    if (!entry) {
      document.getElementById("docTitle").textContent = product.model + " — " + I18N.pickLocale(type.name, lang);
      body.innerHTML = '<div class="empty-note">' + esc(t.common.noDocumentsYet) + "</div>";
      return;
    }

    document.getElementById("docTitle").textContent = entry.title;
    document.getElementById("docMeta").textContent = t.common.lastUpdated + ": " + (entry.updatedAt || "—");
    document.title = entry.title + " · " + t.site.name;

    // language tabs
    var tabsWrap = document.getElementById("langTabs");
    tabsWrap.innerHTML = I18N.SUPPORTED.map(function (code) {
      var has = availableLangs.indexOf(code) !== -1;
      var active = code === wantLang ? " active" : "";
      var disabled = has ? "" : " disabled";
      var href = has ? I18N.urlFor("manual-viewer.html", lang, { product: productId, type: typeId, lang: code }) : "#";
      var label = { en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" }[code];
      return '<a href="' + href + '" class="' + active.trim() + " " + disabled.trim() + '">' + label + "</a>";
    }).join("");

    // actions
    document.getElementById("printBtn").textContent = t.common.print;
    document.getElementById("pdfBtn").textContent = t.common.downloadPdf;
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
    document.getElementById("pdfBtn").addEventListener("click", function () { window.print(); });

    // related manuals
    var others = ctx.manualsIndex.filter(function (m) { return m.productId === productId && m.typeId !== typeId; });
    var otherTypeIds = Array.from(new Set(others.map(function (m) { return m.typeId; })));
    var relatedWrap = document.getElementById("relatedManuals");
    if (otherTypeIds.length) {
      document.getElementById("relatedTitle").textContent = t.common.relatedManuals;
      relatedWrap.innerHTML = otherTypeIds.map(function (tid) {
        var ty = DATA.findType(ctx.types, tid);
        var langs = DATA.langsForManual(ctx.manualsIndex, productId, tid);
        var preferred = langs.indexOf(lang) !== -1 ? lang : langs[0];
        var href = I18N.urlFor("manual-viewer.html", lang, { product: productId, type: tid, lang: preferred });
        return '<a href="' + href + '" style="display:block; padding:8px 0; font-size:13.5px; font-weight:600;">' + esc(I18N.pickLocale(ty.name, lang)) + "</a>";
      }).join("");
    }

    document.getElementById("switchToTypeView").href = I18N.urlFor("manual-type-detail.html", lang, { type: typeId });
    document.getElementById("switchToTypeView").textContent = t.common.switchView;

    // load content, then build TOC
    var contentEl = document.getElementById("manualContent");
    contentEl.innerHTML = '<div class="skeleton" style="height:18px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:14px;width:90%;margin-bottom:8px;"></div><div class="skeleton" style="height:14px;width:80%;"></div>';

    fetch(entry.path).then(function (r) {
      if (!r.ok) throw new Error("not found");
      return r.text();
    }).then(function (html) {
      contentEl.innerHTML = html;
      buildToc(contentEl);
    }).catch(function () {
      contentEl.innerHTML = '<p class="state-msg">' + esc(t.common.loadError) + "</p>";
    });
  }

  function buildToc(contentEl) {
    var headings = contentEl.querySelectorAll("h2[id]");
    var tocDesktop = document.getElementById("tocListDesktop");
    var tocMobile = document.getElementById("tocListMobile");
    var tocWrapDesktop = document.getElementById("tocDesktop");
    var tocWrapMobile = document.getElementById("tocMobile");

    if (!headings.length) {
      if (tocWrapDesktop) tocWrapDesktop.style.display = "none";
      if (tocWrapMobile) tocWrapMobile.style.display = "none";
      return;
    }

    var items = Array.prototype.map.call(headings, function (h) {
      return '<li><a href="#' + h.id + '">' + h.textContent + "</a></li>";
    }).join("");
    if (tocDesktop) tocDesktop.innerHTML = items;
    if (tocMobile) tocMobile.innerHTML = items;

    var links = document.querySelectorAll("#tocDesktop a");
    if (links.length && "IntersectionObserver" in window) {
      var map = {};
      links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var link = map[en.target.id];
          if (!link) return;
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove("active"); });
            link.classList.add("active");
          }
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("products").then(run);
  });
})();
