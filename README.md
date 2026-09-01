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

## 設計說明

- 版面延續 mylumens.com 的白底、深色文字、企業風格；主色（連結、按鈕、目前分頁）與強調色定義在 `assets/css/style.css` 開頭的 `:root` 區塊（`--brand-*`、`--accent-*`），拿到正式品牌色票後直接改這幾個變數即可全站套用。
- 字型使用系統內建字型（不額外載入 Google Fonts），確保三語言在各平台都能正確顯示，也讓頁面在無網路環境下開啟時樣式不跑版。
- 手冊內容頁的「列印／另存 PDF」按鈕呼叫瀏覽器內建列印功能，並搭配獨立的列印樣式（隱藏導覽列與側邊欄），可直接列印或另存成 PDF。
- 全站搜尋是前端輕量比對（不依賴第三方函式庫），對中、英文皆可直接做關鍵字比對，避免中文斷詞函式庫的額外相依性。

## 目前的示範資料

- 產品清單沿用 mylumens.com 現有的 7 大產品線與型號，作為結構示範。
- 為了展示完整流程，只有 VC-A71P、VC-TR61、PS753、OIP-N60D 這 4 個型號附有實際手冊內容（皆標示為「示範內容」），其餘產品僅有型號資料、尚無手冊，用來展示「產品存在但手冊尚未上架」時頁面的呈現方式。
- 正式上線前，請將所有標示「示範內容 / Sample content」的手冊內容替換為正式技術文件，並將 `assets/images/products/` 內的線稿圖示替換為正式產品照片。
