/* Lumens 手冊管理後台
 * 直接透過 GitHub Contents API 讀寫 data/*.json 與 manuals/**\/*.html，
 * 每個儲存動作都是一次真正的 git commit，網站沿用既有的 GitHub Pages 自動部署。
 * 沒有草稿／審核機制：儲存 = 立即上線（透過 GitHub Pages 重新部署，約 30-90 秒）。
 */
(function () {
  "use strict";

  var CFG_KEY = "lumens-admin-github-cfg";
  var LANGS = ["en", "zh-CN", "zh-TW"];
  var LANG_LABELS = { en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" };

  var cfg = null; // { owner, repo, branch, token }
  var shas = {};  // path -> sha
  var state = { categories: [], types: [], manualsIndex: [], searchIndex: [] };

  var PATHS = {
    categories: "data/product-categories.json",
    types: "data/manual-types.json",
    manualsIndex: "data/manuals-index.json",
    searchIndex: "data/search-index.json"
  };

  var SECTION_TEMPLATES = {
    "user-guide": '<h2 id="overview">Overview</h2>\n<p></p>\n\n<h2 id="package-contents">Package Contents</h2>\n<ul>\n  <li></li>\n</ul>\n\n<h2 id="setup">Setup &amp; Connections</h2>\n<p></p>\n\n<h2 id="operation">Basic Operation</h2>\n<p></p>\n\n<h2 id="specifications">Specifications</h2>\n<table>\n  <thead><tr><th>Item</th><th>Value</th></tr></thead>\n  <tbody>\n    <tr><td></td><td></td></tr>\n  </tbody>\n</table>\n\n<h2 id="troubleshooting">Troubleshooting</h2>\n<p></p>',
    "installation-guide": '<h2 id="before-you-start">Before You Start</h2>\n<ul>\n  <li></li>\n</ul>\n\n<h2 id="mounting">Mounting</h2>\n<p></p>\n\n<h2 id="wiring">Wiring</h2>\n<table>\n  <thead><tr><th>Cable</th><th>Recommendation</th></tr></thead>\n  <tbody>\n    <tr><td></td><td></td></tr>\n  </tbody>\n</table>\n\n<h2 id="network-setup">Network Setup</h2>\n<p></p>\n\n<h2 id="verification">Installation Verification</h2>\n<p></p>',
    "command-set": '<h2 id="connection">Connection</h2>\n<table>\n  <thead><tr><th>Interface</th><th>Default Setting</th></tr></thead>\n  <tbody>\n    <tr><td></td><td></td></tr>\n  </tbody>\n</table>\n\n<h2 id="command-format">Command Format</h2>\n<p></p>\n\n<h2 id="ptz-commands">Commands</h2>\n<table>\n  <thead><tr><th>Function</th><th>Command</th></tr></thead>\n  <tbody>\n    <tr><td></td><td><code></code></td></tr>\n  </tbody>\n</table>',
    "default": '<h2 id="section-1">Section title</h2>\n<p></p>'
  };

  // ---------------------------------------------------------------- utils --

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slugify(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function b64ToUtf8(b64) {
    var binary = atob(String(b64 || "").replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function stripHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ").trim();
  }

  // ------------------------------------------------------------ GitHub API --

  function apiUrl(path) {
    return "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/contents/" + path;
  }
  function apiHeaders(extra) {
    var h = {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  function ghError(res) {
    return res.json().catch(function () { return {}; }).then(function (j) {
      var msg = res.status + " " + res.statusText + (j.message ? " — " + j.message : "");
      if (res.status === 401) msg = "Token 無效或已過期，請重新登入。";
      if (res.status === 403) msg = "沒有權限，請確認 Token 有這個 repository 的 Contents 讀寫權限。(" + msg + ")";
      if (res.status === 409 || res.status === 422) msg = "檔案在你之外的地方被改動過（版本衝突），請按「重新整理資料」後再試一次。(" + msg + ")";
      return new Error(msg);
    });
  }
  function ghGet(path) {
    return fetch(apiUrl(path) + "?ref=" + encodeURIComponent(cfg.branch), { headers: apiHeaders() })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) return ghError(res).then(function (e) { throw e; });
        return res.json().then(function (data) {
          shas[path] = data.sha;
          return { sha: data.sha, text: b64ToUtf8(data.content) };
        });
      });
  }
  function ghPut(path, text, message) {
    var body = { message: message, content: utf8ToB64(text), branch: cfg.branch };
    if (shas[path]) body.sha = shas[path];
    return fetch(apiUrl(path), { method: "PUT", headers: apiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) })
      .then(function (res) {
        if (!res.ok) return ghError(res).then(function (e) { throw e; });
        return res.json().then(function (data) {
          shas[path] = data.content.sha;
          return data;
        });
      });
  }
  function ghDelete(path, message) {
    var run = function () {
      return fetch(apiUrl(path), {
        method: "DELETE",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ message: message, sha: shas[path], branch: cfg.branch })
      }).then(function (res) {
        if (res.status === 404) { delete shas[path]; return null; }
        if (!res.ok) return ghError(res).then(function (e) { throw e; });
        delete shas[path];
        return res.json();
      });
    };
    if (shas[path]) return run();
    return ghGet(path).then(function (cur) { if (!cur) return null; return run(); });
  }

  // -------------------------------------------------------------- loading --

  function loadAll() {
    return Promise.all([
      ghGet(PATHS.categories), ghGet(PATHS.types), ghGet(PATHS.manualsIndex), ghGet(PATHS.searchIndex)
    ]).then(function (res) {
      if (!res[0] || !res[1] || !res[2]) throw new Error("找不到 data/product-categories.json、manual-types.json 或 manuals-index.json，請確認 repo 與分支是否正確。");
      state.categories = JSON.parse(res[0].text).categories || [];
      state.types = JSON.parse(res[1].text).types || [];
      state.manualsIndex = JSON.parse(res[2].text) || [];
      state.searchIndex = res[3] ? (JSON.parse(res[3].text) || []) : [];
    });
  }

  function saveCategories(message) { return ghPut(PATHS.categories, JSON.stringify({ categories: state.categories }, null, 2) + "\n", message); }
  function saveTypes(message) { return ghPut(PATHS.types, JSON.stringify({ types: state.types }, null, 2) + "\n", message); }
  function saveManualsIndex(message) { return ghPut(PATHS.manualsIndex, JSON.stringify(state.manualsIndex, null, 2) + "\n", message); }
  function saveSearchIndex(message) { return ghPut(PATHS.searchIndex, JSON.stringify(state.searchIndex, null, 2) + "\n", message); }

  // ------------------------------------------------------------ data lookups --

  function findCategory(id) { return state.categories.filter(function (c) { return c.id === id; })[0] || null; }
  function findProductEntry(id) {
    for (var i = 0; i < state.categories.length; i++) {
      var cat = state.categories[i];
      var p = (cat.products || []).filter(function (p) { return p.id === id; })[0];
      if (p) return { product: p, category: cat };
    }
    return null;
  }
  function findType(id) { return state.types.filter(function (t) { return t.id === id; })[0] || null; }
  function sortedTypes() { return state.types.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function allProducts() {
    var out = [];
    state.categories.forEach(function (c) { (c.products || []).forEach(function (p) { out.push({ product: p, category: c }); }); });
    return out;
  }

  // ---------------------------------------------------------- write operations --

  function upsertCategory(data, isNew) {
    if (isNew) {
      if (findCategory(data.id)) return Promise.reject(new Error("這個產品線代碼已經存在: " + data.id));
      state.categories.push({ id: data.id, name: data.name, description: data.description, products: [] });
    } else {
      var c = findCategory(data.id);
      if (!c) return Promise.reject(new Error("找不到產品線: " + data.id));
      c.name = data.name; c.description = data.description;
    }
    return saveCategories((isNew ? "新增" : "更新") + "產品線: " + data.id);
  }

  function deleteCategory(id) {
    var c = findCategory(id);
    if (!c) return Promise.resolve();
    if ((c.products || []).length) return Promise.reject(new Error("這個產品線底下還有 " + c.products.length + " 個產品，請先刪除或搬移產品後再刪除產品線。"));
    state.categories = state.categories.filter(function (x) { return x.id !== id; });
    return saveCategories("刪除產品線: " + id);
  }

  function upsertProduct(data, isNew, prevCategoryId) {
    if (isNew) {
      if (findProductEntry(data.id)) return Promise.reject(new Error("這個產品代碼已經存在: " + data.id));
      var cat = findCategory(data.categoryId);
      if (!cat) return Promise.reject(new Error("找不到產品線: " + data.categoryId));
      cat.products = cat.products || [];
      cat.products.push({ id: data.id, model: data.model, name: data.name, image: data.image, manuals: data.manuals || [] });
    } else {
      var found = findProductEntry(data.id);
      if (!found) return Promise.reject(new Error("找不到產品: " + data.id));
      if (prevCategoryId && prevCategoryId !== data.categoryId) {
        found.category.products = found.category.products.filter(function (p) { return p.id !== data.id; });
        var newCat = findCategory(data.categoryId);
        if (!newCat) return Promise.reject(new Error("找不到產品線: " + data.categoryId));
        newCat.products = newCat.products || [];
        newCat.products.push({ id: data.id, model: data.model, name: data.name, image: data.image, manuals: data.manuals || [] });
      } else {
        found.product.model = data.model; found.product.name = data.name;
        found.product.image = data.image; found.product.manuals = data.manuals || [];
      }
    }
    return saveCategories((isNew ? "新增" : "更新") + "產品: " + data.id);
  }

  function deleteProduct(id) {
    var found = findProductEntry(id);
    if (!found) return Promise.resolve();
    var related = state.manualsIndex.filter(function (m) { return m.productId === id; });
    return related.reduce(function (p, m) {
      return p.then(function () { return ghDelete(m.path, "刪除手冊檔案: " + m.path).catch(function () {}); });
    }, Promise.resolve()).then(function () {
      state.manualsIndex = state.manualsIndex.filter(function (m) { return m.productId !== id; });
      state.searchIndex = state.searchIndex.filter(function (m) { return m.productId !== id; });
      found.category.products = found.category.products.filter(function (p) { return p.id !== id; });
      return saveCategories("刪除產品: " + id);
    }).then(function () { return saveManualsIndex("移除產品的手冊索引: " + id); })
      .then(function () { return saveSearchIndex("移除產品的搜尋索引: " + id); });
  }

  function upsertManualType(data, isNew) {
    if (isNew) {
      if (findType(data.id)) return Promise.reject(new Error("這個文件類型代碼已經存在: " + data.id));
      state.types.push({ id: data.id, order: data.order, name: data.name });
    } else {
      var t = findType(data.id);
      if (!t) return Promise.reject(new Error("找不到文件類型: " + data.id));
      t.order = data.order; t.name = data.name;
    }
    return saveTypes((isNew ? "新增" : "更新") + "文件類型: " + data.id);
  }

  function deleteManualType(id) {
    var usedByProduct = state.categories.some(function (c) { return (c.products || []).some(function (p) { return (p.manuals || []).indexOf(id) !== -1; }); });
    var usedByManual = state.manualsIndex.some(function (m) { return m.typeId === id; });
    if (usedByProduct || usedByManual) return Promise.reject(new Error("這個文件類型還有產品或手冊在使用，請先移除相關項目後再刪除。"));
    state.types = state.types.filter(function (t) { return t.id !== id; });
    return saveTypes("刪除文件類型: " + id);
  }

  function saveManualContent(data) {
    var found = findProductEntry(data.productId);
    if (!found) return Promise.reject(new Error("找不到產品: " + data.productId));
    var path = "manuals/" + found.category.id + "/" + data.productId + "/" + data.typeId + "/" + data.lang + ".html";
    return ghGet(path).then(function () {
      return ghPut(path, data.content.trim() + "\n", "更新手冊內容: " + path);
    }).then(function () {
      var today = todayStr();
      var idx = state.manualsIndex.findIndex(function (m) { return m.productId === data.productId && m.typeId === data.typeId && m.lang === data.lang; });
      var entry = { productId: data.productId, categoryId: found.category.id, typeId: data.typeId, lang: data.lang, title: data.title, path: path, updatedAt: today };
      if (idx === -1) state.manualsIndex.push(entry); else state.manualsIndex[idx] = entry;
      return saveManualsIndex("更新手冊索引: " + path);
    }).then(function () {
      var sIdx = state.searchIndex.findIndex(function (m) { return m.productId === data.productId && m.typeId === data.typeId && m.lang === data.lang; });
      var sEntry = { productId: data.productId, categoryId: found.category.id, typeId: data.typeId, lang: data.lang, title: data.title, path: path, text: stripHtml(data.content).slice(0, 8000) };
      if (sIdx === -1) state.searchIndex.push(sEntry); else state.searchIndex[sIdx] = sEntry;
      return saveSearchIndex("更新搜尋索引: " + path);
    }).then(function () {
      if ((found.product.manuals || []).indexOf(data.typeId) === -1) {
        found.product.manuals = (found.product.manuals || []).concat([data.typeId]);
        return saveCategories("將「" + data.typeId + "」加入產品 " + data.productId + " 的手冊清單");
      }
    });
  }

  function deleteManualContent(productId, typeId, lang) {
    var found = findProductEntry(productId);
    var entry = state.manualsIndex.filter(function (m) { return m.productId === productId && m.typeId === typeId && m.lang === lang; })[0];
    var p = entry ? ghDelete(entry.path, "刪除手冊檔案: " + entry.path).catch(function () {}) : Promise.resolve();
    return p.then(function () {
      state.manualsIndex = state.manualsIndex.filter(function (m) { return !(m.productId === productId && m.typeId === typeId && m.lang === lang); });
      return saveManualsIndex("刪除手冊索引: " + productId + "/" + typeId + "/" + lang);
    }).then(function () {
      state.searchIndex = state.searchIndex.filter(function (m) { return !(m.productId === productId && m.typeId === typeId && m.lang === lang); });
      return saveSearchIndex("刪除搜尋索引: " + productId + "/" + typeId + "/" + lang);
    }).then(function () {
      var remaining = state.manualsIndex.some(function (m) { return m.productId === productId && m.typeId === typeId; });
      if (!remaining && found && (found.product.manuals || []).indexOf(typeId) !== -1) {
        found.product.manuals = found.product.manuals.filter(function (t) { return t !== typeId; });
        return saveCategories("從產品 " + productId + " 移除已無內容的文件類型 " + typeId);
      }
    });
  }

  // -------------------------------------------------------------------- UI --

  function showStatus(kind, text) {
    var el = $("#statusBanner");
    el.className = "status-banner " + kind;
    el.textContent = text;
    el.hidden = false;
    if (kind !== "busy") {
      clearTimeout(showStatus._t);
      showStatus._t = setTimeout(function () { el.hidden = true; }, 6000);
    }
  }

  function withBusy(label, fn) {
    showStatus("busy", label + "…");
    return fn().then(function (r) {
      showStatus("ok", label + "完成，網站將在約 30–90 秒內自動重新部署。");
      return r;
    }).catch(function (err) {
      showStatus("err", "失敗：" + err.message);
      throw err;
    });
  }

  // ---- generic dialog form ----
  function openDialog(opts) {
    // opts: { title, fieldsHtml, initialErrors, onSubmit(formEl) -> Promise }
    var dlg = $("#formDialog");
    $("#formDialogTitle").textContent = opts.title;
    $("#formDialogBody").innerHTML = opts.fieldsHtml;
    var errEl = $("#formDialogError");
    errEl.hidden = true; errEl.textContent = "";
    var form = $("#formDialogForm");

    var submitHandler = function (e) {
      e.preventDefault();
      errEl.hidden = true;
      $("#formDialogSubmit").disabled = true;
      opts.onSubmit(form).then(function () {
        form.removeEventListener("submit", submitHandler);
        dlg.close();
      }).catch(function (err) {
        errEl.textContent = err.message || String(err);
        errEl.hidden = false;
      }).finally(function () { $("#formDialogSubmit").disabled = false; });
    };
    form.addEventListener("submit", submitHandler);

    $("#formDialogCancel").onclick = function () { form.removeEventListener("submit", submitHandler); dlg.close(); };
    dlg.showModal();
    if (opts.afterOpen) opts.afterOpen(form);
  }

  function langFieldGroup(prefix, label, values, opts) {
    values = values || {};
    opts = opts || {};
    var tag = opts.textarea ? "textarea" : "input type=\"text\"";
    return (
      '<div class="lang-field-group"><div class="lbl">' + esc(label) + '</div>' +
      LANGS.map(function (l) {
        var fname = prefix + "_" + l.replace("-", "");
        var v = esc(values[l] || "");
        if (opts.textarea) {
          return '<div class="field"><label for="' + fname + '">' + LANG_LABELS[l] + '</label><textarea id="' + fname + '" name="' + fname + '" rows="2">' + v + "</textarea></div>";
        }
        return '<div class="field"><label for="' + fname + '">' + LANG_LABELS[l] + '</label><input id="' + fname + '" name="' + fname + '" type="text" value="' + v + '"></div>';
      }).join("") +
      "</div>"
    );
  }
  function readLangField(form, prefix) {
    var out = {};
    LANGS.forEach(function (l) {
      var fname = prefix + "_" + l.replace("-", "");
      out[l] = (form.elements[fname] && form.elements[fname].value || "").trim();
    });
    return out;
  }

  // ---------------------------------------------------------- Categories tab --

  function renderCategories() {
    var panel = $("#panel-categories");
    var rows = state.categories.map(function (c) {
      return (
        "<tr>" +
          "<td><code>" + esc(c.id) + "</code></td>" +
          "<td>" + esc(c.name["zh-TW"] || c.name.en) + '<div class="muted">' + esc(c.name.en) + "</div></td>" +
          "<td>" + (c.products || []).length + "</td>" +
          '<td class="row-actions">' +
            '<button class="btn small" data-edit-cat="' + esc(c.id) + '">編輯</button>' +
            '<button class="btn small danger" data-del-cat="' + esc(c.id) + '">刪除</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");

    panel.innerHTML =
      '<div class="admin-toolbar"><div class="spacer"></div><button class="btn primary" id="addCatBtn">+ 新增產品線</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>代碼</th><th>名稱</th><th>產品數</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="empty-state">還沒有任何產品線</td></tr>') +
      "</tbody></table></div>";

    $("#addCatBtn").onclick = function () { openCategoryForm(null); };
    $all("[data-edit-cat]", panel).forEach(function (b) { b.onclick = function () { openCategoryForm(findCategory(b.dataset.editCat)); }; });
    $all("[data-del-cat]", panel).forEach(function (b) {
      b.onclick = function () {
        if (!confirm("確定要刪除產品線「" + b.dataset.delCat + "」嗎？")) return;
        withBusy("刪除產品線", function () { return deleteCategory(b.dataset.delCat); })
          .then(renderCategories).then(renderProducts).catch(function () {});
      };
    });
  }

  function openCategoryForm(existing) {
    var isNew = !existing;
    var fields =
      '<div class="field"><label>代碼 (id)</label><input name="id" type="text" value="' + esc(existing ? existing.id : "") + '" ' + (isNew ? "" : "disabled") + ' placeholder="例如 ptz-camera" required></div>' +
      (isNew ? '<p class="field-help">建立後無法修改代碼。</p>' : "") +
      langFieldGroup("name", "名稱", existing ? existing.name : {}) +
      langFieldGroup("desc", "說明", existing ? existing.description : {}, { textarea: true });

    openDialog({
      title: isNew ? "新增產品線" : "編輯產品線：" + existing.id,
      fieldsHtml: fields,
      onSubmit: function (form) {
        var id = isNew ? slugify(form.elements.id.value) : existing.id;
        if (!id) return Promise.reject(new Error("請輸入代碼"));
        var data = { id: id, name: readLangField(form, "name"), description: readLangField(form, "desc") };
        if (!data.name.en) return Promise.reject(new Error("請至少填寫英文名稱"));
        return withBusy(isNew ? "新增產品線" : "更新產品線", function () { return upsertCategory(data, isNew); })
          .then(function () { renderCategories(); renderProducts(); });
      }
    });
  }

  // ------------------------------------------------------------ Products tab --

  function renderProducts() {
    var panel = $("#panel-products");
    var catOptions = '<option value="">全部產品線</option>' + state.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name["zh-TW"] || c.name.en) + "</option>";
    }).join("");

    panel.innerHTML =
      '<div class="admin-toolbar">' +
        '<select id="prodCatFilter">' + catOptions + "</select>" +
        '<div class="spacer"></div><button class="btn primary" id="addProdBtn">+ 新增產品</button>' +
      "</div>" +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>型號</th><th>名稱</th><th>產品線</th><th>已宣告的文件類型</th><th></th></tr></thead><tbody id="prodTbody"></tbody></table></div>';

    function renderRows() {
      var filterCat = $("#prodCatFilter").value;
      var list = allProducts().filter(function (e) { return !filterCat || e.category.id === filterCat; });
      var typeMap = {};
      state.types.forEach(function (t) { typeMap[t.id] = t; });

      $("#prodTbody").innerHTML = list.map(function (e) {
        var p = e.product;
        var chips = (p.manuals || []).map(function (tid) {
          return '<span class="chip-sm">' + esc(typeMap[tid] ? typeMap[tid].name["zh-TW"] : tid) + "</span>";
        }).join("") || '<span class="muted">尚未設定</span>';
        return (
          "<tr>" +
            "<td><code>" + esc(p.model) + "</code></td>" +
            "<td>" + esc(p.name["zh-TW"] || p.name.en) + "</td>" +
            "<td>" + esc(e.category.name["zh-TW"] || e.category.name.en) + "</td>" +
            '<td><div class="chip-row">' + chips + "</div></td>" +
            '<td class="row-actions">' +
              '<button class="btn small" data-edit-prod="' + esc(p.id) + '">編輯</button>' +
              '<button class="btn small danger" data-del-prod="' + esc(p.id) + '">刪除</button>' +
            "</td>" +
          "</tr>"
        );
      }).join("") || '<tr><td colspan="5" class="empty-state">沒有符合的產品</td></tr>';

      $all("[data-edit-prod]", panel).forEach(function (b) { b.onclick = function () { openProductForm(findProductEntry(b.dataset.editProd)); }; });
      $all("[data-del-prod]", panel).forEach(function (b) {
        b.onclick = function () {
          if (!confirm("確定要刪除產品「" + b.dataset.delProd + "」嗎？這會一併刪除它所有的手冊檔案，無法復原。")) return;
          withBusy("刪除產品", function () { return deleteProduct(b.dataset.delProd); })
            .then(renderProducts).then(renderManuals).catch(function () {});
        };
      });
    }

    $("#prodCatFilter").onchange = renderRows;
    $("#addProdBtn").onclick = function () { openProductForm(null); };
    renderRows();
  }

  function openProductForm(existing) {
    var isNew = !existing;
    var product = existing ? existing.product : null;
    var catOptions = state.categories.map(function (c) {
      var sel = existing && existing.category.id === c.id ? " selected" : "";
      return '<option value="' + esc(c.id) + '"' + sel + ">" + esc(c.name["zh-TW"] || c.name.en) + "</option>";
    }).join("");
    var typeChecks = sortedTypes().map(function (t) {
      var checked = product && (product.manuals || []).indexOf(t.id) !== -1 ? " checked" : "";
      return '<label><input type="checkbox" name="manuals" value="' + esc(t.id) + '"' + checked + "> " + esc(t.name["zh-TW"] || t.name.en) + "</label>";
    }).join("");

    var fields =
      '<div class="form-grid-2">' +
      '<div class="field"><label>代碼 (id)</label><input name="id" type="text" value="' + esc(product ? product.id : "") + '" ' + (isNew ? "" : "disabled") + ' placeholder="例如 vc-a99" required></div>' +
      '<div class="field"><label>型號 (model)</label><input name="model" type="text" value="' + esc(product ? product.model : "") + '" placeholder="例如 VC-A99" required></div>' +
      "</div>" +
      '<div class="field"><label>產品線</label><select name="categoryId">' + catOptions + "</select></div>" +
      langFieldGroup("name", "產品名稱", product ? product.name : {}) +
      '<div class="field"><label>縮圖路徑</label><input name="image" type="text" value="' + esc(product ? product.image : "assets/images/products/placeholder-camera.svg") + '"></div>' +
      '<div class="field"><label>已宣告的文件類型（勾選代表這個產品「將會有」這些手冊，之後在「手冊文件」分頁補上實際內容）</label><div class="checkbox-grid">' + (typeChecks || '<span class="muted">尚未建立任何文件類型</span>') + "</div></div>";

    openDialog({
      title: isNew ? "新增產品" : "編輯產品：" + product.id,
      fieldsHtml: fields,
      onSubmit: function (form) {
        var id = isNew ? slugify(form.elements.id.value) : product.id;
        if (!id) return Promise.reject(new Error("請輸入代碼"));
        var manuals = $all('input[name="manuals"]:checked', form).map(function (i) { return i.value; });
        var data = {
          id: id,
          model: (form.elements.model.value || "").trim(),
          categoryId: form.elements.categoryId.value,
          name: readLangField(form, "name"),
          image: (form.elements.image.value || "").trim() || "assets/images/products/placeholder-camera.svg",
          manuals: manuals
        };
        if (!data.model) return Promise.reject(new Error("請輸入型號"));
        if (!data.name.en) return Promise.reject(new Error("請至少填寫英文名稱"));
        var prevCat = existing ? existing.category.id : null;
        return withBusy(isNew ? "新增產品" : "更新產品", function () { return upsertProduct(data, isNew, prevCat); })
          .then(function () { renderProducts(); renderCategories(); renderManuals(); });
      }
    });
  }

  // -------------------------------------------------------------- Types tab --

  function renderTypes() {
    var panel = $("#panel-types");
    var list = sortedTypes();
    var rows = list.map(function (t, i) {
      var usedByProducts = state.categories.reduce(function (n, c) { return n + (c.products || []).filter(function (p) { return (p.manuals || []).indexOf(t.id) !== -1; }).length; }, 0);
      return (
        "<tr>" +
          "<td>" + (t.order != null ? t.order : i + 1) + "</td>" +
          "<td><code>" + esc(t.id) + "</code></td>" +
          "<td>" + esc(t.name["zh-TW"] || t.name.en) + '<div class="muted">' + esc(t.name.en) + "</div></td>" +
          "<td>" + usedByProducts + " 個產品使用中</td>" +
          '<td class="row-actions">' +
            '<button class="btn small" data-move-up="' + esc(t.id) + '"' + (i === 0 ? " disabled" : "") + '>▲</button>' +
            '<button class="btn small" data-move-down="' + esc(t.id) + '"' + (i === list.length - 1 ? " disabled" : "") + '>▼</button>' +
            '<button class="btn small" data-edit-type="' + esc(t.id) + '">編輯</button>' +
            '<button class="btn small danger" data-del-type="' + esc(t.id) + '">刪除</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");

    panel.innerHTML =
      '<div class="admin-toolbar"><div class="spacer"></div><button class="btn primary" id="addTypeBtn">+ 新增文件類型</button></div>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>順序</th><th>代碼</th><th>名稱</th><th>使用情況</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="empty-state">還沒有任何文件類型</td></tr>') +
      "</tbody></table></div>";

    $("#addTypeBtn").onclick = function () { openTypeForm(null); };
    $all("[data-edit-type]", panel).forEach(function (b) { b.onclick = function () { openTypeForm(findType(b.dataset.editType)); }; });
    $all("[data-del-type]", panel).forEach(function (b) {
      b.onclick = function () {
        if (!confirm("確定要刪除文件類型「" + b.dataset.delType + "」嗎？")) return;
        withBusy("刪除文件類型", function () { return deleteManualType(b.dataset.delType); }).then(renderTypes).catch(function () {});
      };
    });
    $all("[data-move-up]", panel).forEach(function (b) { b.onclick = function () { swapOrder(b.dataset.moveUp, -1); }; });
    $all("[data-move-down]", panel).forEach(function (b) { b.onclick = function () { swapOrder(b.dataset.moveDown, 1); }; });
  }

  function swapOrder(id, dir) {
    var list = sortedTypes();
    var idx = list.findIndex(function (t) { return t.id === id; });
    var otherIdx = idx + dir;
    if (otherIdx < 0 || otherIdx >= list.length) return;
    var a = list[idx], b = list[otherIdx];
    var tmp = a.order; a.order = b.order; b.order = tmp;
    withBusy("調整順序", function () { return saveTypes("調整文件類型順序: " + a.id + " / " + b.id); }).then(renderTypes).catch(function () {});
  }

  function openTypeForm(existing) {
    var isNew = !existing;
    var fields =
      '<div class="form-grid-2">' +
      '<div class="field"><label>代碼 (id)</label><input name="id" type="text" value="' + esc(existing ? existing.id : "") + '" ' + (isNew ? "" : "disabled") + ' placeholder="例如 quick-start" required></div>' +
      '<div class="field"><label>顯示順序</label><input name="order" type="number" value="' + (existing ? existing.order : (state.types.length + 1) * 10) + '"></div>' +
      "</div>" +
      langFieldGroup("name", "名稱", existing ? existing.name : {});

    openDialog({
      title: isNew ? "新增文件類型" : "編輯文件類型：" + existing.id,
      fieldsHtml: fields,
      onSubmit: function (form) {
        var id = isNew ? slugify(form.elements.id.value) : existing.id;
        if (!id) return Promise.reject(new Error("請輸入代碼"));
        var data = { id: id, order: Number(form.elements.order.value) || 0, name: readLangField(form, "name") };
        if (!data.name.en) return Promise.reject(new Error("請至少填寫英文名稱"));
        return withBusy(isNew ? "新增文件類型" : "更新文件類型", function () { return upsertManualType(data, isNew); })
          .then(function () { renderTypes(); renderProducts(); });
      }
    });
  }

  // ------------------------------------------------------------ Manuals tab --

  function renderManuals() {
    var panel = $("#panel-manuals");
    var options = allProducts().map(function (e) {
      return '<option value="' + esc(e.product.id) + '">' + esc(e.product.model) + " — " + esc(e.product.name["zh-TW"] || e.product.name.en) + "</option>";
    }).join("");

    panel.innerHTML =
      '<div class="admin-toolbar"><label style="font-weight:700; font-size:13.5px;">選擇產品：</label>' +
      '<select id="manualProdSelect" style="min-width:280px;"><option value="">— 請選擇 —</option>' + options + "</select>" +
      '<div class="spacer"></div>' +
      '<select id="manualAddTypeSelect" style="min-width:160px;"></select>' +
      '<button class="btn small" id="manualAddTypeBtn">加入這個文件類型</button>' +
      "</div>" +
      '<div id="manualGridWrap"></div>';

    $("#manualProdSelect").onchange = function () { renderManualGrid($("#manualProdSelect").value); };
    $("#manualAddTypeBtn").onclick = function () {
      var pid = $("#manualProdSelect").value;
      var tid = $("#manualAddTypeSelect").value;
      if (!pid || !tid) return;
      var found = findProductEntry(pid);
      if ((found.product.manuals || []).indexOf(tid) !== -1) return;
      found.product.manuals = (found.product.manuals || []).concat([tid]);
      withBusy("加入文件類型", function () { return saveCategories("將 " + tid + " 加入產品 " + pid); })
        .then(function () { renderManualGrid(pid); renderProducts(); }).catch(function () {});
    };
    renderManualGrid("");
  }

  function renderManualGrid(productId) {
    var wrap = $("#manualGridWrap");
    var addSelect = $("#manualAddTypeSelect");
    addSelect.innerHTML = sortedTypes().map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name["zh-TW"] || t.name.en) + "</option>"; }).join("");

    if (!productId) { wrap.innerHTML = '<div class="empty-state">請先選擇一個產品，管理它的手冊文件。</div>'; return; }
    var found = findProductEntry(productId);
    if (!found) { wrap.innerHTML = '<div class="empty-state">找不到這個產品。</div>'; return; }
    var product = found.product;
    var declaredTypes = sortedTypes().filter(function (t) { return (product.manuals || []).indexOf(t.id) !== -1; });

    if (!declaredTypes.length) {
      wrap.innerHTML = '<div class="empty-state">這個產品還沒有宣告任何文件類型，請用上方「加入這個文件類型」新增。</div>';
      return;
    }

    var rows = declaredTypes.map(function (t) {
      var cells = LANGS.map(function (lang) {
        var entry = state.manualsIndex.filter(function (m) { return m.productId === productId && m.typeId === t.id && m.lang === lang; })[0];
        if (entry) {
          return (
            '<td><div class="cell-exists">' +
              '<span class="chip-sm">已建立</span>' +
              '<div class="muted">' + esc(entry.updatedAt || "") + "</div>" +
              '<div class="row-actions"><button class="btn small" data-edit-manual="' + t.id + "|" + lang + '">編輯</button>' +
              '<button class="btn small danger" data-del-manual="' + t.id + "|" + lang + '">刪除</button></div>' +
            "</div></td>"
          );
        }
        return '<td class="cell-empty"><a href="#" data-new-manual="' + t.id + "|" + lang + '">+ 新增</a></td>';
      }).join("");
      return "<tr><td>" + esc(t.name["zh-TW"] || t.name.en) + "</td>" + cells + "</tr>";
    }).join("");

    wrap.innerHTML =
      '<div class="manual-grid"><table><thead><tr><th>文件類型</th><th>English</th><th>简体中文</th><th>繁體中文</th></tr></thead><tbody>' + rows + "</tbody></table></div>";

    $all("[data-new-manual]", wrap).forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        var parts = a.dataset.newManual.split("|");
        openManualForm(productId, parts[0], parts[1], null);
      };
    });
    $all("[data-edit-manual]", wrap).forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.editManual.split("|");
        var entry = state.manualsIndex.filter(function (m) { return m.productId === productId && m.typeId === parts[0] && m.lang === parts[1]; })[0];
        openManualForm(productId, parts[0], parts[1], entry);
      };
    });
    $all("[data-del-manual]", wrap).forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.delManual.split("|");
        if (!confirm("確定要刪除這份手冊內容嗎？（" + parts[0] + " / " + parts[1] + "）")) return;
        withBusy("刪除手冊內容", function () { return deleteManualContent(productId, parts[0], parts[1]); })
          .then(function () { renderManualGrid(productId); }).catch(function () {});
      };
    });
  }

  function openManualForm(productId, typeId, lang, existingEntry) {
    var type = findType(typeId);
    var isNew = !existingEntry;
    var loadContent = isNew
      ? Promise.resolve(SECTION_TEMPLATES[typeId] || SECTION_TEMPLATES["default"])
      : ghGet(existingEntry.path).then(function (r) { return r ? r.text : ""; });

    loadContent.then(function (content) {
      var defaultTitle = existingEntry ? existingEntry.title : (findProductEntry(productId).product.model + " " + (type.name["zh-TW"] || type.name.en));
      var fields =
        '<div class="field"><label>標題</label><input name="title" type="text" value="' + esc(defaultTitle) + '" required></div>' +
        '<div class="field"><label>內容 (HTML) — 開頭用 &lt;h2 id="..."&gt; 分段，會自動變成本頁目錄</label>' +
        '<textarea name="content" rows="16">' + esc(content) + "</textarea></div>";

      openDialog({
        title: (isNew ? "新增" : "編輯") + "手冊內容：" + productId + " / " + typeId + " / " + LANG_LABELS[lang],
        fieldsHtml: fields,
        onSubmit: function (form) {
          var data = {
            productId: productId, typeId: typeId, lang: lang,
            title: (form.elements.title.value || "").trim(),
            content: form.elements.content.value
          };
          if (!data.title) return Promise.reject(new Error("請輸入標題"));
          if (!data.content.trim()) return Promise.reject(new Error("請輸入內容"));
          return withBusy(isNew ? "新增手冊內容" : "更新手冊內容", function () { return saveManualContent(data); })
            .then(function () { renderManualGrid(productId); renderProducts(); });
        }
      });
    }).catch(function (err) { showStatus("err", "載入內容失敗：" + err.message); });
  }

  // ------------------------------------------------------------------ tabs --

  function switchTab(name) {
    $all(".admin-tab").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === name); });
    ["categories", "products", "types", "manuals"].forEach(function (n) {
      $("#panel-" + n).hidden = n !== name;
    });
  }

  function renderAll() {
    renderCategories(); renderProducts(); renderTypes(); renderManuals();
  }

  // -------------------------------------------------------------- bootstrap --

  function setConnected(isConnected) {
    $("#loginPanel").hidden = isConnected;
    $("#adminPanel").hidden = !isConnected;
    $("#topbarActions").hidden = !isConnected;
    var status = $("#connStatus");
    status.classList.toggle("connected", isConnected);
    status.textContent = isConnected ? ("已連接：" + cfg.owner + "/" + cfg.repo + "@" + cfg.branch) : "尚未連接";
  }

  function connect(newCfg, remember) {
    cfg = newCfg;
    shas = {};
    return loadAll().then(function () {
      if (remember) { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
      setConnected(true);
      renderAll();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $all(".admin-tab").forEach(function (b) { b.onclick = function () { switchTab(b.dataset.tab); }; });

    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var errEl = $("#loginError");
      errEl.hidden = true;
      var newCfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || "main", token: f.token.value.trim() };
      connect(newCfg, f.fRemember ? f.fRemember.checked : $("#fRemember").checked).catch(function (err) {
        errEl.textContent = err.message; errEl.hidden = false;
      });
    });

    $("#refreshBtn").onclick = function () {
      showStatus("busy", "重新整理資料…");
      shas = {};
      loadAll().then(function () { showStatus("ok", "資料已更新"); renderAll(); })
        .catch(function (err) { showStatus("err", "重新整理失敗：" + err.message); });
    };
    $("#logoutBtn").onclick = function () {
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      cfg = null; shas = {};
      setConnected(false);
    };

    try {
      var saved = localStorage.getItem(CFG_KEY);
      if (saved) {
        var savedCfg = JSON.parse(saved);
        $("#fOwner").value = savedCfg.owner || "";
        $("#fRepo").value = savedCfg.repo || "";
        $("#fBranch").value = savedCfg.branch || "main";
        connect(savedCfg, true).catch(function () { /* stay on login form, let user re-enter */ });
      }
    } catch (e) {}
  });
})();
