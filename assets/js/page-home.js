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
    input.setAttribute("aria-label", t.search.inputLabel);
    form.querySelector("button").textContent = t.common.searchButton;

    // Small icon-chip row shown on each entry card — decorative shortcuts
    // that echo the card's sub-categories, not data-bound to live counts.
    var chipCamera = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="11" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>';
    var chipBox = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="12" rx="2"/><path d="M9 20h6M12 17v3"/></svg>';
    var chipLens = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="12" cy="11" r="3.2"/></svg>';
    var chipGuide = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
    var chipInstall = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V7l8-4 8 4v13"/><path d="M9 20v-6h6v6"/></svg>';
    var chipQuick = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z"/></svg>';

    document.getElementById("entryProduct").innerHTML =
      '<a class="entry-card" href="' + I18N.urlFor("products.html", lang) + '">' +
        '<span class="entry-photo"><img src="assets/images/home/entry-product-highlight.png" alt="" loading="lazy"></span>' +
        '<span class="badge">' + esc(t.nav.byProduct) + "</span>" +
        "<h3>" + esc(t.home.enterByProductTitle) + "</h3>" +
        "<p>" + esc(t.home.enterByProductDesc) + "</p>" +
        '<span class="chips"><span class="chip">' + chipCamera + '</span><span class="chip">' + chipBox + '</span><span class="chip">' + chipLens + "</span></span>" +
        '<span class="go">' + esc(t.common.viewProduct) + " →</span>" +
      "</a>";

    document.getElementById("entryType").innerHTML =
      '<a class="entry-card" href="' + I18N.urlFor("manual-types.html", lang) + '">' +
        '<span class="entry-graphic"><svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="26" y="10" width="48" height="62" rx="6" fill="#25436f"/><rect x="16" y="20" width="48" height="62" rx="6" fill="#2f6fae"/><rect x="24" y="34" width="32" height="4" rx="2" fill="#bcdcff"/><rect x="24" y="44" width="32" height="4" rx="2" fill="#bcdcff" opacity=".7"/><rect x="24" y="54" width="20" height="4" rx="2" fill="#bcdcff" opacity=".5"/></svg></span>' +
        '<span class="badge">' + esc(t.nav.byType) + "</span>" +
        "<h3>" + esc(t.home.enterByTypeTitle) + "</h3>" +
        "<p>" + esc(t.home.enterByTypeDesc) + "</p>" +
        '<span class="chips"><span class="chip">' + chipGuide + '</span><span class="chip">' + chipInstall + '</span><span class="chip">' + chipQuick + "</span></span>" +
        '<span class="go">' + esc(t.common.viewAllDocuments) + " →</span>" +
      "</a>";

    var typeMap = {};
    ctx.types.forEach(function (ty) { typeMap[ty.id] = ty; });
    var catMap = {};
    ctx.categories.forEach(function (c) { catMap[c.id] = c; });

    var recent = ctx.manualsIndex
      .slice()
      .sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
      .filter(function (e) { var found = DATA.findProduct(ctx.categories, e.productId); return found && DATA.isProductVisible(found.product, lang); })
      .filter(function (e) { return e.lang === lang; })
      .slice(0, 5);
    if (!recent.length) {
      recent = ctx.manualsIndex.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); })
        .filter(function (e) { var found = DATA.findProduct(ctx.categories, e.productId); return found && DATA.isProductVisible(found.product, lang); }).slice(0, 5);
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

    var preferred = ctx.manualsIndex.filter(function (e) {
      var found = DATA.findProduct(ctx.categories, e.productId);
      return e.lang === lang && found && DATA.isProductVisible(found.product, lang);
    });
    var popularitySource = preferred.length ? preferred : ctx.manualsIndex;
    var counts = {};
    popularitySource.forEach(function (e) { counts[e.productId] = (counts[e.productId] || 0) + 1; });
    var popular = Object.keys(counts).map(function (productId) {
      var found = DATA.findProduct(ctx.categories, productId);
      return { productId: productId, model: found ? found.product.model : productId, count: counts[productId] };
    }).sort(function (a, b) { return b.count - a.count || a.model.localeCompare(b.model, "en", { numeric: true }); }).slice(0, 6);
    var popularWrap = document.getElementById("popularLinks");
    if (popular.length) {
      document.getElementById("popularLinksTitle").textContent = t.home.popularTitle;
      popularWrap.innerHTML = popular.map(function (item) {
        var href = I18N.urlFor("product-detail.html", lang, { id: item.productId });
        return '<div class="manual-row"><div><div class="title">' + esc(item.model) + '</div><div class="meta">' + esc(item.count + " " + t.common.documentsAvailable) + '</div></div><a class="btn" href="' + href + '">' + esc(t.common.viewProduct) + "</a></div>";
      }).join("");
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("home").then(run);
  });
})();
