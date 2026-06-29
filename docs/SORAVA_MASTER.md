# Sorava / SkyShare マスター資料

最終更新: 2026-06-29  
対象リポジトリ: `Mill-Miya/SkyShare`  
開発名: `SkyShare`  
サービス名・呼称: `Sorava`

> この資料は、観望会支援Webアプリ Sorava / SkyShare の現時点における目的、設計、実装状況、運用方針をまとめたマスター資料である。

---

## 0. 基本情報

| 項目 | 内容 |
|---|---|
| アプリ名 | SkyShare |
| サービス名・呼称 | Sorava |
| GitHub | `Mill-Miya/SkyShare` |
| Frontend | GitHub Pages |
| Backend | Render |
| Backend URL | `https://skyshare-nhcb.onrender.com` |
| WebSocket | `wss://skyshare-nhcb.onrender.com/ws` |
| 最新確認コミット | `2972f3d Center clear target row` |

公開URL:

```text
https://mill-miya.github.io/SkyShare/
```

PASSは公開リポジトリ上では値を直接管理しない。運用時の共有用アクセスコードは、GitHub Secrets / Render環境変数 / 部内連絡など、公開されない場所で管理する。

---

## 1. Sorava / SkyShare とは

Sorava / SkyShareは、観望会でHostが選んだ天体や方向を参加者へ共有し、参加者が自分のスマートフォンで対象天体を見つけやすくするためのWebアプリである。

目的は、高機能な天文シミュレーターを作ることではない。

主目的は、観望会で参加者全員が同じ空・同じ天体を見つけやすくすることである。

通常の星図アプリは、基本的に利用者が自分で天体を探す。Soravaでは、案内役であるHostが対象を選び、それをGuest側へ同期できる。

典型的な流れは以下の通り。

```text
Hostが「今日はこれを見る」と選ぶ
↓
Guestのスマホにも同じ対象が表示される
↓
Guestは自分のスマホで方向や高度を確認する
↓
観望会で同じ対象を探しやすくなる
```

---

## 2. 開発背景

観望会では、初心者が対象天体を見つけるのが難しい。

よく起きる問題は以下である。

- どの星を見ているのか分からない
- 説明された方角が分からない
- 「あの明るい星の右」と言われても、その星がどれか分からない
- Hostの説明を聞き逃すと追いつけない
- 人数が多いと一人ずつ案内しにくい
- 星図アプリは高機能すぎて初心者には扱いにくい

Soravaは、これらの問題を軽くするために考えた。

参加者が天文学に詳しくなくても、以下を把握できるようにする。

- 今は何を見ているのか
- どちらを向けばいいのか
- どのくらいの高さを見ればいいのか

---

## 3. コンセプト

Soravaのコンセプトは以下である。

> 案内役が選んだ天体を、参加者全員のスマホへ共有する観望会支援ツール

重要な考え方は以下。

- 星図アプリではなく観望会補助ツール
- 参加者が同じ対象を見つけやすくする
- スマホブラウザで即利用できる
- アプリインストール不要
- QRコードから参加できる
- 通信量を少なくする
- 手動操作でも使える
- センサー追従は補助機能
- 現場で壊れないことを優先する

---

## 4. 想定利用シーン

主な想定は、大学天文部の観望会である。

典型的な流れ。

1. HostがSoravaでセッションを作成する
2. QRコードを表示する
3. 参加者がスマホでQRを読み取る
4. PASSを入力する
5. Guestとして参加する
6. Hostが対象天体を選択する
7. Guestのスマホにも同じ対象が反映される
8. Guestが方位・高度・誘導UIを見ながら空を探す
9. Hostが対象を切り替えたり、方向共有したりする

---

## 5. Host と Guest

### Host

Hostは、観望会で夜空を案内する人である。

Hostができること。

- セッション作成
- QRコード表示
- 観望対象の選択
- 対象共有
- 共有OFF
- 方向共有
- 参加人数確認
- セッション終了

### Guest

Guestは、観望会に参加する人である。

Guestができること。

- QRコードから参加
- Hostが選んだ対象を見る
- 対象の方位・高度を確認
- 誘導UIを見て空を探す
- 手動操作または追従モードでSky画面を動かす

---

## 6. 普通の星図アプリとの違い

