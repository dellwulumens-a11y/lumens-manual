/* Lumens Manual Center — qa.html */
(function () {
  var I18N = window.LumensI18n;

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    document.getElementById("crumbHome").textContent = t.breadcrumb.home;
    document.getElementById("crumbHome").href = I18N.urlFor("index.html", lang);
    document.getElementById("crumbCurrent").textContent = t.nav.qa;
    document.getElementById("qaTitle").textContent = t.qa.title;
    document.getElementById("qaDescription").textContent = t.qa.description;

    var items = (ctx.qa || []).filter(function (item) { return item.enabled !== false; });
    var list = document.getElementById("qaList");
    if (!items.length) {
      list.innerHTML = '<p class="state-msg">' + esc(t.qa.empty) + "</p>";
      return;
    }
    list.innerHTML = items.sort(function (a, b) {
      return (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id));
    }).map(function (item) {
      var category = I18N.pickLocale(item.category, lang);
      var answer = I18N.pickLocale(item.answer, lang).replace(/\r?\n/g, "<br>");
      return '<details class="qa-item">' +
        '<summary><span>' + esc(I18N.pickLocale(item.question, lang)) + '</span></summary>' +
        '<div class="qa-answer">' + esc(answer).replace(/&lt;br&gt;/g, "<br>") +
        (category ? '<div class="qa-category">' + esc(category) + '</div>' : '') + '</div>' +
      '</details>';
    }).join("");

    window.LumensCommon.track("view_qa", { qa_count: items.length, language: lang });
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("qa").then(run);
  });
})();
