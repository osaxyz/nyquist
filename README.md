<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://www.nyquist.sh/brand/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://www.nyquist.sh/brand/logo.png">
  <img src="https://www.nyquist.sh/brand/logo-outline.png" width="240" alt="nyquist">
</picture>

# nyquist

A crypto wallet for autonomous agents. Each agent owns a Safe on Ethereum and sends with its own signature, without human approval or custody.<br>
<sub>自律エージェントのための仮想通貨ウォレットです。エージェントごとに Ethereum の Safe を持ち、人間の承認も預かりもなしに、自分の署名だけで送金します。</sub>

<p align="center"><a href="#en">Read more in English</a> · <a href="#ja">日本語で読む</a></p>

<a id="en"></a>

## English

<p align="center">
  <a href="https://github.com/osaxyz/nyquist"><img src="https://img.shields.io/github/stars/osaxyz/nyquist?style=social" alt="Star nyquist on GitHub"></a><br>
  <sub>If nyquist helps you, a star keeps us going.</sub>
</p>

> [!IMPORTANT]
> nyquist runs on Ethereum mainnet and the Sepolia testnet. It is early-stage software, and the API and the MCP tools may change. Start with small amounts: sends through nyquist are capped at $100 of ETH each and $500 a day.

### Quick start

1. On the machine where your agent runs, create the wallet and register it with your agent. Choose a network, then Claude Code, Hermes Agent, OpenClaw, Grok Bot, or another MCP client.

```sh
npm create nyquist
```

2. Send ETH to the Safe address it shows, on the same network: what you want to send, plus gas. The first send also creates the Safe. On Sepolia, add 0.002 ETH for that.
3. Start a new session of your agent. In Claude Code, check that the server is connected. It is `nyquist-mainnet` on mainnet and `nyquist` on Sepolia.

```sh
claude mcp get nyquist-mainnet
```

If it shows `Status: ✔ Connected`, your agent can use the wallet.

> [!TIP]
> The keys are stored in `~/.nyquist`. Running `npm create nyquist` again reuses them, so you get the same Safe.

Try asking:

- "Show my nyquist wallet."
- "Send 0.001 ETH to 0x…"
- "Did that transaction go through?"

### Technology

<details>
<summary>Only the agent can move the funds</summary>
<br>

The Safe has one owner, the agent's key, with a threshold of 1. nyquist runs a relayer that pays gas up front, but the relayer is never an owner, so neither nyquist nor anyone who breaks into it can move the funds.

| Key | Where it lives | What it does |
| --- | --- | --- |
| secp256k1 | The agent's machine | Signs Safe transactions as the sole owner |
| Ed25519 | The agent's machine | Signs API requests |
| Relayer key | nyquist | Pays gas. It cannot sign for the Safe |

</details>

<details>
<summary>Agents sign up without a human</summary>
<br>

Every API request carries an RFC 9421 HTTP Message Signature made with the agent's Ed25519 key. The key's RFC 7638 thumbprint is the agent's ID, so there are no accounts, passwords, or OAuth flows to set up.

</details>

<details>
<summary>Gas is paid up front and refunded by the Safe</summary>
<br>

The relayer submits each transaction and is refunded by the Safe's built-in payment, in the same transaction, for the gas it actually used. The agent never needs a separate gas balance. The first send also creates the Safe. On mainnet, that happens in the same transaction and its gas is part of the refund, so it costs what gas costs at that moment. On Sepolia, the Safe pays a fixed 0.002 ETH creation fee. On mainnet, nyquist adds a 5% fee to the refund; the amount sent is never touched.

</details>

<details>
<summary>The agent does not trust the server</summary>
<br>

Before signing, the agent checks the server's answers on its own machine and stops if anything differs.

| Check | How |
| --- | --- |
| Safe address | Recomputed from the agent's key with CREATE2 |
| What is signed | The Safe transaction hash is rebuilt from the request |
| Nonce | Read from the chain |
| Gas and refund | Bounded by the published formula, the agent's own RPC, and `NYQUIST_MAX_FEE_WEI`; the refund can only go to the published relayer |
| Server messages | Replaced with fixed local text, so the server cannot write instructions to the model |

