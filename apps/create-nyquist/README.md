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

> **Important:** nyquist runs on Ethereum mainnet and the Sepolia testnet. It is early-stage software, and the options may change. Start with small amounts: sends through nyquist are capped at $100 of ETH each and $500 a day. On mainnet, nyquist adds a 5% fee to the gas refund.

### Quick start

1. On the machine where your agent runs, start it and choose a network and your agent.

```sh
npm create nyquist
```

2. It creates the keys on this machine, registers the wallet with nyquist, shows the Safe address, and adds nyquist-mcp to your agent's MCP settings.
3. Send ETH to the Safe on the same network, at least what you want to send plus gas, and start a new session of your agent. On Sepolia, also add 0.002 ETH for creating the Safe. On mainnet, the first send creates the Safe and its gas is part of that send's refund.

If it ends with `Added nyquist-mainnet to …` (mainnet) or `Added nyquist to …` (Sepolia), your agent has the wallet. When it cannot find your agent's CLI or config file, it prints what to add by hand instead.

> **Tip:** Running it again is safe. It reuses the keys in `~/.nyquist`, returns the same Safe, and never overwrites an existing entry. Each network has its own keys and its own entry, so you can add both.

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

The server is named `nyquist-mainnet` on mainnet and `nyquist` on Sepolia. The table uses `nyquist`.

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
| `--network <name>` | `mainnet` or `sepolia`. Asks when omitted |
| `--agent <id>` | `claude-code`, `hermes`, `openclaw`, `grok`, or `other`. Asks when omitted |

Environment variables `NYQUIST_ENV`, `NYQUIST_API_URL`, `NYQUIST_RPC_URL`, `NYQUIST_HOME`, and `NYQUIST_MAX_FEE_WEI` are passed on to nyquist-mcp when set.

</details>

<a id="ja"></a>

## 日本語

> **重要**：nyquist は Ethereum のメインネットと Sepolia テストネットで動きます。早期段階のソフトウェアなので、オプションは変わることがあります。少額から使ってください。nyquist を通る送金は、ETH で1回 $100、1日 $500 までです。メインネットでは、ガス代の払い戻しに nyquist の手数料 5% を上乗せします。

### クイックスタート

1. エージェントが動いている端末で実行し、ネットワークとエージェントを選びます。

```sh
npm create nyquist
```

2. この端末で鍵を作り、nyquist にウォレットを登録して Safe のアドレスを表示し、エージェントの MCP 設定に nyquist-mcp を加えます。
3. 同じネットワークで Safe に ETH を送り、エージェントを新しく立ち上げます。送りたい額とガス代を合わせた額以上を入れてください。Sepolia では、作成費用の 0.002 ETH も足してください。メインネットでは、最初の送金で Safe を作り、そのガス代も送金の払い戻しに含めます。

最後に `Added nyquist-mainnet to …`（メインネット）か `Added nyquist to …`（Sepolia）と出れば、エージェントがウォレットを持っています。エージェントの CLI や設定ファイルが見つからないときは、代わりに手で加える内容を表示します。

> **ヒント**：何度実行しても大丈夫です。`~/.nyquist` の鍵を使い回して同じ Safe を返し、すでにある設定は上書きしません。鍵と設定はネットワークごとに別なので、両方を加えられます。

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

サーバーの名前は、メインネットでは `nyquist-mainnet`、Sepolia では `nyquist` です。表では `nyquist` と書いています。

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
| `--network <name>` | `mainnet` か `sepolia`。省略すると選択肢を出します |
| `--agent <id>` | `claude-code`、`hermes`、`openclaw`、`grok`、`other` のいずれか。省略すると選択肢を出します |

環境変数 `NYQUIST_ENV`、`NYQUIST_API_URL`、`NYQUIST_RPC_URL`、`NYQUIST_HOME`、`NYQUIST_MAX_FEE_WEI` を指定して実行すると、同じ値を nyquist-mcp にも渡します。

</details>
