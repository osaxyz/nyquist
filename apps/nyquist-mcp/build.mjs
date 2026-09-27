import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { bundle } from "../../scripts/bundle.mjs"

await bundle(build, { cwd: fileURLToPath(new URL(".", import.meta.url)) })
