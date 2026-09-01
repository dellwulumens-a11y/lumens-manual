/* Lumens Manual Center — search.html
   Lightweight client-side keyword search over data/search-index.json.
   No tokenizer library: CJK content has no word boundaries, so this does
   substring + occurrence-count scoring, which works for English, Simplified
   and Traditional Chinese alike without a segmenter dependency.
*/
(function () {
  var I18N = window.LumensI18n;
  var DATA = window.LumensData;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function score(query, entry) {
    var q = query.toLowerCase();
    var title = (entry.title || "").toLowerCase();
    var text = (entry.text || "").toLowerCase();
    var s = 0;
    if (title.indexOf(q) !== -1) s += 60;
    var re = new RegExp(escRe(q), "g");
    var matches = text.match(re);
    if (matches) s += Math.min(matches.length, 8) * 6;
    return s;
  }

  function snippet(query, text) {
    var lower = text.toLowerCase();
    var idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, 160) + (text.length > 160 ? "…" : "");
    var start = Math.max(0, idx - 70);
    var end = Math.min(text.length, idx + query.length + 90);
    var out = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    var re = new RegExp("(" + escRe(query) + ")", "ig");
    return out.replace(re, "<mark>$1</mark>");
  }

  function run(ctx) {
    var t = ctx.t, lang = ctx.lang, esc = ctx.esc;
    var params = new URL(location.href).searchParams;
    var q = (params.get("q") || "").trim();

    document.getElementById("searchTitle").textContent = t.search.title;
    var input = document.getElementById("searchInput");
    input.value = q;
    input.placeholder = t.common.searchPlaceholder;
    document.getElementById("searchForm").addEventListener("submit", function (e) {
      // allow normal GET submit (keeps ?lang= via hidden field set below)
    });
    var langField = document.getElementById("searchLangField");
    if (langField) langField.value = lang;

    var resultsEl = document.getElementById("searchResults");
    var countEl = document.getElementById("resultCount");

    if (!q) {
      countEl.textContent = "";
      resultsEl.innerHTML = "";
      return;
    }

    fetch("data/search-index.json").then(function (r) { return r.json(); }).then(function (all) {
      var inLang = all.filter(function (e) { return e.lang === lang; });
      var pool = inLang.length ? inLang : all;
      var scored = pool
        .map(function (e) { return { entry: e, s: score(q, e) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; });

      countEl.textContent = scored.length + " " + t.search.resultCount + (inLang.length === 0 && all.length ? "" : "");

      if (!scored.length) {
        resultsEl.innerHTML = '<p class="state-msg">' + esc(t.search.noResults) + "</p>";
        return;
      }

      var catMap = {}, typeMap = {};
      ctx.categories.forEach(function (c) { catMap[c.id] = c; });
      ctx.types.forEach(function (ty) { typeMap[ty.id] = ty; });

      resultsEl.innerHTML = scored.map(function (x) {
        var e = x.entry;
        var cat = catMap[e.categoryId];
        var found = DATA.findProduct(ctx.categories, e.productId);
        var model = found ? found.product.model : e.productId;
        var typeName = typeMap[e.typeId] ? I18N.pickLocale(typeMap[e.typeId].name, lang) : e.typeId;
        var crumb = (cat ? I18N.pickLocale(cat.name, lang) : "") + " / " + model + " / " + typeName;
        var href = I18N.urlFor("manual-viewer.html", lang, { product: e.productId, type: e.typeId, lang: e.lang });
        return (
          '<div class="result-item">' +
            '<div class="crumb">' + esc(crumb) + "</div>" +
            '<h3><a href="' + href + '">' + esc(e.title) + "</a></h3>" +
            "<p>" + snippet(q, e.text) + "</p>" +
          "</div>"
        );
      }).join("");
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("search").then(run);
  });
})();
