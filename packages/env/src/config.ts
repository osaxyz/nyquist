// 秘密ではなく、変更の経緯を git で追いたい設定値をここに置く。
// 値を変えるときは、理由をコミットメッセージか PR に残す。

export const ENVIRONMENTS = ["development", "production"] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export type Address = `0x${string}`

export type ChainConfig = {
    id: number
    name: string
    rpcUrl: string
    // リレイヤーが tx を送る RPC。省略すると rpcUrl に送る。
    // メインネットでは Flashbots Protect（https://rpc.flashbots.net）のような非公開の送信経路にし、
    // mempool の tx の calldata を写して先に実行され、リレイヤーの tx が revert してガス代だけ失うのを防ぐ。
    sendRpcUrl?: string
}

export type SafeConfig = {
    version: string
    singleton: Address
    proxyFactory: Address
    fallbackHandler: Address
}

export type Config = {
    // エージェント側（nyquist-mcp と create-nyquist）が既定で接続する API のオリジン。
    apiUrl: string
    // リレイヤーのアドレス。秘密鍵は .env.* に暗号化して置き、アドレスだけをここに公開する。
    // エージェント側は、Safe のアドレスの計算と払い戻し先の確認にこの値を使い、API の応答を鵜呑みにしない。
    relayerAddress: Address
    chain: ChainConfig
    safe: SafeConfig
    signature: {
        maxAgeSeconds: number
        maxLifetimeSeconds: number
        clockSkewSeconds: number
    }
    relayer: {
        gasLimitCap: number
        receiptTimeoutMs: number
        baseGasOverhead: number
        firstExecutionGas: number
        undeployedSafeTxGas: number
        gasPriceMultiplier: number
        deploymentFeeWei: string
        // リレイヤーの手数料。Safe 内の呼び出しと baseGas の見積もりに掛ける割合（1 bps = 0.01%）。
        feeBps: number
    }
    claim: {
        ttlSeconds: number
    }
    session: {
        ttlSeconds: number
        nonceTtlSeconds: number
    }
    tenant: {
        maxAccountPerUser: number
        maxMemberPerAccount: number
        maxAgentPerAccount: number
        maxEnrollmentUses: number
        maxEnrollmentTtlSeconds: number
    }
}

// mainnet は法的確認が済むまで使わない。Issue #1 を参照。
const SEPOLIA: ChainConfig = {
    id: 11155111,
    name: "Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
}

// メインネット。法的確認が済むまで CONFIG には入れない。入れるときは、この値と relayerAddress を使う。
// 送信は Flashbots Protect に送り、公開の mempool に出さない。calldata を写して先に実行され、
// リレイヤーの tx が revert してガス代だけを失うのを防ぐ。読み取りは公開の RPC で行う。
// メインネットのリレイヤーの手数料。メインネットを CONFIG に入れるときに relayer.feeBps に使う。
// bundler や paymaster と同じく、ガス代への上乗せとして受け取る。送金額には連動させない。
export const MAINNET_FEE_BPS = 500

export const MAINNET: ChainConfig = {
    id: 1,
    name: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    sendRpcUrl: "https://rpc.flashbots.net/fast",
}

// Safe v1.4.1 の正規デプロイ。どのチェーンでも同じアドレスになる。
// https://github.com/safe-global/safe-deployments
const SAFE_V1_4_1: SafeConfig = {
    version: "1.4.1",
    singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
    proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
}

// Safe のオーナーはエージェントの signer だけで、閾値は1。エージェントが単独で送金できる。
// nyquist は利用者の資金を動かせる鍵を1本も持たない。Issue #5 を参照。
const SHARED = {
    safe: SAFE_V1_4_1,
    signature: {
        maxAgeSeconds: 60,
        maxLifetimeSeconds: 300,
        clockSkewSeconds: 5,
    },
    // リレイヤーはガス代を立て替え、Safe の払い戻し機能で回収する。
    relayer: {
        gasLimitCap: 1_000_000,
        receiptTimeoutMs: 90_000,
        // Safe が execTransaction の中で計測しないガス。nonce の更新、署名の検証、払い戻しの送金、イベントの分。
        // 基本の 21000 と calldata の分は、見積もりのたびに計算して足す。
        // Sepolia の実測（2026-09-27）で、作成済みの Safe の送金は計測外が約 28k だったので、少し余裕を持たせた値にする。
        baseGasOverhead: 33_000,
        // 最初の送金だけは Safe の nonce を 0 から 1 に書くため、計測外のガスが約 17k 増える。
        firstExecutionGas: 17_000,
        // Safe を作る前は Safe 自身のコードがなく、Safe 内の呼び出しを正確に見積もれない。
        // その間は safeTxGas をこの値以上にする。使わなかった分は払い戻しに含まれない。
        undeployedSafeTxGas: 150_000,
        // 見積もり時点の maxFeePerGas に掛ける倍率。実際の払い戻しは実際に払った額になる。
        gasPriceMultiplier: 2,
        // Safe を作るときに setup の payment でリレイヤーに払ってもらう額。
        // 作成時点のガス代がこれを超えるなら、下がるまで作成を待つ。
        deploymentFeeWei: "2000000000000000",
        // Sepolia の ETH には価値がないので、テストネットでは取らない。
        feeBps: 0,
    },
    claim: {
        ttlSeconds: 86_400,
    },
    // 人間のログイン。SIWE の nonce は発行から5分、セッションは1日で切れる。
    session: {
        ttlSeconds: 86_400,
        nonceTtlSeconds: 300,
    },
    tenant: {
        maxAccountPerUser: 5,
        maxMemberPerAccount: 20,
        maxAgentPerAccount: 50,
        maxEnrollmentUses: 100,
        maxEnrollmentTtlSeconds: 30 * 86_400,
    },
} satisfies Omit<Config, "chain" | "apiUrl" | "relayerAddress">

export const CONFIG = {
    development: { ...SHARED, apiUrl: "http://localhost:8787", relayerAddress: "0x947C75672A5c4c1bD1Fb5243D4d6B4Dc3b6B6bB0", chain: SEPOLIA },
    // Cloudflare の Original SIN Architecture アカウントにデプロイしている。Issue #9 を参照。
    production: {
        ...SHARED,
        apiUrl: "https://nyquist-api-production.original-sin-architecture.workers.dev",
        relayerAddress: "0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174",
        chain: SEPOLIA,
    },
} as const satisfies Record<Environment, Config>
