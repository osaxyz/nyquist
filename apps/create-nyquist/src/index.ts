import { parseArgs } from "node:util"
import { cancel, intro, isCancel, log, note, outro, select, spinner } from "@clack/prompts"
import { Keystore, Wallet, loadSettings } from "@nyquist/agent"
import { formatEther } from "viem"
import { AGENTS, MCP_SPEC, install, server, type AgentId } from "./agents"

// npm create nyquist の本体。この端末で鍵を作り、nyquist にウォレットを登録し、
// 選んだエージェントの MCP 設定に nyquist-mcp を加える。鍵はこの端末から出さない。

const HELP = `Usage: npm create nyquist [-- options]

Options:
  --agent <id>          claude-code, hermes, openclaw, grok, or other
  --enrollment <token>  Join an organization with an enrollment token
  -h, --help            Show this help`

// nyquist-mcp も同じ環境変数を読むので、指定されていれば MCP の設定にも渡す。
const PASSED_ENV = ["NYQUIST_ENV", "NYQUIST_API_URL", "NYQUIST_RPC_URL", "NYQUIST_HOME", "NYQUIST_MAX_FEE_WEI"] as const

const { values } = parseArgs({
    options: {
        agent: { type: "string" },
        enrollment: { type: "string" },
        help: { type: "boolean", short: "h" },
    },
})

if (values.help) {
    console.log(HELP)
    process.exit(0)
}

function short(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function chooseAgent(): Promise<AgentId> {
    if (values.agent) {
        const found = AGENTS.find((agent) => agent.value === values.agent)
        if (!found) throw new Error(`Unknown agent "${values.agent}". Use one of: ${AGENTS.map((agent) => agent.value).join(", ")}`)
        return found.value
    }
    const answer = await select({ message: "Which agent should get the wallet?", options: AGENTS })
    if (isCancel(answer)) {
        cancel("Cancelled")
        process.exit(0)
    }
    return answer
}

async function main() {
    intro("nyquist")
    const agent = await chooseAgent()

    // Grok Bot は自分のクラウドのコンピューターで MCP サーバーを動かすので、鍵もそこで作られる。
    // この端末で鍵を作っても使えないので、チャットで頼む文だけを案内する。
    if (agent === "grok") {
        note(`Add an MCP server called nyquist that runs: npx -y ${MCP_SPEC}`, "Ask Grok Bot in chat")
        outro("Grok Bot creates the keys on its own computer. Then ask it to call nyquist_setup.")
        return
    }

    const settings = loadSettings()
    const keystore = new Keystore(settings.home, settings.environment)
    const wallet = new Wallet(settings, keystore)

    const keys = spinner()
    keys.start("Generating keys on this machine")
    const { created } = await keystore.loadOrCreate()
    keys.stop(created ? "Generated keys on this machine" : "Using the keys already on this machine")

    const register = spinner()
    register.start("Registering the wallet with nyquist")
    let safe: string
    let feeWei: string
    try {
        const { agent: registered } = await wallet.setup(values.enrollment)
        safe = registered.safe
        feeWei = registered.deploymentFeeWei
    } catch (error) {
        register.error("Could not register the wallet")
        throw error
    }
    register.stop(`Registered the wallet  Safe ${short(safe)}`)

    const env = Object.fromEntries(PASSED_ENV.flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : [])))
    const result = await install(agent, server(env, settings.home, process.env.NYQUIST_MCP_PACKAGE))
    if (result.kind === "manual") {
        log.warn(result.message)
        note(result.snippet)
    } else {
        log.success(result.message)
        if (result.kind === "added" && result.next) log.info(result.next)
    }

    note(
        [
            `Safe      ${safe}`,
            `Chain     ${settings.config.chain.name}`,
            `Key file  ${keystore.path}`,
            "",
            `Fund the Safe with at least ${formatEther(BigInt(feeWei))} ETH for its creation,`,
            "plus what you want to send. Then ask your agent:",
            '"Send 0.01 ETH to 0x…"',
        ].join("\n"),
        "Next",
    )
    outro("Keep the key file safe. Losing it means losing access to the funds.")
}

main().catch((error: unknown) => {
    log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
