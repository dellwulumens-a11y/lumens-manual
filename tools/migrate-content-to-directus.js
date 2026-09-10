// One-time migration: copies data/product-categories.json, data/manual-types.json
// and data/manuals-index.json (plus the actual files under manuals/) into the
// Directus collections created by tools/setup-directus-content.js. Safe to
// re-run: categories/types/products are upserted by id, and a manual record is
// skipped (not re-uploaded) if one already exists for the same product+type+lang.
const fs = require("fs");
const path = require("path");

const env = {};
try {
  fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  });
} catch (e) {}
Object.assign(env, process.env); // e.g. DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD to target a remote instance without editing .env

const baseUrl = env.DIRECTUS_URL || "http://127.0.0.1:8055";
let token;

async function request(pathname, options = {}) {
  const response = await fetch(baseUrl + pathname, {
    ...options,
    headers: { Authorization: "Bearer " + token, ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(pathname + " " + response.status + ": " + JSON.stringify(body));
  return body;
}

const jsonHeaders = { "Content-Type": "application/json" };

async function upsert(collection, id, data) {
  try {
    await request("/items/" + collection + "/" + encodeURIComponent(id));
    await request("/items/" + collection + "/" + encodeURIComponent(id), { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(data) });
    return "updated";
  } catch (error) {
    await request("/items/" + collection, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ id, ...data }) });
    return "created";
  }
}

async function uploadFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  const type = ext === ".pdf" ? "application/pdf" : "text/html";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), filename);
  const response = await fetch(baseUrl + "/files", { method: "POST", headers: { Authorization: "Bearer " + token }, body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("/files upload " + filename + " " + response.status + ": " + JSON.stringify(body));
  return body.data.id;
}

async function manualExists(product, type, lang) {
  const query = "/items/manuals?filter[product][_eq]=" + encodeURIComponent(product) + "&filter[type][_eq]=" + encodeURIComponent(type) + "&filter[lang][_eq]=" + encodeURIComponent(lang) + "&limit=1&fields=id";
  const result = await request(query);
  return result.data && result.data.length ? result.data[0].id : null;
}

async function main() {
  const login = await fetch(baseUrl + "/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: env.DIRECTUS_ADMIN_EMAIL, password: env.DIRECTUS_ADMIN_PASSWORD })
  }).then((r) => r.json());
  token = login.data.access_token;

  const categoriesData = JSON.parse(fs.readFileSync("data/product-categories.json", "utf8"));
  const typesData = JSON.parse(fs.readFileSync("data/manual-types.json", "utf8"));
  const manualsData = JSON.parse(fs.readFileSync("data/manuals-index.json", "utf8"));

  console.log("=== Manual types ===");
  for (const t of typesData.types) {
    const result = await upsert("manual_types", t.id, { order: t.order, name_en: t.name.en, name_zh_cn: t.name["zh-CN"], name_zh_tw: t.name["zh-TW"] });
    console.log(result + ": " + t.id);
  }

  console.log("=== Product categories ===");
  for (let i = 0; i < categoriesData.categories.length; i++) {
    const c = categoriesData.categories[i];
    const result = await upsert("product_categories", c.id, {
      order: i + 1,
      name_en: c.name.en, name_zh_cn: c.name["zh-CN"], name_zh_tw: c.name["zh-TW"],
      description_en: (c.description || {}).en || null,
      description_zh_cn: (c.description || {})["zh-CN"] || null,
      description_zh_tw: (c.description || {})["zh-TW"] || null
    });
    console.log(result + ": " + c.id);
  }

  console.log("=== Products ===");
  let productCount = 0;
  for (const c of categoriesData.categories) {
    for (const p of c.products) {
      const result = await upsert("products", p.id, {
        category: c.id,
        model: p.model,
        name_en: (p.name || {}).en || null,
        name_zh_cn: (p.name || {})["zh-CN"] || null,
        name_zh_tw: (p.name || {})["zh-TW"] || null,
        image: p.image,
        audiences: p.audiences || ["mainland", "global"],
        manuals: p.manuals || []
      });
      productCount++;
      console.log(result + ": " + p.id);
    }
  }
  console.log("Products done: " + productCount);

  console.log("=== Manuals (this uploads files, will take a while) ===");
  let created = 0, skipped = 0, failed = 0;
  for (let i = 0; i < manualsData.length; i++) {
    const m = manualsData[i];
    try {
      const existingId = await manualExists(m.productId, m.typeId, m.lang);
      if (existingId) { skipped++; continue; }

      const format = m.format || "fragment";
      const payload = {
        product: m.productId,
        type: m.typeId,
        lang: m.lang,
        title: m.title,
        format,
        status: "published"
      };

      if (format === "fragment") {
        payload.content = fs.readFileSync(m.path, "utf8");
      } else {
        payload.file = await uploadFile(m.path);
      }

      await request("/items/manuals", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) });
      created++;
    } catch (error) {
      failed++;
      console.error("FAILED " + m.path + ": " + error.message);
    }
    if ((i + 1) % 20 === 0 || i === manualsData.length - 1) {
      console.log("Progress: " + (i + 1) + "/" + manualsData.length + " (created " + created + ", skipped " + skipped + ", failed " + failed + ")");
    }
  }

  console.log("=== Done === created: " + created + ", skipped (already existed): " + skipped + ", failed: " + failed);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
