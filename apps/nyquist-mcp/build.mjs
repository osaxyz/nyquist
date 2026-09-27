import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { bundle } from "../../scripts/bundle.mjs"

// MCP サーバーが名乗る版。package.json から取り、ビルド結果に埋め込む。
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))

await bundle(build, {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    define: { __VERSION__: JSON.stringify(manifest.version) },
})
