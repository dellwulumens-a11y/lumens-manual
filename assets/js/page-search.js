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
  function normalizeSearchText(s) {
    return String(s || "").toLowerCase().replace(/[\s\-_./\\]+/g, "");
  }

  function score(query, entry, product, category, type, lang) {
    var q = normalizeSearchText(query);
    var title = normalizeSearchText(entry.title);
    var text = normalizeSearchText(entry.text);
    var model = normalizeSearchText(product && product.model);
    var productName = normalizeSearchText(product && I18N.pickLocale(product.name, lang));
    var categoryName = normalizeSearchText(category && I18N.pickLocale(category.name, lang));
    var typeName = normalizeSearchText(type && I18N.pickLocale(type.name, lang));
    var s = 0;
    if (model.indexOf(q) !== -1) s += 120;
    if (productName.indexOf(q) !== -1) s += 70;
    if (title.indexOf(q) !== -1) s += 60;
    if (categoryName.indexOf(q) !== -1 || typeName.indexOf(q) !== -1) s += 20;
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
    var categoryId = params.get("category") || "";
    var typeId = params.get("type") || "";
    var docLang = params.get("docLang") || "";

    document.getElementById("searchTitle").textContent = t.search.title;
    var input = document.getElementById("searchInput");
    input.value = q;
    input.placeholder = t.common.searchPlaceholder;
    input.setAttribute("aria-label", t.search.inputLabel);
    document.querySelector("#searchForm button").textContent = t.common.searchButton;
    var langField = document.getElementById("searchLangField");
    if (langField) langField.value = lang;

    var categoryFilter = document.getElementById("categoryFilter");
    var typeFilter = document.getElementById("typeFilter");
    var docLangFilter = document.getElementById("docLangFilter");
    var option = function (value, label, selected) {
      return '<option value="' + esc(value) + '"' + (selected ? " selected" : "") + ">" + esc(label) + "</option>";
    };
    categoryFilter.innerHTML = option("", t.common.allCategories, !categoryId) + ctx.categories.map(function (category) {
      return option(category.id, I18N.pickLocale(category.name, lang), category.id === categoryId);
    }).join("");
    typeFilter.innerHTML = option("", t.common.allTypes, !typeId) + ctx.types.map(function (type) {
      return option(type.id, I18N.pickLocale(type.name, lang), type.id === typeId);
    }).join("");
    docLangFilter.innerHTML = option("", t.search.allLanguages, !docLang) + option("en", "English", docLang === "en") + option("zh-CN", "简体中文", docLang === "zh-CN") + option("zh-TW", "繁體中文", docLang === "zh-TW");
    document.getElementById("categoryFilterLabel").textContent = t.search.productLine;
    document.getElementById("typeFilterLabel").textContent = t.search.documentType;
    document.getElementById("docLangFilterLabel").textContent = t.search.documentLanguage;
    document.getElementById("searchFilters").setAttribute("aria-label", t.search.filtersLabel);
    document.getElementById("clearFilters").textContent = t.search.clearFilters;
    document.getElementById("clearFilters").addEventListener("click", function () {
      categoryFilter.value = "";
      typeFilter.value = "";
      docLangFilter.value = "";
      document.getElementById("searchForm").submit();
    });

    var resultsEl = document.getElementById("searchResults");
    var countEl = document.getElementById("resultCount");

    if (!q) {
      countEl.textContent = "";
      resultsEl.innerHTML = '<p class="state-msg">' + esc(t.search.searchPrompt) + "</p>";
      return;
    }

    fetch("data/search-index.json").then(function (r) {
      if (!r.ok) throw new Error("search index unavailable");
      return r.json();
    }).then(function (all) {
      var catMap = {}, typeMap = {}, productMap = {};
      ctx.categories.forEach(function (c) {
        catMap[c.id] = c;
        (c.products || []).forEach(function (p) { productMap[p.id] = p; });
      });
      ctx.types.forEach(function (ty) { typeMap[ty.id] = ty; });
      var filtered = all.filter(function (e) {
        return (!productMap[e.productId] || DATA.isProductVisible(productMap[e.productId], lang)) &&
          (!categoryId || e.categoryId === categoryId) && (!typeId || e.typeId === typeId) &&
          (!docLang || e.lang === docLang);
      });
      var preferred = docLang ? filtered : filtered.filter(function (e) { return e.lang === lang; });
      var pool = preferred.length ? preferred : filtered;
      var scored = pool
        .map(function (e) { return { entry: e, s: score(q, e, productMap[e.productId], catMap[e.categoryId], typeMap[e.typeId], lang) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; });

      window.LumensCommon.track("search", {
        search_term: q,
        category: categoryId || "all",
        document_type: typeId || "all",
        document_language: docLang || "all",
        result_count: scored.length
      });

      countEl.textContent = scored.length + " " + t.search.resultCount;

      if (!scored.length) {
        resultsEl.innerHTML = '<p class="state-msg">' + esc(t.search.noResults) + "</p>";
        return;
      }

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
    }).catch(function () {
      countEl.textContent = "";
      resultsEl.innerHTML = '<p class="state-msg">' + esc(t.common.loadError) + "</p>";
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    window.LumensCommon.init("search").then(run);
  });
})();
