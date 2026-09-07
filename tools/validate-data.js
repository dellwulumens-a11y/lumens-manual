#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LANGS = ["en", "zh-CN", "zh-TW"];

function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(relativePath + ": " + error.message);
  }
}

function assertUnique(values, label) {
  const seen = new Set();
  values.forEach((value) => {
    if (!value) throw new Error(label + " cannot be empty");
    if (seen.has(value)) throw new Error(label + " is duplicated: " + value);
    seen.add(value);
  });
}

function main() {
  const categoriesData = readJson("data/product-categories.json");
  const typesData = readJson("data/manual-types.json");
  const manuals = readJson("data/manuals-index.json");
  const categories = categoriesData.categories;
  const types = typesData.types;

  if (!Array.isArray(categories)) throw new Error("data/product-categories.json: categories must be an array");
  if (!Array.isArray(types)) throw new Error("data/manual-types.json: types must be an array");
  if (!Array.isArray(manuals)) throw new Error("data/manuals-index.json: root must be an array");

  assertUnique(categories.map((category) => category.id), "Product line id");
  assertUnique(types.map((type) => type.id), "Document type id");

  const categoryIds = new Set(categories.map((category) => category.id));
  const typeIds = new Set(types.map((type) => type.id));
  const productIds = [];
  const products = new Map();

  categories.forEach((category) => {
    if (!categoryIds.has(category.id)) throw new Error("Unknown product line: " + category.id);
    (category.products || []).forEach((product) => {
      productIds.push(product.id);
      products.set(product.id, product);
      (product.manuals || []).forEach((typeId) => {
        if (!typeIds.has(typeId)) throw new Error("Product " + product.id + " references unknown document type: " + typeId);
      });
    });
  });
  assertUnique(productIds, "Product id");

  const manualKeys = [];
  manuals.forEach((entry) => {
    const key = entry.productId + "/" + entry.typeId + "/" + entry.lang;
    manualKeys.push(key);
    if (!products.has(entry.productId)) throw new Error("Manual references unknown product: " + entry.productId);
    if (!typeIds.has(entry.typeId)) throw new Error("Manual references unknown document type: " + entry.typeId);
    if (!LANGS.includes(entry.lang)) throw new Error("Manual has unsupported language: " + entry.lang);
    if (!/^manuals\/[A-Za-z0-9._/-]+$/.test(entry.path || "") || entry.path.includes("..")) {
      throw new Error("Manual path is invalid: " + entry.path);
    }
    if (!fs.existsSync(path.join(ROOT, entry.path))) throw new Error("Manual file is missing: " + entry.path);
  });
  assertUnique(manualKeys, "Manual index entry");
  console.log("Data validation passed: " + categories.length + " product lines, " + productIds.length + " products, " + manuals.length + " manuals");
}

main();
