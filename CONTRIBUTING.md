<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo.png">
  <img src="docs/assets/logo-outline.png" width="240" alt="nyquist">
</picture>

# Contributing to nyquist

How to build, check, and release the nyquist clients.<br>
<sub>nyquist のクライアントをビルド、確認、公開するための手順です。</sub>

<p align="center"><a href="#en">Read more in English</a> · <a href="#ja">日本語で読む</a></p>

<a id="en"></a>

## English

> [!IMPORTANT]
> This repository is a mirror. The code is developed in a private repository together with the nyquist API and copied here automatically, so pull requests cannot be merged here directly. Please open an Issue for bugs, questions, and proposals.

1. Open an Issue that describes what happened or what you propose.
2. A maintainer makes the change in the private repository.
3. The change arrives here as a pull request from the sync app and is merged after review.

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
<summary>Try the packages before a release</summary>
<br>

Pack both packages and point `NYQUIST_MCP_PACKAGE` at the nyquist-mcp tarball. The MCP settings then run `npx --prefix=~/.nyquist -y --package <tarball> nyquist-mcp`.

```sh
pnpm --filter nyquist-mcp --filter create-nyquist pack --pack-destination "$HOME/.nyquist/dev"
NYQUIST_MCP_PACKAGE="$HOME/.nyquist/dev/nyquist-mcp-0.1.0.tgz" npx -y --package "$HOME/.nyquist/dev/create-nyquist-0.1.0.tgz" create-nyquist
```

</details>

<details>
<summary>Release to npm</summary>
<br>

The `publish` workflow publishes with npm Trusted Publishing, so no npm token is stored in GitHub. While this repository is public, npm also attaches provenance. Register the following once under Settings → Trusted Publisher of each package on npmjs.com.

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | osaxyz |
| Repository | nyquist |
| Workflow filename | publish.yml |
| Environment name | npm |

After the version bump has been merged into main:

```sh
gh workflow run publish.yml -f package=nyquist-mcp
gh workflow run publish.yml -f package=create-nyquist
```

</details>

<a id="ja"></a>

## 日本語

> [!IMPORTANT]
> このリポジトリはミラーです。コードは nyquist の API と一緒に非公開のリポジトリで開発し、ここへ自動でコピーしているので、ここでは pull request を直接マージできません。不具合、質問、提案は Issue で知らせてください。

1. 起きたことや提案を Issue に書きます。
2. メンテナーが非公開のリポジトリで変更します。
3. 変更は同期用の App の pull request としてここに届き、確認してからマージします。

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
<summary>公開前のパッケージを試す</summary>
<br>

2つのパッケージの tarball を作り、`NYQUIST_MCP_PACKAGE` に nyquist-mcp の tarball を指定します。MCP の設定には `npx --prefix=~/.nyquist -y --package <その tarball> nyquist-mcp` が登録されます。

```sh
pnpm --filter nyquist-mcp --filter create-nyquist pack --pack-destination "$HOME/.nyquist/dev"
NYQUIST_MCP_PACKAGE="$HOME/.nyquist/dev/nyquist-mcp-0.1.0.tgz" npx -y --package "$HOME/.nyquist/dev/create-nyquist-0.1.0.tgz" create-nyquist
```

</details>

<details>
<summary>npm への公開</summary>
<br>

`publish` ワークフローが npm の Trusted Publishing で公開するので、npm のトークンを GitHub に置きません。このリポジトリが公開されている間は provenance も付きます。最初に一度だけ、npmjs.com の各パッケージの Settings → Trusted Publisher に次を登録します。

| 項目 | 値 |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | osaxyz |
| Repository | nyquist |
| Workflow filename | publish.yml |
| Environment name | npm |

版を上げて main にマージしたあと、次で公開します。

```sh
gh workflow run publish.yml -f package=nyquist-mcp
gh workflow run publish.yml -f package=create-nyquist
```

</details>
