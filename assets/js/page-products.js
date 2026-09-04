/* Lumens Manual Center — products.html (browse by product) */
(function () {
  var I18N = window.LumensI18n;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    var latestByProduct = {};
    (ctx.manualsIndex || []).forEach(function (manual) {
      var current = latestByProduct[manual.productId] || "";
      if (manual.updatedAt && manual.updatedAt > current) latestByProduct[manual.productId] = manual.updatedAt;
    });

    document.getElementById("crumbCurrent").textContent = t.breadcrumb.products;
    document.getElementById("pageTitle").textContent = t.nav.byProduct;
    document.getElementById("pageDesc").textContent = t.home.enterByProductDesc;
    document.getElementById("switchViewLink").textContent = t.common.switchView;
    document.getElementById("switchViewLink").href = I18N.urlFor("manual-types.html", lang);

    var grid = document.getElementById("categoryGrid");
    grid.innerHTML = ctx.categories.map(function (cat, i) {
      var products = (cat.products || []).slice().sort(function (a, b) {
        var dateA = latestByProduct[a.id] || "";
        var dateB = latestByProduct[b.id] || "";
        return dateB.localeCompare(dateA);
      }).map(function (p, productIndex) {
        var href = I18N.urlFor("product-detail.html", lang, { id: p.id });
        return (
          '<a href="' + href + '" data-product-index="' + productIndex + '">' +
            '<span class="model-name">' + esc(p.model) + "</span>" +
          "</a>"
        );
      }).join("");
      var hasMore = (cat.products || []).length > 3;
      return (
        '<div class="category-card" style="' + window.LumensCommon.tagColorStyle(i) + '">' +
          '<span class="cat-badge">' + esc(t.footer.productLine) + "</span>" +
          '<div class="count">' + (cat.products || []).length + " " + esc(t.common.modelsAvailable) + "</div>" +
          "<h3>" + esc(I18N.pickLocale(cat.name, lang)) + "</h3>" +
          '<p class="desc">' + esc(I18N.pickLocale(cat.description, lang)) + "</p>" +
          '<div class="product-list' + (hasMore ? ' is-collapsed' : '') + '" id="products-' + cat.id + '">' + products + "</div>" +
          (hasMore ? '<button class="product-toggle" type="button" aria-expanded="false" aria-controls="products-' + cat.id + '" data-more-label="' + esc(t.common.showAllProducts) + '" data-less-label="' + esc(t.common.showFewerProducts) + '">' + esc(t.common.showAllProducts) + '</button>' : '') +
        "</div>"
      );
    }).join("");

    grid.querySelectorAll(".product-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        var expanded = button.getAttribute("aria-expanded") === "true";
        var list = document.getElementById(button.getAttribute("aria-controls"));
        list.classList.toggle("is-collapsed", expanded);
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
        button.textContent = expanded ? button.dataset.moreLabel : button.dataset.lessLabel;
      });
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("products").then(run);
  });
})();