普通の星図アプリは、自分で天体を調べたり探したりするためのもの。

Soravaは、観望会で案内役と参加者が同じ対象を見るための共有機能を持つ。

```text
普通の星図アプリ: 自分で探す
Sorava: Hostが選んだ対象をGuestに同期して、みんなで同じ対象を探す
```

---

## 7. 使用技術

### 主な使用言語

- TypeScript

### 補助的に使用しているもの

- JavaScript
- HTML
- CSS

### Frontend

- React
- Vite
- TypeScript
- Canvas 2D

### Backend

- Node.js
- WebSocket
- JavaScript

### 天体計算

- astronomy-engine

### 通信

- HTTP
- WebSocket

### ホスティング

- Frontend: GitHub Pages
- Backend: Render

### 開発・管理

- GitHub
- GitHub Actions
- Render Dashboard
- Codex
- ChatGPT

---

## 8. Render の役割

Renderは、バックエンドサーバーを公開するために使っているホスティングサービスである。

Soravaでは、Render上で以下を動かしている。

- Node.jsのセッションサーバー
- WebSocketサーバー
- `/api/session`
- `/health`
- `/ws`

役割の整理。

```text
GitHub Pages: 画面を表示するFrontend
Render: HostとGuestをつなぐBackend
```

---

## 9. 全体構成

Soravaは、FrontendとBackendを分けている。

```text
スマホ / PC
  ↓
GitHub Pages上のFrontend
  ↓
Render上のBackend
  ↓
WebSocketでHost/Guest同期
```

Frontendは、画面表示・天体計算・Sky描画・Targets選択を担当する。

Backendは、セッション作成・Host/Guest接続・targetId同期・方向共有を担当する。

---

## 10. 重要な設計方針

Soravaでは、サーバーで天体位置計算をしない。

サーバーは基本的に以下だけを同期する。

- targetId
- 方向情報
- 参加人数
- セッション状態

天体位置は各端末で計算する。

理由。

- 通信量を減らせる
- サーバー負荷を減らせる
- 無料サーバーでも運用しやすい
- 各端末の現在地と時刻に合わせられる
- 低通信環境でも動きやすい

---

## 11. データの流れ

Hostが対象を選んだ場合。

```text
HostがM31を選択
↓
Frontendが targetId: messier_m31 をBackendへ送る
↓
BackendがGuestへ targetId を配信
↓
Guest端末が messier_m31 のRA/Decから現在の方位・高度を計算
↓
Guest画面にM31の方向と誘導UIを表示
```

重要なのは、サーバーがM31の位置を計算して配っているわけではないこと。

サーバーは、「HostがM31を選んだ」という情報だけを中継する。

---

## 12. 画面構成

主な画面は以下。

- Sky
- Targets
- Session
- Settings

### Sky画面

空を表示する中心画面。

表示内容。

- 現在のSky中心方位・高度
- 明るい恒星
- 月・惑星
- 選択中の対象
- メシエ天体
- 二重星
- 目印線
- 誘導UI
- Host共有方向
- 手動 / 追従切替

Sky画面はCanvas 2Dで描画している。

操作。

- スワイプ: 方位・高度を動かす
- ピンチ: ズーム
- 追従ON: 端末センサーに合わせて動く

### Targets画面

観望対象を選ぶ画面。

カテゴリ。

- おすすめ
- 月・惑星
- 明るい星
- 星雲・星団
- 二重星
- 目印
- 季節別

夏の大三角や北斗七星のような複合目印は、Targetsからは非表示にしている。理由は、単一ターゲットとして誘導すると意味が曖昧になるためである。

現在、Targetsの「選択なし」は中央に単独表示される。説明文は削除済み。

### Session画面

Host / Guestの接続を管理する画面。

Host側。

- セッション作成
- QRコード表示
- 参加URL表示
- 参加人数表示
- 共有状態表示
- セッション終了

Guest側。

- QR参加
- セッション参加
- Hostの共有対象確認

### Settings画面

設定画面。

主な項目。

- ナイトモード
- 上下反転
- Sensor Probe
- 管理者向けデバッグ

現在、「上下反転」は通常表示として追加済み。センサー追従時に上下が逆に動く端末で、管理者画面を開かずに切り替えられる。

