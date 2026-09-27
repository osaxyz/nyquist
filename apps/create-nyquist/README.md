<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://www.nyquist.sh/brand/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://www.nyquist.sh/brand/logo.png">
  <img src="https://www.nyquist.sh/brand/logo-outline.png" width="240" alt="nyquist">
</picture>

# create-nyquist

One command that gives your autonomous agent its own Ethereum wallet and adds nyquist-mcp to it.<br>
<sub>1つのコマンドで、自律エージェントに自分の Ethereum ウォレットを持たせ、nyquist-mcp を登録します。</sub>

<p align="center"><a href="#en">Read more in English</a> · <a href="#ja">日本語で読む</a></p>

<a id="en"></a>

## English

> **Important:** nyquist runs on the Sepolia testnet only. Do not send mainnet ETH to a nyquist Safe. It is early-stage software, and the options may change.

### Quick start

1. On the machine where your agent runs, start it and choose your agent.

```sh
npm create nyquist
```

2. It creates the keys on this machine, registers the wallet with nyquist, shows the Safe address, and adds nyquist-mcp to your agent's MCP settings.
3. Send Sepolia ETH to the Safe, at least 0.002 ETH for creating it plus what you want to send, and start a new session of your agent.

If it ends with `Added nyquist to …`, your agent has the wallet. When it cannot find your agent's CLI or config file, it prints what to add by hand instead.

> **Tip:** Running it again is safe. It reuses the keys in `~/.nyquist`, returns the same Safe, and never overwrites an existing `nyquist` entry.

Try asking your agent:

- "Show my nyquist wallet."
- "Send 0.001 ETH to 0x…"

### Technology

<details>
<summary>The keys never leave this machine</summary>
<br>

The keys are created here and stored in `~/.nyquist`. Only the public key and the signer address are sent to nyquist. The Safe address nyquist returns is recomputed locally from the key before it is saved, so a wrong server cannot make you fund someone else's address.

</details>

<details>
<summary>The MCP server is pinned</summary>
<br>

It registers `nyquist-mcp` at the exact version it was built with, not `latest`. A new release never runs on your agent until you run `npm create nyquist` again.

</details>

### Specification

<details>
<summary>Supported agents</summary>
<br>

| Agent | How it is added |
| --- | --- |
| Claude Code | `claude mcp add nyquist --scope user` |
| Hermes Agent | Adds `nyquist` under `mcp_servers` in `~/.hermes/config.yaml`, keeping comments and order |
| OpenClaw | `openclaw mcp set nyquist`. Restart the gateway afterwards |
| Grok Bot | Prints a message to paste into the chat. Grok Bot runs the server and keeps the keys on its own computer |
| Other MCP client | Prints the stdio server settings |

</details>

<details>
<summary>Options</summary>
<br>

| Option | Purpose |
| --- | --- |
| `--agent <id>` | `claude-code`, `hermes`, `openclaw`, `grok`, or `other`. Asks when omitted |
| `--enrollment <token>` | Joins an organization with an enrollment token issued by its account |

Environment variables `NYQUIST_ENV`, `NYQUIST_API_URL`, `NYQUIST_RPC_URL`, `NYQUIST_HOME`, and `NYQUIST_MAX_FEE_WEI` are passed on to nyquist-mcp when set.

</details>

<a id="ja"></a>

## 日本語

> **重要**：nyquist は Sepolia テストネットでだけ動きます。nyquist の Safe にメインネットの ETH を送らないでください。早期段階のソフトウェアなので、オプションは変わることがあります。

### クイックスタート

1. エージェントが動いている端末で実行し、エージェントを選びます。

```sh
npm create nyquist
```

2. この端末で鍵を作り、nyquist にウォレットを登録して Safe のアドレスを表示し、エージェントの MCP 設定に nyquist-mcp を加えます。
3. Safe に Sepolia の ETH を送り、エージェントを新しく立ち上げます。作成費用の 0.002 ETH と、送りたい額を合わせた額以上を入れてください。

最後に `Added nyquist to …` と出れば、エージェントがウォレットを持っています。エージェントの CLI や設定ファイルが見つからないときは、代わりに手で加える内容を表示します。

> **ヒント**：何度実行しても大丈夫です。`~/.nyquist` の鍵を使い回して同じ Safe を返し、すでにある `nyquist` の設定は上書きしません。

エージェントに次のように頼んでみてください。

- 「nyquist のウォレットを見せて」
- 「0.001 ETH を 0x… に送って」

### テクノロジー

<details>
<summary>鍵はこの端末から出ません</summary>
<br>

鍵はここで作り、`~/.nyquist` に保存します。nyquist に送るのは公開鍵と signer のアドレスだけです。nyquist が返した Safe のアドレスは、保存する前に鍵から手元で計算し直すので、誤ったサーバーが他人のアドレスへ入金させることはできません。

</details>

<details>
<summary>MCP サーバーの版を固定します</summary>
<br>

`nyquist-mcp` を `latest` ではなく、ビルドしたときの版で登録します。新しい版は、`npm create nyquist` をもう一度実行するまで、エージェントの環境では動きません。

</details>

### 仕様

<details>
<summary>対応するエージェント</summary>
<br>

| エージェント | 加え方 |
| --- | --- |
| Claude Code | `claude mcp add nyquist --scope user` |
| Hermes Agent | `~/.hermes/config.yaml` の `mcp_servers` に `nyquist` を加えます。コメントや並び順は残します |
| OpenClaw | `openclaw mcp set nyquist`。そのあとゲートウェイを再起動します |
| Grok Bot | チャットに貼る文を表示します。Grok Bot は自分のコンピューターでサーバーを動かし、鍵もそこに置きます |
| その他の MCP クライアント | stdio のサーバーの設定を表示します |

</details>

<details>
<summary>オプション</summary>
<br>

| オプション | 役割 |
| --- | --- |
| `--agent <id>` | `claude-code`、`hermes`、`openclaw`、`grok`、`other` のいずれか。省略すると選択肢を出します |
| `--enrollment <token>` | 組織のアカウントが発行した登録トークンで、その組織に属します |

環境変数 `NYQUIST_ENV`、`NYQUIST_API_URL`、`NYQUIST_RPC_URL`、`NYQUIST_HOME`、`NYQUIST_MAX_FEE_WEI` を指定して実行すると、同じ値を nyquist-mcp にも渡します。

</details>
