# Sorava 部内テスト用デプロイメモ

このメモは、数日後の部内テストでスマホからSoravaを開き、PC Host / スマホ GuestでSession共有を確認するための最小手順です。

## 公開URL

Frontend:

```text
https://mill-miya.github.io/SkyShare/
```

Backend:

```text
https://skyshare-nhcb.onrender.com
```

Renderのサービスを作り直した場合のみ、新しいBackend URLに置き換えてください。

## 構成

```text
Frontend: GitHub Pages
Backend: Render Free Web Service
WebSocket: wss://skyshare-nhcb.onrender.com/ws
API: https://skyshare-nhcb.onrender.com/api/session
```

GitHub PagesではNode.jsサーバーを動かせないため、Session作成APIとWebSocketはRender側で動かします。

## ローカル起動

```bash
npm install
npm run server
npm run dev
```

ローカルではVite proxyにより、Frontendから以下へ接続します。

```text
API: /api/session -> http://127.0.0.1:8787/api/session
WS: /ws -> ws://127.0.0.1:8787/ws
```

## build確認

```bash
npx tsc -b
npm run build
```

## Render Backend設定

RenderでWeb Serviceを作成します。

推奨設定:

```text
Repository: Mill-Miya/SkyShare
Branch: main
Runtime: Node
Build Command: npm ci
Start Command: npm run server
Health Check Path: /health
Plan: Free
```

`render.yaml` も追加済みです。Render Blueprintを使う場合はこの設定を利用できます。

Render Freeはスリープする可能性があります。部内テスト開始前に、Hostまたは担当者が一度Backend URLへアクセスしてサーバーを起こしてください。

```text
https://<render-service-name>.onrender.com/health
```

### Backend環境変数

公開テストでは未設定でも動きますが、必要に応じてRender側で以下を調整できます。

```text
ALLOWED_ORIGINS=https://mill-miya.github.io,http://localhost:5173,http://localhost:5174
MAX_ROOMS=80
MAX_GUESTS_PER_ROOM=60
ROOM_TTL_MS=21600000
SESSION_CREATE_LIMIT=12
SESSION_CREATE_WINDOW_MS=60000
POINTER_MIN_INTERVAL_MS=45
```

`ALLOWED_ORIGINS` 未設定時は部内テスト優先で全Originを許可します。設定する場合はGitHub Pages URLとローカル確認用URLをカンマ区切りで入れてください。

サーバー側では以下を保護しています。

```text
targetId: null または moon/mercury/venus/mars/jupiter/saturn のみ許可
pointer azimuth: 0以上360未満のnumberのみ許可
pointer altitude: -90以上90以下のnumberのみ許可
NaN / Infinity / 文字列数値 / オブジェクトは拒否
```

## GitHub Pages設定

GitHub repository settingsでPagesを有効にします。

```text
Settings -> Pages -> Source: GitHub Actions
```

GitHub Actions workflow:

```text
.github/workflows/deploy-pages.yml
```

GitHub Pages用のVite baseは、workflow内で以下を指定して切り替えます。

```text
GITHUB_PAGES=true
```

`/SkyShare/join/{sessionId}` の直接アクセス用に、build後に `dist/index.html` を `dist/404.html` へコピーします。

## 予備Frontend

古いAndroid端末でGitHub Pagesの証明書を信頼できない場合に備え、必要ならVercel / Netlify / Render Static Siteで同じFrontendを公開します。

推奨設定:

```text
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
VITE_API_BASE_URL=https://skyshare-nhcb.onrender.com
VITE_WS_URL=wss://skyshare-nhcb.onrender.com/ws
VITE_GUEST_ACCESS_CODE=0629
```

GitHub Pagesでは `GITHUB_PAGES=true` によりbase pathが `/SkyShare/` になります。Vercel / Netlify / Render Static Siteでは通常 `GITHUB_PAGES` を設定せず、base path `/` で公開してください。

予備Frontendを作った場合は、Render backendの `ALLOWED_ORIGINS` にOriginだけを追加します。