---

## 13. PASS機能

SoravaにはPASS機能がある。

目的は、URLが残っても誰でも簡単に入れないようにすることである。特に、部内テスト後にURLだけが残り続けて、勝手に使われるのを防ぐ目的がある。

### 通常URLの場合

```text
https://mill-miya.github.io/SkyShare/
↓
PASS入力画面
↓
PASS入力
↓
アプリ本体へ進む
```

### join URLの場合

```text
https://mill-miya.github.io/SkyShare/join/{sessionId}
↓
PASS入力画面
↓
PASS入力
↓
Guest参加へ進む
```

### PASS誤入力時

PASSを間違えると、同一タブでロックされる。

誤入力時には以下を開始しない。

- WebSocket接続
- joinSession
- Guest状態への遷移
- target共有処理
- pointer共有処理

ロック状態は `sessionStorage` に保存される。

再テストする場合は以下が必要。

- タブを閉じる
- 別タブで開く
- 別ブラウザで開く
- サイトデータを削除する

localhostではPASSは基本表示されず、公開URLで確認する想定。

---

## 14. Targetsに入っている対象

### 月・惑星

- 月
- 水星
- 金星
- 火星
- 木星
- 土星

### 明るい星

- ベガ
- アルタイル
- デネブ
- アークトゥルス
- スピカ
- アンタレス
- シリウス
- ベテルギウス
- リゲル
- カペラ
- アルデバラン
- プロキオン
- ポルックス
- レグルス
- フォーマルハウト
- 北極星
- カノープス

### 星雲・星団・銀河

- M31 アンドロメダ銀河
- M42 オリオン大星雲
- M45 すばる
- M13 ヘルクレス座球状星団
- M57 リング星雲
- M27 亜鈴状星雲
- M44 プレセペ星団
- M3 球状星団
- M8 干潟星雲
- M20 三裂星雲
- M17 オメガ星雲
- M11 野鴨星団

### 二重星

- アルビレオ
- ミザール
- カストル
- アルマク
- ε Lyrae ダブル・ダブルスター
- コル・カロリ

### 目印

Targetsからは複合目印は非表示。ただしSky上では薄い補助線として表示する。

- 夏の大三角
- 冬の大三角
- 北斗七星
- カシオペヤ座
- オリオン座三つ星

---

## 15. 天体位置計算

### 月・惑星

`astronomy-engine` を使って、現在地・現在時刻から方位・高度を計算する。

### 恒星・メシエ天体・二重星

固定RA/Decを持つカタログ対象として定義している。

各端末が以下を使い、方位・高度へ変換する。

- RA
- Dec
- 緯度
- 経度
- 現在時刻

現段階では、歳差補正などの高精度処理は未実装。Soravaの目的が精密な天文シミュレーターではなく、観望会で対象方向を案内する補助ツールだからである。

---

## 16. Sky描画

Sky画面はCanvas 2Dで描画している。

描画対象。

- 背景
- 地平線
- 山・地面表現
- 明るい恒星
- 月・惑星
- メシエ天体
- 二重星
- 選択中対象
- Host共有方向
- 目印線
- 誘導UI

描画方針。

- 通常時はラベルを出しすぎない
- 選択中対象は強調する
- 地平線下の対象は抑制
- メシエ天体は小さなリング系
- 二重星は二点
- 目印線は薄く表示

天体名が表示される条件。

- 選択中の対象
- `debug=1`
- 視線が明らかに近い場合

常時大量にラベルを出すと星図アプリのようになり、観望会補助ツールとして見にくくなるため、表示を抑えている。

---

## 17. 誘導UI

Targetsで対象を選ぶと、Sky画面に誘導UIが出る。

誘導では、Sky中心と対象の方位・高度差を計算する。

表示内容。

- 左右どちらへ動かすか
- 上下どちらへ動かすか
- 対象に近いか
- 低高度警告
- 捕捉判定

捕捉判定は `±3°以内`。

これは望遠鏡の精密導入ではなく、参加者が対象方向の目安を掴むためのものである。

---

## 18. Host / Guest 共有

Hostが選んだ対象は、Guestへ共有される。

共有されるもの。

- `targetId`

共有されないもの。

