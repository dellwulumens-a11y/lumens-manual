// Creates the Directus collections needed to eventually replace the static
// data/product-categories.json, manual-types.json and manuals-index.json
// files: product_categories, manual_types, products, manuals. Schema only —
// migrating the existing 66 products / 256 manual records is a separate step
// once this structure is confirmed. Safe to re-run (checks before creating).
const fs = require("fs");

const env = {};
try {
  fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  });
} catch (e) {}
Object.assign(env, process.env); // e.g. DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD to target a remote instance without editing .env

const baseUrl = env.DIRECTUS_URL || "http://127.0.0.1:8055";

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(path + " " + response.status + ": " + JSON.stringify(body));
  return body;
}

async function ensureCollection(api, collection, meta, primaryKeyField) {
  try {
    await api("/collections/" + collection);
    console.log("Collection already exists: " + collection);
    return;
  } catch (error) {
    await api("/collections", {
      method: "POST",
      body: JSON.stringify({ collection, meta, schema: {}, fields: [primaryKeyField] })
    });
    console.log("Created collection: " + collection);
  }
}

async function ensureField(api, collection, field) {
  try {
    await api("/fields/" + collection + "/" + field.field);
    console.log("Field already exists: " + collection + "." + field.field);
  } catch (error) {
    await api("/fields/" + collection, { method: "POST", body: JSON.stringify(field) });
    console.log("Created field: " + collection + "." + field.field);
  }
}

async function ensureM2ORelation(api, collection, field, relatedCollection) {
  try {
    await api("/relations/" + collection + "/" + field);
    console.log("Relation already exists: " + collection + "." + field + " -> " + relatedCollection);
  } catch (error) {
    await api("/relations", {
      method: "POST",
      body: JSON.stringify({ collection, field, related_collection: relatedCollection })
    });
    console.log("Created relation: " + collection + "." + field + " -> " + relatedCollection);
  }
}

async function ensurePublicPermission(api, publicPolicyId, collection, action, permissions) {
  const existing = await api("/permissions?filter[collection][_eq]=" + collection + "&filter[action][_eq]=" + action + "&filter[policy][_eq]=" + publicPolicyId);
  if (existing.data && existing.data.length) {
    console.log("Public permission already exists: " + collection + "." + action);
    return;
  }
  await api("/permissions", {
    method: "POST",
    body: JSON.stringify({ collection, action, policy: publicPolicyId, permissions, fields: ["*"] })
  });
  console.log("Created public permission: " + collection + "." + action);
}

