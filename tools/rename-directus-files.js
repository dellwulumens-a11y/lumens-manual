// One-off fix for files uploaded before migrate-content-to-directus.js gave
// them descriptive names: source files on disk are only named by language
// (e.g. "en.pdf", since the folder structure already encodes product/type),
// so the flat Directus File Library showed everything as "En"/"Zh Tw"/etc.
// This renames each already-uploaded file's metadata in place — no
// re-upload, so it's fast and safe to re-run.
const fs = require("fs");

const env = {};
try {
  fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  });
} catch (e) {}
Object.assign(env, process.env);

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
const EXT_BY_FORMAT = { pdf: ".pdf", standalone: ".html" };

async function main() {
  const login = await fetch(baseUrl + "/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email: env.DIRECTUS_ADMIN_EMAIL, password: env.DIRECTUS_ADMIN_PASSWORD })
  }).then((r) => r.json());
  token = login.data.access_token;

  const manuals = await request("/items/manuals?limit=-1&filter[file][_nnull]=true&fields=id,product,type,lang,title,format,file");

  let updated = 0, failed = 0;
  for (const m of manuals.data) {
    const ext = EXT_BY_FORMAT[m.format] || "";
    const filename = m.product + "-" + m.type + "-" + m.lang + ext;
    try {
      await request("/files/" + m.file, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ filename_download: filename, title: m.title })
      });
      updated++;
    } catch (error) {
      failed++;
      console.error("FAILED file " + m.file + " (manual " + m.id + "): " + error.message);
    }
  }
  console.log("Renamed " + updated + " files, " + failed + " failed.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
