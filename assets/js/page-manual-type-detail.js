/* Lumens Manual Center — manual-type-detail.html
   Lists every product that offers a given document type; each row links
   straight into the manual viewer when content already exists, or falls
   back to the product page when the type is declared but not authored yet.
*/
(function () {
  var I18N = window.LumensI18n;
  var DATA = window.LumensData;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    var params = new URL(location.href).searchParams;
    var typeId = params.get("type");
    var type = DATA.findType(ctx.types, typeId);

    if (!type) {
      document.getElementById("typeDetailBody").innerHTML =
        '<p class="state-msg">' + esc(t.common.loadError) + "</p>";
      return;
    }

    document.getElementById("crumbTypes").textContent = t.breadcrumb.manualTypes;
    document.getElementById("crumbTypes").href = I18N.urlFor("manual-types.html", lang);
    document.getElementById("crumbCurrent").textContent = I18N.pickLocale(type.name, lang);
    document.getElementById("pageTitle").textContent = I18N.pickLocale(type.name, lang);

    var products = DATA.productsForType(ctx.categories, typeId);
    document.getElementById("pageDesc").textContent =
      products.length + " " + t.common.documentsAvailable;

    if (!products.length) {
      document.getElementById("typeDetailBody").innerHTML = '<div class="empty-note">' + esc(t.common.noDocumentsYet) + "</div>";
      return;
    }

    var byCategory = {};
    products.forEach(function (p) {
      byCategory[p.categoryId] = byCategory[p.categoryId] || [];
      byCategory[p.categoryId].push(p);
    });

    var html = Object.keys(byCategory).map(function (catId) {
      var cat = DATA.findCategory(ctx.categories, catId);
      var rows = byCategory[catId].map(function (p) {
        var langs = DATA.langsForManual(ctx.manualsIndex, p.id, typeId);
        var preferredLang = langs.indexOf(lang) !== -1 ? lang : langs[0];
        var href = preferredLang
          ? I18N.urlFor("manual-viewer.html", lang, { product: p.id, type: typeId, lang: preferredLang })
          : I18N.urlFor("product-detail.html", lang, { id: p.id });
        var langPills = langs.length
          ? langs.map(function (l) { return '<span class="lang-pill">' + l + "</span>"; }).join("")
          : '<span class="lang-pill">' + esc(t.common.noDocumentsYet) + "</span>";
        return (
          '<div class="manual-row">' +
            "<div>" +
              '<div class="title"><a href="' + href + '">' + esc(p.model) + " — " + esc(p.name && I18N.pickLocale(p.name, lang) || p.model) + "</a></div>" +
            "</div>" +
            '<div class="langs">' + langPills + "</div>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="manual-group">' +
          "<h3>" + esc(I18N.pickLocale(cat.name, lang)) + "</h3>" +
          rows +
        "</div>"
      );
    }).join("");

    document.getElementById("typeDetailBody").innerHTML = html;
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("types").then(run);
  });
})();
