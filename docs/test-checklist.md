# Sorava 部内テスト チェックリスト

## 事前確認

- [ ] GitHub Pages URLがスマホのモバイル通信で開ける
- [ ] Render等のサーバーが起動している
- [ ] `/api/session` が成功する
- [ ] `/api/session` の連打が429で抑制される
- [ ] WebSocket接続が成功する
- [ ] 不正なOriginを制限する場合、`ALLOWED_ORIGINS` が正しい
- [ ] QRコードが表示される
- [ ] 参加URLが開ける

## Host

- [ ] セッションを作成できる
- [ ] sessionIdが表示される
- [ ] QRコードが表示される
- [ ] 参加人数が増える
- [ ] 天体共有できる
- [ ] 共有OFFにできる
- [ ] 方向共有にできる
- [ ] Host終了できる

## Guest

- [ ] QRまたはURLから参加できる
- [ ] コード入力で参加できる
- [ ] Hostの天体共有が反映される
- [ ] 共有OFFで誘導が消える
- [ ] 方向共有マーカーが表示される
- [ ] 視野外マーカーが表示される
- [ ] 退出できる
- [ ] 再接続できる

## 共有モード

- [ ] OFFでGuestの誘導と方向マーカーが消える
- [ ] 天体で選択天体がGuestへ共有される
- [ ] 天体未選択時にGuestの天体誘導が解除される
- [ ] 方向でHostのSky中央方向がGuestへ共有される
- [ ] 方向共有中にHostがSkyを動かすとGuest側も更新される
- [ ] 不正targetIdが拒否され、共有状態が変わらない
- [ ] 不正pointer値が拒否され、共有状態が変わらない
- [ ] pointer:updateを過剰送信しても通常操作が破綻しない

## UI

- [ ] スマホ縦画面で崩れない
- [ ] Bottom Sheetが下部ナビの裏に潜らない
- [ ] ナイトモードが使える
- [ ] 天体選択後の視点移動が不自然に飛ばない
- [ ] Sky画面が過度に眩しくない
- [ ] SettingsのSensor Probeにevent種別が表示される
- [ ] SettingsのSensor Probeにraw高度 / offset / final高度 / 高度反転が表示される
- [ ] 「水平に合わせる」でfinal高度が0°付近になる
- [ ] 上下が逆に動く端末では「高度反転」で修正できる
- [ ] 追従ON/OFFがSky上で切り替えられる
- [ ] 通常UIでは天頂点・天頂ラベル・高度線が表示されない
- [ ] `?debug=1` では必要に応じて天頂確認ができる

## 30分テスト

- [ ] 30分程度Sessionが維持される
- [ ] 複数Guestで大きく破綻しない
- [ ] 共有切り替えを繰り返しても破綻しない
- [ ] 死んだ接続が残り続けず参加人数が戻る

## トラブル時確認

- [ ] Backend `/health` が成功する
- [ ] `SORAVA_API_BASE_URL` が `https://` で設定されている
- [ ] `SORAVA_WS_URL` が `wss://.../ws` で設定されている
- [ ] Render Freeのスリープ解除後にSession作成できる
- [ ] `/SkyShare/join/{sessionId}` の直接アクセスが開ける

## 古いAndroid端末

- [ ] GitHub Pagesで `NET::ERR_CERT_AUTHORITY_INVALID` が出る場合、Chrome直開きで確認する
- [ ] LINE内ブラウザやQRリーダー内ブラウザを避ける
- [ ] Chrome / Android System WebView / Google Play services を更新する
- [ ] 端末の日付と時刻を自動設定にする
- [ ] Wi-Fiとモバイル通信の両方で試す
- [ ] それでも開けない場合、Vercel / Netlify / Render Static Site の予備Frontend URLを使う
- [ ] 古いAndroidでセンサーが不安定な場合、追従をOFFにして手動操作で使う
