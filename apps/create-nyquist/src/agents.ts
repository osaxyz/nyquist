import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { readFile, rename, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { isMap, isScalar, parseDocument } from "yaml"

// エージェントの MCP 設定に nyquist-mcp を加える。
// 各エージェントの CLI があればそれを使い、なければ設定ファイルに書くか、手で加える内容を返す。

export const MCP_PACKAGE = "nyquist-mcp"

// ビルド時に nyquist-mcp の package.json の版が入る。tsx で直接動かしたときは latest を使う。
declare const __MCP_VERSION__: string | undefined
const MCP_VERSION = typeof __MCP_VERSION__ === "string" ? __MCP_VERSION__ : "latest"

// 鍵を扱うサーバーなので、起動のたびに最新版を取りにいかず、版を固定する。
// 乗っ取られた版が公開されても、すでに入れた人の環境では自動では動かない。
export const MCP_SPEC = `${MCP_PACKAGE}@${MCP_VERSION}`

// name は MCP の設定での名前。Sepolia は nyquist、メインネットは nyquist-mainnet にし、両方を並べて入れられるようにする。
export type Server = { name: string; command: string; args: string[]; env: Record<string, string> }

export type Result =
    | { kind: "added"; message: string; next?: string }
    | { kind: "exists"; message: string }
    | { kind: "manual"; message: string; snippet: string }

export type AgentId = "claude-code" | "hermes" | "openclaw" | "grok" | "other"

export const AGENTS: { value: AgentId; label: string; hint?: string }[] = [
    { value: "claude-code", label: "Claude Code" },
    { value: "hermes", label: "Hermes Agent" },
    { value: "openclaw", label: "OpenClaw" },
    { value: "grok", label: "Grok Bot", hint: "runs in the cloud" },
    { value: "other", label: "Other MCP client" },
]

// NYQUIST_MCP_PACKAGE で、npx に渡すパッケージを差し替えられる。
// 公開前に手元でビルドした tarball を試すときや、版を固定するときに使う。
// npx はパスをそのまま実行しようとするので、差し替えたときは --package で渡してコマンド名を指定する。
// エージェントは作業中のプロジェクトで MCP サーバーを起動する。そのプロジェクトの package.json が
// devEngines で pnpm などを指定していると npx が止まるので、--prefix で鍵のディレクトリを起点にする。
export function server(name: string, env: Record<string, string>, prefix: string, spec?: string): Server {
    const args = [`--prefix=${prefix}`, "-y", "--package", spec ?? MCP_SPEC, MCP_PACKAGE]
    return { name, command: "npx", args, env }
}

// 設定ファイルに書く中身。名前はキーにするので含めず、環境変数がなければ env を省く。
function entry(value: Server): { command: string; args: string[]; env?: Record<string, string> } {
    return { command: value.command, args: value.args, ...(Object.keys(value.env).length ? { env: value.env } : {}) }
}

function has(command: string): boolean {
    return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0
}

function run(command: string, args: string[]): { ok: boolean; output: string } {
    const result = spawnSync(command, args, { encoding: "utf8" })
    return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() }
}

