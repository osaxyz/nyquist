# Problem types

nyquist の API は、失敗を RFC 9457 の Problem Details（`application/problem+json`）で返します。`type` はこのページの見出しへのリンクです。クライアントは `title` や `detail` の文字列ではなく、`status` と `type` で分岐してください。

定義の正本は [src/index.ts](src/index.ts) の `PROBLEM` です。

## invalid-request

400。本文やパラメータがスキーマに合いません。SafeTx の署名が signer のものでない場合もここに含まれます。`detail` の指摘に沿って直してください。

## signature-required

401。RFC 9421 の `Signature-Input` と `Signature` ヘッダーがありません。

## signature-invalid

401。署名を検証できません。本文や署名対象の改ざん、必須パラメータの欠落、登録時に keyid と公開鍵のサムプリントが一致しない場合などです。

## signature-expired

401。署名の `created` が古すぎるか、`expires` を過ぎています。新しく署名し直してください。

## nonce-reused

401。同じ `nonce` の署名はもう使われています。リクエストごとに新しい nonce で署名してください。

## agent-unknown

401。keyid に対応するエージェントが登録されていません。先に `POST /api/v1/agent` で登録してください。

## registration-closed

403。この API は招待制で、招待コードのない登録、または招待コードが違う登録は受け付けません。招待コードを受け取っている場合は、NYQUIST_INVITE に設定してから登録し直してください。

## agent-suspended

403。中継した tx が 24 時間に 2 回 revert したため、24 時間このエージェントの中継を止めています。エージェントは、自分でガスを払えば Safe から直接送金できます。

## spending-limit-exceeded

403。送金額の上限を超えています。上限は USD で、1回あたりと直近24時間の合計があり、Safe から送る ETH をそのときの ETH/USD で換算して数えます。実行されなかった送金は数えません。額を減らすか、時間をおいてから送ってください。

## not-found

404。リソースがありません。他のエージェントが送った tx を参照した場合もここに含まれます。存在を推測されないよう、権限がない場合も 404 を返します。

## agent-exists

409。この公開鍵のエージェントはすでに登録されています。

## safe-not-funded

409。Safe の残高が作成費用に満たないため、まだ作成していません。`detail` のアドレスに入金してから送金してください。

## nonce-mismatch

409。SafeTx の nonce が Safe の現在値と一致しません。`GET /api/v1/agent` の `nonce` を使って署名し直してください。

## transaction-pending

409。前に中継した tx がまだ確定していません。同じ nonce の tx を二重に送らないよう、確定するまで新しい送金は受け付けません。`GET /api/v1/transaction/{hash}` で状態を確かめてから送り直してください。

## quote-expired

409。見積もりが古くなっています。ガス代が上がったか、`baseGas` が足りません。`POST /api/v1/transaction/quote` で見積もり直して署名し直してください。

## transaction-reverted

422。見積もりか送信前のシミュレーションで revert しました。宛先や金額、Safe の残高を確認してください。

## gas-limit-exceeded

422。ガス量がリレイヤーの上限を超えます。処理を分けてください。

## rate-limited

429。登録かリクエストが多すぎます。しばらく待ってから再試行してください。

## internal

500。サーバー内部のエラーです。`instance` のリクエスト ID を添えて報告してください。

## upstream

502。Ethereum の RPC との通信に失敗しました。時間をおいて再試行してください。

## network-congested

503。ガス代が作成費用で払える水準を超えているため、Safe を作成できません。ガス代が下がってから再試行してください。

## price-unavailable

503。送金額の上限を確かめるための ETH/USD の価格が、古いか取得できません。ETH を送らない呼び出しは影響を受けません。しばらく待ってから送ってください。
