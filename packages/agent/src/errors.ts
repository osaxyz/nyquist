// nyquist-mcp 自身が書いた文の例外。エージェントに見せてよい。
// RPC やサーバーの応答から作った文は、この例外にしない。
export class WalletError extends Error {
    override name = "WalletError"
}
