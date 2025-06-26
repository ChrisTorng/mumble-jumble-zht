# Mumble Jumble 繁體中文

線上展示: [Google AI Studio - Mumble Jumble 繁體中文](https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221PLz1ymGabVV1oZjFvDbodY7QiGRPTNpF%22%5D,%22action%22:%22open%22,%22userId%22:%22115817363595740447839%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing)

開發過程介紹: 

由 [Google AI Studio - Build](https://aistudio.google.com/apps) 之 [Mumble Jumble](https://aistudio.google.com/apps/bundled/mumble_jumble)，下載後以 VS Code 及 GitHub Copilot 協助，將畫面顯示文字修改為繁體中文版，對話語音也改用中文口音。所有開發提示均儲存在 [prompts](prompts) 資料夾中。

增加參考 `@vitejs/plugin-vue` npm 套件以支援本機開發。另本機開發時，使用免費帳號無法生成圖片，仍可以語音對話，但程式碼上傳到 Google AI Studio 就可以正常生成圖片。

注意: 保哥的 [使用 Google AI Studio 與 Gemini 進行氛圍程式設計](https://www.facebook.com/will.fans/videos/2991473334384787) 直播 中有提醒，若使用 `npm run dev` 建立 `dist` 版本公開，會有洩露金鑰的問題，故我僅更新回 Google AI Studio 網頁，它不會有洩露問題。

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## LICENSE

原始程式來自 [Google AI Studio - Build](https://aistudio.google.com/apps) 之 [Mumble Jumble](https://aistudio.google.com/apps/bundled/mumble_jumble)，本專案之中文化部份則採 MIT 授權