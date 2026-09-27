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
> nyquist runs on the Sepolia testnet only. Do not send mainnet ETH to a nyquist Safe. It is early-stage software, and the API and the MCP tools may change.

### Quick start

1. On the machine where your agent runs, create the wallet and register it with your agent. Choose Claude Code, Hermes Agent, OpenClaw, Grok Bot, or another MCP client.

```sh
npm create nyquist
```

2. Send Sepolia ETH to the Safe address it shows. The first send creates the Safe, so fund at least 0.002 ETH for that plus what you want to send.
3. Start a new session of your agent. In Claude Code, check that the server is connected.

```sh
claude mcp get nyquist
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

Every API request carries an RFC 9421 HTTP Message Signature made with the agent's Ed25519 key. The key's RFC 7638 thumbprint is the agent's ID, so there are no accounts, passwords, or OAuth flows to set up. A human can later claim an agent into an organization with Sign-In with Ethereum.

</details>

<details>
<summary>Gas is paid up front and refunded by the Safe</summary>
<br>

The relayer submits each transaction and is refunded by the Safe's built-in payment, in the same transaction, for the gas it actually used. The agent never needs a separate gas balance. The first send also creates the Safe and pays a fixed 0.002 ETH creation fee from it.

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
| `nyquist_wallet` | Returns the Safe address, balance, owners, and organization |
| `nyquist_send` | Sends ETH or calls a contract. The first send creates the Safe |
| `nyquist_transaction` | Returns the status of a send |
| `nyquist_claim_code` | Creates a code a human uses to claim the agent into an organization |
| `nyquist_add_recovery_owner` | Adds the human who claimed the agent as a recovery owner of the Safe |

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

| Item | Value |
| --- | --- |
| Chain | Sepolia (chain ID 11155111) |
| Safe | v1.4.1, singleton `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| Relayer | `0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174` |
| API | [OpenAPI document](https://nyquist-api-production.original-sin-architecture.workers.dev/api/v1/openapi.json) |

</details>

<a id="ja"></a>

## 日本語

<p align="center">
  <a href="https://github.com/osaxyz/nyquist"><img src="https://img.shields.io/github/stars/osaxyz/nyquist?style=social" alt="Star nyquist on GitHub"></a><br>
  <sub>nyquist が役に立ったら、スターを付けてもらえると励みになります。</sub>
</p>

> [!IMPORTANT]
> nyquist は Sepolia テストネットでだけ動きます。nyquist の Safe にメインネットの ETH を送らないでください。早期段階のソフトウェアなので、API と MCP のツールは変わることがあります。

### クイックスタート

1. エージェントが動いている端末で、ウォレットを作ってエージェントに登録します。Claude Code、Hermes Agent、OpenClaw、Grok Bot、その他の MCP クライアントから選びます。

```sh
npm create nyquist
```

2. 表示された Safe のアドレスに Sepolia の ETH を送ります。最初の送金で Safe が作られるので、その費用の 0.002 ETH と、送りたい額を合わせた額以上を入れてください。
3. エージェントを新しく立ち上げます。Claude Code なら、接続できているかを確かめます。

```sh
claude mcp get nyquist
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

API へのリクエストには、エージェントの Ed25519 の鍵で RFC 9421 の HTTP Message Signature を付けます。鍵の RFC 7638 のサムプリントがエージェントの ID になるので、アカウント、パスワード、OAuth の設定はありません。あとから人間が Sign-In with Ethereum で、エージェントを組織に引き取れます。

</details>

<details>
<summary>ガス代は立て替えて、Safe から払い戻します</summary>
<br>

リレイヤーが tx を送り、実際に使ったガスの分を、同じ tx の中で Safe の払い戻しの仕組みで受け取ります。エージェントがガス代を別に持つ必要はありません。最初の送金では Safe も作り、決まった作成費用 0.002 ETH を Safe から払います。

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
| `nyquist_wallet` | Safe のアドレス、残高、オーナー、所属する組織を返します |
| `nyquist_send` | ETH を送るか、コントラクトを呼びます。最初の送金で Safe を作ります |
| `nyquist_transaction` | 送金の状態を返します |
| `nyquist_claim_code` | 人間がエージェントを組織に引き取るためのコードを作ります |
| `nyquist_add_recovery_owner` | 引き取った人間を、Safe の復旧用オーナーに加えます |

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

| 項目 | 値 |
| --- | --- |
| チェーン | Sepolia（chain ID 11155111） |
| Safe | v1.4.1。singleton は `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| リレイヤー | `0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174` |
| API | [OpenAPI の文書](https://nyquist-api-production.original-sin-architecture.workers.dev/api/v1/openapi.json) |

</details>
