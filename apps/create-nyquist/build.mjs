import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { bundle } from "../../scripts/bundle.mjs"

// 登録する nyquist-mcp の版。同じリポジトリの package.json から取り、ビルド結果に埋め込む。
const mcp = JSON.parse(readFileSync(new URL("../nyquist-mcp/package.json", import.meta.url), "utf8"))

await bundle(build, {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    define: { __MCP_VERSION__: JSON.stringify(mcp.version) },
})
