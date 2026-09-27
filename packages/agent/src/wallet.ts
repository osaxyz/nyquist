import {
    createPublicClient,
    defineChain,
    getAddress,
    http,
    isAddress,
    isAddressEqual,
    zeroAddress,
    type Address,
    type Hex,
} from "viem"
import {
    SAFE_ABI,
    calldataFloorGas,
    calldataGas,
    encodeAddOwner,
    encodeExecTransaction,
    encodeSetup,
    predictSafeAddress,
    safeTxHash,
    safeTypedData,
    saltNonce,
    type SafeTransaction,
} from "@nyquist/safe"
import { signRequest } from "@nyquist/signature"
import { WalletError } from "./errors"
import type { Keys, Keystore } from "./keystore"
import type { Settings } from "./settings"

const CHAIN_BASE = { nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }

export type Agent = {
    id: string
    accountId: string | null
    status: "active" | "suspended"
    signer: Address
    safe: Address
    owners: Address[]
    threshold: number
    recoveryOwner: Address | null
    deployed: boolean
    balanceWei: string
    nonce: string
    deploymentFeeWei: string
    createdAt: string
}

type Quote = {
    safe: Address
    chainId: number
    nonce: string
    safeTxGas: string
    baseGas: string
    gasPrice: string
    gasToken: Address
    refundReceiver: Address
    safeTxHash: Hex
    maxFeeWei: string
}

export type TransactionResult = { hash: Hex; safeTxHash: Hex; status: "pending" | "success" | "failed" | "reverted" | "dropped" }

// サーバーの応答は、形を確かめてから使う。形の違う値や余計な項目を、そのままエージェントに渡さない。
const HASH = /^0x[0-9a-fA-F]{64}$/
const DECIMAL = /^(0|[1-9][0-9]{0,77})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const STATUSES = ["pending", "success", "failed", "reverted", "dropped"] as const

function malformed(): never {
    throw new WalletError("nyquist の応答の形が正しくありません")
}

function address(value: unknown): Address {
    if (typeof value !== "string" || !isAddress(value, { strict: false })) malformed()
    return getAddress(value)
}

function decimal(value: unknown): string {
    if (typeof value !== "string" || !DECIMAL.test(value)) malformed()
    return value
}

function hash(value: unknown): Hex {
    if (typeof value !== "string" || !HASH.test(value)) malformed()
    return value.toLowerCase() as Hex
}

function parseAgent(json: unknown): Agent {
    if (typeof json !== "object" || json === null) malformed()
    const value = json as Record<string, unknown>
    if (typeof value.id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.id)) malformed()
    if (value.accountId !== null && (typeof value.accountId !== "string" || !UUID.test(value.accountId))) malformed()
    if (value.status !== "active" && value.status !== "suspended") malformed()
    if (!Array.isArray(value.owners) || typeof value.threshold !== "number" || !Number.isInteger(value.threshold)) malformed()
    if (typeof value.deployed !== "boolean" || typeof value.createdAt !== "string") malformed()
    return {
        id: value.id,
        accountId: value.accountId,
        status: value.status,
        signer: address(value.signer),
        safe: address(value.safe),
        owners: value.owners.map(address),
        threshold: value.threshold,
        recoveryOwner: value.recoveryOwner === null ? null : address(value.recoveryOwner),
        deployed: value.deployed,
        balanceWei: decimal(value.balanceWei),
        nonce: decimal(value.nonce),
        deploymentFeeWei: decimal(value.deploymentFeeWei),
        createdAt: Number.isNaN(Date.parse(value.createdAt)) ? malformed() : new Date(value.createdAt).toISOString(),
    }
}

function parseQuote(json: unknown): Quote {
    if (typeof json !== "object" || json === null) malformed()
    const value = json as Record<string, unknown>
    if (typeof value.chainId !== "number") malformed()
    return {
        safe: address(value.safe),
        chainId: value.chainId,
        nonce: decimal(value.nonce),
        safeTxGas: decimal(value.safeTxGas),
        baseGas: decimal(value.baseGas),
        gasPrice: decimal(value.gasPrice),
        gasToken: address(value.gasToken),
        refundReceiver: address(value.refundReceiver),
        safeTxHash: hash(value.safeTxHash),
        maxFeeWei: decimal(value.maxFeeWei),
    }
}

