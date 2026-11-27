// 決めた瞬間はいつ？の検査。中身（時計の数・差の出し方・問いの答えを data.js とは別に解き直す・今日の5回と上級の組み方 3年分・
// とことんの並び）・ファイル（出典・言い方・写し元の言葉・PWA・OGP）・通しで遊ぶ（1周まつ・押した時の点・回り続けて止まる・
// 文字盤とキーボードで答える・差・2段目の問い・まちがい・ヒント・続きから・結果の時間の線・上級・練習・とことん・復習・カレンダー）・
// 幅320px・保存できない帯・引き継ぎ・深さ・game-core・見やすさ
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。日付を変えるときは QA_DATE=YYYY-MM-DD
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";
import { checkDepth } from "./depth-check.mjs";
import { checkCore } from "./core-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const firstClose = async (q) => { if (await q.locator("#howto[open]").count()) await q.click("#howto-ok"); if (await q.evaluate(() => !!(window.Core && Core.coach && Core.coach.active()))) { await q.evaluate(() => { Core.coach.leave(); scrollTo(0, 0); }); await q.waitForTimeout(100); } };
const G = createRequire(import.meta.url)(path.join(root, "data.js"));

// ---- 1. 中身（ブラウザを使わない）----
// 論文の数字（ゲームとは別に書く。Libet ほか 1983 の本文・Table 2、Schurger ほか 2012）。出典メモは shared-workflows の games/kimeta-shunkan-research.md
const PAPER = { period: 2560, ticks: 60, coast: [500, 800], W: -204, M: -86, S: -47, RP2: -550, RP1: -1025, W2RP2: 350, W2RP1: 800, N: 40 };
check("時計は論文と同じ（1周2560ミリ秒・60目盛り・押したあと500〜800ミリ秒回る）", G.PERIOD === PAPER.period && G.TICKS === PAPER.ticks && G.COAST[0] === PAPER.coast[0] && G.COAST[1] === PAPER.coast[1]);
check("論文の数字（W −204・M −86・S −47・type II −550・type I −1025・W との差 350・800・40回）が出典メモと同じ", ["W", "M", "S", "RP2", "RP1", "W2RP2", "W2RP1", "N"].every((k) => Object.prototype.hasOwnProperty.call(G.LIBET, k) && G.LIBET[k] === PAPER[k]) && Object.keys(G.LIBET).every((k) => G.LIBET[k] === PAPER[k]), JSON.stringify(G.LIBET)); // 必ず要るキーは PAPER の側から数える（LIBET から消しても通らない）
check("type II の準備電位は W のさらに約350ミリ秒前（−200 −350 ＝ −550）", -200 - PAPER.W2RP2 === PAPER.RP2);
// 差の解き直し：角度で考える（data.js の diffMs は剰余で考える）。ちょうど半周は data.js と同じく押す前（−1280）に数える
const angDiff = (a, p) => { const th = (a - p) * (2 * Math.PI / 60); const d = Math.atan2(Math.sin(th), Math.cos(th)); let t = d / (2 * Math.PI) * 60; if (Math.abs(Math.abs(t) - 30) < 1e-9) t = -30; return Math.round(t * 2560 / 60); };
{ let R = G.rng(7), bad = []; const seen = new Set();
  for (let n = 0; n < 5000; n++) { const a = Math.round(R() * 120) / 2 % 60, p = Math.round(R() * 6000) / 100 % 60; seen.add(a + ":" + p); const x = G.diffMs(a, p), y = angDiff(a, p); if (Math.abs(x - y) > 1) bad.push(`${a},${p}:${x}/${y}`); }
  check(`差の出し方を角度の計算で解き直して同じ（${seen.size}組）`, bad.length === 0 && seen.size >= 300, bad.slice(0, 5).join(" ")); }
check("差：同じ位置は0・半目盛り手前は約−21・1目盛り先は約＋43・0と59.5は−21", G.diffMs(10, 10) === 0 && G.diffMs(9.5, 10) === -21 && G.diffMs(11, 10) === 43 && G.diffMs(59.5, 0) === -21 && G.diffMs(0, 59.5) === 21);
{ let bad = []; for (let st = 0; st < 60; st++) for (let t = 0; t < 20000; t += 137) { const p = G.posAt(st, t), q = (st + t * 60 / 2560) - 60 * Math.floor((st + t * 60 / 2560) / 60); if (Math.abs(p - q) > 1e-9 || p < 0 || p >= 60) bad.push(`${st},${t}`); }
  check("点の位置：回し始めて t ミリ秒の位置が、1周2560ミリ秒の速さと合う（60×146通り）", bad.length === 0, bad.slice(0, 3).join(" ")); }
// 問いの答えの解き直し：論文の問いは別に書いた表、計算の問いは自分で計算する
const FACT_ANS = { f01: "2.56秒", f02: `約${Math.round(2560 / 60)}ミリ秒`, f03: "点の位置を、本人があとで答えた", f04: "約200ミリ秒前", f05: "約85ミリ秒前", f06: `約${PAPER.W2RP2}ミリ秒前`, f07: `約${PAPER.W2RP1}ミリ秒前`, f08: `${PAPER.N}回`, f09: "0.5〜0.8秒回ってから止まった", f10: "本当より少し早め（約50ミリ秒）", f11: "したくなった時に。前もって決めない", f12: "筋肉の電気が出はじめた時", f13: "点が1周するまで", f14: "W のあと動くまでに、やめられるかもしれない", f15: "ゆらぎの積み上がりで、まだ決める前かもしれない", f16: "動く約150ミリ秒前", f17: "準備電位（脳波）", f18: "ボタンが押された時", f19: `約${-PAPER.RP2}ミリ秒前` };
{ const bad = [];
  for (const q of G.Q) {
    let want;
    const n = +q.id.slice(1);
    if (q.g === "f") want = FACT_ANS[q.id];
    else if (q.g === "t") want = `約${Math.round(n * PAPER.period / PAPER.ticks)}ミリ秒`;
    else if (q.g === "b") want = `−${-angDiff(-n, 0)}ミリ秒（押す前）`;
    if (q.ans !== want) bad.push(`${q.id}:${q.ans}≠${want}`);
    if (q.opts.length !== 3 || new Set(q.opts).size !== 3 || q.opts.filter((o) => o === q.ans).length !== 1) bad.push(`${q.id}:選び肢`);
    if (!q.src || !q.src.length || !q.look || !q.why) bad.push(`${q.id}:出典・見るところ・わけ`);
  }
  check(`問いの答えを data.js とは別に解き直して同じ（${G.Q.length}問。論文の問いは別の表、計算の問いは自分で計算）`, bad.length === 0 && Object.keys(FACT_ANS).length === G.Q.filter((q) => q.g === "f").length, bad.slice(0, 5).join(" ")); }
