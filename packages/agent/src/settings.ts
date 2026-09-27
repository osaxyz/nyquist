import { homedir } from "node:os"
import { join } from "node:path"
import { parseEther } from "viem"
import { CONFIG, ENVIRONMENTS, type Config, type Environment } from "@nyquist/env"

export type Settings = {
    environment: Environment
    config: Config
    apiUrl: string
    rpcUrl: string
    home: string
    maxFeeWei: bigint
    // 登録が招待制の API に、登録のときに添える招待コード。
    invite?: string
}

// 環境変数で上書きできる。既定は production の API と、~/.nyquist に置いた鍵。
export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
    const environment = (env.NYQUIST_ENV ?? "production") as Environment
    if (!ENVIRONMENTS.includes(environment)) {
        throw new Error(`NYQUIST_ENV は ${ENVIRONMENTS.join(" か ")} にしてください`)
    }
    const config = CONFIG[environment]
    return {
        environment,
        config,
        apiUrl: (env.NYQUIST_API_URL ?? config.apiUrl).replace(/\/+$/, ""),
        rpcUrl: env.NYQUIST_RPC_URL ?? config.chain.rpcUrl,
        home: env.NYQUIST_HOME ?? join(homedir(), ".nyquist"),
        // 1回の送金で Safe から払い戻すガス代の上限。これを超える見積もりには署名しない。
        maxFeeWei: env.NYQUIST_MAX_FEE_WEI ? BigInt(env.NYQUIST_MAX_FEE_WEI) : parseEther("0.01"),
        ...(env.NYQUIST_INVITE ? { invite: env.NYQUIST_INVITE } : {}),
    }
}