- HostのGPS
- Hostの時刻
- Hostの生センサー値
- Host端末の姿勢そのもの

Guestは受け取った `targetId` をもとに、自分の端末で天体位置を計算する。

---

## 19. 方向共有

対象共有とは別に、HostがSky画面で見ている中央方向をGuestへ共有できる。

共有する情報。

- `azimuthDeg`
- `altitudeDeg`

これにより、「このあたりを見て」という案内がしやすくなる。

方向共有でも、Hostのセンサー生データは送らない。

---

## 20. センサー追従

スマホのDeviceOrientationを使い、端末の向きに合わせてSky画面を動かす追従モードがある。

ただし、センサー追従は端末差が大きい。

起きやすい問題。

- 方位がずれる
- Androidで値が暴れる
- 古い端末でセンサーが取れない
- iPhoneで権限要求が必要
- 上下が逆になる端末がある
- 磁気センサーが周囲の金属に影響される

そのため、Soravaではセンサー追従を補助機能として扱う。本命は手動操作である。

---

## 21. 上下反転

Settingsに「上下反転」を追加済み。

目的は、センサー追従時に、上へ向けたのに下へ動く端末を救済することである。

以前は管理者画面内の設定だったが、現在は通常Settingsに表示される。

---

## 22. 手動操作

Soravaでは手動操作を本命としている。

理由。

- 全員のセンサーが正確とは限らない
- 古いAndroidではセンサーが不安定
- 磁気センサーは環境に左右される
- 手動ならほぼ全端末で使える

手動操作でできること。

- Skyをスワイプして動かす
- ピンチでズームする
- 対象方向へ誘導を見る
- Hostが共有した対象を見る

---

## 23. UI方針

Soravaの主な利用端末はスマホ。そのため、PCよりスマホUIを優先する。

重要な方針。

- 重ならない
- 下まで見える
- スクロールできる
- ボタンが押せる
- 文字を詰め込みすぎない
- Sky操作を邪魔しない
- Bottom navに隠れない

現在、スマホ向けに `@media (max-width: 430px)` のレスポンシブCSSが入っている。

調整済みの内容。

- Top bar圧縮
- Guidance panel圧縮
- Targets行をスマホ向けに整理
- Session画面圧縮
- Bottom Sheet高さ調整
- Bottom nav圧縮
- Targets表示文言短縮

Targets表示文言の例。

```text
方位 123° → 方123°
高度 35° → 高35°
地平線下 → 地平下
観測困難 → 困難
```

---

## 24. ナイトモード

観望会では暗順応を邪魔しないように、ナイトモードを用意している。

ナイトモードでは、赤系の表示に切り替える。

ただし、アプリ側だけでなくスマホ本体の画面輝度も下げる必要がある。

---

## 25. サーバー機能

Backendの主な機能。

- `/health`
- `/api/session`
- `/ws`

### `/health`

サーバーが起きているか確認するためのエンドポイント。

### `/api/session`

Hostがセッションを作成するためのエンドポイント。

### `/ws`

Host / Guest間のリアルタイム同期用WebSocket。

---

## 26. サーバー側の安全対策

実装済み。

- targetId validation
- pointer azimuth/altitude validation
- NaN拒否
- Infinity拒否
- 文字列数値拒否
- オブジェクト拒否
- room数上限
- guest数上限
- room TTL cleanup
- WebSocket heartbeat
- rate limit
- `crypto.randomInt` によるsessionId生成
- `ALLOWED_ORIGINS` によるOrigin制限
- 不正targetId拒否

これは商用サービス並みの認証ではなく、公開テストで最低限荒らされにくくするための対策である。

---

## 27. Render設定

Backend Render service。

| 項目 | 値 |
|---|---|
| Name | SkyShare |
| Region | Oregon |
| Instance Type | Free |
| Source | `https://github.com/Mill-Miya/SkyShare` |
| Branch | `main` |
| Root Directory | 空欄 |
| Build Command | `npm ci` |
| Start Command | `npm run server` |
| Health Check Path | `/health` |

Root Directoryは空欄でよい。repo直下に `package.json` や `server` などがあるため。

### ALLOWED_ORIGINS

本番GitHub Pagesだけなら以下。

```text
ALLOWED_ORIGINS=https://mill-miya.github.io
```

