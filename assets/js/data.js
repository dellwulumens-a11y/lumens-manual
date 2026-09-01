/* Lumens Manual Center — data access layer
   Every product, category and document-type list is read from JSON here.
   Adding a product line or a new manual category never touches this file —
   only the JSON under /data.
*/
(function (global) {
  var cache = {};

  function fetchJson(path) {
    if (cache[path]) return cache[path];
    cache[path] = fetch(path).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + path);
      return r.json();
    });
    return cache[path];
  }

  function getCategories() {
    return fetchJson("data/product-categories.json").then(function (d) { return d.categories; });
  }

  function getTypes() {
    return fetchJson("data/manual-types.json").then(function (d) {
      return d.types.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    });
  }

  function getManualsIndex() {
    return fetchJson("data/manuals-index.json");
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
  function productsForType(categories, typeId) {
    var out = [];
    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        if ((p.manuals || []).indexOf(typeId) !== -1) {
          out.push(Object.assign({}, p, { categoryId: cat.id, categoryName: cat.name }));
        }
      });
    });
    return out;
  }

  global.LumensData = {
    getCategories: getCategories,
    getTypes: getTypes,
    getManualsIndex: getManualsIndex,
    flattenProducts: flattenProducts,
    findProduct: findProduct,
    findCategory: findCategory,
    findType: findType,
    manualsForProduct: manualsForProduct,
    manualEntry: manualEntry,
    langsForManual: langsForManual,
    productsForType: productsForType
  };
})(window);
