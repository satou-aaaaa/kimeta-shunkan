// 決めた瞬間はいつ？の中身（ブラウザと node の両方で使う）。
// 1回＝回る点の時計を見て、好きなときにボタンを押す。押そうと思った瞬間（W）か押した瞬間（M）の点の位置を答え、
// 押した時の点の位置との差をミリ秒で出す。そのあと2段目で、実験の読み方の問い（3つから1つ）に答える。
// 時計は Libet, Gleason, Wright, Pearl (1983) Brain 106:623-642 と同じ：1周 2.56 秒・60目盛り（1目盛り 2560/60 ≒ 42.7 ms）・
// 押したあと 500〜800 ms 回ってから止まる・はじめに1周まつ。問いの答えは同じ論文と Schurger, Sitt, Dehaene (2012) PNAS 109:E2904 の数字。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ始まりの位置・同じ問い。
// Q の並び・中身は、変えると過去の日の問いが変わる。公開したあとは最後に足すだけにし、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const PERIOD = 2560, TICKS = 60, STEP = 0.5; // 1周のミリ秒・目盛りの数・答えのきざみ（半目盛り ≒ 21 ms）
  const COAST = [500, 800]; // 押したあと点が回り続ける長さ（論文 p.626 "between +500 and +800 ms"）
  const KIND = { W: { name: "押そうと思った瞬間", short: "W", ask: "押そうと思った瞬間、点はどこにいた？" }, M: { name: "押した瞬間", short: "M", ask: "ボタンを押した瞬間、点はどこにいた？" } };
  // 論文の数字（筋肉の電気 EMG が出はじめた時を0としたミリ秒。Libet ほか 1983 の本文と Table 2）
  const LIBET = { W: -204, M: -86, S: -47, RP2: -550, RP1: -1025, W2RP2: 350, W2RP1: 800, N: 40 };
  const SRC = {
    libet: ["Libet, Gleason, Wright, Pearl「Time of conscious intention to act in relation to onset of cerebral activity (readiness-potential)」Brain 106 (1983) 623–642", "https://doi.org/10.1093/brain/106.3.623"],
    schurger: ["Schurger, Sitt, Dehaene「An accumulator model for spontaneous neural activity prior to self-initiated movement」PNAS 109 (2012) E2904–E2913", "https://doi.org/10.1073/pnas.1210467109"],
  };
  const L = [SRC.libet], S2 = [SRC.schurger];

  // 論文を読む問い（id・問い・選び肢（はじめが答え）・見るところ・わけ・出典）
  const FACTS = [
    ["f01", "実験の点は、1周を何秒で回った？", ["2.56秒", "1秒", "60秒"], "ふつうの時計の秒針より、ずっと速い。", "1周2.56秒。秒針（60秒）よりずっと速く回した。", L],
    ["f02", "文字盤の1目盛り（60に分けた1つ）は、約何ミリ秒？", ["約43ミリ秒", "約17ミリ秒", "約1000ミリ秒"], "2560ミリ秒を60で分ける。", "2560 ÷ 60 ≒ 42.7。1目盛りで約43ミリ秒。", L],
    ["f03", "「押そうと思った時」（W）は、どうやって測った？", ["点の位置を、本人があとで答えた", "脳波から読みとった", "筋肉の電気から読みとった"], "このゲームと同じやり方。", "W は本人の答えだけが手がかり。点の位置を思い出して答えた。", L],
    ["f04", "W は、筋肉が動き出す約何ミリ秒前だった？", ["約200ミリ秒前", "約20ミリ秒前", "約2000ミリ秒前"], "1秒の5分の1くらい。", "W の平均は約−200ミリ秒（表では−204）。", L],
    ["f05", "「動いた」と感じた時（M）は？", ["約85ミリ秒前", "約500ミリ秒前", "約300ミリ秒あと"], "W より0に近い。", "M の平均は約−85ミリ秒（表では−86）。動く前に「動いた」と答えていた。", L],
    ["f06", "準備電位（type II）は、W より約何ミリ秒前に始まった？", ["約350ミリ秒前", "約35ミリ秒前", "約3500ミリ秒前"], "動画で「約0.35秒」と言った数字。", "type II の準備電位は、W より平均約350ミリ秒前に始まった。", L],
    ["f07", "前もって考えた回がまじる組（type I）では、準備電位は W の約何ミリ秒前？", ["約800ミリ秒前", "約80ミリ秒前", "約8000ミリ秒前"], "type II の約350ミリ秒より長い。", "type I の準備電位は、W より平均約800ミリ秒前に始まった。", L],
    ["f08", "1つの組で、何回くり返して平均した？", ["40回", "5回", "1000回"], "準備電位は小さいので、何回も重ねた。", "1つの組は40回。脳波を重ねて平均した。", L],
    ["f09", "動いたあと、点はどうなった？", ["0.5〜0.8秒回ってから止まった", "押したその時に、ぴたりと止まった", "止まらずに、ずっと回り続けた"], "このゲームの点も同じ。", "動いたあと、点は500〜800ミリ秒回ってから止まった。", L],
    ["f10", "手の甲に弱い刺激を当てた回（S）で、感じた時の答えは？", ["本当より少し早め（約50ミリ秒）", "本当より約500ミリ秒おそめ", "いつもぴったり"], "答え方のくせを調べるための回。", "S の平均は約−50ミリ秒（表では−47）。答えは少し早めにずれていた。", L],
    ["f11", "いつ動くかについて、どう頼まれた？", ["したくなった時に。前もって決めない", "合図の音が鳴ったら、すぐに動く", "点が0の所に来たら、そこで動く"], "「自分で決めた」動きを調べたい。", "前もって決めず、したくなった時に動くよう頼まれた。", L],
    ["f12", "論文の時刻の0（基準）は？", ["筋肉の電気が出はじめた時", "点が止まった時", "準備電位が出はじめた時"], "腕や指の筋肉。", "0は筋肉の電気（EMG）が出はじめた時。このゲームの0はボタンが押された時。", L],
    ["f13", "点が回り出してから、まず何を待った？", ["点が1周するまで", "点が10周するまで", "何も待たない"], "このゲームも同じ。", "点が1周するのを待ってから、動いてよいことにした。", L],
    ["f14", "論文が考えた「拒否（veto）」とは？", ["W のあと動くまでに、やめられるかもしれない", "準備電位を、薬で止めてしまうこと", "点の位置を、あとで答えずにおくこと"], "W から動くまで約150〜200ミリ秒ある。", "W のあと動くまでの間に、意識で止められるかもしれない、と考えた。", L],
    ["f15", "Schurger らは、準備電位の早い部分をどう読んだ？", ["ゆらぎの積み上がりで、まだ決める前かもしれない", "決めたあとの、動くための準備にちがいない", "まばたきなど、目の動きから出る電気"], "「決める前」か「決めたあと」か。", "早い部分は、決める前のゆらぎの積み上がりかもしれない、と読んだ。読み方は分かれている。", S2],
    ["f16", "Schurger らのモデルで、「動く」と決まるのはいつごろかもしれない？", ["動く約150ミリ秒前", "動く約1.5秒前", "動いたあと"], "W（約200ミリ秒前）より少しあと。", "決めるのは動くすぐ前（例：約150ミリ秒前）かもしれない、と述べた。", S2],
    ["f17", "このゲームの画面で、論文から借りた数字は？", ["準備電位（脳波）", "押した時刻", "答えた点の位置"], "頭に付ける機械が要るもの。", "準備電位は脳波。このゲームでは測れない。", L],
    ["f18", "このゲームの時刻の0は？", ["ボタンが押された時", "筋肉の電気が出はじめた時", "点が止まった時"], "論文の0とはちがう。", "このゲームの0は、ボタンが押された知らせが画面に届いた時。", L],
    ["f19", "type II の準備電位は、筋肉が動く約何ミリ秒前に始まった？", ["約550ミリ秒前", "約55ミリ秒前", "約5500ミリ秒前"], "W の約200ミリ秒に、約350ミリ秒を足す。", "type II の始まりは平均約−550ミリ秒。W（約−200）のさらに約350ミリ秒前。", L],
  ];
  const msOf = (n) => Math.round((n * PERIOD) / TICKS);
  const Q = FACTS.map(([id, q, opts, look, why, src]) => ({ id, q, opts, ans: opts[0], look, why, src, g: "f" }));
  // 計算の問い（1周 2560 ミリ秒・60目盛りから。答えは msOf、ちがう選び肢は「1周1秒」「1周60秒」とまちがえた時の数）
  for (let n = 1; n <= 30; n++) Q.push({ id: "t" + String(n).padStart(2, "0"), g: "t", q: `点が ${n} 目盛り進むのに、約何ミリ秒かかる？`, opts: [`約${msOf(n)}ミリ秒`, `約${Math.round((n * 1000) / TICKS)}ミリ秒`, `約${n * 1000}ミリ秒`], look: "1周2560ミリ秒・60目盛り。", why: `2560 × ${n} ÷ 60 ≒ ${msOf(n)}。`, src: L });
  for (let n = 1; n <= 25; n++) Q.push({ id: "b" + String(n).padStart(2, "0"), g: "b", q: `答えた位置が、押した時の点より ${n} 目盛り手前。差は？`, opts: [`−${msOf(n)}ミリ秒（押す前）`, `＋${msOf(n)}ミリ秒（押したあと）`, `−${Math.round((n * 1000) / TICKS)}ミリ秒（押す前）`], look: "手前＝点がそれより前に通った所。そこならマイナス。", why: `${n}目盛り × 約42.7 ≒ ${msOf(n)}ミリ秒。手前なのでマイナス（押す前）。`, src: L });
  for (const x of Q) x.ans = x.opts[0];
  const QBY = Object.fromEntries(Q.map((x) => [x.id, x]));

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // tag ＝ "W|f03|17"（種類 W・M｜問いの id｜点の始まりの目盛り 0〜59）。この文字だけで同じ1回を作り直せる
  const TAG = /^([WM])\|([a-z]\d\d)\|(\d{1,2})$/;
  function ok(tag) { const m = TAG.exec(String(tag)); return !!m && !!QBY[m[2]] && +m[3] < TICKS && String(+m[3]) === m[3]; }
  function make(tag) {
    if (!ok(tag)) return null;
    const [, k, qid, st] = TAG.exec(tag), q = QBY[qid], R = rng(seedOf("t:" + tag));
    const opts = shuffle(R, q.opts), coast = ri(R, COAST[0], COAST[1]); // 選び肢の並びと、押したあと回る長さ（同じ tag なら同じ）
    return { tag, kind: k, K: KIND[k], start: +st, qid, q: q.q, opts, ans: q.ans, look: q.look, why: q.why, src: q.src, g: q.g, coast, name: KIND[k].name };
  }
  // 点の位置（目盛り。0〜60 未満）：回し始めて t ミリ秒
  const posAt = (start, t) => (((start + (t * TICKS) / PERIOD) % TICKS) + TICKS) % TICKS;
  // 答えた位置 a と押した時の位置 p の差（ミリ秒）。半周より遠ければ反対まわりに数える（−1280〜＋1280 未満）。マイナスなら押す前
  function diffMs(a, p) { let d = (((a - p) % TICKS) + TICKS) % TICKS; if (d >= TICKS / 2) d -= TICKS; return Math.round((d * PERIOD) / TICKS); }
  const snap = (x) => ((Math.round(x / STEP) * STEP) % TICKS + TICKS) % TICKS; // 答えは半目盛りきざみ
  // 平均とばらつき（標本の標準偏差。1つなら0）
  function stats(a) { const n = a.length; if (!n) return { n: 0, mean: 0, sd: 0 }; const m = a.reduce((x, y) => x + y, 0) / n; const v = n > 1 ? a.reduce((x, y) => x + (y - m) * (y - m), 0) / (n - 1) : 0; return { n, mean: Math.round(m), sd: Math.round(Math.sqrt(v)) }; }

  const IDS = Q.map((x) => x.id);
  // 今日の5回（W・W・W・M・W。4回目は「押した瞬間」のくらべの回）。問いは 論文・論文・計算・計算（差）・論文 の順で、重ねない。だれでも同じ
  const DKINDS = ["W", "W", "W", "M", "W"], DGRPS = ["f", "f", "t", "b", "f"], HGRPS = ["f", "t", "f", "b", "f"];
  const pickQ = (R, grps, used) => grps.map((g) => { const c = IDS.filter((x) => QBY[x].g === g && !used.has(x)); const q = c[ri(R, 0, c.length - 1)]; used.add(q); return q; });
  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), qs = pickQ(R, DGRPS, new Set());
    return DKINDS.map((k, i) => `${k}|${qs[i]}|${ri(R, 0, TICKS - 1)}`);
  }
  // 上級：目盛りだけの文字盤で W を5回。今日の5回と問いを重ねない
  function hardTags(date) {
    const used = new Set(dailyTags(date).map((t) => t.split("|")[1])), R = rng(seedOf("hard:" + date)), qs = pickQ(R, HGRPS, used);
    return qs.map((q) => `W|${q}|${ri(R, 0, TICKS - 1)}`);
  }
  // 種から n 回分（練習・とことん）。問いは全部出し切るまで重ねない（seen に入れた問いは使わない）。kinds は "W"・"M"・"X"（まぜる。W を多めに）
  function randomTags(seed, n, kinds, seen) {
    const R = rng(seedOf("r:" + seed)), out = [];
    let pool = shuffle(R, IDS.filter((x) => !seen.has(x)));
    for (let i = 0; i < n; i++) {
      if (!pool.length) { seen.clear(); pool = shuffle(R, IDS); }
      const q = pool.shift(); seen.add(q);
      const k = kinds === "X" ? (ri(R, 0, 3) === 0 ? "M" : "W") : kinds;
      out.push(`${k}|${q}|${ri(R, 0, TICKS - 1)}`);
    }
    return out;
  }

  const KMS = { PERIOD, TICKS, STEP, COAST, KIND, LIBET, SRC, Q, QBY, IDS, ok, make, posAt, diffMs, snap, stats, msOf, dailyTags, hardTags, randomTags, seedOf, rng, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = KMS; else root.KMS = KMS;
})(typeof self !== "undefined" ? self : this);
