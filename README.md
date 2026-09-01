# Lumens 手冊中心 — 網站建置說明

一個純靜態 HTML／CSS／JavaScript 的產品手冊網站，不需要伺服器端程式或資料庫。所有產品、手冊分類與介面文字皆由 `data/` 內的 JSON 設定檔驅動。

## 快速預覽

瀏覽器直接開啟 `index.html`（`file://`）會因為瀏覽器安全限制無法讀取 JSON／手冊 HTML 內容。請用任一種簡易伺服器啟動：

```bash
# 方法一：Python（大多數電腦已內建）
cd lumens-manual-site
python3 -m http.server 8080
# 開啟 http://localhost:8080

# 方法二：Node.js
npx serve .
```

正式上線時，把整個資料夾放到任何一般網頁空間（Apache、Nginx、S3+CloudFront、GitHub Pages 皆可）即可，不需要額外的伺服器程式。

## 目錄結構

```
index.html                 首頁
products.html               依產品瀏覽
product-detail.html         單一產品的手冊列表（?id=產品代碼）
manual-types.html           依文件類型瀏覽
manual-type-detail.html     單一類型下的所有產品（?type=類型代碼）
manual-viewer.html          手冊內容顯示（?product=&type=&lang=）
search.html                 全站搜尋（?q=關鍵字）

assets/css/style.css        共用樣式（延續 mylumens.com 白底企業風格）
assets/js/                  共用邏輯與各頁面渲染程式
assets/images/products/     產品縮圖（目前為預留的線稿圖示，請替換為正式產品圖）

data/product-categories.json   產品分類與產品清單 ← 新增／修改／下架產品在這裡改
data/manual-types.json         手冊分類清單 ← 新增手冊類型在這裡改
data/manuals-index.json        每份手冊的檔案位置與語言對照表
data/i18n/{en,zh-CN,zh-TW}.json  三語言介面文字（導覽列、按鈕等）
data/search-index.json         全站搜尋用的純文字索引（由工具腳本自動產生，請勿手動編輯）

manuals/{分類}/{產品}/{類型}/{語言}.html   實際手冊內容（乾淨的 HTML 片段）

tools/build-search-index.js     重新產生 search-index.json 的小工具

admin/index.html, admin.js, admin.css   管理後台（新增／修改／刪除產品線、產品、文件類型、手冊內容）
```

## 常見維護操作

### 新增一個產品

1. 打開 `data/product-categories.json`，在對應分類的 `products` 陣列裡新增一筆，例如：
   ```json
   { "id": "vc-xx99", "model": "VC-XX99", "name": {"en": "...", "zh-CN": "...", "zh-TW": "..."}, "image": "assets/images/products/placeholder-camera.svg", "manuals": ["user-guide"] }
   ```
2. `manuals` 陣列列出這個產品「將會有」哪些類型的手冊（即使檔案還沒寫好也可以先列出，頁面會顯示「尚無文件」）。
3. 不需要新增任何頁面檔案。

### 新增一種手冊分類（例如「保固說明」）

1. 打開 `data/manual-types.json`，新增一筆（`id` 用英文小寫連字號，`order` 決定顯示順序）。
2. 不需要新增任何頁面檔案，「依文件類型瀏覽」頁會自動出現這個新分類。

### 新增一份手冊內容

1. 在 `manuals/{分類代碼}/{產品代碼}/{類型代碼}/` 底下新增對應語言的 `.html`（例如 `zh-CN.html`），內容只需要乾淨的 HTML（`<h2 id="...">`、`<p>`、`<table>`、`<ul>` 等），不需要 `<html>`/`<head>`/`<body>`。
2. 在 `data/manuals-index.json` 加入對應的一筆紀錄（`productId`、`categoryId`、`typeId`、`lang`、`title`、`path`、`updatedAt`）。
3. 執行 `node tools/build-search-index.js` 重新產生搜尋索引，讓新內容可以被搜尋到。

### 手冊內容的兩種格式：`format` 欄位

`data/manuals-index.json` 每一筆紀錄可以加上 `"format"` 欄位，決定這份手冊怎麼呈現：

