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

const productCategories = JSON.parse(fs.readFileSync("data/product-categories.json", "utf8"));
const PRODUCT_MODELS = productCategories.categories.flatMap((cat) => (cat.products || []).map((p) => p.model || p.id));

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(path + " " + response.status + ": " + JSON.stringify(body));
  return body;
}

async function main() {
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: env.DIRECTUS_ADMIN_EMAIL, password: env.DIRECTUS_ADMIN_PASSWORD })
  });
  const headers = { Authorization: "Bearer " + login.data.access_token };
  const api = (path, options = {}) => request(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });

  let collection;
  try {
    collection = await api("/collections/qa_items");
    console.log("Collection already exists: qa_items");
  } catch (error) {
    collection = await api("/collections", {
      method: "POST",
      body: JSON.stringify({
        collection: "qa_items",
        meta: { icon: "quiz", note: "TS 維護的多語 Q&A", display_template: "{{question_en}}" },
        schema: {}
      })
    });
    console.log("Created collection: " + collection.data.collection);
  }

  const fields = [
    { field: "status", type: "string", meta: { interface: "select-dropdown", options: { choices: [{ text: "草稿", value: "draft" }, { text: "審核中", value: "in_review" }, { text: "已發布", value: "published" }] }, width: "half" }, schema: { default_value: "draft" } },
    { field: "sort", type: "integer", meta: { interface: "input", width: "half" }, schema: { default_value: 10 } },
    { field: "category", type: "string", meta: { interface: "input", width: "half" }, schema: {} },
    { field: "question_en", type: "text", meta: { interface: "input", width: "full" }, schema: {} },
    { field: "question_zh_cn", type: "text", meta: { interface: "input", width: "full" }, schema: {} },
    { field: "question_zh_tw", type: "text", meta: { interface: "input", width: "full" }, schema: {} },
    { field: "answer_en", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} },
    { field: "answer_zh_cn", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} },
    { field: "answer_zh_tw", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} },
    {
      field: "products",
      type: "json",
      meta: {
        interface: "tags",
        note: "適用機種型號，可複選多個",
        options: { presets: PRODUCT_MODELS, allowCustom: true },
        width: "full"
      },
      schema: {}
    },
    {
      field: "date_updated",
      type: "timestamp",
      meta: { special: ["date-updated"], interface: "datetime", readonly: true, width: "half", note: "發布/更新時間，前台以此欄位排序（最新在最上面）" },
      schema: {}
    }
  ];

  for (const field of fields) {
    try {
      await api("/fields/qa_items/" + field.field);
      console.log("Field already exists: " + field.field);
    } catch (error) {
      await api("/fields/qa_items", { method: "POST", body: JSON.stringify(field) });
      console.log("Created field: " + field.field);
    }
  }

  let roleId;
  try {
    const roles = await api("/roles?filter[name][_eq]=TS%20Q%26A%20Editor");
    if (roles.data && roles.data.length) {
      console.log("Role already exists: TS Q&A Editor");
      roleId = roles.data[0].id;
      console.log("Role id: " + roleId);
    } else {
      const role = await api("/roles", { method: "POST", body: JSON.stringify({ name: "TS Q&A Editor", icon: "quiz", description: "Maintain Q&A content without system administration", app_access: true, admin_access: false }) });
      roleId = role.data.id;
      console.log("Created role: " + role.data.id);
    }
  } catch (error) {
    console.log("Role setup needs the Directus UI or policy API: " + error.message);
  }

  let policyId;
  const policies = await api("/policies?filter[name][_eq]=TS%20Q%26A%20Editor");
  if (policies.data && policies.data.length) {
    policyId = policies.data[0].id;
    console.log("Policy already exists: " + policyId);
  } else {
    const policy = await api("/policies", { method: "POST", body: JSON.stringify({ name: "TS Q&A Editor", icon: "quiz", description: "Q&A content access", app_access: true, admin_access: false }) });
    policyId = policy.data.id;
    console.log("Created policy: " + policyId);
  }

  const actions = ["read", "create", "update", "delete"];
  const permissionCollections = ["qa_items", "directus_files", "directus_folders"];
  for (const collection of permissionCollections) {
    for (const action of actions) {
      const existing = await api("/permissions?filter[collection][_eq]=" + collection + "&filter[action][_eq]=" + action + "&filter[policy][_eq]=" + policyId);
      if (!existing.data || !existing.data.length) {
        await api("/permissions", { method: "POST", body: JSON.stringify({ collection, action, permissions: {}, validation: {}, presets: {}, fields: ["*"], policy: policyId }) });
        console.log("Created permission: " + collection + "." + action);
      } else {
        console.log("Permission already exists: " + collection + "." + action);
      }
    }
  }

  const access = await api("/access?filter[role][_eq]=" + roleId + "&filter[policy][_eq]=" + policyId);
  if (access.data && access.data.length) {
    console.log("Policy already attached to role");
  } else {
    await api("/access", { method: "POST", body: JSON.stringify({ role: roleId, policy: policyId }) });
    console.log("Attached policy to role");
  }

  const publicPolicy = await api("/policies?filter[name][_eq]=%24t:public_label");
  const publicPolicyId = publicPolicy.data[0].id;
  const existingPublicRead = await api("/permissions?filter[collection][_eq]=qa_items&filter[action][_eq]=read&filter[policy][_eq]=" + publicPolicyId);
  if (existingPublicRead.data && existingPublicRead.data.length) {
    console.log("Public read permission already exists: qa_items");
  } else {
    await api("/permissions", {
      method: "POST",
      body: JSON.stringify({ collection: "qa_items", action: "read", policy: publicPolicyId, permissions: { status: { _eq: "published" } }, fields: ["*"] })
    });
    console.log("Created public read permission: qa_items (published only)");
  }

  console.log("Directus Q&A schema setup complete.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