// 手で貼るコマンドの引数を、シェルでそのまま使える形に引用する。空白や記号を含むパスでも崩れない。
function quote(argument: string): string {
    return /^[A-Za-z0-9_@%+=:,./-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", `'\\''`)}'`
}

function json(value: Server): string {
    return JSON.stringify({ [value.name]: entry(value) }, null, 2)
}

function claudeCode(value: Server): Result {
    const envArgs = Object.entries(value.env).flatMap(([key, v]) => ["-e", `${key}=${v}`])
    const args = ["mcp", "add", value.name, "--scope", "user", ...envArgs, "--", value.command, ...value.args]
    if (!has("claude")) {
        return { kind: "manual", message: "Claude Code's CLI was not found. Run this to add nyquist:", snippet: `claude ${args.map(quote).join(" ")}` }
    }
    if (run("claude", ["mcp", "get", value.name]).ok) {
        return { kind: "exists", message: `Claude Code already has an MCP server called ${value.name}` }
    }
    const added = run("claude", args)
    if (!added.ok) throw new Error(`claude mcp add failed: ${added.output}`)
    return { kind: "added", message: `Added ${value.name} to Claude Code's MCP settings`, next: "Start a new Claude Code session to load it." }
}

// openclaw mcp list --json の出力に同じ名前のサーバーがあるか。名前をキーにした形と、name を持つ配列の形の両方を読む。
// 読めなければ undefined を返す。
function openClawHas(output: string, name: string): boolean | undefined {
    let parsed: unknown
    try {
        parsed = JSON.parse(output)
    } catch {
        return undefined
    }
    const servers = typeof parsed === "object" && parsed !== null && "servers" in parsed ? (parsed as { servers: unknown }).servers : parsed
    if (Array.isArray(servers)) return servers.some((server) => typeof server === "object" && server !== null && (server as { name?: unknown }).name === name)
    if (typeof servers === "object" && servers !== null) return Object.hasOwn(servers, name)
    return undefined
}

function openClaw(value: Server): Result {
    const body = JSON.stringify(entry(value))
    if (!has("openclaw")) {
        return { kind: "manual", message: "OpenClaw's CLI was not found. Add this under mcp.servers in OpenClaw's config:", snippet: json(value) }
    }
    // set は同じ名前があれば置き換えるので、先に一覧を読み、すでにあれば触らない。
    // 一覧の形が読めないときも、上書きせずに手で加えてもらう。
    const listed = run("openclaw", ["mcp", "list", "--json"])
    const existing = listed.ok ? openClawHas(listed.output, value.name) : undefined
    if (existing === true) return { kind: "exists", message: `OpenClaw already has an MCP server called ${value.name}` }
    if (existing === undefined) {
        return { kind: "manual", message: "Could not read OpenClaw's MCP settings. Add this under mcp.servers in OpenClaw's config:", snippet: json(value) }
    }
    const added = run("openclaw", ["mcp", "set", value.name, body])
    if (!added.ok) throw new Error(`openclaw mcp set failed: ${added.output}`)
    return { kind: "added", message: `Added ${value.name} to OpenClaw's MCP settings`, next: "Restart the OpenClaw gateway to load it." }
}

async function hermes(value: Server): Promise<Result> {
    const home = process.env.HERMES_HOME ?? join(homedir(), ".hermes")
    const path = join(home, "config.yaml")
    if (!existsSync(path)) {
        const snippet = parseDocument("mcp_servers: {}")
        snippet.setIn(["mcp_servers", value.name], entry(value))
        return { kind: "manual", message: `${path} was not found. Add this to Hermes Agent's config.yaml:`, snippet: snippet.toString({ flowCollectionPadding: false }) }
    }
    // コメントや並び順を残したまま、mcp_servers にこのサーバーだけを加える。
    const document = parseDocument(await readFile(path, "utf8"))
    if (document.errors.length) throw new Error(`Could not read ${path}: ${document.errors[0]?.message}`)
    const servers = document.get("mcp_servers", true)
    if (servers === undefined || servers === null || (isScalar(servers) && servers.value === null)) {
        // mcp_servers がない、または `mcp_servers:` だけで中身が空のとき。
        document.set("mcp_servers", document.createNode({}))
    } else if (!isMap(servers)) {
        throw new Error(`mcp_servers in ${path} is not a map. Add ${value.name} to it by hand.`)
    } else if (servers.has(value.name)) {
        return { kind: "exists", message: `${path} already has an MCP server called ${value.name}` }
    }
    document.setIn(["mcp_servers", value.name], document.createNode(entry(value)))
    // 一時ファイルに書いてから置き換える。途中で止まっても、元の設定ファイルは壊れない。
    const temporary = join(dirname(path), `.config.yaml.${randomUUID()}.tmp`)
    await writeFile(temporary, document.toString({ flowCollectionPadding: false }), { mode: (await stat(path)).mode & 0o777, flag: "wx" })
    await rename(temporary, path)
    return { kind: "added", message: `Added ${value.name} to ${path}`, next: "Run /reload-mcp in Hermes, or start a new session." }
}

export async function install(agent: Exclude<AgentId, "grok">, value: Server): Promise<Result> {
    switch (agent) {
        case "claude-code":
            return claudeCode(value)
        case "openclaw":
            return openClaw(value)
        case "hermes":
            return hermes(value)
        case "other":
            return { kind: "manual", message: `Register ${value.name} as a stdio MCP server in your client:`, snippet: json(value) }
    }
}
