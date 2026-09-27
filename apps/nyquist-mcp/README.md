<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://www.nyquist.sh/brand/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://www.nyquist.sh/brand/logo.png">
  <img src="https://www.nyquist.sh/brand/logo-outline.png" width="240" alt="nyquist">
</picture>

# nyquist-mcp

An MCP server that gives an autonomous agent its own Ethereum wallet. The keys stay on the agent's machine.<br>
<sub>自律エージェントに自分の Ethereum ウォレットを持たせる MCP サーバーです。鍵はエージェントの端末から出ません。</sub>

<p align="center"><a href="#en">Read more in English</a> · <a href="#ja">日本語で読む</a></p>

<a id="en"></a>

## English

> **Important:** nyquist runs on the Sepolia testnet only. Do not send mainnet ETH to a nyquist Safe. It is early-stage software, and the tools may change.

### Quick start

1. Run `npm create nyquist`. It creates the keys, registers the wallet, and adds this server to your agent. To add it by hand instead, register it as a stdio MCP server. In Claude Code:

```sh
claude mcp add nyquist --scope user -- npx --prefix="$HOME/.nyquist" -y --package nyquist-mcp@0.1.0 nyquist-mcp
```

2. Ask your agent to set up the wallet. It calls `nyquist_setup` and returns the Safe address.
3. Send Sepolia ETH to that address, at least 0.002 ETH for creating the Safe plus what you want to send.

> **Tip:** The version is pinned, so a new release never runs on your agent until you change it. `--prefix` starts npx from `~/.nyquist` instead of your project. Without it, npx refuses to run inside a project whose `package.json` requires another package manager through `devEngines`.

Try asking:

- "Set up my nyquist wallet."
- "Send 0.001 ETH to 0x…"
- "Create a claim code so I can take over this agent."

### Technology

<details>
<summary>Only the agent can move the funds</summary>
<br>

The Safe has one owner, the agent's secp256k1 key, with a threshold of 1. nyquist's relayer pays gas up front and is refunded by the Safe, but it is never an owner.

| Key | Purpose |
| --- | --- |
| Ed25519 | Signs API requests with RFC 9421 HTTP Message Signatures |
| secp256k1 | Signs Safe transactions as the sole owner |

The keys are stored in `~/.nyquist/agent.<environment>.json`, with mode 0600 in a 0700 directory. Losing the secp256k1 key means losing the funds, so keep the balance small until a human has claimed the agent and been added with `nyquist_add_recovery_owner`.

</details>

<details>
<summary>Every send is checked before signing</summary>
<br>

`nyquist_send` does not trust nyquist's quote. It signs only if all of these hold.

| Check | How |
| --- | --- |
| Safe address | Recomputed from the agent's key with CREATE2 when registering |
| Chain and Safe | The quote's chain ID and Safe match the registration |
| Safe transaction hash | Rebuilt locally from the request |
| Nonce | Equal to the Safe's nonce on chain |
| Gas | `baseGas` and `safeTxGas` within the published formula; `safeTxGas` at least the agent's own estimate |
| Gas price | No more than three times the current fee from the agent's own RPC |
| Refund | Paid only to the published relayer, and no more than `NYQUIST_MAX_FEE_WEI` |

Calls to the Safe itself are refused, except for adding a recovery owner. Error text from the server is replaced with fixed local messages before it reaches the model.

</details>

### Specification

<details>
<summary>MCP tools</summary>
<br>

| Tool | Purpose |
| --- | --- |
| `nyquist_setup` | Creates the keys and registers the wallet. Returns the same wallet every time |
| `nyquist_wallet` | Returns the Safe address, balance, owners, and organization |
| `nyquist_send` | Sends ETH or calls a contract. The first send creates the Safe and pays a 0.002 ETH creation fee |
| `nyquist_transaction` | Returns `pending`, `success`, `failed`, `reverted`, or `dropped` for a send. `dropped` means nyquist cancelled it before it ran |
| `nyquist_claim_code` | Creates a code a human uses to claim the agent into an organization |
| `nyquist_add_recovery_owner` | Adds the human who claimed the agent as a Safe owner. Takes the address the human gave you directly |

</details>

<details>
<summary>Environment variables</summary>
<br>

| Variable | Default | Purpose |
| --- | --- | --- |
| `NYQUIST_ENV` | `production` | `development` uses a local API |
| `NYQUIST_API_URL` | The API for the environment | The nyquist API to use |
| `NYQUIST_RPC_URL` | A public Sepolia RPC | The RPC used to check quotes |
| `NYQUIST_HOME` | `~/.nyquist` | Where the keys are stored |
| `NYQUIST_MAX_FEE_WEI` | 0.01 ETH | The most gas refund a single send may pay |

</details>

<a id="ja"></a>

## 日本語

> **重要**：nyquist は Sepolia テストネットでだけ動きます。nyquist の Safe にメインネットの ETH を送らないでください。早期段階のソフトウェアなので、ツールは変わることがあります。

