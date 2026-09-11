/* Lumens Manual Center — data access layer
   Every product, category and document-type list is read from JSON here.
   Adding a product line or a new manual category never touches this file —
   only the JSON under /data.
*/
(function (global) {
  var cache = {};

  // CMS source toggle: the live site always reads the static JSON files
  // below. Passing ?cms=directus once (e.g. while testing the V2.0 backend)
  // switches every page to read from Directus instead and remembers the
  // choice in this browser via localStorage; ?cms=static switches back.
  var DIRECTUS_URL = "https://lumens-manual-directus.zeabur.app";
  function cmsSource() {
    try {
      var requested = new URLSearchParams(global.location.search).get("cms");
      if (requested) global.localStorage.setItem("lumens_cms_source", requested);
      return global.localStorage.getItem("lumens_cms_source") || "static";
    } catch (e) {
      return "static";
    }
  }
  function useDirectus() { return cmsSource() === "directus"; }

  function fetchJson(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + path);
      return r.json();
    });
    return cache[path];
  }

  function fetchDirectus(path) {
    var url = DIRECTUS_URL + path;
    if (cache[url]) return cache[url];
    cache[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + url);
      return r.json();
    }).then(function (body) { return body.data; });
    return cache[url];
  }

  /** Directus stores each translation as its own column (name_en, name_zh_cn,
   * name_zh_tw); the rest of the site expects the {en, "zh-CN", "zh-TW"} shape
   * the static JSON files already use, so every Directus read is translated
   * back into that shape here — no other file needs to know the difference. */
  function langObj(row, prefix) {
    return { en: row[prefix + "_en"], "zh-CN": row[prefix + "_zh_cn"], "zh-TW": row[prefix + "_zh_tw"] };
  }
  function hasAnyLang(obj) { return !!(obj && (obj.en || obj["zh-CN"] || obj["zh-TW"])); }

  function getCategoriesStatic() {
    return fetchJson("data/product-categories.json").then(function (d) { return d.categories; });
  }

  function getCategoriesDirectus() {
    return Promise.all([
      fetchDirectus("/items/product_categories?sort=order&limit=-1"),
      fetchDirectus("/items/products?limit=-1")
    ]).then(function (results) {
      var cats = results[0], products = results[1];
      return cats.map(function (c) {
        return {
          id: c.id,
          name: langObj(c, "name"),
          description: langObj(c, "description"),
          products: products.filter(function (p) { return p.category === c.id; }).map(function (p) {
            var name = langObj(p, "name");
            return {
              id: p.id,
              model: p.model,
              name: hasAnyLang(name) ? name : undefined,
              image: p.image,
              manuals: p.manuals || [],
              audiences: p.audiences || []
            };
          })
        };
      });
    });
  }

  function getCategories() {
    return useDirectus() ? getCategoriesDirectus() : getCategoriesStatic();
  }

  function getTypesStatic() {
    return fetchJson("data/manual-types.json").then(function (d) {
      return d.types.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    });
  }

  function getTypesDirectus() {
    return fetchDirectus("/items/manual_types?sort=order&limit=-1").then(function (rows) {
      return rows.map(function (t) { return { id: t.id, order: t.order, name: langObj(t, "name") }; });
    });
  }

  function getTypes() {
    return useDirectus() ? getTypesDirectus() : getTypesStatic();
  }

  function getManualsIndexStatic() {
    return fetchJson("data/manuals-index.json");
  }

  /** format=fragment manuals carry their HTML inline as `content` (no `path`
   * to fetch); page-manual-viewer.js uses that instead of fetch(entry.path)
   * when it's present. pdf/standalone manuals get a real fetchable `path`
   * pointing at the file's Directus asset URL, so that code needs no change. */
  function getManualsIndexDirectus() {
    return Promise.all([
      fetchDirectus("/items/manuals?limit=-1"),
      fetchDirectus("/items/products?limit=-1&fields=id,category")
    ]).then(function (results) {
      var manuals = results[0], products = results[1];
      var categoryByProduct = {};
      products.forEach(function (p) { categoryByProduct[p.id] = p.category; });
      return manuals.map(function (m) {
        return {
          productId: m.product,
          categoryId: categoryByProduct[m.product] || "",
          typeId: m.type,
          lang: m.lang,
          title: m.title,
          path: m.format === "fragment" ? null : DIRECTUS_URL + "/assets/" + m.file,
          content: m.format === "fragment" ? m.content : null,
          format: m.format,
          updatedAt: m.date_updated ? m.date_updated.slice(0, 10) : ""
        };
      });
    });
  }

  function getManualsIndex() {
    return useDirectus() ? getManualsIndexDirectus() : getManualsIndexStatic();
  }

  function getQaStatic() {
    return fetchJson("data/qa.json").then(function (d) { return d.items || []; });
  }

  function getQaDirectus() {
    return fetchDirectus("/items/qa_items?sort=-date_updated&limit=-1&filter[status][_eq]=published").then(function (rows) {
      return rows.map(function (r) {
        return {
          id: String(r.id),
          order: r.sort || 0,
          enabled: true,
          category: { en: r.category, "zh-CN": r.category, "zh-TW": r.category },
          question: { en: r.question_en, "zh-CN": r.question_zh_cn, "zh-TW": r.question_zh_tw },
          answer: { en: r.answer_en, "zh-CN": r.answer_zh_cn, "zh-TW": r.answer_zh_tw }
        };
      });
    });
  }

  function getQa() {
    return useDirectus() ? getQaDirectus() : getQaStatic();
  }

  /** Flatten categories into a single product list, each tagged with its category. */
  function flattenProducts(categories) {
    var out = [];
    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        out.push(Object.assign({}, p, { categoryId: cat.id, categoryName: cat.name }));
      });
    });
    return out;
  }

  function findProduct(categories, productId) {
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      for (var j = 0; j < (cat.products || []).length; j++) {
        if (cat.products[j].id === productId) {
          return { product: cat.products[j], category: cat };
        }
      }
    }
    return null;
  }

  function isProductVisible(product, lang) {
    var audiences = product && product.audiences;
    if (!audiences || !audiences.length || audiences.length === 2) return true;
    return audiences.indexOf(lang === "zh-CN" ? "mainland" : "global") !== -1;
  }

  function findCategory(categories, categoryId) {
    return categories.filter(function (c) { return c.id === categoryId; })[0] || null;
  }

  function findType(types, typeId) {
    return types.filter(function (t) { return t.id === typeId; })[0] || null;
  }

  function manualsForProduct(index, productId) {
    return index.filter(function (m) { return m.productId === productId; });
  }

  function manualEntry(index, productId, typeId, lang) {
    return index.filter(function (m) {
      return m.productId === productId && m.typeId === typeId && m.lang === lang;
    })[0] || null;
  }

  function langsForManual(index, productId, typeId) {
    return index
      .filter(function (m) { return m.productId === productId && m.typeId === typeId; })
      .map(function (m) { return m.lang; });
  }

  /** Products whose declared `manuals` list includes this type id. */
  function productsForType(categories, typeId, lang) {
    var out = [];
    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        if ((p.manuals || []).indexOf(typeId) !== -1 && isProductVisible(p, lang)) {
          out.push(Object.assign({}, p, { categoryId: cat.id, categoryName: cat.name }));
        }
      });
    });
    return out;
  }

  global.LumensData = {
    useDirectus: useDirectus,
    getCategories: getCategories,
    getTypes: getTypes,
    getManualsIndex: getManualsIndex,
    getQa: getQa,
    flattenProducts: flattenProducts,
    findProduct: findProduct,
    isProductVisible: isProductVisible,
    findCategory: findCategory,
    findType: findType,
    manualsForProduct: manualsForProduct,
    manualEntry: manualEntry,
    langsForManual: langsForManual,
    productsForType: productsForType
  };
})(window);
