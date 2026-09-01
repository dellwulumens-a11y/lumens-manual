/* Lumens Manual Center — index.html */
(function () {
  var I18N = window.LumensI18n;
  var DATA = window.LumensData;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;

    document.getElementById("heroTitle").textContent = t.home.heroTitle;
    document.getElementById("heroSubtitle").textContent = t.home.heroSubtitle;

    var form = document.getElementById("heroSearchForm");
    form.action = I18N.urlFor("search.html", lang);
    var input = document.getElementById("heroSearchInput");
    input.placeholder = t.common.searchPlaceholder;

    var iconProduct = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="11" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>';
    var iconType = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';

    document.getElementById("entryProduct").innerHTML =
      '<a class="entry-card highlight" href="' + I18N.urlFor("products.html", lang) + '">' +
        '<span class="icon-box">' + iconProduct + "</span>" +
        '<span class="tag">' + esc(t.nav.byProduct) + "</span>" +
        "<h3>" + esc(t.home.enterByProductTitle) + "</h3>" +
        "<p>" + esc(t.home.enterByProductDesc) + "</p>" +
        '<span class="go">' + esc(t.common.viewProduct) + " →</span>" +
      "</a>";

    document.getElementById("entryType").innerHTML =
      '<a class="entry-card alt" href="' + I18N.urlFor("manual-types.html", lang) + '">' +
        '<span class="icon-box">' + iconType + "</span>" +
        '<span class="tag">' + esc(t.nav.byType) + "</span>" +
        "<h3>" + esc(t.home.enterByTypeTitle) + "</h3>" +
        "<p>" + esc(t.home.enterByTypeDesc) + "</p>" +
        '<span class="go">' + esc(t.common.viewAllDocuments) + " →</span>" +
      "</a>";

    var typeMap = {};
    ctx.types.forEach(function (ty) { typeMap[ty.id] = ty; });
    var catMap = {};
    ctx.categories.forEach(function (c) { catMap[c.id] = c; });

    var recent = ctx.manualsIndex
      .slice()
      .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
      .filter(function (e) { return e.lang === lang; })
      .slice(0, 5);
    if (!recent.length) {
      recent = ctx.manualsIndex.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); }).slice(0, 5);
    }

    var quickWrap = document.getElementById("quickLinks");
    if (recent.length) {
      document.getElementById("quickLinksTitle").textContent = t.home.quickLinksTitle;
      quickWrap.innerHTML = recent.map(function (e) {
        var found = DATA.findProduct(ctx.categories, e.productId);
        var model = found ? found.product.model : e.productId;
        var typeName = typeMap[e.typeId] ? I18N.pickLocale(typeMap[e.typeId].name, lang) : e.typeId;
        var href = I18N.urlFor("manual-viewer.html", lang, { product: e.productId, type: e.typeId, lang: e.lang });
        return (
          '<div class="manual-row">' +
            '<div><div class="title">' + esc(model) + " — " + esc(typeName) + '</div><div class="meta">' + esc(t.common.lastUpdated) + ": " + esc(e.updatedAt || "—") + "</div></div>" +
            '<a class="btn" href="' + href + '">' + esc(t.common.viewProduct) + "</a>" +
          "</div>"
        );
      }).join("");
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("home").then(run);
  });
})();
