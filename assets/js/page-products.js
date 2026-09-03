/* Lumens Manual Center — products.html (browse by product) */
(function () {
  var I18N = window.LumensI18n;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;

    document.getElementById("crumbCurrent").textContent = t.breadcrumb.products;
    document.getElementById("pageTitle").textContent = t.nav.byProduct;
    document.getElementById("pageDesc").textContent = t.home.enterByProductDesc;
    document.getElementById("switchViewLink").textContent = t.common.switchView;
    document.getElementById("switchViewLink").href = I18N.urlFor("manual-types.html", lang);

    var grid = document.getElementById("categoryGrid");
    grid.innerHTML = ctx.categories.map(function (cat, i) {
      var products = (cat.products || []).map(function (p) {
        var href = I18N.urlFor("product-detail.html", lang, { id: p.id });
        var productName = p.name && I18N.pickLocale(p.name, lang) || p.model;
        return (
          '<a href="' + href + '">' +
            "<span>" + esc(productName) + "</span>" +
            '<span class="model-name">' + esc(p.model) + "</span>" +
          "</a>"
        );
      }).join("");
      return (
        '<div class="category-card" style="' + window.LumensCommon.tagColorStyle(i) + '">' +
          '<span class="cat-badge">' + esc(t.footer.productLine) + "</span>" +
          '<div class="count">' + (cat.products || []).length + " " + esc(t.common.documentsAvailable).replace(/^ */, "") + "</div>" +
          "<h3>" + esc(I18N.pickLocale(cat.name, lang)) + "</h3>" +
          '<p class="desc">' + esc(I18N.pickLocale(cat.description, lang)) + "</p>" +
          '<div class="product-list">' + products + "</div>" +
        "</div>"
      );
    }).join("");
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("products").then(run);
  });
})();
