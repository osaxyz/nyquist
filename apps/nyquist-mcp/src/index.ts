import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { formatEther, getAddress, isAddress, parseEther, type Hex } from "viem"
import { z } from "zod"
import { ApiError, Keystore, QuoteRejected, Wallet, WalletError, loadSettings, type Agent } from "@nyquist/agent"

const settings = loadSettings()
const keystore = new Keystore(settings.home, settings.environment)
const wallet = new Wallet(settings, keystore)
// Sepolia とメインネットの両方を入れたエージェントが取り違えないよう、ツールの説明にチェーン名を入れる。
const CHAIN = settings.config.chain.name
// 作成費用が 0 の環境では、Safe の作成を最初の送金とまとめ、作成のガス代も払い戻しに含める。
const BUNDLED = BigInt(settings.config.relayer.deploymentFeeWei) === 0n
const { perTransactionUsd, perDayUsd } = settings.config.spending

// ビルド時に package.json の版を埋め込む。tsx で直接動かしたときは埋め込まれない。
declare const __VERSION__: string | undefined
const server = new McpServer({ name: "nyquist", version: typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0-dev" })

type Content = { content: { type: "text"; text: string }[]; isError?: boolean }

function reply(value: unknown): Content {
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }
}

// API のエラーは、サーバーの本文ではなく、ここで決めた文で伝える。
// サーバーの文をそのままエージェントに渡すと、乗っ取られたサーバーが指示を書き込めるため。
const PROBLEM_MESSAGES: Record<string, string> = {
    "invalid-request": "リクエストの内容が正しくありません。宛先、金額、calldata を確認してください",
    "signature-invalid": "リクエストの署名を検証できませんでした。時計がずれていないか確認してください",
    "signature-expired": "リクエストの署名の期限が切れました。もう一度試してください",
    "nonce-reused": "同じリクエストが二度送られました。もう一度試してください",
    "agent-unknown": "このエージェントは nyquist に登録されていません。nyquist_setup を呼んでください",
    "registration-closed": "この nyquist の API は招待制です。NYQUIST_INVITE に招待コードを設定してください",
    "spending-limit-exceeded": "送金額の上限を超えています。額を減らすか、時間をおいてから送ってください",
    "price-unavailable": "ETH の価格を確かめられないため、今は ETH を送れません。しばらく待ってから送ってください",
    "agent-suspended": "送金の失敗が続いたため、nyquist がこのエージェントの中継を24時間止めています",
    "not-found": "見つかりませんでした",
    "agent-exists": "このエージェントはすでに登録されています",
    "safe-not-funded": "Safe の残高が足りません。入金してから送ってください",
    "nonce-mismatch": "Safe の nonce が変わりました。もう一度試してください",
    "quote-expired": "ガス代が変わりました。もう一度試してください",
    "transaction-pending": "前の送金がまだ確定していません。nyquist_transaction で確定したことを確かめてから送ってください",
    "transaction-reverted": "Safe から呼び出すと失敗します。宛先、金額、Safe の残高（ガス代の払い戻し分を含む）を確認してください",
    "gas-limit-exceeded": "ガス量が nyquist の上限を超えます",
    "rate-limited": "リクエストが多すぎます。少し待ってから試してください",
    "network-congested": "ガス代が高いため、下がってから試してください",
    upstream: "nyquist がチェーンと通信できませんでした。少し待ってから試してください",
}

// RPC やライブラリの例外の文には、RPC やサーバーが返した文が混ざる。エージェントには決まった文だけを返し、
// 詳しい内容は MCP クライアントのログ（標準エラー出力）にだけ書く。
function unexpected(error: unknown): string {
    console.error("nyquist-mcp:", error)
    return "RPC または nyquist との通信で予期しないエラーが起きました。少し待ってから試してください"
}

// 知らない種類はサーバーの文字列をそのまま見せず、不明なエラーとして返す。種類の名前はログにだけ書く。
function problemMessage(problem: string | undefined): string {
    if (problem !== undefined && Object.hasOwn(PROBLEM_MESSAGES, problem)) return PROBLEM_MESSAGES[problem]!
    if (problem !== undefined) console.error("nyquist-mcp: 知らない種類のエラー:", problem)
    return "不明なエラー"
}

// 失敗は例外にせず、エージェントが次の行動を決められる文で返す。
async function run(task: () => Promise<unknown>): Promise<Content> {
    try {
        return reply(await task())
    } catch (error) {
        const message =
            error instanceof ApiError
                ? `nyquist API が ${error.status} を返しました: ${problemMessage(error.problem)}`
                : error instanceof QuoteRejected
                  ? `見積もりを検証できなかったため、署名していません: ${error.message}`
                  : error instanceof WalletError
                    ? error.message
                    : unexpected(error)
        return { content: [{ type: "text", text: message }], isError: true }
    }
}

// Safe のアドレス、オーナー、閾値は、鍵ファイルとチェーンから取った値を見せる。サーバーの申告は使わない。
async function summarize(agent: Agent) {
    const chain = await wallet.onchain()
    return {
        safe: chain.safe,
        balance: `${formatEther(BigInt(agent.balanceWei))} ETH`,
        chain: settings.config.chain.name,
        deployed: chain.deployed,
        deploymentFee: BigInt(agent.deploymentFeeWei) === 0n ? "最初の送金のガス代に含めて払う" : `${formatEther(BigInt(agent.deploymentFeeWei))} ETH`,
        owners: chain.owners,
        threshold: chain.threshold,
        relayStatus: agent.status,
        nonce: agent.nonce,
    }
}

const AddressInput = z
    .string()
    .refine((value) => isAddress(value, { strict: false }), "Ethereum のアドレスではありません")
    .describe("送金先のアドレス")

server.registerTool(
    "nyquist_setup",
    {
        title: "ウォレットを用意する",
        description:
            `このエージェント専用の ${CHAIN} のウォレット（Safe）を用意する。鍵はこの端末に作り、外には出さない。人間の承認は要らない。すでにあれば同じウォレットを返す。${BUNDLED ? "Safe を使い始めるには、送金額とガス代を合わせた額以上をこのアドレスに入金してもらう必要がある。Safe は最初の送金と同じ tx で作り、作成のガス代もその払い戻しに含まれる。" : "Safe を使い始めるには、作成費用と送金額を合わせた額以上をこのアドレスに入金してもらう必要がある。"}`,
        annotations: { idempotentHint: true, openWorldHint: true },
    },
    async () =>
        run(async () => {
            const { agent, created } = await wallet.setup()
            return {
                ...(await summarize(agent)),
                keyCreated: created,
                keyFile: keystore.path,
                note: "鍵ファイルを失うと、このウォレットの資金を動かせなくなります。鍵ファイルを控え、少額で使ってください。",
            }
        }),
)

server.registerTool(
    "nyquist_wallet",
    {
        title: "ウォレットの状態を見る",
        description:
            `${CHAIN} の Safe のアドレス、残高、オーナー、nyquist が中継しているかを返す。`,
        annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => run(async () => await summarize(await wallet.info())),
)

server.registerTool(
    "nyquist_send",
    {
        title: "ETH を送る、コントラクトを呼ぶ",
        description:
            `${CHAIN} の Safe から ETH を送るか、コントラクトを呼び出す。ガス代は nyquist が立て替え、Safe から払い戻す。署名の前に、見積もりのハッシュとガスの条件を手元で検証する。最初の送金のときだけ Safe を作り、${BUNDLED ? "作成のガス代もその払い戻しに含める。" : "その作成費用も Safe から差し引く。"}送れる ETH は、そのときの価格で1回 $${perTransactionUsd}、直近24時間で $${perDayUsd} まで。`,
        inputSchema: {
            to: AddressInput,
            amount: z
                .string()
                .regex(/^\d+(\.\d+)?$/, "ETH の10進数で指定してください")
                .default("0")
                .describe("送る ETH の量。例: 0.01"),
            data: z
                .string()
                .regex(/^0x([0-9a-fA-F]{2})*$/)
                .default("0x")
                .describe("コントラクトを呼ぶときの calldata。ETH を送るだけなら省略する"),
        },
        annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ to, amount, data }) =>
        run(async () => {
            // 最初の送金では Safe の作成費用も差し引かれるので、送る前に作成済みかを確かめておく。
            const before = await wallet.info()
            const value = parseEther(amount)
            const result = await wallet.send({ to: getAddress(to), value, data: data as Hex })
            const deploymentFeeWei = before.deployed ? 0n : BigInt(before.deploymentFeeWei)
            return {
                ...result,
                feeLimit: `${formatEther(BigInt(result.feeLimitWei))} ETH`,
                // feeLimit のうち、nyquist の手数料の分。ガス代への上乗せで、送金額には連動しない。
                serviceFeeLimit: `${formatEther(BigInt(result.serviceFeeLimitWei))} ETH`,
                ...(before.deployed
                    ? {}
                    : {
                          // 作成費用が 0 のときは、作成のガス代が feeLimit に含まれている。
                          deploymentFee: deploymentFeeWei === 0n ? "feeLimit に含まれる" : `${formatEther(deploymentFeeWei)} ETH`,
                          // 送った額、Safe の作成費用、ガス代の払い戻しの上限を足した、Safe から出ていく額の上限。
                          maxTotalCost: `${formatEther(value + deploymentFeeWei + BigInt(result.feeLimitWei))} ETH`,
                      }),
                note:
                    result.status === "pending"
                        ? "確定を待ちきれませんでした。nyquist_transaction で状態を確かめてください。"
                        : result.status === "failed"
                          ? "Safe 内の呼び出しが失敗しました。ガス代は払い戻し済みです。"
                          : undefined,
            }
        }),
)

server.registerTool(
    "nyquist_transaction",
    {
        title: "送金の状態を見る",
        description:
            "nyquist_send で送った tx の状態を返す。status は pending、success、failed、reverted、dropped のいずれか。dropped は取り込まれないまま nyquist が取り消し、実行されなかったことを表すので、必要なら送り直す。",
        inputSchema: { hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).describe("nyquist_send が返した hash") },
        annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ hash }) => run(() => wallet.transaction(hash as Hex)),
)

await server.connect(new StdioServerTransport())
