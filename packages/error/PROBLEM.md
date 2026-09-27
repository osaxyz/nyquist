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

## session-required

401。`Authorization: Bearer` のセッショントークンがありません。`POST /api/v1/session` でログインしてください。

## session-invalid

401。セッショントークンが不正、期限切れ、またはログアウト済みです。ログインし直してください。

## siwe-invalid

401。SIWE のメッセージか署名が正しくありません。nonce の再利用や期限切れ、domain、uri、chainId の不一致、別のアドレスによる署名などです。

## forbidden

403。アカウントでの役割が足りません。owner はすべて、admin は登録トークンとエージェントの管理、member は参照だけができます。

## enrollment-invalid

403。登録トークンが不正、期限切れ、失効済み、または使用回数の上限に達しています。アカウントの admin に新しいトークンを発行してもらってください。

## claim-invalid

403。引き取りコードが不正、期限切れ、すでに使われた、またはエージェントがすでに別のアカウントに所属しています。エージェントに新しいコードを発行してもらってください。

## agent-suspended

403。アカウントの admin が、このエージェントの中継を止めています。エージェントは、自分でガスを払えば Safe から直接送金できます。

## not-found

404。リソースがありません。所属していないアカウントや、他のエージェントが送った tx を参照した場合もここに含まれます。存在を推測されないよう、権限がない場合も 404 を返します。

## agent-exists

409。この公開鍵のエージェントはすでに登録されています。

## limit-exceeded

409。テナントの上限に達しています。1人が作れるアカウント数、アカウントのメンバー数、アカウントのエージェント数に上限があります。

## safe-not-funded

409。Safe の残高が作成費用に満たないため、まだ作成していません。`detail` のアドレスに入金してから送金してください。

## nonce-mismatch

409。SafeTx の nonce が Safe の現在値と一致しません。`GET /api/v1/agent` の `nonce` を使って署名し直してください。

## quote-expired

409。見積もりが古くなっています。ガス代が上がったか、`baseGas` が足りません。`POST /api/v1/transaction/quote` で見積もり直して署名し直してください。

## transaction-reverted

422。見積もりか送信前のシミュレーションで revert しました。宛先や金額、Safe の残高を確認してください。

## gas-limit-exceeded

422。ガス量がリレイヤーの上限を超えます。処理を分けてください。

## rate-limited

429。登録かログインが多すぎます。しばらく待ってから再試行してください。

## internal

500。サーバー内部のエラーです。`instance` のリクエスト ID を添えて報告してください。

## upstream

502。Ethereum の RPC との通信に失敗しました。時間をおいて再試行してください。

## network-congested

503。ガス代が作成費用で払える水準を超えているため、Safe を作成できません。ガス代が下がってから再試行してください。
