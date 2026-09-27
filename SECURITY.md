# Security policy

nyquist handles wallet keys, so we take reports seriously.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through [GitHub's private vulnerability reporting](https://github.com/osaxyz/nyquist/security/advisories/new) for this repository.

Include what you found, how to reproduce it, and what an attacker could do with it. We will reply as soon as we can.

## Scope

- The packages in this repository: `nyquist-mcp`, `create-nyquist`, and the libraries they bundle from `packages/`.
- The nyquist API and relayer, which run outside this repository. Report issues with them the same way.

nyquist runs on Ethereum mainnet and the Sepolia testnet.

---

# セキュリティについて

nyquist はウォレットの鍵を扱うので、脆弱性の報告を重く受け止めます。

## 脆弱性を報告する

公開の Issue には書かないでください。このリポジトリの [GitHub の非公開の脆弱性報告](https://github.com/osaxyz/nyquist/security/advisories/new) から報告してください。

見つけた内容、再現の手順、攻撃者に何ができるかを書いてください。できるだけ早く返信します。

## 対象

- このリポジトリのパッケージ（`nyquist-mcp` と `create-nyquist`）と、それらが `packages/` から同梱しているライブラリ
- このリポジトリの外で動いている nyquist の API とリレイヤー。こちらも同じ方法で報告してください

nyquist は、Ethereum のメインネットと Sepolia テストネットで動いています。