check("Schurger らの問いは Schurger らの論文を出典にする", G.Q.filter((q) => /Schurger/.test(q.q)).every((q) => q.src.some(([n]) => /Schurger/.test(n))));
// 全部の tag（種類2×問い×始まり60）を作り直せる
{ const bad = []; let n = 0;
  for (const k of ["W", "M"]) for (const q of G.IDS) for (let st = 0; st < 60; st++) {
    const t = `${k}|${q}|${st}`, P = G.make(t); n++;
    if (!P || P.tag !== t || P.start !== st || P.kind !== k || !P.opts.includes(P.ans) || P.coast < 500 || P.coast > 800 || JSON.stringify(G.make(t)) !== JSON.stringify(P)) bad.push(t);
  }
  check(`1回の種類（W・M×問い×始まりの位置）が300種類以上・全部作り直せる・回り続ける長さは500〜800ミリ秒（${n}種類）`, bad.length === 0 && n >= 300, bad.slice(0, 5).join(" ")); }
check("作れない tag を弾く（00・余分な文字・知らない問い・60）", ["W|f01|60", "W|f01|07", "X|f01|1", "W|f99|1", "W|f01|1|x", "W|f01|", 3].every((t) => !G.ok(t) && G.make(t) === null));
// 今日の5回と上級（3年分）
{ const bad = []; let d = "2026-11-27";
  for (let i = 0; i < 1100; i++) {
    const a = G.dailyTags(d), h = G.hardTags(d), qa = a.map((t) => t.split("|")[1]), qh = h.map((t) => t.split("|")[1]);
    if (a.length !== 5 || a.map((t) => t[0]).join("") !== "WWWMW" || new Set(qa).size !== 5 || qa.map((q) => G.QBY[q].g).join("") !== "fftbf") bad.push(d + ":今日");
    if (h.length !== 5 || !h.every((t) => t[0] === "W") || new Set(qh).size !== 5 || qh.some((q) => qa.includes(q))) bad.push(d + ":上級");
    if (![...a, ...h].every(G.ok) || JSON.stringify(G.dailyTags(d)) !== JSON.stringify(a)) bad.push(d + ":作り直し");
    d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
  }
  check("今日の5回：W・W・W・M・W、問いは 論文・論文・計算・差・論文 で重ねない。上級：W を5回・今日と問いを重ねない（3年分）", bad.length === 0, bad.slice(0, 5).join(" ")); }
// 公開したあとは過去の日の5回が変わらない（F7）。変えるときは作り直して理由を PR に書く
const PINS = "2026-11-27=W|f08|22,W|f19|49,W|t07|12,M|b08|29,W|f15|45;W|f18|5,W|t23|43,W|f05|23,W|b20|14,W|f04|31\n2026-12-25=W|f06|39,W|f09|54,W|t27|9,M|b05|29,W|f08|51;W|f13|0,W|t10|45,W|f03|1,W|b09|0,W|f02|56\n2027-06-01=W|f03|20,W|f16|36,W|t15|41,M|b15|44,W|f05|36;W|f08|43,W|t21|45,W|f07|6,W|b13|13,W|f17|38";
check("過去の日の5回と上級が変わらない（PINS。game-dev.md F7）", PINS.split("\n").every((l) => { const [d, v] = l.split("="); return G.dailyTags(d).join(",") + ";" + G.hardTags(d).join(",") === v; }));
// 問いを足しても過去の日が変わらない：使い始める日（since）を書いた問いを足した data.js を作り、PINS の日は同じ・since からは選ばれることを見る
{ const src = readFileSync(path.join(root, "data.js"), "utf8"), row = '    ["f99", "足した問い", ["あ", "い", "う"], "見る", "わけ", L, "2030-01-01"],\n';
  const add = src.replace(/(\n  \];\n  const msOf)/, "\n" + row.trimEnd() + "$1"), mod = { exports: {} };
  vm.runInNewContext(add, { module: mod, self: undefined });
  const H = mod.exports, pinsSame = !!H.QBY && !!H.QBY.f99 && PINS.split("\n").every((l) => { const [d, v] = l.split("="); return H.dailyTags(d).join(",") + ";" + H.hardTags(d).join(",") === v; });
  let used = false, d = "2030-01-01"; for (let i = 0; i < 400 && !used; i++) { if ([...H.dailyTags(d), ...H.hardTags(d)].some((t) => t.includes("|f99|"))) used = true; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10); }
  let early = false; d = "2026-11-27"; for (let i = 0; i < 1100; i++) { if ([...H.dailyTags(d), ...H.hardTags(d)].some((t) => t.includes("|f99|"))) early = true; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10); }
  check("問いを最後に足しても（since 付き）、過去の日の5回と上級は変わらず、since の日から選ばれる", pinsSame && used && !early, `pins ${pinsSame}・since から ${used}・前に出た ${early}`); }