async function main() {
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: env.DIRECTUS_ADMIN_EMAIL, password: env.DIRECTUS_ADMIN_PASSWORD })
  });
  const headers = { Authorization: "Bearer " + login.data.access_token };
  const api = (path, options = {}) => request(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });

  const stringPk = (length) => ({ field: "id", type: "string", meta: { interface: "input", note: "沿用現有 JSON 資料的英文小寫代碼" }, schema: { is_primary_key: true, length: length || 64 } });

  await ensureCollection(api, "product_categories", { icon: "category", note: "產品分類" }, stringPk());
  await ensureCollection(api, "manual_types", { icon: "description", note: "手冊文件類型" }, stringPk());
  await ensureCollection(api, "products", { icon: "videocam", note: "產品型號" }, stringPk());
  await ensureCollection(api, "manuals", { icon: "menu_book", note: "手冊文件（每個產品/類型/語言一筆）" }, { field: "id", type: "integer", meta: { interface: "input", hidden: true, readonly: true }, schema: { is_primary_key: true, has_auto_increment: true } });

  const langField = (prefix, label, type) => ({
    field: prefix, type: type || "string",
    meta: { interface: type === "text" ? "input-multiline" : "input", note: label, width: "full" },
    schema: {}
  });

  await ensureField(api, "product_categories", { field: "order", type: "integer", meta: { interface: "input", width: "half" }, schema: { default_value: 10 } });
  await ensureField(api, "product_categories", langField("name_en", "分類名稱（英文）"));
  await ensureField(api, "product_categories", langField("name_zh_cn", "分類名稱（簡體）"));
  await ensureField(api, "product_categories", langField("name_zh_tw", "分類名稱（繁體）"));
  await ensureField(api, "product_categories", langField("description_en", "分類說明（英文）", "text"));
  await ensureField(api, "product_categories", langField("description_zh_cn", "分類說明（簡體）", "text"));
  await ensureField(api, "product_categories", langField("description_zh_tw", "分類說明（繁體）", "text"));

  await ensureField(api, "manual_types", { field: "order", type: "integer", meta: { interface: "input", width: "half" }, schema: { default_value: 10 } });
  await ensureField(api, "manual_types", langField("name_en", "類型名稱（英文）"));
  await ensureField(api, "manual_types", langField("name_zh_cn", "類型名稱（簡體）"));
  await ensureField(api, "manual_types", langField("name_zh_tw", "類型名稱（繁體）"));

  await ensureField(api, "products", { field: "category", type: "string", meta: { interface: "select-dropdown-m2o", width: "half" }, schema: {} });
  await ensureM2ORelation(api, "products", "category", "product_categories");
  await ensureField(api, "products", { field: "model", type: "string", meta: { interface: "input", width: "half" }, schema: {} });
  await ensureField(api, "products", langField("name_en", "產品名稱（英文，可留空以型號顯示）"));
  await ensureField(api, "products", langField("name_zh_cn", "產品名稱（簡體，可留空以型號顯示）"));
  await ensureField(api, "products", langField("name_zh_tw", "產品名稱（繁體，可留空以型號顯示）"));
  await ensureField(api, "products", { field: "image", type: "string", meta: { interface: "input", note: "圖片路徑，例如 assets/images/products/placeholder-camera.svg", width: "full" }, schema: {} });
  await ensureField(api, "products", { field: "audiences", type: "json", meta: { interface: "tags", note: "適用市場：mainland、global", options: { presets: ["mainland", "global"] }, width: "full" }, schema: {} });
  await ensureField(api, "products", { field: "manuals", type: "json", meta: { interface: "tags", note: "這個產品規劃要有哪些手冊類型（即使檔案還沒上架也可先列出）", options: { presets: ["user-guide", "installation-guide", "command-set", "quick-start", "other"] }, width: "full" }, schema: {} });

  await ensureField(api, "manuals", { field: "product", type: "string", meta: { interface: "select-dropdown-m2o", width: "half" }, schema: {} });
  await ensureM2ORelation(api, "manuals", "product", "products");
  await ensureField(api, "manuals", { field: "type", type: "string", meta: { interface: "select-dropdown-m2o", width: "half" }, schema: {} });
  await ensureM2ORelation(api, "manuals", "type", "manual_types");
  await ensureField(api, "manuals", { field: "lang", type: "string", meta: { interface: "select-dropdown", options: { choices: [{ text: "English", value: "en" }, { text: "简体中文", value: "zh-CN" }, { text: "繁體中文", value: "zh-TW" }] }, width: "half" }, schema: {} });
  await ensureField(api, "manuals", { field: "title", type: "string", meta: { interface: "input", width: "full" }, schema: {} });
  await ensureField(api, "manuals", { field: "format", type: "string", meta: { interface: "select-dropdown", options: { choices: [{ text: "內容片段", value: "fragment" }, { text: "完整獨立頁面", value: "standalone" }, { text: "PDF", value: "pdf" }] }, width: "half" }, schema: { default_value: "fragment" } });
  await ensureField(api, "manuals", { field: "status", type: "string", meta: { interface: "select-dropdown", options: { choices: [{ text: "草稿", value: "draft" }, { text: "已發布", value: "published" }] }, width: "half" }, schema: { default_value: "draft" } });
  await ensureField(api, "manuals", { field: "content", type: "text", meta: { interface: "input-rich-text-html", note: "format=fragment 時使用：乾淨的 HTML 片段", width: "full" }, schema: {} });
  await ensureField(api, "manuals", { field: "file", type: "uuid", meta: { interface: "file", note: "format=standalone 或 pdf 時使用：上傳對應檔案", width: "full" }, schema: {} });
  await ensureM2ORelation(api, "manuals", "file", "directus_files");
  await ensureField(api, "manuals", { field: "date_updated", type: "timestamp", meta: { special: ["date-updated"], interface: "datetime", readonly: true, width: "half" }, schema: {} });

  const publicPolicy = await api("/policies?filter[name][_eq]=%24t:public_label");
  const publicPolicyId = publicPolicy.data[0].id;
  await ensurePublicPermission(api, publicPolicyId, "product_categories", "read", {});
  await ensurePublicPermission(api, publicPolicyId, "manual_types", "read", {});
  await ensurePublicPermission(api, publicPolicyId, "products", "read", {});
  await ensurePublicPermission(api, publicPolicyId, "manuals", "read", { status: { _eq: "published" } });
  await ensurePublicPermission(api, publicPolicyId, "directus_files", "read", {});

  console.log("Directus content schema setup complete.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
