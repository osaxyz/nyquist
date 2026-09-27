import { z } from "zod"
import { CONFIG, ENVIRONMENTS, type Config, type Environment } from "./config"

export * from "./config"

const privateKey = z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .transform((value) => value as `0x${string}`)

// .env.development と .env.production に dotenvx で暗号化して置く値。
// nyquist が持つ秘密鍵はリレイヤーの1本だけ。Safe のオーナーにはならない。
const secretSchema = z.object({
    RELAYER_PRIVATE_KEY: privateKey,
    // 登録が招待制の環境で、登録に添えてもらう招待コード。
    REGISTRATION_INVITE: z.string().min(24).optional(),
})

// wrangler の vars やテストから渡す値。
// ETHEREUM_RPC_URL は読み取り用の RPC。本番では API キーを含む Alchemy の URL を .env.* に暗号化して置き、秘密として渡す。
const runtimeSchema = z.object({
    APP_ENV: z.enum(ENVIRONMENTS),
    ETHEREUM_RPC_URL: z.url().optional(),
})

export type Secret = z.infer<typeof secretSchema>

export type Env = {
    environment: Environment
    config: Config
    secret: Secret
    rpcUrl: string
    // tx を送る RPC。読み取り用と分け、メインネットでは非公開の送信経路を使う。
    sendRpcUrl: string
}

export class EnvError extends Error {
    override name = "EnvError"
}

export function loadEnv(raw: object): Env {
    const result = runtimeSchema.and(secretSchema).safeParse(raw)
    if (!result.success) {
        // 値そのものは出さず、どのキーが不正かだけを伝える。
        const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "(全体)"))]
        throw new EnvError(`環境変数が不正です: ${keys.join(", ")}`)
    }
    const { APP_ENV, ETHEREUM_RPC_URL, ...secret } = result.data
    const config: Config = CONFIG[APP_ENV]
    if (config.registration === "invite" && !secret.REGISTRATION_INVITE) {
        throw new EnvError("環境変数が不正です: REGISTRATION_INVITE")
    }
    return {
        environment: APP_ENV,
        config,
        secret,
        rpcUrl: ETHEREUM_RPC_URL ?? config.chain.rpcUrl,
        // 非公開の送信経路を持つチェーン（メインネット）は、ETHEREUM_RPC_URL を渡しても送信をそこから外さない。
        // テストで ETHEREUM_RPC_URL を渡したときは、送信もそこに向ける。
        sendRpcUrl: config.chain.sendRpcUrl ?? ETHEREUM_RPC_URL ?? config.chain.rpcUrl,
    }
}