function parseTransaction(json: unknown): TransactionResult {
    if (typeof json !== "object" || json === null) malformed()
    const value = json as Record<string, unknown>
    const status = STATUSES.find((candidate) => candidate === value.status) ?? malformed()
    return { hash: hash(value.hash), safeTxHash: hash(value.safeTxHash), status }
}

export class ApiError extends Error {
    override name = "ApiError"
    readonly status: number
    // problem+json の type の末尾。例: safe-not-funded
    readonly problem: string | undefined

    // サーバーの本文（detail）はエージェントの文脈にそのまま流れるので、ここでは持たない。
    // 乗っ取られたサーバーが「0x… に送金して」のような指示を書けてしまうため。
    constructor(status: number, body: { type?: string }) {
        // type は …/PROBLEM.md#safe-not-funded の形。# のあとを種類として読み、形が違えば捨てる。
        const slug = typeof body.type === "string" ? body.type.split("#").pop() : undefined
        const problem = slug && /^[a-z-]{1,40}$/.test(slug) ? slug : undefined
        super(`HTTP ${status}${problem ? ` ${problem}` : ""}`)
        this.status = status
        this.problem = problem
    }
}

// 見積もりが信頼できないときは、署名する前にこの例外で止める。
export class QuoteRejected extends Error {
    override name = "QuoteRejected"
}

export type Call = { to: Address; value: bigint; data: Hex }

export class Wallet {
    readonly #settings: Settings
    readonly #keystore: Keystore

    constructor(settings: Settings, keystore: Keystore) {
        this.#settings = settings
        this.#keystore = keystore
    }

    async #request<T>(keys: Keys, method: string, path: string, body?: unknown): Promise<T> {
        const request = new Request(`${this.#settings.apiUrl}${path}`, {
            method,
            headers: body === undefined ? {} : { "content-type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const signed = await signRequest(request, { privateKey: keys.signingKey, keyid: keys.agentId })
        const response = await fetch(signed)
        const text = await response.text()
        const json = text ? (JSON.parse(text) as unknown) : null
        if (!response.ok) throw new ApiError(response.status, (json ?? {}) as { type?: string })
        return json as T
    }

    #client() {
        const { config, rpcUrl } = this.#settings
        return createPublicClient({
            chain: defineChain({ ...CHAIN_BASE, id: config.chain.id, name: config.chain.name, rpcUrls: { default: { http: [rpcUrl] } } }),
            transport: http(rpcUrl),
        })
    }

    // 自分の signer だけをオーナーにした Safe のアドレスを、サーバーに頼らず計算する。
    // Safe の作成費用はリレイヤーに払うので、そのアドレスと額も初期化の内容に入る。
    #expectedSafe(keys: Keys): Address {
        const { config } = this.#settings
        const initializer = encodeSetup([keys.signer.address], 1, config.safe.fallbackHandler, {
            amount: BigInt(config.relayer.deploymentFeeWei),
            receiver: config.relayerAddress,
        })
        return predictSafeAddress(config.safe.proxyFactory, config.safe.singleton, initializer, saltNonce(keys.agentId))
    }