// とことん・練習の並び：何百回作って、1回の中で問いを全部出し切るまで重ねない
{ const bad = []; let m = 0;
  for (let n = 0; n < 400; n++) {
    const list = G.randomTags("qa" + n, 160, "X", new Set()), qs = list.map((t) => t.split("|")[1]);
    for (let i = 0; i + G.IDS.length <= qs.length; i += G.IDS.length) if (new Set(qs.slice(i, i + G.IDS.length)).size !== G.IDS.length) bad.push(n);
    m += list.filter((t) => t[0] === "M").length;
    if (!list.every(G.ok)) bad.push(n + ":tag");
  }
  for (const k of ["W", "M"]) if (!G.randomTags("k" + k, 30, k, new Set()).every((t) => t[0] === k)) bad.push(k);
  check(`とことん・練習：400回作って、問いを${G.IDS.length}問出し切るまで重ねない・W と M がまざる`, bad.length === 0 && m > 400 * 160 * 0.15 && m < 400 * 160 * 0.35, bad.slice(0, 5).join(" ") + ` M ${m}`); }
check("ばらつき（標本の標準偏差）の計算", JSON.stringify(G.stats([-100, -200, -300])) === JSON.stringify({ n: 3, mean: -200, sd: 100 }) && G.stats([]).n === 0 && G.stats([5]).sd === 0);

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
const own = html.replace(/<!-- a11y:begin[\s\S]*?a11y:end -->/, "").replace(/<!-- store:begin[\s\S]*?store:end -->/, "").replace(/<!-- core:begin[\s\S]*?core:end -->/, "").replace(/<!-- kiroku:begin[\s\S]*?kiroku:end -->/, "");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
{ const cs = [...html.matchAll(/connect-src([^;"]*)/g)].map((m) => m[1].trim().split(/\s+/));
  check("CSP で通信先を自分だけにしている（connect-src は 'self' 1つだけ）", cs.length === 1 && cs[0].length === 1 && cs[0][0] === "'self'", JSON.stringify(cs)); }
check("押した時刻・答えを外へ送らない（fetch・sendBeacon・XMLHttpRequest を使わない）", !/\bfetch\(|sendBeacon|XMLHttpRequest|WebSocket/.test(own + gen));
check("Math.random は練習・とことんの種だけ（今日の5回・上級は日付の乱数。data.js には無い）", (own.match(/Math\.random/g) || []).length === 1 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
{ const inl = html.split("<script>").slice(1).map((x) => x.split("</" + "script>")[0]).join("\n");
  check("一行の式の途中にコメント // を足さない（行の残りが消える）", !/;\s*\/\/[^\n]*;\s*\w/.test((gen + "\n" + inl).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"))); }
{ const howto = (html.match(/<dialog id="howto"[\s\S]*?<\/dialog>/) || [""])[0], ab = (html.match(/function about\(\)[\s\S]*?\n}/) || [""])[0], tl = (html.match(/function timeline\([\s\S]*?\n}/) || [""])[0];
  const brain = (t) => /準備電位[^。]*このゲームでは測れ/.test(t), local = (t) => /外へ(は)?送り?ません|外へ送らない/.test(t);
  check("言い方：遊び方・「このゲームについて」・結果の時間の線・README に「準備電位は脳波なので、このゲームでは測れない」がある", brain(howto) && brain(ab) && brain(tl) && brain(readme), `遊び方 ${brain(howto)}・について ${brain(ab)}・線 ${brain(tl)}・README ${brain(readme)}`);
  check("言い方：遊び方・「このゲームについて」・README に、押した時刻と答えを外へ送らないことがある", local(howto) && local(ab) && local(readme));
  check("言い方：読み方が分かれていることを書き、「自由意志は無い」と言い切らない", /分かれて/.test(ab) && /分かれて/.test(tl) && !/自由意志は(無|な)い|自由意志は存在しない|脳が(すべて|全部)決めている/.test(own + gen + readme));
  check("言い方：W はボタンの約200ミリ秒前・準備電位はさらに約350ミリ秒前、を「このゲームについて」と結果の時間の線に並べる", /約200ミリ秒前/.test(ab) && /さらに約350ミリ秒前/.test(ab) && /約350ミリ秒/.test(tl) && /G\.LIBET\.RP2/.test(tl));
  check("言い方：このゲームの0（ボタン）と論文の0（筋肉の電気）がちがうことを「このゲームについて」と README に書く", /筋肉の電気/.test(ab) && /0は、ボタン/.test(ab) && /論文の0は筋肉の電気/.test(readme) && /ゲームの0はボタン/.test(readme));
  check("出典：「このゲームについて」に Libet ほか 1983 と Schurger ほか 2012（題名・年・DOI）", /G\.SRC/.test(ab) && /const SRC = \{\s*libet: \["Libet, Gleason, Wright, Pearl「Time of conscious intention to act[^"]*」Brain 106 \(1983\) 623–642", "https:\/\/doi\.org\/10\.1093\/brain\/106\.3\.623"\],\s*schurger: \["Schurger, Sitt, Dehaene「An accumulator model[^"]*」PNAS 109 \(2012\)[^"]*", "https:\/\/doi\.org\/10\.1073\/pnas\.1210467109"\],/.test(gen)); }
check("写し元（屋台の値下げ合戦・その写し元の風力階級よみ）の言葉が残っていない（game-dev.md A 手順5）", !/屋台|値下げ|性格帳|縁日|団子|みどり屋|しっぺ返し|Axelrod|アクセルロッド|囚人|もうけ点|ytn|YTN|yatai|__nm|風力|風速|気象庁|fuuryoku|fry-/.test(own + gen + readme + readFileSync(path.join(root, "manifest.webmanifest"), "utf8") + readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8") + readFileSync(path.join(root, "tools/make-og.cjs"), "utf8") + readFileSync(path.join(root, "tools/make-icons.cjs"), "utf8"))); // AGENTS.md は写し元の名前を書くので見ない
check("手で書く所がこのゲームの言葉（description・遊び方・ホームの1行目・2段目の名前・manifest・感想フォームの例）", /<meta name="description" content="1周2\.56秒で回る点の時計/.test(html) && /<dialog id="howto"[\s\S]*1周2\.56秒[\s\S]*<\/dialog>/.test(html) && /回る点を見て、好きなときに押す。/.test(own) && /2段目：実験を読む/.test(own) && /リベットの実験/.test(JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8")).description) && /押そうと思った/.test(readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8")));
check("共有画像（make-og.cjs）は答え（測った差・問いの答え）を入れず、このゲームの時計と問いかけ", /決めた/.test(readFileSync(path.join(root, "tools/make-og.cjs"), "utf8")) && !G.Q.some((q) => readFileSync(path.join(root, "tools/make-og.cjs"), "utf8").includes(q.ans)));
check("画面にお笑いの言葉を入れない", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(own + gen));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキー（記録・文字・復習）だけで読む・depth.js も前に読む", /<script src="transfer\.js" data-game="kimeta-shunkan" data-keys="kms-v1,kms-fs,kms-depth"><\/script>\s*<script src="depth\.js" data-game="kimeta-shunkan" data-key="kms-depth"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
check("好きなだけ遊べる：チケット・回数の上限・🔒で開くモードを入れない・時間制限なし（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒|制限時間|残り時間|タイムアップ/.test(own));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/kimeta-shunkan/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎ・深さも）、取り直して保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./transfer-qr.js", "./depth.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && shell.every((f) => f === "./" || existsSync(path.join(root, f))) && /cache: "reload"/.test(sw) && /const CACHE = "kms-v\d+"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  { const st = await checkSwStall(sw); check("PWA：通信が止まっても4秒ほどで保存した画面に切り替わる（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "決めた瞬間はいつ？" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = process.env.QA_DATE || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayAdd = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, h = 844) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // 日付だけを QA_DATE に合わせる（時刻の進み・performance.now は本物のまま）
  if (process.env.QA_DATE) await c.addInitScript((d) => { const off = Date.parse(d + "T03:00:00Z") - Date.now(); const N = Date.now; Date.now = () => N() + off; const D = Date; globalThis.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(N() + off); } static now() { return N() + off; } }; }, process.env.QA_DATE);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("kms-v1") || "{}"));
const angOf = (cx, cy) => ((Math.atan2(cx - 120, 120 - cy) / (2 * Math.PI)) * 60 + 60) % 60;
const tickDist = (a, b) => { const d = Math.abs(a - b) % 60; return Math.min(d, 60 - d); };
async function clickDial(p, pos) { const b = await p.locator("#dial").boundingBox(); const a = (pos / 60) * 2 * Math.PI, r = b.width * 0.3; await p.mouse.click(b.x + b.width / 2 + r * Math.sin(a), b.y + b.height / 2 - r * Math.cos(a)); }
// 1回を測る：回す → 1周まって押す → 止まるのを待つ → 押した時の位置から off 目盛りの所を文字盤で選んで決める
async function measure(p, off = 0) {
  await p.click("#spin");
  await p.waitForSelector("#press:not([disabled])", { timeout: 6000 });
  await p.click("#press");
  await p.waitForSelector("#pick", { timeout: 4000 });
  const tgt = await p.evaluate((o) => __km.G.snap(__km.pressPos() + o), off);
  await clickDial(p, tgt);
  await p.click("#pick");
  await p.waitForSelector("#choices");
  return tgt;
}
const ansIdx = (p) => p.evaluate(() => { const c = __km.cur(); return c.P.opts.indexOf(c.P.ans); });
const answer = async (p) => { await p.click(`.ch[data-j="${await ansIdx(p)}"]`); await p.waitForSelector(".verdict"); };
const next = async (p) => { await p.click("#next"); await p.waitForTimeout(150); };
const sizes = (p, sel = "button, a[href], .ch") => p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && !e.closest("#core-coach")).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.textContent.trim().slice(0, 12), Math.round(r.height), Math.round(r.width)]; }).filter(([, h, w]) => h < 44 || w < 44), sel);
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

mkdirSync(path.join(root, "qa-report"), { recursive: true });
let p = await newPage();
await firstClose(p);
check("ホームが出る（題・今日の5回・上級・とことん・練習・記録帳）", await p.locator("h1.title").count() === 1 && await p.evaluate(() => ["go-d", "go-h", "go-e", "go-p", "go-dex", "go-cal", "go-ach"].every((id) => !!document.getElementById(id))));
check("ホーム：押せる所が44px以上", (await sizes(p)).length === 0, JSON.stringify(await sizes(p)));
check("ホームの絵の時計は動かない（動き続けるアニメーションが無い）", await p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length === 0));

// 今日の5回を通しで遊ぶ
await p.click("#go-d"); await p.waitForSelector("#spin");
const day = G.dailyTags(TODAY);
check("今日の5回：1回目は今日の tag・回す前は点が始まりの位置で止まっている", await p.evaluate(() => __km.cur().tag) === day[0] && await p.evaluate((st) => { const d = document.querySelector("#dial .dot"); return Math.abs(((Math.atan2(+d.getAttribute("cx") - 120, 120 - +d.getAttribute("cy")) / (2 * Math.PI)) * 60 + 60) % 60 - st) < 0.01 || st === 0; }, G.make(day[0]).start));
check("回す画面：押せる所が44px以上・幅390pxではみ出さない", (await sizes(p)).length === 0 && !(await overflow(p)), JSON.stringify(await sizes(p)));
const spinAt = Date.now(); // 回すを押す前から数える（押せるようになるまでの時間を、短く見積もらない）
await p.click("#spin"); await p.waitForTimeout(400);
await p.click("#press", { force: true }).catch(() => {}); await p.waitForTimeout(50);
check("1周（2.56秒）まつまでは押せない（論文 p.625）", await p.evaluate(() => __km.ph()) === "spin" && await p.locator("#press[disabled]").count() === 1);
const moved = await p.evaluate(async () => { const d = document.querySelector("#dial .dot"), x = +d.getAttribute("cx"), y = +d.getAttribute("cy"); await new Promise((r) => setTimeout(r, 300)); return Math.abs(+d.getAttribute("cx") - x) + Math.abs(+d.getAttribute("cy") - y); });
check("回しているあいだ点が動く", moved > 1);
const unlockMs = await p.evaluate(async (t0) => { const b = document.getElementById("press"); while (b.disabled) await new Promise((r) => setTimeout(r, 10)); return Date.now() - t0; }, spinAt);
check("1周たつと押せる（回してから2.56秒より前には押せない。押すまで待つ。時間制限なし）", await p.locator("#press:not([disabled])").count() === 1 && unlockMs >= 2560 && unlockMs < 6000, `${unlockMs}ms`);
await p.waitForTimeout(1500);
check("押せるようになってから時間がたっても、待ち続ける", await p.evaluate(() => __km.ph()) === "spin");
// 押した時刻の点の位置 ＝ そのとき画面に描いた点の位置（1こま＝16.7ミリ秒 ≒ 0.4目盛り以内）
const pr = await p.evaluate(() => { const d = document.querySelector("#dial .dot"), cx = +d.getAttribute("cx"), cy = +d.getAttribute("cy"), t = performance.now(); __km.press(t); return { cx, cy, pp: __km.pressPos(), t, t0: __km.t0(), st: __km.cur().P.start, coast: __km.cur().P.coast }; });
check("押した時の点の位置は、押した時刻から1周2560ミリ秒の速さで出した位置（data.js とは別に計算）", Math.abs(pr.pp - ((pr.st + (pr.t - pr.t0) * 60 / 2560) % 60)) < 1e-6);
check("押した時の点の位置は、そのとき画面に描いていた点とほぼ同じ（1目盛り未満）", tickDist(angOf(pr.cx, pr.cy), pr.pp) < 1, `${angOf(pr.cx, pr.cy)} / ${pr.pp}`);
const tPress = Date.now();
await p.waitForSelector("#pick", { timeout: 4000 });
const tStop = Date.now() - tPress;
const stopAt = await p.evaluate(() => { const d = document.querySelector("#dial .dot"); return [+d.getAttribute("cx"), +d.getAttribute("cy")]; });
check("押したあと点は500〜800ミリ秒回り続けてから止まり（論文 p.626）、止まった位置は押した時刻＋回り続けた長さの位置", tStop >= pr.coast - 30 && tStop < pr.coast + 600 && tickDist(angOf(...stopAt), (pr.st + (pr.t - pr.t0 + pr.coast) * 60 / 2560) % 60) < 0.05, `${tStop}ms / coast ${pr.coast}`);
check("答える画面：押せる所が44px以上・はみ出さない", (await sizes(p)).length === 0 && !(await overflow(p)), JSON.stringify(await sizes(p)));
// 文字盤を押して答える（押した時の位置の5目盛り手前）
const want = G.snap(pr.pp - 5);
await clickDial(p, want);
check("文字盤を押すと、その位置（半目盛りきざみ）が選ばれる", await p.evaluate(() => +document.getElementById("dial").getAttribute("aria-valuenow")) === want);
await p.click("#pick"); await p.waitForSelector("#choices");
{ const d = await p.evaluate(() => __km.cur().d);
  check("差＝答えの位置と押した時の位置の差（角度で解き直して同じ）・5目盛り手前は約−213ミリ秒・「押す前」と出る", d.a === want && d.ms === angDiff(d.a, d.p) && Math.abs(d.ms + 213) <= 22 && /−\d+ミリ秒/.test(await p.textContent("#read")) && /押す前/.test(await p.textContent("#read")), JSON.stringify(d)); }
check("差のあと、文字盤に答え（▲）と押した時の点（●）を形で分けて出す（色だけで分けない）", await p.locator("#dial .amk").count() === 1 && await p.locator("#dial .pmk").count() === 1 && /▲/.test(await p.textContent("#read")) && /●/.test(await p.textContent("#read")));
check("2段目：実験を読む問いが3つの選び肢で出る・自信のボタンがある", await p.locator(".ch").count() === 3 && await p.locator("#why .sure-row button").count() === 1 && /2段目/.test(await p.textContent("#why")));
// 続きから：読み直しても、測った差と問いのまま
await p.reload(); await p.waitForTimeout(200); await firstClose(p); await p.click("#go-d"); await p.waitForSelector("#choices");
check("続きから：読み直しても、測った差と2段目の問いのまま（測り直さない）", await p.evaluate(() => __km.cur().d && __km.cur().d.a) === want && await p.locator("#spin").count() === 0);
await answer(p);
check("正解：★3・わけ・論文の W の平均（約−200）・出典が出る", /★★★/.test(await p.textContent(".verdict")) && /約−200ミリ秒/.test(await p.textContent(".verdict")) && await p.locator(".verdict .src a").count() >= 1);
await next(p);
// 2回目：キーボードで答える・まちがい
await p.click("#spin"); await p.waitForSelector("#press:not([disabled])", { timeout: 6000 });
await p.focus("#press"); await p.keyboard.press(" ");
await p.waitForSelector("#pick", { timeout: 4000 });
check("スペースキーで押せる", await p.evaluate(() => __km.ph()) === "report");
await p.focus("#dial"); for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowRight"); await p.keyboard.press("Enter");
await p.waitForSelector("#choices");
check("キーボードで答えられる（矢印で半目盛りずつ・Enter で決める）", await p.evaluate(() => __km.cur().d.a) === 1.5);
{ const wi = await p.evaluate(() => { const c = __km.cur(); return c.P.opts.findIndex((o) => o !== c.P.ans); });
  await p.click(`.ch[data-j="${wi}"]`); await p.waitForTimeout(100);
  check("まちがい：✕ と文字で知らせ、その選び肢を消す", /✕/.test(await p.textContent("#msg")) && await p.locator(`.ch[data-j="${wi}"].ng[disabled]`).count() === 1); }
await answer(p);
check("まちがえたら★2", /★★☆/.test((await p.textContent(".verdict")).replace(/\s/g, "")));
await next(p);
// 3回目：ヒント2回でしぼる → 残ったまちがいを選ぶと正解だけ
await measure(p, 0);
check("差：押した時の位置そのものを答えると、差は半目盛り（約21ミリ秒）以内", Math.abs(await p.evaluate(() => __km.cur().d.ms)) <= 22);
await p.click("#hint"); await p.click("#hint"); await p.waitForTimeout(100);
check("ヒント1は見るところ、ヒント2でまちがいを1つ消して2つにしぼる", await p.locator(".ch:not([disabled])").count() === 2 && /💡/.test(await p.textContent("#hintbox")));
{ const left = await p.evaluate(() => { const c = __km.cur(); return [...document.querySelectorAll(".ch:not([disabled])")].map((b) => +b.dataset.j).find((j) => c.P.opts[j] !== c.P.ans); });
  await p.click(`.ch[data-j="${left}"]`); await p.waitForTimeout(100);
  check("ヒント2のあとに残ったまちがいを選ぶと、正解だけが残る", await p.locator(".ch:not([disabled])").count() === 1); }
await answer(p);
await next(p);
check("次の回でフォーカスが問題の枠に移る", await p.evaluate(() => document.activeElement && document.activeElement.id === "card"));
check("4回目は「押した瞬間」（M）のくらべの回", await p.evaluate(() => __km.cur().P.kind) === "M" && /押した瞬間/.test(await p.textContent("#card .bar")));
await measure(p, -2); await answer(p); await next(p);
await measure(p, -4); await answer(p); await next(p);
await p.waitForSelector("#wmean");
{ const s = await mem(p), rec = s.days[TODAY];
  check("今日の5回の記録：まちがい＋ヒント（0・1・3・0・0）・種類・差が残る・測った回数と記録帳の差に入る", rec && rec.m.join() === "0,1,3,0,0" && rec.k.join("") === "WWWMW" && rec.d.length === 5 && s.n === 5 && s.log.length === 5, JSON.stringify(rec));
  const ws = G.stats(rec.d.filter((_, j) => rec.k[j] === "W"));
  const signed = `${ws.mean > 0 ? "＋" : ws.mean < 0 ? "−" : "±"}${Math.abs(ws.mean)}ミリ秒`; // 符号も見る（押す前と押したあとを取りちがえない）
  check("結果：W の平均とばらつき（4回）を出す", (await p.textContent("#wmean")).includes(signed) && (await p.textContent("#wsd")).includes(`${ws.sd}ミリ秒`), await p.textContent("#wmean"));
  const tl = await p.textContent("#tl");
  check("結果：時間の線に、準備電位 type I・type II・論文の W・M と、あなたの W・M を並べ、準備電位は測れないと書く", /type I/.test(tl) && /type II/.test(tl) && /−1025/.test(tl) && /−550/.test(tl) && /あなたの W（4回）/.test(tl) && /あなたの M（1回）/.test(tl) && /測れません/.test(tl), tl.slice(0, 200));
  check("結果：時間の線は形でも分ける（論文 ◆・あなたの W ●・M ■）", await p.locator("#tl .dia").count() === 1 && await p.locator("#tl .ydot").count() === 1 && await p.locator("#tl .ysq").count() === 1);
  const st = await p.evaluate(() => __km.shareText("d", __km.todayKey(), JSON.parse(localStorage.getItem("kms-v1")).days[__km.todayKey()]));
  check("共有の文に測った差・問いの答えを入れない（押した時刻・答えは外へ出さない）", !/ミリ秒|\d{2,}ms/.test(st) && /第\d+回/.test(st), st); }
check("結果の画面：はみ出さない・押せる所44px以上", !(await overflow(p)) && (await sizes(p)).length === 0, JSON.stringify(await sizes(p)));
await p.screenshot({ path: path.join(root, "qa-report", "result-390.png"), fullPage: true }).catch(() => {});
// 上級：目盛りだけ・ヒントなし
await p.evaluate(() => __km.home()); await p.click("#go-h"); await p.waitForSelector("#spin");
check("上級：文字盤の数字が無い（目盛りだけ）・ヒントなし・今日の上級の tag", await p.locator("#dial .nm").count() === 0 && await p.locator("#hint").count() === 0 && await p.evaluate(() => __km.cur().tag) === G.hardTags(TODAY)[0]);
check("今日の5回：数字のある文字盤（0〜55）", await p.evaluate(() => { __km.home(); document.getElementById("go-p").click(); document.querySelector(".lv button").click(); return document.querySelectorAll("#dial .nm").length; }) === 12);
// 練習は記録に入れない
{ const before = await mem(p); await measure(p, 0); await answer(p);
  const after = await mem(p);
  check("練習：今日の記録・測った回数・記録帳の差に入れない", JSON.stringify(after.days) === JSON.stringify(before.days) && after.n === before.n && after.log.length === before.log.length); }
// とことん：1回測って降りる
await p.evaluate(() => __km.home()); await p.click("#go-e"); await p.waitForSelector("#spin");
await measure(p, 1); await answer(p);
await p.click("#quit"); await p.waitForSelector("#eres");
check("とことん：測った直後でも「ここで降りる」で終わり、1度に測った回数を残す", /1回 測りました/.test(await p.textContent("#eres")) && (await mem(p)).ebest === 1 && (await mem(p)).n === 6);
{ const L = await p.evaluate(() => __km.endlessList()); check("とことんの並びは40回ずつ・作れる tag", L.length === 40 && L.every(G.ok)); }
// 記録帳
await p.evaluate(() => __km.book()); await p.waitForTimeout(100);
check("記録帳：W・M の平均とばらつき・差の分かれ方・答えた問い", /W 平均/.test(await p.textContent("#bstat")) && await p.locator(".hist div").count() === 12 && await p.locator(".bq").count() === G.Q.filter((q) => q.g === "f").length);
check("記録帳：はみ出さない・押せる所44px以上", !(await overflow(p)) && (await sizes(p)).length === 0, JSON.stringify(await sizes(p)));
// 復習：まちがえた問いが次の日に戻る
{ const dep = await p.evaluate(() => JSON.parse(localStorage.getItem("kms-depth") || "{}"));
  const keys = Object.keys(dep.rv || {});
  check("復習：まちがえた・ヒントを使った問い（2回目・3回目）が次の日の復習に入る", keys.includes(day[1]) && keys.includes(day[2]) && dep.rv[day[1]].due === dayAdd(TODAY, 1), keys.join(","));
  await p.evaluate((t) => { const d = JSON.parse(localStorage.getItem("kms-depth")); for (const k in d.rv) d.rv[k].due = t; localStorage.setItem("kms-depth", JSON.stringify(d)); }, TODAY);
  await p.reload(); await p.waitForTimeout(200); await firstClose(p);
  check("復習：日の来た問いがホームに「復習 N問」で出る", /復習 2問/.test(await p.textContent("#go-r")));
  await p.click("#go-r"); await p.waitForSelector("#spin");
  check("復習：まちがえた回（同じ問い・同じ始まりの位置）を作り直す", [day[1], day[2]].includes(await p.evaluate(() => __km.cur().tag))); }
// 実績・カレンダー
await p.evaluate(() => __km.home()); await p.click("#go-ach"); await p.waitForTimeout(100);
check("実績：10〜14個・はじめの5回が取れている", await p.locator(".ach").count() >= 10 && await p.locator(".ach").count() <= 14 && await p.locator('.ach.got[data-id="first"]').count() === 1);
await p.evaluate(() => __km.cal()); await p.waitForTimeout(100);
check("カレンダー：今日の5回の日に★", await p.locator(`.cal .c[data-k="${TODAY}"] i`).count() === 1);
await p.close();

// 取りこぼした日：過去7日をあとから遊べる（日付を外から決める）
{ const p2 = await newPage();
  await p2.evaluate((d) => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0, n: 0, log: [] })); }, TODAY);
  await p2.reload(); await p2.waitForTimeout(150);
  const late = await p2.evaluate(() => __km.lateDays(__km.load()));
  const exp = []; for (let i = 1; i <= 7; i++) { const d = dayAdd(TODAY, -i); if (d >= "2026-11-27") exp.push(d); }
  check("取りこぼした日：公開の日（2026-11-27）から過去7日まで", JSON.stringify(late) === JSON.stringify(exp), late.join(","));
  if (late.length) { await p2.evaluate((d) => __km.start("a", d), late[0]); await p2.waitForTimeout(100); check("あとから：その日の今日の5回と同じ並び", await p2.evaluate(() => __km.cur().tag) === G.dailyTags(late[0])[0]); }
  // 記録の形が壊れていても開ける
  await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true, days: { "2026-11-27": { m: [0], k: ["X"], d: ["<b>"] }, "x": 1 }, hdays: [], dex: { constructor: 5, f01: "<i>" }, runs: { d: { mode: "d", date: "2026-11-27", list: ["W|f01|1"], res: [], cur: { wrong: [{ toString: null }], hints: "9", d: { a: 1, p: 2, ms: 999 }, step: 2 }, id: "x" }, e: 5 }, ebest: { toString: null }, n: [3], log: [["W", "<b>"], ["W", -100]] })); });
  await p2.reload(); await p2.waitForTimeout(150);
  const s = await p2.evaluate(() => __km.load());
  check("壊れた記録（形のちがう日・数でない物・合わない差）でもホームが出て、正しい形に直す", await p2.locator("#go-dex").count() === 1 && !s.days["2026-11-27"] && s.ebest === 0 && s.n === 0 && s.log.length === 1 && s.runs.d.cur.d === null && s.runs.d.cur.step === 1 && !("constructor" in s.dex && s.dex.constructor === 5), JSON.stringify(s).slice(0, 300));
  // 5回そろっていない日の記録は取り込まない（ホームが終えた日と見て、結果が NaN になる）
  await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true, days: { "2026-11-27": { m: [], k: [], d: [] }, "2026-11-28": { m: [0, 0], k: ["W", "W"], d: [-100, -100] }, "2026-11-29": { m: [0, 0, 0, 0, 0], k: ["W", "W", "W", "M", "W"], d: [-1, -2, -3, -4, -5] } } })); });
  { const s = await p2.evaluate(() => __km.load()); check("日ごとの記録は5回そろったものだけ残す（空・2回の日は捨てる）", Object.keys(s.days).join() === "2026-11-29", Object.keys(s.days).join()); }
  // 保存に失敗したタブ（mem）と、あとで保存したタブの記録帳の差を両方残す（回の印で合わせる）
  { const r = await p2.evaluate(() => {
      const base = { v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 };
      localStorage.setItem("kms-v1", JSON.stringify({ ...base, t: 2, n: 3, log: [["W", -100, "r1:0"], ["W", -120, "r1:1"], ["M", -50, "r2:0"]] }));
      __km.setMem(JSON.stringify({ ...base, t: 1, n: 3, log: [["W", -100, "r1:0"], ["W", -120, "r1:1"], ["W", -140, "r1:2"]] }));
      const a = __km.load();
      __km.setMem(JSON.stringify({ ...base, t: 1, n: 3, log: [["W", -100, "r1:0"], ["W", -120, "r1:1"], ["M", -50, "r2:0"]] }));
      const b = __km.load(); __km.setMem(null);
      return { a: [a.n, a.log.map((x) => x[2]).join()], b: [b.n, b.log.length] };
    });
    check("保存に失敗したタブと、あとで保存したタブの測定を両方残す（記録帳の差と測った回数）", r.a[0] === 4 && r.a[1] === "r1:0,r1:1,r2:0,r1:2" && r.b[0] === 3 && r.b[1] === 3, JSON.stringify(r)); }
  // 書いたのに残っていない（引き継ぎのあとの古いタブで書かずに戻るなど）ときは、保存できたことにしない
  { const r = await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true })); const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "kms-v1") return; return o.call(this, k, v); }; __km.save((s) => { s.ebest = 9; }); Storage.prototype.setItem = o; const kept = __km.load().ebest === 9, warn = !!document.getElementById("savewarn"); __km.save(() => {}); return { kept, warn, after: !document.getElementById("savewarn") && JSON.parse(localStorage.getItem("kms-v1")).ebest === 9 }; });
    check("書いても残っていなければ、手元の写し（mem）を消さずに帯を出し、次に書けたら残す", r.kept && r.warn && r.after, JSON.stringify(r)); }
  // 結果の時間の線：線の外の平均も端に丸めない（＋640 と ＋300 が同じ所に描かれない）
  { const r = await p2.evaluate(() => [640, -1250, 1280].map((v) => { const d = document.createElement("div"); d.innerHTML = __km.timeline({ n: 1, mean: v, sd: 0 }, null); return [v, +d.querySelector(".ydot").getAttribute("cx"), +d.querySelector(".zero").getAttribute("x1")]; }));
    check("結果の時間の線：線の外にある平均は、線を広げて描く（両端 8・332 に丸めない）", r.every(([v, x, z]) => x > 8 && x < 332 && (v > 0 ? x > z : x < z)), JSON.stringify(r)); }
  // 暗い画面：文字盤の数字（カードの地の上）を明るくする
  { await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true })); A11y.set("theme", 2); __km.home(); document.getElementById("go-p").click(); document.querySelector(".lv button").click(); }); await p2.waitForTimeout(200);
    const f = await p2.evaluate(() => getComputedStyle(document.querySelector("#dial .nm")).fill); await p2.evaluate(() => A11y.set("theme", 0));
    check("暗い画面：文字盤の数字を明るい色にする", f === "rgb(236, 234, 228)", f); }
  // 別のタブで先に測った差があれば、それを使う（この画面と結果で同じ差）
  { await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true })); __km.home(); document.getElementById("go-p").click(); document.querySelector(".lv button").click(); });
    await p2.waitForTimeout(150); await measure(p2, -2);
    const want = await p2.evaluate(() => { const c = __km.cur(), a = (c.d.a + 10) % 60, d = { a, p: c.d.p, ms: __km.G.diffMs(a, c.d.p) }; __km.save((s) => { s.runs[__km.mode()].cur.d = d; }); return d.ms; });
    await p2.click("#hint"); await p2.waitForTimeout(100);
    const shown = await p2.evaluate(() => __km.cur().d.ms); await answer(p2);
    const got = await p2.evaluate(() => { const r = __km.load().runs[__km.mode()]; return r.res[r.res.length - 1].d; });
    check("別のタブで先に測った差があれば、この画面も結果もその差を使う", shown === want && got === want, `${want} ${shown} ${got}`); }
  // 保存できないとき：帯を出したままにし、保存できたら消す
  await p2.evaluate(() => { localStorage.setItem("kms-v1", JSON.stringify({ v: 1, tut: true })); window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "kms-v1") throw new Error("full"); return window.__set.call(this, k, v); }; __km.home(); document.getElementById("go-p").click(); document.querySelector(".lv button").click(); });
  await p2.waitForTimeout(2500);
  check("保存できないときは、画面の上に帯を出したままにする（数秒たっても）", await p2.locator("#savewarn").count() === 1);
  await p2.evaluate(() => { Storage.prototype.setItem = window.__set; __km.save(() => {}); });
  check("保存できたら帯を消す", await p2.locator("#savewarn").count() === 0);
  await p2.close(); }

