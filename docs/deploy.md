# Sorava 部内テスト用デプロイメモ

このメモは、数日後の部内テストでスマホからSoravaを開き、PC Host / スマホ GuestでSession共有を確認するための最小手順です。

## 公開URL

Frontend:

```text
https://mill-miya.github.io/SkyShare/
```

Backend:

```text
https://<render-service-name>.onrender.com
```

Render作成後、実際のBackend URLに置き換えてください。

## 構成

```text
Frontend: GitHub Pages
Backend: Render Free Web Service
WebSocket: wss://<render-service-name>.onrender.com/ws
API: https://<render-service-name>.onrender.com/api/session
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

## GitHub Actions Variables

Repository variablesに以下を設定してください。

```text
SORAVA_API_BASE_URL=https://<render-service-name>.onrender.com
SORAVA_WS_URL=wss://<render-service-name>.onrender.com/ws
```

`SORAVA_WS_URL` は以下のように `/ws` なしでも動きますが、明示的に `/ws` まで入れることを推奨します。

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
- HTTPSページから `ws://` へ接続していないか
- WebSocket URLが `wss://.../ws` になっているか
- ブラウザで位置情報を拒否してもフォールバック座標で動くか
- Render Freeの初回起動に時間がかかっていないか

## 部内テスト前にやること

- [ ] PR #2を確認し、必要ならmainへmerge
- [ ] Render Web Serviceを作成
- [ ] GitHub Actions Variablesを設定
- [ ] GitHub PagesをActions sourceで有効化
- [ ] deploy-pages workflowを実行
- [ ] スマホのモバイル通信でFrontend URLを開く
- [ ] PC Host / スマホ GuestでSession共有を確認
