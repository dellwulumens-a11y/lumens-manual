#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE = "C:\\Users\\Dell.Wu\\Desktop\\先給Dell的\\VC (Vic 補PDF轉檔，移除簡中機種)";
const CATEGORIES_PATH = path.join(ROOT, "data", "product-categories.json");
const INDEX_PATH = path.join(ROOT, "data", "manuals-index.json");
const MANUALS_ROOT = path.join(ROOT, "manuals");

const typeMap = {
  "QSG": { id: "installation-guide", label: "Installation Guide" },
  "User Manual": { id: "user-guide", label: "User Manual" }
};

function productId(model) {
  return model
    .toLowerCase()
    .replace(/[,()]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-v01$/, "")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
}

function categoryId(model) {
  if (/^(BC-\d|VC-(B|BC))/.test(model)) return "fixed-camera";
  if (/^VC-TR|^VC-TA/.test(model)) return "auto-tracking-ptz";
  return "ptz-camera";
}

function language(fileName) {
  if (/English/i.test(fileName)) return "en";
  if (/S[-_ ]Chinese|Chinese-S/i.test(fileName)) return "zh-CN";
  if (/Chinese|Chineese/i.test(fileName)) return "zh-TW";
  return null;
}

function versionScore(fileName) {
  const matches = fileName.match(/20\d{2}[-_]?\d{2}[-_]?\d{2}/g) || [];
  const dates = matches.map((value) => Number(value.replace(/[-_]/g, "")));
  const hasVic = /Vic/i.test(fileName) ? 1 : 0;
  return [dates.length ? Math.max(...dates) : 0, hasVic, fileName.length];
}

function compareVersions(a, b) {
  const left = versionScore(a.file.name);
  const right = versionScore(b.file.name);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return right[i] - left[i];
  }
  return a.name.localeCompare(b.name);
}

function ensureProduct(categories, model, types) {
  const id = productId(model);
  const category = categories.find((item) => item.id === categoryId(model));
  let product = category.products.find((item) => item.id === id);
  if (!product) {
    product = {
      id,
      model,
      name: { en: model, "zh-CN": model, "zh-TW": model },
      image: "assets/images/products/placeholder-camera.svg",
      manuals: []
    };
    category.products.push(product);
  }
  product.manuals = Array.from(new Set([...(product.manuals || []), ...types]));
  return { id, categoryId: category.id };
}

function main() {
  const categoriesData = JSON.parse(fs.readFileSync(CATEGORIES_PATH, "utf8"));
  const manualsIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const candidates = [];
  let ignoredPackingLists = 0;
  let ignoredLanguages = 0;

  for (const modelDir of fs.readdirSync(SOURCE, { withFileTypes: true })) {
    if (!modelDir.isDirectory()) continue;
    const model = modelDir.name;
    for (const typeDir of fs.readdirSync(path.join(SOURCE, model), { withFileTypes: true })) {
      const type = typeMap[typeDir.name];
      if (!type || !typeDir.isDirectory()) {
        if (typeDir.isDirectory() && typeDir.name === "裝箱清單") ignoredPackingLists += 1;
        continue;
      }
      const files = fs.readdirSync(path.join(SOURCE, model, typeDir.name), { withFileTypes: true })
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf")
        .map((entry) => ({ model, type, file: entry, source: path.join(SOURCE, model, typeDir.name, entry.name) }));
      for (const item of files) {
        const lang = language(item.file.name);
        if (!lang) {
          ignoredLanguages += 1;
          continue;
        }
        candidates.push({ ...item, lang });
      }
    }
  }

  const grouped = new Map();
  for (const item of candidates) {
    const key = `${productId(item.model)}|${item.type.id}|${item.lang}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const selected = Array.from(grouped.values()).map((items) => items.sort(compareVersions)[0]);
  const importedProductIds = new Set(selected.map((item) => productId(item.model)));
  const selectedTypeKeys = new Set(selected.map((item) => `${productId(item.model)}|${item.type.id}|${item.lang}`));
  const productsByModel = new Map();

  for (const item of selected) {
    const product = ensureProduct(categoriesData.categories, item.model, [item.type.id]);
    productsByModel.set(product.id, product);
    const outputDir = path.join(MANUALS_ROOT, product.categoryId, product.id, item.type.id);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${item.lang}.pdf`);
    fs.copyFileSync(item.source, outputPath);
  }

  const retainedIndex = manualsIndex.filter((entry) => {
    if (!importedProductIds.has(entry.productId)) return true;
    return !selectedTypeKeys.has(`${entry.productId}|${entry.typeId}|${entry.lang}`);
  });
  const newEntries = selected.map((item) => {
    const product = productsByModel.get(productId(item.model));
    return {
      productId: productId(item.model),
      categoryId: product.categoryId,
      typeId: item.type.id,
      lang: item.lang,
      title: `${item.model} ${item.type.label}`,
      path: `manuals/${product.categoryId}/${productId(item.model)}/${item.type.id}/${item.lang}.pdf`,
      format: "pdf",
      updatedAt: "2026-09-07"
    };
  });

  fs.writeFileSync(CATEGORIES_PATH, JSON.stringify(categoriesData, null, 2) + "\n", "utf8");
  fs.writeFileSync(INDEX_PATH, JSON.stringify([...retainedIndex, ...newEntries], null, 2) + "\n", "utf8");
  console.log(`Imported ${selected.length} PDF entries from ${candidates.length} language-matched PDFs.`);
  console.log(`Added or updated ${productsByModel.size} products.`);
  console.log(`Ignored ${ignoredPackingLists} packing-list folders and ${ignoredLanguages} PDFs with unsupported language names.`);
}

main();