### クイックスタート

1. `npm create nyquist` を実行します。鍵を作り、ウォレットを登録し、このサーバーをエージェントに加えます。手で加えるときは、stdio の MCP サーバーとして登録します。Claude Code なら次のとおりです。

```sh
claude mcp add nyquist --scope user -- npx --prefix="$HOME/.nyquist" -y --package nyquist-mcp@0.1.0 nyquist-mcp
```

2. エージェントにウォレットの用意を頼みます。`nyquist_setup` を呼んで、Safe のアドレスを返します。
3. そのアドレスに Sepolia の ETH を送ります。Safe の作成費用の 0.002 ETH と、送りたい額を合わせた額以上を入れてください。

> **ヒント**：版を固定しているので、新しい版は、あなたが版を書き換えるまでエージェントの環境では動きません。`--prefix` は、npx をプロジェクトではなく `~/.nyquist` から起動するためのものです。これがないと、`package.json` の `devEngines` で別のパッケージマネージャーを指定したプロジェクトの中では、npx が起動を拒みます。

次のように頼んでみてください。

- 「nyquist のウォレットを用意して」
- 「0.001 ETH を 0x… に送って」
- 「このエージェントを引き取れるよう、引き取りコードを作って」

### テクノロジー

<details>
<summary>資金を動かせるのはエージェントだけです</summary>
<br>

Safe のオーナーはエージェントの secp256k1 の鍵1つだけで、閾値は1です。nyquist のリレイヤーはガス代を立て替えて Safe から払い戻しを受けますが、オーナーにはなりません。

| 鍵 | 役割 |
| --- | --- |
| Ed25519 | API へのリクエストに RFC 9421 の HTTP Message Signature を付ける |
| secp256k1 | 唯一のオーナーとして Safe の tx に署名する |

鍵は `~/.nyquist/agent.<環境>.json` に、ファイルは 0600、ディレクトリは 0700 で保存します。secp256k1 の鍵を失うと資金も失うので、人間に引き取ってもらい、`nyquist_add_recovery_owner` で加えるまでは、少額で使ってください。

</details>

<details>
<summary>署名する前に、送金ごとに確かめます</summary>
<br>

`nyquist_send` は nyquist の見積もりを信じきらず、次をすべて満たすときだけ署名します。

| 確かめること | 方法 |
| --- | --- |
| Safe のアドレス | 登録のときに、エージェントの鍵から CREATE2 で計算し直す |
| チェーンと Safe | 見積もりの chain ID と Safe が、登録時と一致する |
| Safe の tx のハッシュ | 依頼から手元で組み立て直す |
| nonce | チェーン上の Safe の nonce と一致する |
| ガス | `baseGas` と `safeTxGas` が公開している計算式の範囲に収まり、`safeTxGas` が自分の見積もり以上である |
| ガス代 | 自分の RPC から取った現在のガス代の3倍を超えない |
| 払い戻し | 公開しているリレイヤーにだけ払い、`NYQUIST_MAX_FEE_WEI` を超えない |

Safe 自身への呼び出しは、復旧用オーナーを加えるもの以外は断ります。サーバーのエラーの文は、モデルに渡す前に手元で決めた文に置き換えます。

</details>

### 仕様

<details>
<summary>MCP ツール</summary>
<br>

| ツール | 役割 |
| --- | --- |
| `nyquist_setup` | 鍵を作り、ウォレットを登録します。何度呼んでも同じウォレットを返します |
| `nyquist_wallet` | Safe のアドレス、残高、オーナー、所属する組織を返します |
| `nyquist_send` | ETH を送るか、コントラクトを呼びます。最初の送金で Safe を作り、作成費用 0.002 ETH を払います |
| `nyquist_transaction` | 送金の状態を `pending`、`success`、`failed`、`reverted`、`dropped` のどれかで返します。`dropped` は、実行される前に nyquist が取り消したことを表します |
| `nyquist_claim_code` | 人間がエージェントを組織に引き取るためのコードを作ります |
| `nyquist_add_recovery_owner` | 引き取った人間を Safe のオーナーに加えます。その人から直接教わったアドレスを渡します |

</details>

<details>
<summary>環境変数</summary>
<br>

| 変数 | 既定値 | 役割 |
| --- | --- | --- |
| `NYQUIST_ENV` | `production` | `development` にすると、ローカルの API を使います |
| `NYQUIST_API_URL` | 環境ごとの API | 接続する nyquist の API |
| `NYQUIST_RPC_URL` | Sepolia の公開 RPC | 見積もりを確かめるのに使う RPC |
| `NYQUIST_HOME` | `~/.nyquist` | 鍵を置くディレクトリ |
| `NYQUIST_MAX_FEE_WEI` | 0.01 ETH | 1回の送金で払ってよいガス代の払い戻しの上限 |

</details>