```text
ALLOWED_ORIGINS=https://mill-miya.github.io,https://xxxxx.vercel.app,http://localhost:5173,http://localhost:5174
```

`/SkyShare/` や末尾スラッシュを含めないでください。

## GitHub Actions Variables

Repository variablesに以下を設定してください。

```text
SORAVA_API_BASE_URL=https://skyshare-nhcb.onrender.com
SORAVA_WS_URL=wss://skyshare-nhcb.onrender.com/ws
VITE_GUEST_ACCESS_CODE=0629
```

`SORAVA_WS_URL` は以下のように `/ws` なしでも動きますが、明示的に `/ws` まで入れることを推奨します。

`VITE_GUEST_ACCESS_CODE` は部内テスト用の簡易サイト利用PASSです。現在は公開確認のため、フロント側の `GUEST_ACCESS_CODE_ENABLED` を `false` にして一時停止しています。再度PASSを使う場合は `src/main.tsx` の `GUEST_ACCESS_CODE_ENABLED` を `true` に戻してください。`/join/{sessionId}` では、PASS有効時のみ正しいPASS入力後にGuest参加へ進みます。

```text
wss://<render-service-name>.onrender.com
```

## 公開環境での接続

1. Render backendを起こす
2. GitHub Pages URLを開く
3. Session -> 始める -> セッション作成
4. QRまたは参加URLでGuest参加
5. Targetsで天体を選択
6. Sessionで共有モードを切り替える

確認する共有モード:

```text
OFF: Guestの案内が消える
天体: selectedTargetIdがGuestへ反映される
方向: HostのSky中央方向がGuestへ反映される
```

## トラブル時の確認ポイント

- GitHub Pages URLがスマホのモバイル通信で開けるか
- Render backendがスリープしていないか
- `https://<render-service-name>.onrender.com/health` が `ok: true` を返すか
- GitHub Actions Variablesが設定されているか
- `ALLOWED_ORIGINS` を設定した場合、GitHub Pages URLが含まれているか
- HTTPSページから `ws://` へ接続していないか
- WebSocket URLが `wss://.../ws` になっているか
- ブラウザで位置情報を拒否してもフォールバック座標で動くか
- Render Freeの初回起動に時間がかかっていないか

### 古いAndroid端末で開けない場合

一部の古いAndroid端末では、GitHub PagesのHTTPS証明書を信頼できず、以下のエラーで開けない場合があります。

```text
NET::ERR_CERT_AUTHORITY_INVALID
Subject: *.github.io
Issuer: Let's Encrypt YR2
```

この場合、Soravaのコードではなく端末側の証明書信頼ストア、Chrome、Android System WebView、または日時設定が原因の可能性があります。HTTPSをやめたり証明書警告を無視する運用にはしないでください。位置情報・センサー・WebSocketを安全に使うため、HTTPSを維持します。

確認手順:

```text
1. Chromeで直接開く
2. LINE内ブラウザやQRリーダー内ブラウザを避ける
3. Chrome / Android System WebView / Google Play services を更新する
4. 端末の日付と時刻を自動設定にする
5. Wi-Fiとモバイル通信の両方で試す
6. それでも開けない場合は、Vercel / Netlify / Render Static Site の予備Frontend URLを使う
```

予備Frontendを使う場合もBackendは以下を使います。

```text
https://skyshare-nhcb.onrender.com
```

古いAndroidでは、ページが開けてもDeviceOrientationの値が不安定、または取得できない場合があります。その場合は追従モードを使わず、手動操作で利用してください。Soravaは手動操作でも天体共有・方向共有・Guest誘導が使えます。

## 部内テスト前にやること

- [ ] PR #2を確認し、必要ならmainへmerge
- [ ] Render Web Serviceを作成
- [ ] GitHub Actions Variablesを設定
- [ ] GitHub PagesをActions sourceで有効化
- [ ] deploy-pages workflowを実行
- [ ] スマホのモバイル通信でFrontend URLを開く
- [ ] PC Host / スマホ GuestでSession共有を確認