// 幅320px
{ const p3 = await newPage(320, 640); await firstClose(p3);
  const o1 = await overflow(p3); await p3.click("#go-d"); await p3.waitForSelector("#spin");
  const o2 = await overflow(p3); await p3.click("#spin"); await p3.waitForSelector("#press:not([disabled])", { timeout: 6000 }); await p3.click("#press"); await p3.waitForSelector("#pick", { timeout: 4000 });
  const o3 = await overflow(p3), sz = await sizes(p3);
  check("幅320px：ホーム・回す画面・答える画面がはみ出さない・押せる所44px以上", !o1 && !o2 && !o3 && sz.length === 0, `${o1}${o2}${o3} ${JSON.stringify(sz)}`);
  await p3.close(); }

// 深さの部品（shared-workflows template/qa/depth-check.mjs）
{ const e = await checkDepth(readFileSync(path.join(root, "depth.js"), "utf8")); check("depth.js（自信をかける・復習）の動き", e.length === 0, e.join(" / ")); }
// game-core（はじめての案内・感想・？遊び方・不具合の帯）
try { await checkCore({ browser, url, check }); } catch (e) { check("game-core の検査が最後まで動く", false, e.message.split("\n")[0]); }
// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "kms-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-27": { m: [0, 1, 0, 0, 2], k: ["W", "W", "W", "M", "W"], d: [-120, -240, -85, -43, -300] } }, hdays: {}, adays: {}, dex: { f01: 1, f08: 2, t07: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, n: 12, log: [["W", -120], ["M", -43]], t: 1 }), "kms-fs": "3", "kms-depth": JSON.stringify({ v: 1, rv: { "W|f08|22": { s: 0, due: "2026-11-28", t: 5 } } }) };
  await checkTransfer({ browser, url, game: "kimeta-shunkan", sample, check, open: async (pg) => { await firstClose(pg); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 決めた瞬間はいつ？ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