ローカルも許可するなら以下。

```text
ALLOWED_ORIGINS=https://mill-miya.github.io,http://localhost:5173,http://localhost:5174
```

注意。

- `/SkyShare/` は入れない
- 末尾スラッシュも入れない
- Originだけ入れる

正しい例。

```text
https://mill-miya.github.io
```

間違い例。

```text
https://mill-miya.github.io/SkyShare/
```

---

## 28. GitHub Pages設定

GitHub PagesはGitHub Actionsでデプロイする。

主な環境変数。

```text
SORAVA_API_BASE_URL=https://skyshare-nhcb.onrender.com
SORAVA_WS_URL=wss://skyshare-nhcb.onrender.com/ws
VITE_GUEST_ACCESS_CODE=<non-public access code>
```

公開リポジトリでは、アクセスコードの値をドキュメントやコードへ直接書かない。必要に応じてGitHub Secretsや環境変数で管理する。

---

## 29. これまでの主な実装フェーズ

### Phase 1: Sky表示

- GPS取得
- GPS失敗時フォールバック
- 月・惑星計算
- Canvas 2D描画
- スワイプ視点移動
- ピンチズーム
- 明るい恒星表示
- 月の満ち欠け
- 地平線下の表現

### Phase 2: Targets・誘導

- Targets画面
- 月・惑星一覧
- 方位・高度表示
- 対象選択
- 選択対象強調
- 誘導UI
- ±3°以内捕捉判定
- 低高度警告

### Phase 3: Session共有

- Host / Guest
- セッション作成
- sessionId発行
- QRコード表示
- `/join/{sessionId}`
- WebSocket
- targetId共有
- 参加人数通知
- セッション終了

### Phase 3.5: UX改善

- 参加する / 始める導線整理
- Bottom Sheet化
- 文言短縮
- reduced motion対応

### Phase 3.6: 共有ON/OFF

- 共有OFF
- Hostは自分だけ対象選択可能
- Guestは共有OFF中誘導非表示
- `targetId: null` 対応

### Phase 3.7: 方向共有

- HostのSky中心方向をGuestへ共有
- azimuth / altitude共有
- `pointer:update`
- 画面端マーカー
- 送信間引き

### Phase 4: Sensor Mode

- 手動 / 追従切替
- iOS権限対応
- DeviceOrientation対応
- Sensor Probe
- 上下反転
- センサー平滑化

### Targets拡張

- 明るい星
- メシエ天体
- 二重星
- 目印線
- RA/Decから方位・高度計算
- Sky描画
- server targetId validation更新

### UI / PASS調整

- スマホレスポンシブCSS
- PASSゲート
- 誤入力ロック
- 通常URLでもPASS要求
- join URLでもPASS要求
- Targets「選択なし」整理
- Settingsに上下反転追加

---

## 30. 直近の修正内容

最新付近の内容。

- GitHub Pages通常URLでもPASS入力画面を表示
- `/join/{sessionId}` ではPASS入力後Guest参加へ進む
- 通常URLではPASS入力後アプリ本体へ進む
- PASS誤入力時は同一タブでロック
- 誤入力時はWebSocket接続やjoinSessionを開始しない
- GitHub Pagesでは既定PASSを使うフォールバックあり
- Targetsの「選択なし」を中央配置
- 「天体を選ばずに空を見る」の説明文を削除
- Settingsに上下反転を通常表示として追加

---

## 31. 現在の確認済み事項

確認済み。

- `npx tsc -b` 成功
- `npm run build` 成功
- GitHub Pages相当ビルド成功
- `node --check server/index.js` 成功
- GitHub mainへpush済み

GitHub上で確認済みの最新コミット。

```text
2972f3d Center clear target row
```

---

## 32. 現在の注意点

- GitHub Pages反映には少し時間がかかる場合がある
- PASS確認時はsessionStorageが残ることがある
- PASS誤入力後は同じタブでロックされる
- 再テスト時はタブを閉じるかサイトデータ削除
- localhostではPASSは基本表示されない想定
- 古いAndroidではGitHub Pagesが証明書エラーになる場合がある
- センサー追従は端末差が大きい
- 手動モードを本命として扱う

---

## 33. 古いAndroid問題

