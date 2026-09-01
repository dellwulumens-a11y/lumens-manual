#!/usr/bin/env node
/**
 * Builds data/search-index.json by extracting plain text from every manual
 * HTML fragment listed in data/manuals-index.json.
 *
 * Run this once after adding or editing manual content:
 *   node tools/build-search-index.js
 *
 * It does not touch product-categories.json or manual-types.json — those
 * stay hand-edited. This script only regenerates the search text index.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "data", "manuals-index.json");
const OUT_PATH = path.join(ROOT, "data", "search-index.json");

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const manualsIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const out = [];
  let missing = 0;

  manualsIndex.forEach((entry) => {
    const filePath = path.join(ROOT, entry.path);
    if (!fs.existsSync(filePath)) {
      console.warn("  ! missing file, skipped:", entry.path);
      missing++;
      return;
    }
    const html = fs.readFileSync(filePath, "utf8");
    const text = stripHtml(html).slice(0, 8000);
    out.push({
      productId: entry.productId,
      categoryId: entry.categoryId,
      typeId: entry.typeId,
      lang: entry.lang,
      title: entry.title,
      path: entry.path,
      text: text
    });
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote " + out.length + " entries to data/search-index.json" + (missing ? " (" + missing + " missing files skipped)" : ""));
}

main();
