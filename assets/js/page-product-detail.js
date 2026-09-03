/* Lumens Manual Center — product-detail.html */
(function () {
  var I18N = window.LumensI18n;
  var DATA = window.LumensData;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    var params = new URL(location.href).searchParams;
    var id = params.get("id");
    var found = DATA.findProduct(ctx.categories, id);

    if (!found) {
      document.getElementById("productBody").innerHTML = '<p class="state-msg">' + esc(t.common.loadError) + "</p>";
      return;
    }

    var product = found.product, category = found.category;

    document.getElementById("crumbProducts").textContent = t.breadcrumb.products;
    document.getElementById("crumbProducts").href = I18N.urlFor("products.html", lang);
    document.getElementById("crumbCurrent").textContent = product.model;

    document.getElementById("productThumb").innerHTML = '<img src="' + product.image + '" alt="' + esc(product.model) + '">';
    document.getElementById("productModelTag").textContent = product.model;
    document.getElementById("productName").textContent = product.name && I18N.pickLocale(product.name, lang) || product.model;
    var catLink = document.getElementById("productCatLink");
    catLink.textContent = I18N.pickLocale(category.name, lang);
    catLink.href = I18N.urlFor("products.html", lang, { category: category.id });
    var catIndex = ctx.categories.findIndex(function (c) { return c.id === category.id; });
    catLink.setAttribute("style", window.LumensCommon.tagColorStyle(catIndex < 0 ? 0 : catIndex));

    var body = document.getElementById("productBody");
    var declaredTypes = product.manuals || [];

    if (!declaredTypes.length) {
      body.innerHTML = '<div class="empty-note">' + esc(t.common.noManualsYet) + "</div>";
      return;
    }

    var typeMap = {};
    ctx.types.forEach(function (ty) { typeMap[ty.id] = ty; });

    var html = declaredTypes.map(function (typeId) {
      var ty = typeMap[typeId];
      if (!ty) return "";
      var langs = DATA.langsForManual(ctx.manualsIndex, product.id, typeId);
      var row;
      if (langs.length) {
        var pills = langs.map(function (l) {
          var href = I18N.urlFor("manual-viewer.html", lang, { product: product.id, type: typeId, lang: l });
          return '<a class="lang-pill" href="' + href + '">' + l + "</a>";
        }).join("");
        row = (
          '<div class="manual-row">' +
            '<div><div class="title">' + esc(I18N.pickLocale(ty.name, lang)) + "</div>" +
            '<div class="meta">' + esc(t.common.availableIn) + ": " + langs.join(" / ") + "</div></div>" +
            '<div class="langs">' + pills + "</div>" +
          "</div>"
        );
      } else {
        row = (
          '<div class="manual-row">' +
            '<div><div class="title">' + esc(I18N.pickLocale(ty.name, lang)) + "</div>" +
            '<div class="meta">' + esc(t.common.noDocumentsYet) + "</div></div>" +
          "</div>"
        );
      }
      return '<div class="manual-group"><h3>' + esc(I18N.pickLocale(ty.name, lang)) + "</h3>" + row + "</div>";
    }).join("");

    body.innerHTML = html;
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("products").then(run);
  });
})();