確認された問題。

```text
Android SHL25でGitHub Pagesが開けない
NET::ERR_CERT_AUTHORITY_INVALID
```

`*.github.io` の証明書チェーンが古いAndroidに合わない可能性がある。

Render backendの `/health` は開けたため、HTTPS全般がダメではなくGitHub Pages側の証明書問題の可能性が高い。

対策案。

- Chromeで直接開く
- LINE内ブラウザを避ける
- 日付と時刻を自動設定
- Chrome更新
- Android System WebView更新
- Google Play services更新
- Firefoxで試す
- Vercel / Netlifyに予備Frontendを作る

---

## 34. 法律・規約まわり

現状のSoravaは低リスク寄り。

理由。

- ログインなし
- アカウントなし
- 名前、メール、学籍番号を取らない
- チャットなし
- DMなし
- 通話なし
- 画像送信なし
- ファイル送信なし
- 課金なし
- 広告なし
- 解析タグなし
- GPSをサーバーに保存しない
- サーバーはtargetIdと方向情報だけを一時同期

注意すべき点。

- 位置情報
- 個人情報
- 著作権
- 外部送信
- 安全配慮
- 電気通信事業法

現状では、部内テスト・無料・小規模・チャットなしなら大きな問題になりにくい。

### 入れておくとよい注意書き

```text
Soravaは、観望会で対象天体の方向を共有するための実験的なWebアプリです。
表示される方位・高度は、端末の位置情報・時刻・センサー状態により誤差が生じる場合があります。
本アプリは望遠鏡の自動制御や精密導入を目的としたものではありません。
位置情報は、現在地から見た天体の方位・高度を計算するために使用します。
位置情報は原則として端末内で処理し、サーバーには保存しません。
使用中は周囲の安全を確認し、歩きながら画面を注視しないでください。
```

---

## 35. 部内テストで確認すること

最低限見ること。

1. 公開URLでPASS画面が出る
2. 正しいPASSで入れる
3. PASS誤入力でロックされる
4. Hostがセッション作成できる
5. QRコードが表示される
6. スマホでQR参加できる
7. `/join/{sessionId}` でもPASSが出る
8. PASS後にGuest参加できる
9. Hostで対象を選ぶとGuestに反映される
10. 共有OFFができる
11. 方向共有ができる
12. Settingsがスクロールできる
13. 上下反転が効く
14. Targetsが重ならない
15. Sky画面が操作できる
16. 10〜30分落ちない

確認対象におすすめ。

- 月
- 木星
- 土星
- ベガ
- M31
- M42
- 北極星
- アルビレオ

---

## 36. 部員への案内文

```text
今日の動作確認では、観望会支援アプリSoravaを試します。
QRコードを読み込むとPASS入力画面が出るので、案内されたPASSを入力してください。
このアプリは、案内役が選んだ天体を参加者のスマホへ共有し、同じ対象を見つけやすくするためのものです。
まだテスト中なので、端末によって表示やセンサーの動きがずれる場合があります。
URLは外部へ共有しないようお願いします。
```

---

## 37. 失敗しやすい点

### PASSが出ない

可能性。

- GitHub Pagesにまだ反映されていない
- 古いキャッシュを見ている
- localhostで見ている
- sessionStorageで解除済み

対策。

- タブを閉じる
- 別ブラウザで開く
- サイトデータ削除
- GitHub Actions確認

### PASS誤入力後に入れない

仕様。同じタブでロックされる。

対策。

- タブを閉じる
- QRを読み直す
- サイトデータ削除

### Session作成できない

見るべきところ。

- Renderが起きているか
- `/health` が通るか
- `ALLOWED_ORIGINS` が正しいか
- GitHub Pagesが最新か
- rate limitにかかっていないか

### Guest参加できない

見るべきところ。

- PASS通過しているか
- sessionIdが生きているか
- Hostが終了していないか
- WebSocketが接続できているか
- Renderが起きているか

### Targetsが重なる

スマホ幅で起きやすい。直近でレスポンシブ修正済みだが、実機確認が必要。

### センサーが変

端末差。上下が逆ならSettingsの「上下反転」を使う。それでもダメなら手動モードで使う。

---

## 38. 現在の完成度

現時点の目安。

