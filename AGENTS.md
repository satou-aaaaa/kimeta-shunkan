# AGENTS.md

決めた瞬間はいつ？：1周2.56秒で回る点の時計を見て、好きなときにボタンを押す。押そうと思った瞬間（W）か押した瞬間（M）の点の位置を答え、押した時との差（ミリ秒）が出る1日5回のゲーム。2段目は実験の読み方の問い（3つから1つ）。リベットの実験（Libet ほか 1983）の体験。`index.html` と `data.js`（時計の数・問い・tag の作り方・差の出し方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

## push する前の確認

```bash
node qa/run.mjs   # 時計の数・差の出し方と問いの答えの解き直し・今日の5回と上級（3年分）・とことん・通しで遊ぶ（1周まつ・押した時の点・回り続けて止まる・文字盤とキーボードで答える・2段目・まちがい・ヒント・続きから・結果の時間の線）・上級・練習・とことん・復習・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）。日付を変えるときは QA_DATE=YYYY-MM-DD
```

## このリポジトリの決まり

- 中身：時計と数字は Libet, Gleason, Wright, Pearl (1983) Brain 106:623–642 と同じ（1周 2560 ms・60目盛り・1周まってから押す・押したあと 500〜800 ms 回って止まる）。論文の数字（W −204・M −86・S −47・準備電位 type II −550＝W のさらに約350前・type I −1025＝W の約800前・40回）は `data.js` の `LIBET` と、`qa/run.mjs` の `PAPER`（別に書いた表）が同じかを QA が見る。解釈が分かれることは Schurger, Sitt, Dehaene (2012) PNAS 109:E2904 から。出典メモは共有フォルダ `games/kimeta-shunkan-research.md`。
- 言い方：「自由意志は無い」などと言い切らない。読み方が分かれていることを書く。準備電位は脳波なのでこのゲームでは測れないことを、遊び方・「このゲームについて」・結果の時間の線・README に書く。論文の0（筋肉の電気）とゲームの0（ボタン）がちがうことも書く（QA が見る）。
- 1回の流れ：回す（`spin`）→ 1周たつと押せる（`press`。押した時刻はイベントの時刻 `e.timeStamp`。`performance.now` と同じものさし）→ `P.coast` ミリ秒回って止まる → 文字盤を押すか ◀▶・矢印で半目盛りきざみに答える（`decide`）→ 差 `G.diffMs`（−1280〜＋1280）→ 2段目の問い（`askWhy`。自信あり・ヒント2つ）。測った差は `runs.*.cur.d` に保存し、続きからは測り直さない。
- tag は `種類|問い|始まりの目盛り`（例 `W|f03|17`）。この文字だけで同じ1回（始まりの位置・選び肢の並び・回り続ける長さ）を作り直す。復習の鍵も tag。
- 今日の5回（W・W・W・M・W、問いは 論文・論文・計算・差・論文）・上級（目盛りだけの文字盤で W を5回、今日と問いを重ねない、ヒントなし）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。`Q` の並び・乱数を引く順番は、変えると過去の日が変わる。公開後に問いを足すときは、最後に足して `FACTS` の7つ目に使い始める日（since）を書く（その日より前の5回は、足す前の問いだけから選ぶ。QA が見る）。並び・乱数を変えるときは QA の `PINS` を作り直して理由を PR に書く。`data.js` を変える PR は自動ではマージされない（`hold_paths`）。
- ★は2段目の問いのまちがい＋ヒントの数（0で★3・1で★2・2以上で★1）。測った差に「正解」は無い。時間制限なし（押すまで待つ）。
- 好きなだけ遊べる：チケット・ライフ・回数制限・🔒で開くモードを入れない（shared-workflows `routines/game-dev.md` F1〜F7）。とことん（`runs.e`）は「ここで降りる」で終わり、1度に測った回数（`ebest`）を残す。
- 記録：記録 `kms-v1`・文字 `kms-fs`・復習 `kms-depth`。押した時刻・答えはこの端末の localStorage だけに残し、外へ送らない（CSP の `connect-src 'self'` を広げない）。共有の文に測った差を入れない。練習は今日の記録・記録帳の差（`log`）に入れない。
- 1問を深くする：`depth.js` と `qa/depth-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。見やすさ（`<!-- a11y:begin -->`〜`end`）・game-core・kiroku・GameStore・引き継ぎ（`transfer.js`）も同じ。直すときは shared-workflows の `template/` を直し、shared-workflows のフォルダで `node scripts/sync-template.mjs <このリポジトリのフォルダ>` を実行して写す。
- 画面の土台は屋台の値下げ合戦（yatai-negasen）から写した。写し元の言葉が残っていないかを QA が見る。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、`og.png` は `node tools/make-og.cjs`。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを読み、手でマージする直前に今の head へのレビューを読み直す。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