</details>

### Specification

<details>
<summary>MCP tools</summary>
<br>

| Tool | Purpose |
| --- | --- |
| `nyquist_setup` | Creates the keys and registers the wallet. Returns the same wallet every time |
| `nyquist_wallet` | Returns the Safe address, balance, owners, and whether nyquist is relaying |
| `nyquist_send` | Sends ETH or calls a contract. The first send creates the Safe |
| `nyquist_transaction` | Returns the status of a send |

</details>

<details>
<summary>Packages</summary>
<br>

| Package | Purpose |
| --- | --- |
| [`create-nyquist`](apps/create-nyquist) | `npm create nyquist`. Creates the wallet and registers it with your agent |
| [`nyquist-mcp`](apps/nyquist-mcp) | The stdio MCP server that holds the keys and signs |

</details>

<details>
<summary>Network and contracts</summary>
<br>

| Item | Ethereum mainnet | Sepolia testnet |
| --- | --- | --- |
| Chain ID | 1 | 11155111 |
| `NYQUIST_ENV` | `mainnet` | `production` (default) |
| Relayer | `0xF6389d891c5761fE74DC3474272eA7C52A9ae5F2` | `0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174` |
| nyquist's fee | 5% of the gas refund | None |
| Send limits | $100 of ETH per send, $500 a day | Same |
| API | [OpenAPI document](https://nyquist-api-mainnet.original-sin-architecture.workers.dev/api/v1/openapi.json) | [OpenAPI document](https://nyquist-api-production.original-sin-architecture.workers.dev/api/v1/openapi.json) |

Both use Safe v1.4.1, singleton `0x41675C099F32341bf84BFc5382aF534df5C7461a`. The limits count the ETH a send moves, priced with Chainlink's ETH/USD feed; token transfers are not counted.

</details>

<a id="ja"></a>

## 日本語

<p align="center">
  <a href="https://github.com/osaxyz/nyquist"><img src="https://img.shields.io/github/stars/osaxyz/nyquist?style=social" alt="Star nyquist on GitHub"></a><br>
  <sub>nyquist が役に立ったら、スターを付けてもらえると励みになります。</sub>
</p>

> [!IMPORTANT]
> nyquist は Ethereum のメインネットと Sepolia テストネットで動きます。早期段階のソフトウェアなので、API と MCP のツールは変わることがあります。少額から使ってください。nyquist を通る送金は、ETH で1回 $100、1日 $500 までです。

### クイックスタート

1. エージェントが動いている端末で、ウォレットを作ってエージェントに登録します。ネットワークを選び、Claude Code、Hermes Agent、OpenClaw、Grok Bot、その他の MCP クライアントから選びます。

```sh
npm create nyquist
```

2. 同じネットワークで、表示された Safe のアドレスに ETH を送ります。送りたい額とガス代を合わせた額以上を入れてください。最初の送金で Safe も作ります。Sepolia では、その費用の 0.002 ETH も足してください。
3. エージェントを新しく立ち上げます。Claude Code なら、接続できているかを確かめます。名前は、メインネットでは `nyquist-mainnet`、Sepolia では `nyquist` です。

```sh
claude mcp get nyquist-mainnet
```

`Status: ✔ Connected` と出れば、エージェントがウォレットを使えます。

> [!TIP]
> 鍵は `~/.nyquist` に保存されます。`npm create nyquist` をもう一度実行しても同じ鍵を使うので、同じ Safe になります。

次のように頼んでみてください。

- 「nyquist のウォレットを見せて」
- 「0.001 ETH を 0x… に送って」
- 「さっきの送金は確定した？」

### テクノロジー

<details>
<summary>資金を動かせるのはエージェントだけです</summary>
<br>

Safe のオーナーはエージェントの鍵1つだけで、閾値は1です。nyquist はガス代を立て替えるリレイヤーを動かしますが、リレイヤーはオーナーではないので、nyquist も、nyquist に侵入した人も、資金を動かせません。

| 鍵 | 置き場所 | 役割 |
| --- | --- | --- |
| secp256k1 | エージェントの端末 | 唯一のオーナーとして Safe の tx に署名する |
| Ed25519 | エージェントの端末 | API へのリクエストに署名する |
| リレイヤーの鍵 | nyquist | ガス代を払う。Safe の tx には署名できない |

</details>

<details>
<summary>人間を介さずに登録できます</summary>
<br>

API へのリクエストには、エージェントの Ed25519 の鍵で RFC 9421 の HTTP Message Signature を付けます。鍵の RFC 7638 のサムプリントがエージェントの ID になるので、アカウント、パスワード、OAuth の設定はありません。

</details>

<details>
<summary>ガス代は立て替えて、Safe から払い戻します</summary>
<br>

リレイヤーが tx を送り、実際に使ったガスの分を、同じ tx の中で Safe の払い戻しの仕組みで受け取ります。エージェントがガス代を別に持つ必要はありません。最初の送金では Safe も作ります。メインネットでは同じ tx の中で作り、そのガス代も払い戻しに含めるので、そのときのガス代だけで済みます。Sepolia では、決まった作成費用 0.002 ETH を Safe から払います。メインネットでは、払い戻しに nyquist の手数料 5% を上乗せします。送る額には手を付けません。

</details>

<details>
<summary>エージェントはサーバーを信じきりません</summary>
<br>

署名する前に、エージェントはサーバーの答えを手元で確かめ、食い違えば止めます。

| 確かめること | 方法 |
| --- | --- |
| Safe のアドレス | エージェントの鍵から CREATE2 で計算し直す |
| 署名する内容 | 依頼から Safe の tx のハッシュを組み立て直す |
| nonce | チェーンから読む |
| ガス代と払い戻し | 公開している計算式、自分の RPC、`NYQUIST_MAX_FEE_WEI` の範囲に収める。払い戻し先は公開しているリレイヤーだけ |
| サーバーの文 | 手元で決めた文に置き換え、サーバーがモデルに指示を書き込めないようにする |

</details>

### 仕様

<details>
<summary>MCP ツール</summary>
<br>

| ツール | 役割 |
| --- | --- |
| `nyquist_setup` | 鍵を作り、ウォレットを登録します。何度呼んでも同じウォレットを返します |
| `nyquist_wallet` | Safe のアドレス、残高、オーナー、nyquist が中継しているかを返します |
| `nyquist_send` | ETH を送るか、コントラクトを呼びます。最初の送金で Safe を作ります |
| `nyquist_transaction` | 送金の状態を返します |

</details>

<details>
<summary>パッケージ</summary>
<br>

| パッケージ | 役割 |
| --- | --- |
| [`create-nyquist`](apps/create-nyquist) | `npm create nyquist`。ウォレットを作り、エージェントに登録します |
| [`nyquist-mcp`](apps/nyquist-mcp) | 鍵を持って署名する stdio の MCP サーバーです |

</details>

<details>
<summary>ネットワークとコントラクト</summary>
<br>

| 項目 | Ethereum メインネット | Sepolia テストネット |
| --- | --- | --- |
| chain ID | 1 | 11155111 |
| `NYQUIST_ENV` | `mainnet` | `production`（既定） |
| リレイヤー | `0xF6389d891c5761fE74DC3474272eA7C52A9ae5F2` | `0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174` |
| nyquist の手数料 | ガス代の払い戻しの 5% | なし |
| 送金の上限 | ETH で1回 $100、1日 $500 | 同じ |
| API | [OpenAPI の文書](https://nyquist-api-mainnet.original-sin-architecture.workers.dev/api/v1/openapi.json) | [OpenAPI の文書](https://nyquist-api-production.original-sin-architecture.workers.dev/api/v1/openapi.json) |

どちらも Safe v1.4.1 で、singleton は `0x41675C099F32341bf84BFc5382aF534df5C7461a` です。上限は、送金で動く ETH を Chainlink の ETH/USD で換算して数えます。トークンの送金は数えません。

</details>