| 項目 | 完成度 |
|---|---:|
| 設計完成度 | 90% |
| コア機能完成度 | 85% |
| 公開テスト準備 | 75〜80% |
| 現場運用安定性 | 60〜70% |
| UI完成度 | 70〜80% |
| センサー追従 | 50〜65% |
| 手動運用 | 80〜85% |

一番期待できるのは以下である。

```text
手動操作 + Host共有 + Guest誘導
```

センサー追従は端末差が大きいため、完璧に期待しすぎない。

---

## 39. 現時点で未実装・後回しの機能

### 今後追加候補

- 目印線ON/OFF
- 観望会モード
- おすすめ天体の自動スコア
- 天体説明カード
- Host専用UIの整理
- Vercel / Netlify予備URL
- 使用後のPASS変更
- センサー安定度表示
- 実地テストログ

### 今は後回しのもの

- ISS
- 人工衛星予報
- カメラAR
- 本格的な星座線
- 全天星表
- ログイン
- DB
- チャット
- DM
- 有料化

---

## 40. 今日やるべきこと

優先順位。

1. GitHub Pagesに最新反映されているか確認
2. PASSで入れるか確認
3. PASS誤入力時にロックされるか確認
4. HostでSession作成
5. スマホでQR参加
6. M31 / ベガ / 北極星 / アルビレオを共有
7. Guest側で反映確認
8. Settingsの上下反転確認
9. TargetsやSession画面のUI確認
10. 10〜30分放置

今日、新機能は増やしすぎない方がよい。

追加するとしても、目印線ON/OFFくらいに留める。

---

## 41. 想定質問と回答

### Q. これは何をするアプリ？

観望会で、案内役が選んだ天体を参加者全員のスマホに共有し、同じ対象を見つけやすくするアプリ。

### Q. 普通の星図アプリと何が違う？

普通の星図アプリは自分で探すもの。SoravaはHostが選んだ天体をGuestへ同期できるため、観望会で同じ対象を共有しやすい。

### Q. HostとGuestとは？

Hostは案内役。Guestは案内される参加者。

### Q. 天体位置はどうやって計算している？

月・惑星は天体計算ライブラリを使う。恒星やメシエ天体は登録済みのRA/Decをもとに、各スマホが現在地・時刻から方位・高度を計算する。

### Q. 望遠鏡を自動で動かせる？

現在は非対応。Soravaは望遠鏡制御ではなく、人が対象方向を探すための補助ツール。

### Q. センサーは正確？

端末による。使えれば便利だが、ズレる場合もある。そのため手動操作でも使えるようにしている。

### Q. 古いAndroidでも使える？

使える可能性はあるが、GitHub Pagesの証明書やセンサーの問題が出る場合がある。その場合は手動モードや予備URLを検討する。

### Q. なぜWebアプリ？

参加者にアプリをインストールさせず、QRコードからすぐ使えるようにするため。

### Q. サーバーは何をしている？

HostとGuestのセッション管理、targetId共有、方向共有をしている。天体計算はしていない。

---

## 42. 一言説明

短く説明するなら。

> Soravaは、観望会で案内役が選んだ天体を参加者のスマホへ共有し、同じ対象を見つけやすくするためのWebアプリです。

技術込みで説明するなら。

> Soravaは、TypeScript / React / Viteで作成したスマホ向けWebアプリです。Sky画面はCanvas 2Dで描画し、天体位置計算にはastronomy-engineを使用しています。FrontendはGitHub Pages、BackendはRender上のNode.js + WebSocketサーバーで動作しています。サーバーは天体計算を行わず、Hostが選択したtargetIdや方向情報だけをGuestへ同期します。各端末が自分の現在地・時刻をもとに天体の方位・高度を計算する構成です。

---

## 43. 今後の方針

今後は新機能追加よりも、まず実機テストとUI安定化を優先する。

優先すること。

- スマホUIの崩れ修正
- PASS導線の確認
- QR参加の安定化
- Host / Guest共有の確認
- 手動モードの使いやすさ向上
- センサー追従の端末差対応
- 30分程度の安定動作

Soravaの本質は、機能を増やすことではなく、観望会で参加者が迷わず同じ空を見られることである。

そのため、今後も現場運用を優先して調整していく。
