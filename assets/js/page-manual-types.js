/* Lumens Manual Center — manual-types.html (browse by document type) */
(function () {
  var I18N = window.LumensI18n;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;

    document.getElementById("crumbCurrent").textContent = t.breadcrumb.manualTypes;
    document.getElementById("pageTitle").textContent = t.nav.byType;
    document.getElementById("pageDesc").textContent = t.home.enterByTypeDesc;
    document.getElementById("switchViewLink").textContent = t.common.switchViewByProduct;
    document.getElementById("switchViewLink").href = I18N.urlFor("products.html", lang);

    var grid = document.getElementById("typeGrid");
    grid.innerHTML = ctx.types.map(function (ty, i) {
      var docCount = ctx.manualsIndex.filter(function (m) { return m.typeId === ty.id; }).length;
      var href = I18N.urlFor("manual-type-detail.html", lang, { type: ty.id });
      var countLabel = docCount ? (docCount + " " + t.common.documentsAvailable) : t.common.noDocumentsYet;
      return (
        '<a class="type-card" href="' + href + '" style="' + window.LumensCommon.tagColorStyle(i) + '">' +
          '<div class="num">' + String(i + 1).padStart(2, "0") + "</div>" +
          "<h3>" + esc(I18N.pickLocale(ty.name, lang)) + "</h3>" +
          "<p>" + esc(countLabel) + "</p>" +
        "</a>"
      );
    }).join("");
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("types").then(run);
  });
})();
