/* Lumens Manual Center — language handling
   Supported languages: en, zh-CN, zh-TW. All three are first-class; there is
   no "default" language baked into markup — every UI string comes from
   data/i18n/{lang}.json and every content field is a {en, zh-CN, zh-TW} map.
*/
(function (global) {
  var SUPPORTED = ["en", "zh-CN", "zh-TW"];
  var STORAGE_KEY = "lumens-manual-lang";
  var cache = {};

  function detectBrowserLang() {
    var nav = (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || "en";
    if (/^zh/i.test(nav)) {
      return /tw|hk|hant/i.test(nav) ? "zh-TW" : "zh-CN";
    }
    return "en";
  }

  function getLang() {
    try {
      var url = new URL(global.location.href);
      var qLang = url.searchParams.get("lang");
      if (qLang && SUPPORTED.indexOf(qLang) !== -1) return qLang;
    } catch (e) {}
    try {
      var stored = global.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    return detectBrowserLang();
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { global.localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  /** Build a URL for `page` with the given lang and any extra query params preserved. */
  function urlFor(page, lang, extraParams) {
    var url = new URL(page, global.location.href);
    if (lang) url.searchParams.set("lang", lang);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (k) {
        if (extraParams[k] != null) url.searchParams.set(k, extraParams[k]);
      });
    }
    return url.pathname.split("/").pop() + url.search;
  }

  function load(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch("data/i18n/" + lang + ".json")
      .then(function (r) { if (!r.ok) throw new Error("i18n fetch failed"); return r.json(); })
      .catch(function () {
        if (lang !== "en") return load("en");
        throw new Error("Could not load UI strings");
      })
      .then(function (dict) { cache[lang] = dict; return dict; });
  }

  function get(dict, path) {
    return path.split(".").reduce(function (o, k) { return (o && o[k] != null) ? o[k] : null; }, dict);
  }

  /** Pick the best available value from a {en, "zh-CN":..., "zh-TW":...} map. */
  function pickLocale(map, lang) {
    if (!map) return "";
    if (map[lang] != null) return map[lang];
    if (map.en != null) return map.en;
    var keys = Object.keys(map);
    return keys.length ? map[keys[0]] : "";
  }

  global.LumensI18n = {
    SUPPORTED: SUPPORTED,
    getLang: getLang,
    setLang: setLang,
    urlFor: urlFor,
    load: load,
    t: get,
    pickLocale: pickLocale
  };
})(window);
