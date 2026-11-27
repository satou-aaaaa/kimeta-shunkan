// SNS で貼られたときの絵（og.png 1200×630）を作る。答え（測った差・問いの答え）は入れず、時計と問いかけだけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const xy = (pos, r) => { const a = (pos / 60) * 2 * Math.PI; return [200 + r * Math.sin(a), 200 - r * Math.cos(a)]; };
  let t = "";
  for (let i = 0; i < 60; i++) { const big = i % 5 === 0, [x1, y1] = xy(i, 176), [x2, y2] = xy(i, big ? 156 : 166); t += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${big ? "#fff" : "#c9d3e6"}" stroke-width="${big ? 4 : 2}"/>`; }
  for (let j = 0; j < 12; j++) { const [x, y] = xy(j * 5, 196); t += `<text x="${x}" y="${y}" font-size="22" font-weight="700" fill="#1d2a3f" text-anchor="middle" dominant-baseline="central">${j * 5}</text>`; }
  const [dx, dy] = xy(13, 145);
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:48px 64px;background:#f3efe4;color:#1d2a3f;display:flex;gap:48px;align-items:center">
    <svg width="440" height="440" viewBox="-20 -20 440 440"><circle cx="200" cy="200" r="182" fill="#14203a"/>${t}<circle cx="200" cy="200" r="145" fill="none" stroke="#ffffff22" stroke-width="2"/><circle cx="${dx}" cy="${dy}" r="15" fill="#ffd166" stroke="#fff" stroke-width="3"/><circle cx="200" cy="200" r="7" fill="#c9d3e6"/></svg>
    <div style="flex:1">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">リベットの実験（1983年）を体験</div>
      <div style="font-size:82px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">決めた<span style="color:#b23a24">瞬間</span>は<br>いつ？</div>
      <div style="font-size:34px;margin-top:18px;line-height:1.5">好きなときに押す。<br>押そうと思ったのは、押す何ミリ秒前？</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
