<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://www.nyquist.sh/brand/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://www.nyquist.sh/brand/logo.png">
  <img src="https://www.nyquist.sh/brand/logo-outline.png" width="240" alt="nyquist">
</picture>

# Contributing to nyquist

How to build and check the nyquist clients.<br>
<sub>nyquist のクライアントをビルドし、確かめるための手順です。</sub>

<p align="center"><a href="#en">Read more in English</a> · <a href="#ja">日本語で読む</a></p>

<a id="en"></a>

## English

> [!IMPORTANT]
> This repository is a mirror. The code is developed in a private repository together with the nyquist API and copied here automatically, so pull requests cannot be merged here directly. Please open an Issue for bugs, questions, and proposals.

1. Open an Issue that describes what happened or what you propose.
2. A maintainer makes the change in the private repository and reviews it there.
3. The sync app pushes the change to main here.

<details>
<summary>Build and check</summary>
<br>

This repository uses pnpm 11.

```sh
pnpm install
pnpm exec turbo run typecheck build
```

`apps/nyquist-mcp/dist/index.js` and `apps/create-nyquist/dist/index.js` bundle every dependency, and `dist/THIRD_PARTY_LICENSES.md` lists their licenses.

</details>

<details>
<summary>Try the packages locally</summary>
<br>

Pack both packages and point `NYQUIST_MCP_PACKAGE` at the nyquist-mcp tarball. The MCP settings then run `npx --prefix=~/.nyquist -y --package <tarball> nyquist-mcp`.

```sh
pnpm --filter nyquist-mcp --filter create-nyquist pack --pack-destination "$HOME/.nyquist/dev"
NYQUIST_MCP_PACKAGE="$HOME/.nyquist/dev/nyquist-mcp-0.1.0.tgz" npx -y --package "$HOME/.nyquist/dev/create-nyquist-0.1.0.tgz" create-nyquist
```

</details>

<a id="ja"></a>

## 日本語

> [!IMPORTANT]
> このリポジトリはミラーです。コードは nyquist の API と一緒に非公開のリポジトリで開発し、ここへ自動でコピーしているので、ここでは pull request を直接マージできません。不具合、質問、提案は Issue で知らせてください。

1. 起きたことや提案を Issue に書きます。
2. メンテナーが非公開のリポジトリで変更し、そこで確かめます。
3. 同期用の App が、変更をここの main に push します。

<details>
<summary>ビルドと確認</summary>
<br>

pnpm 11 を使います。

```sh
pnpm install
pnpm exec turbo run typecheck build
```

`apps/nyquist-mcp/dist/index.js` と `apps/create-nyquist/dist/index.js` には依存をすべて同梱し、そのライセンスを `dist/THIRD_PARTY_LICENSES.md` にまとめます。

</details>

<details>
<summary>手元でパッケージを試す</summary>
<br>

2つのパッケージの tarball を作り、`NYQUIST_MCP_PACKAGE` に nyquist-mcp の tarball を指定します。MCP の設定には `npx --prefix=~/.nyquist -y --package <その tarball> nyquist-mcp` が登録されます。

```sh
pnpm --filter nyquist-mcp --filter create-nyquist pack --pack-destination "$HOME/.nyquist/dev"
NYQUIST_MCP_PACKAGE="$HOME/.nyquist/dev/nyquist-mcp-0.1.0.tgz" npx -y --package "$HOME/.nyquist/dev/create-nyquist-0.1.0.tgz" create-nyquist
```

</details>
