// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、目盛りの文字盤と回る点。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * 2 * Math.PI; return `<line x1="${50 + 36 * Math.sin(a)}" y1="${50 - 36 * Math.cos(a)}" x2="${50 + 30 * Math.sin(a)}" y2="${50 - 30 * Math.cos(a)}" stroke="#fff" stroke-width="2.6"/>`; }).join("");
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3efe4"/><circle cx="50" cy="50" r="42" fill="#14203a"/>${ticks}
      <circle cx="50" cy="50" r="25" fill="none" stroke="#ffffff33" stroke-width="1.5"/>
      <circle cx="${50 + 25 * Math.sin(1.1)}" cy="${50 - 25 * Math.cos(1.1)}" r="7" fill="#ffd166" stroke="#fff" stroke-width="1.5"/>
      <polygon points="50,24 46,16 54,16" fill="#7fd1ff"/><circle cx="50" cy="50" r="3" fill="#c9d3e6"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
