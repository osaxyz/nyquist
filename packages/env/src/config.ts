// 秘密ではなく、変更の経緯を git で追いたい設定値をここに置く。
// 値を変えるときは、理由をコミットメッセージか PR に残す。

// production は Sepolia の本番、mainnet はイーサリアムのメインネット。
// エージェントの鍵は環境ごとのファイルに分かれるので、Sepolia の鍵でメインネットのお金は動かない。
export const ENVIRONMENTS = ["development", "production", "mainnet"] as const
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
    // Chainlink の ETH/USD の価格フィード。送金額の上限を USD で確かめるのに使う。
    ethUsdFeed: { address: Address; decimals: number }
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
    // エージェントの登録を誰にでも開くか。invite のときは、招待コード（REGISTRATION_INVITE）を添えた登録だけを受け付ける。
    registration: "open" | "invite"
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
    // nyquist のリレイヤーを通る送金の上限（USD）。Safe から送る ETH（value）を、そのときの ETH/USD で換算して数える。
    // トークンの送金は value に出てこないので数えない。価格が maxPriceAgeSeconds より古いか取れないときは、ETH を送る送金を断る。
    spending: {
        perTransactionUsd: number
        perDayUsd: number
        maxPriceAgeSeconds: number
    }
}

const SEPOLIA: ChainConfig = {
    id: 11155111,
    name: "Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    ethUsdFeed: { address: "0x694AA1769357215DE4FAC081bf1f309aDC325306", decimals: 8 },
}

// メインネット。
// 送信は Flashbots Protect に送り、公開の mempool に出さない。calldata を写して先に実行され、
// リレイヤーの tx が revert してガス代だけを失うのを防ぐ。読み取りは公開の RPC で行う。
// メインネットのリレイヤーの手数料。
// bundler や paymaster と同じく、ガス代への上乗せとして受け取る。送金額には連動させない。
export const MAINNET_FEE_BPS = 500

export const MAINNET: ChainConfig = {
    id: 1,
    name: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    sendRpcUrl: "https://rpc.flashbots.net/fast",
    ethUsdFeed: { address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", decimals: 8 },
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
        // 0 にすると、Safe の作成と最初の送金を1つの tx にまとめ、作成のガスをその送金の払い戻しに含める。
        // 作成費用がそのときのガス代に合う。Safe のアドレスはこの値で決まるので、登録済みのエージェントの分は変えられない。
        deploymentFeeWei: "2000000000000000",
        // Sepolia の ETH には価値がないので、テストネットでは取らない。
        feeBps: 0,
    },
    // プロンプトインジェクションを受けたエージェントが、残高をすべて送れないようにする。
    // メインネットの ETH/USD のフィードは1時間ごとに更新されるので、2時間までの古さを認める。
    spending: {
        perTransactionUsd: 100,
        perDayUsd: 500,
        maxPriceAgeSeconds: 7_200,
    },
} satisfies Omit<Config, "chain" | "apiUrl" | "relayerAddress" | "registration">

export const CONFIG = {
    development: {
        ...SHARED,
        apiUrl: "http://localhost:8787",
        relayerAddress: "0x947C75672A5c4c1bD1Fb5243D4d6B4Dc3b6B6bB0",
        chain: SEPOLIA,
        registration: "open",
        // メインネットと同じく、作成と最初の送金をまとめる。
        relayer: { ...SHARED.relayer, deploymentFeeWei: "0" },
    },
    // Cloudflare の Original SIN Architecture アカウントにデプロイしている。Issue #9 を参照。
    production: {
        ...SHARED,
        apiUrl: "https://nyquist-api-production.original-sin-architecture.workers.dev",
        relayerAddress: "0x2d7A951dbDFeA17E2c3EecA87cFde15a205c1174",
        chain: SEPOLIA,
        registration: "open",
        // 登録済みの Safe のアドレスを変えないよう、作成費用を決めて払ってもらう方式のままにする。
        // 本番で作成と送金をまとめる方式は、非公開の送信経路があるチェーンでだけ使う。公開の mempool では、
        // 先に Safe を作られてまとめた tx が revert すると、渡したガスをほぼ全部リレイヤーが払うことになる。
    },
    // Sepolia とは別の Worker、別のリレイヤーで動かす。法的確認は済み、登録を誰にでも開いている。Issue #72 を参照。
    // 招待制に戻すときは registration を invite にする。招待コードは .env.mainnet の REGISTRATION_INVITE にある。
    mainnet: {
        ...SHARED,
        apiUrl: "https://nyquist-api-mainnet.original-sin-architecture.workers.dev",
        relayerAddress: "0xF6389d891c5761fE74DC3474272eA7C52A9ae5F2",
        chain: MAINNET,
        registration: "open",
        // Safe の作成は最初の送金とまとめ、そのときのガス代で払ってもらう。
        relayer: { ...SHARED.relayer, feeBps: MAINNET_FEE_BPS, deploymentFeeWei: "0" },
    },
} as const satisfies Record<Environment, Config>