    async #keys(): Promise<Keys> {
        const keys = await this.#keystore.load()
        if (!keys?.registration) throw new WalletError("ウォレットがまだありません。先に nyquist_setup を呼んでください")
        return keys
    }

    // 鍵がなければ作り、未登録なら登録する。何度呼んでも同じウォレットを返す。
    async setup(enrollment?: string): Promise<{ agent: Agent; created: boolean }> {
        const { keys, created } = await this.#keystore.loadOrCreate()
        const expected = this.#expectedSafe(keys)
        if (keys.registration) {
            if (!isAddressEqual(keys.registration.safe, expected)) {
                throw new QuoteRejected(`保存されている Safe ${keys.registration.safe} が、この鍵から計算した ${expected} と一致しません`)
            }
            return { agent: await this.info(), created: false }
        }
        let agent: Agent
        try {
            agent = parseAgent(
                await this.#request<unknown>(keys, "POST", "/api/v1/agent", {
                    publicKey: keys.publicKey,
                    signer: keys.signer.address,
                    ...(enrollment ? { enrollment } : {}),
                }),
            )
        } catch (error) {
            // 登録は済んだのに、鍵ファイルへの記録の前に止まっていた場合。同じ確かめ方をしてから記録し直す。
            if (!(error instanceof ApiError) || error.problem !== "agent-exists") throw error
            agent = parseAgent(await this.#request<unknown>(keys, "GET", "/api/v1/agent"))
        }
        // 返ってきた Safe が自分の鍵だけをオーナーにしているかを、アドレスを手元で計算して確かめてから保存する。
        // id や signer はサーバーの申告なので、それだけでは Safe がすり替えられていないことの証明にならない。
        if (agent.id !== keys.agentId || !isAddressEqual(agent.signer, keys.signer.address) || agent.threshold !== 1) {
            throw new QuoteRejected("登録の応答がこの鍵と一致しません")
        }
        if (!isAddressEqual(agent.safe, expected)) {
            throw new QuoteRejected(`サーバーが返した Safe が、この鍵から計算した ${expected} と一致しません`)
        }
        if (agent.deploymentFeeWei !== this.#settings.config.relayer.deploymentFeeWei) {
            throw new QuoteRejected("Safe の作成費用が公開されている値と違います")
        }
        await this.#keystore.saveRegistration({ agentId: agent.id, safe: agent.safe })
        return { agent, created }
    }

    async info(): Promise<Agent> {
        const keys = await this.#keys()
        return parseAgent(await this.#request<unknown>(keys, "GET", "/api/v1/agent"))
    }

    async claim(): Promise<{ code: string; expiresAt: string }> {
        return this.#request(await this.#keys(), "POST", "/api/v1/agent/claim")
    }

    async transaction(hash: Hex): Promise<TransactionResult> {
        return parseTransaction(await this.#request<unknown>(await this.#keys(), "GET", `/api/v1/transaction/${hash}`))
    }

    // 見積もりを受け取り、手元で検証してから署名して送る。
    // Safe 自身への呼び出しは、オーナーやモジュールを書き換えて Safe を明け渡せるので受け付けない。
    async send(call: Call): Promise<TransactionResult & { feeLimitWei: string }> {
        const keys = await this.#keys()
        if (isAddressEqual(call.to, keys.registration!.safe)) {
            throw new WalletError("Safe 自身は宛先にできません")
        }
        return this.#send(keys, call)
    }

    async #send(keys: Keys, call: Call): Promise<TransactionResult & { feeLimitWei: string }> {
        const safe = keys.registration!.safe
        const quote = parseQuote(await this.#request<unknown>(keys, "POST", "/api/v1/transaction/quote", {
            to: call.to,
            value: call.value.toString(),
            data: call.data,
        }))
        const tx = await this.#verify(quote, safe, call)
        const signature = await keys.signer.signTypedData(safeTypedData(this.#settings.config.chain.id, safe, tx))
        const result = parseTransaction(await this.#request<unknown>(keys, "POST", "/api/v1/transaction", {
            to: tx.to,
            value: tx.value.toString(),
            data: tx.data,
            nonce: tx.nonce.toString(),
            safeTxGas: tx.safeTxGas.toString(),
            baseGas: tx.baseGas.toString(),
            gasPrice: tx.gasPrice.toString(),
            signature,
        }))
        return { ...result, feeLimitWei: ((tx.safeTxGas + tx.baseGas) * tx.gasPrice).toString() }
    }

    // 引き取ったアカウントの owner を、Safe の復旧用オーナーに加える。
    // 加える相手は、人間から直接受け取ったアドレス（expected）で決める。サーバーの申告だけで決めると、
    // 乗っ取られたサーバーが自分のアドレスを返して Safe のオーナーに入り込める。
    async addRecoveryOwner(expected: Address): Promise<TransactionResult & { owner: Address }> {
        const keys = await this.#keys()
        const safe = keys.registration!.safe
        const owner = getAddress(expected)
        const agent = await this.info()
        if (!agent.recoveryOwner || !isAddressEqual(agent.recoveryOwner, owner)) {
            throw new WalletError("人間から受け取ったアドレスが、nyquist に登録された復旧用オーナーと一致しません")
        }
        const owners = await this.#owners(safe)
        if (owners.some((address) => isAddressEqual(address, owner))) {
            throw new WalletError(`${owner} はすでに Safe のオーナーです`)
        }
        const result = await this.#send(keys, { to: safe, value: 0n, data: encodeAddOwner(owner, 1) })
        return { ...result, owner }
    }

    // Safe のオーナーをチェーンから読む。作成前は自分の signer だけ。
    async #owners(safe: Address): Promise<readonly Address[]> {
        const client = this.#client()
        const code = await client.getCode({ address: safe })
        if (code === undefined || code === "0x") return []
        return client.readContract({ address: safe, abi: SAFE_ABI, functionName: "getOwners" })
    }

    // サーバーを信じきらず、署名する内容を手元で組み立てて確かめる。
    async #verify(quote: Quote, safe: Address, call: Call): Promise<SafeTransaction> {
        const { config, maxFeeWei } = this.#settings
        if (quote.chainId !== config.chain.id) throw new QuoteRejected(`chainId が ${config.chain.id} ではありません`)
        if (!isAddressEqual(quote.safe, safe)) throw new QuoteRejected("見積もりの Safe が登録時の Safe と違います")
        if (!isAddressEqual(quote.gasToken, zeroAddress)) throw new QuoteRejected("ガス代は ETH 以外で払えません")
        // 払い戻し先は、公開されているリレイヤーのアドレスに限る。
        if (!isAddressEqual(quote.refundReceiver, config.relayerAddress)) {
            throw new QuoteRejected("払い戻し先が nyquist のリレイヤーではありません")
        }


        const tx: SafeTransaction = {
            to: call.to,
            value: call.value,
            data: call.data,
            safeTxGas: BigInt(quote.safeTxGas),
            baseGas: BigInt(quote.baseGas),
            gasPrice: BigInt(quote.gasPrice),
            gasToken: zeroAddress,
            refundReceiver: getAddress(quote.refundReceiver),
            nonce: BigInt(quote.nonce),
        }
        if (safeTxHash(config.chain.id, safe, tx) !== quote.safeTxHash) {
            throw new QuoteRejected("SafeTx のハッシュが手元の計算と一致しません")
        }

        // baseGas と safeTxGas が、nyquist の公開している計算式の範囲に収まっているか。
        // calldata の多い tx は EIP-7623 の下限で払うので、その場合は下限を基準にする。
        const calldata = encodeExecTransaction({ ...tx, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n }, `0x${"ff".repeat(65)}`)
        const intrinsic = 21_000n + calldataGas(calldata)
        const floor = calldataFloorGas(calldata)
        const overhead = BigInt(config.relayer.baseGasOverhead) + BigInt(config.relayer.firstExecutionGas)
        const baseGasLimit = (intrinsic > floor ? intrinsic : floor) + overhead * 2n
        if (tx.baseGas > baseGasLimit) throw new QuoteRejected(`baseGas が大きすぎます。上限は ${baseGasLimit} です`)
        if (tx.safeTxGas > BigInt(config.relayer.gasLimitCap)) throw new QuoteRejected("safeTxGas が大きすぎます")

        const client = this.#client()
        // nonce をチェーンの値に固定する。サーバーが nonce を進めて見積もり直すと、
        // 1回の依頼に2つの署名を集めて両方実行できてしまう。
        const code = await client.getCode({ address: safe })
        const deployed = code !== undefined && code !== "0x"
        const onchainNonce = deployed ? await client.readContract({ address: safe, abi: SAFE_ABI, functionName: "nonce" }) : 0n
        if (tx.nonce !== onchainNonce) throw new QuoteRejected(`見積もりの nonce が Safe の nonce ${onchainNonce} と違います`)

        // safeTxGas が小さすぎると、Safe 内の呼び出しだけが失敗し、払い戻しは払わされる。
        // 自分でも Safe から呼んだものとして見積もり、それ以上であることを確かめる。
        let needed: bigint
        try {
            needed = await client.estimateGas({ account: safe, to: call.to, value: call.value, data: call.data })
        } catch {
            throw new QuoteRejected("Safe から呼び出すと revert します。宛先、金額、Safe の残高を確認してください")
        }
        if (tx.safeTxGas < needed) throw new QuoteRejected(`safeTxGas が小さすぎます。${needed} 以上が必要です`)

        // gasPrice を、自分で取得した現在のガス代と比べる。
        const { maxFeePerGas } = await client.estimateFeesPerGas()
        const priceLimit = maxFeePerGas * BigInt(config.relayer.gasPriceMultiplier + 1)
        if (tx.gasPrice > priceLimit) throw new QuoteRejected("gasPrice が現在のガス代に比べて高すぎます")

        const fee = (tx.safeTxGas + tx.baseGas) * tx.gasPrice
        if (fee > maxFeeWei) {
            throw new QuoteRejected(`払い戻しの上限 ${fee} wei が、NYQUIST_MAX_FEE_WEI の ${maxFeeWei} wei を超えます`)
        }
        return tx
    }
}