- **不填，或 `"format": "fragment"`（預設）**：內容片段，套用本站的排版樣式，`<h2 id="...">` 會自動變成頁面左側目錄，也支援本站的「列印／另存 PDF」按鈕。適合大多數手冊。
- **`"format": "standalone"`**：完整獨立頁面。當某份手冊本身是一份完整的、有自己排版與互動效果的網頁（例如既有的簡報型手冊、外部工具產出的完整 HTML），可以**原封不動**存成一個檔案，不需要轉換成 `<h2>` 分段格式。手冊頁會用 `<iframe>` 把這個檔案原樣嵌入頁面中間，不套用本站樣式、也不產生頁面目錄（因為目錄需要讀取同一份文件的標題，跨 iframe 讀不到），改在右上角顯示「在新分頁開啟原始頁面」按鈕。全文搜尋只會比對到手冊標題，不會索引到 iframe 裡的內文（因為那些內容通常是用 JavaScript 動態產生的，不是網頁上看得到的純文字）。

範例：
```json
{
  "productId": "tp-200",
  "categoryId": "touch-panel",
  "typeId": "user-guide",
  "lang": "zh-TW",
  "title": "TP-200 上手指南",
  "path": "manuals/touch-panel/tp-200/user-guide/zh-TW.html",
  "format": "standalone",
  "updatedAt": "2026-09-01"
}
```

透過管理後台的「手冊文件」分頁新增／編輯手冊時，對話框裡也有「內容格式」的下拉選單可以直接選，不需要手動編輯這個欄位。

**注意**：如果原始檔案開頭沒有 `<meta charset="UTF-8">`，某些瀏覽器／伺服器組合可能會誤判編碼，讓中文顯示成亂碼。上傳前建議先確認檔案第一行有這一行（沒有的話，在檔案最前面加上這一行即可，不會影響原本的版面或內容）。

## 管理後台（admin/）

部署到 GitHub Pages 後，可以透過 `你的網址/admin/` 開啟管理後台，用網頁介面管理產品線、產品、文件類型與手冊內容，不需要手動編輯 JSON 或用 git 指令。

**運作原理**：後台沒有自己的資料庫，每一次新增／修改／刪除都是直接呼叫 GitHub API，對這個 repository 送出一次 commit，網站會沿用現有的 GitHub Pages 自動重新部署（約 30–90 秒生效）。沒有草稿或審核機制——按下「儲存」就會直接上線。

**登入方式**：需要一組 GitHub Fine-grained Personal Access Token（只需授權這一個 repository、Contents 權限設為 Read and write），後台頁面裡的登入畫面有申請步驟。Token 只會存在你自己瀏覽器的本機儲存空間，不會上傳到任何地方，也不會出現在 git 紀錄裡。每一位需要用後台的人都要各自申請自己的 Token。

**安全提醒**：`admin/` 底下的頁面本身沒有帳號密碼保護，只要知道網址任何人都能打開登入畫面——但沒有有效的 Token 就完全無法讀取或修改任何資料，所以實際的存取控制是靠 Token 本身，而不是隱藏這個網址。請把 Token 當密碼一樣保管，不要分享、不要貼到公開的地方；覺得外流時，直接到 GitHub 的 Token 設定頁面撤銷即可，不影響網站本身。

## 設計說明

- 版面延續 mylumens.com 的白底、深色文字、企業風格；主色（連結、按鈕、目前分頁）與強調色定義在 `assets/css/style.css` 開頭的 `:root` 區塊（`--brand-*`、`--accent-*`），拿到正式品牌色票後直接改這幾個變數即可全站套用。
- 字型使用系統內建字型（不額外載入 Google Fonts），確保三語言在各平台都能正確顯示，也讓頁面在無網路環境下開啟時樣式不跑版。
- 手冊內容頁的「列印／另存 PDF」按鈕呼叫瀏覽器內建列印功能，並搭配獨立的列印樣式（隱藏導覽列與側邊欄），可直接列印或另存成 PDF。
- 全站搜尋是前端輕量比對（不依賴第三方函式庫），對中、英文皆可直接做關鍵字比對，避免中文斷詞函式庫的額外相依性。

## 目前的示範資料

- 產品清單沿用 mylumens.com 現有的 7 大產品線與型號，作為結構示範。
- 為了展示完整流程，只有 VC-A71P、VC-TR61、PS753、OIP-N60D 這 4 個型號附有實際手冊內容（皆標示為「示範內容」），其餘產品僅有型號資料、尚無手冊，用來展示「產品存在但手冊尚未上架」時頁面的呈現方式。
- 正式上線前，請將所有標示「示範內容 / Sample content」的手冊內容替換為正式技術文件，並將 `assets/images/products/` 內的線稿圖示替換為正式產品照片。
