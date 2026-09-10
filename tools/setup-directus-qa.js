const fs = require("fs");

const env = {};
fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const baseUrl = "http://127.0.0.1:8055";

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
    { field: "answer_zh_tw", type: "text", meta: { interface: "input-multiline", width: "full" }, schema: {} }
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
  for (const action of actions) {
    const existing = await api("/permissions?filter[collection][_eq]=qa_items&filter[action][_eq]=" + action + "&filter[policy][_eq]=" + policyId);
    if (!existing.data || !existing.data.length) {
      await api("/permissions", { method: "POST", body: JSON.stringify({ collection: "qa_items", action, permissions: {}, validation: {}, presets: {}, fields: ["*"] , policy: policyId }) });
      console.log("Created permission: " + action);
    } else {
      console.log("Permission already exists: " + action);
    }
  }

  const access = await api("/access?filter[role][_eq]=" + roleId + "&filter[policy][_eq]=" + policyId);
  if (access.data && access.data.length) {
    console.log("Policy already attached to role");
  } else {
    await api("/access", { method: "POST", body: JSON.stringify({ role: roleId, policy: policyId }) });
    console.log("Attached policy to role");
  }

  console.log("Directus Q&A schema setup complete.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
