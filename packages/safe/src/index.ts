// Safe v1.4.1 の tx ハッシュ計算とエンコード。
// エージェントはサーバーから渡されたハッシュを信じず、ここで自分で計算して署名する。

import {
    concatHex,
    decodeFunctionResult,
    encodeAbiParameters,
    encodeFunctionData,
    getAddress,
    getContractAddress,
    hashTypedData,
    keccak256,
    toBytes,
    toEventSelector,
    zeroAddress,
    type Address,
    type Hex,
} from "viem"

export const SAFE_ABI = [
    {
        type: "function",
        name: "setup",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_owners", type: "address[]" },
            { name: "_threshold", type: "uint256" },
            { name: "to", type: "address" },
            { name: "data", type: "bytes" },
            { name: "fallbackHandler", type: "address" },
            { name: "paymentToken", type: "address" },
            { name: "payment", type: "uint256" },
            { name: "paymentReceiver", type: "address" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "execTransaction",
        stateMutability: "payable",
        inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
            { name: "operation", type: "uint8" },
            { name: "safeTxGas", type: "uint256" },
            { name: "baseGas", type: "uint256" },
            { name: "gasPrice", type: "uint256" },
            { name: "gasToken", type: "address" },
            { name: "refundReceiver", type: "address" },
            { name: "signatures", type: "bytes" },
        ],
        outputs: [{ name: "success", type: "bool" }],
    },
    {
        type: "function",
        name: "addOwnerWithThreshold",
        stateMutability: "nonpayable",
        inputs: [
            { name: "owner", type: "address" },
            { name: "_threshold", type: "uint256" },
        ],
        outputs: [],
    },
    { type: "event", name: "ExecutionSuccess", inputs: [{ name: "txHash", type: "bytes32" }, { name: "payment", type: "uint256" }] },
    { type: "event", name: "ExecutionFailure", inputs: [{ name: "txHash", type: "bytes32" }, { name: "payment", type: "uint256" }] },
    {
        type: "function",
        name: "nonce",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "getOwners",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        type: "function",
        name: "getModulesPaginated",
        stateMutability: "view",
        inputs: [
            { name: "start", type: "address" },
            { name: "pageSize", type: "uint256" },
        ],
        outputs: [
            { name: "array", type: "address[]" },
            { name: "next", type: "address" },
        ],
    },
    {
        type: "function",
        name: "getThreshold",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        type: "function",
        name: "getTransactionHash",
        stateMutability: "view",
        inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
            { name: "operation", type: "uint8" },
            { name: "safeTxGas", type: "uint256" },
            { name: "baseGas", type: "uint256" },
            { name: "gasPrice", type: "uint256" },
            { name: "gasToken", type: "address" },
            { name: "refundReceiver", type: "address" },
            { name: "_nonce", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bytes32" }],
    },
] as const

export const PROXY_FACTORY_ABI = [
    {
        type: "function",
        name: "createProxyWithNonce",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_singleton", type: "address" },
            { name: "initializer", type: "bytes" },
            { name: "saltNonce", type: "uint256" },
        ],
        outputs: [{ name: "proxy", type: "address" }],
    },
] as const

// nyquist が中継する SafeTx。delegatecall は中継しないので operation は常に 0。
// gasPrice、baseGas、refundReceiver は、リレイヤーが立て替えたガス代を Safe から払い戻すのに使う。
export type SafeTransaction = {
    to: Address
    value: bigint
    data: Hex
    safeTxGas: bigint
    baseGas: bigint
    gasPrice: bigint
    gasToken: Address
    refundReceiver: Address
    nonce: bigint
}

const SAFE_TX_TYPES = {
    SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
    ],
} as const

export function safeTypedData(chainId: number, safe: Address, tx: SafeTransaction) {
    return {
        domain: { chainId, verifyingContract: safe },
        types: SAFE_TX_TYPES,
        primaryType: "SafeTx" as const,
        message: {
            to: tx.to,
            value: tx.value,
            data: tx.data,
            operation: 0,
            safeTxGas: tx.safeTxGas,
            baseGas: tx.baseGas,
            gasPrice: tx.gasPrice,
            gasToken: tx.gasToken,
            refundReceiver: tx.refundReceiver,
            nonce: tx.nonce,
        },
    }
}

export function safeTxHash(chainId: number, safe: Address, tx: SafeTransaction): Hex {
    return hashTypedData(safeTypedData(chainId, safe, tx))
}

export type OwnerSignature = { signer: Address; signature: Hex }

// Safe は署名をオーナーのアドレスの昇順で並べることを要求する。
// v が 27 か 28 の65バイト署名は、tx ハッシュへの ECDSA 署名として検証される。
export function packSignatures(signatures: OwnerSignature[]): Hex {
    const sorted = [...signatures].sort((a, b) => {
        const left = BigInt(getAddress(a.signer))
        const right = BigInt(getAddress(b.signer))
        return left < right ? -1 : left > right ? 1 : 0
    })
    for (const { signature } of sorted) {
        if (toBytes(signature).length !== 65) throw new Error("署名は65バイトである必要があります")
    }
    return concatHex(sorted.map(({ signature }) => signature))
}

export function encodeExecTransaction(tx: SafeTransaction, signatures: Hex): Hex {
    return encodeFunctionData({
        abi: SAFE_ABI,
        functionName: "execTransaction",
        args: [
            tx.to,
            tx.value,
            tx.data,
            0,
            tx.safeTxGas,
            tx.baseGas,
            tx.gasPrice,
            tx.gasToken,
            tx.refundReceiver,
            signatures,
        ],
    })
}

export type SetupPayment = { amount: bigint; receiver: Address }

// payment を指定すると、Safe は作成時に自分の残高から receiver に ETH を払う。
export function encodeSetup(
    owners: Address[],
    threshold: number,
    fallbackHandler: Address,
    payment: SetupPayment = { amount: 0n, receiver: zeroAddress },
): Hex {
    return encodeFunctionData({
        abi: SAFE_ABI,
        functionName: "setup",
        args: [owners, BigInt(threshold), zeroAddress, "0x", fallbackHandler, zeroAddress, payment.amount, payment.receiver],
    })
}

export function encodeAddOwner(owner: Address, threshold: number): Hex {
    return encodeFunctionData({
        abi: SAFE_ABI,
        functionName: "addOwnerWithThreshold",
        args: [owner, BigInt(threshold)],
    })
}

// Safe v1.4.1 がガードのアドレスを置くストレージの位置。keccak256("guard_manager.guard.address")。
// ガードは execTransaction の前後に任意の処理を差し込めるので、中継する前に空であることを確かめる。
export const GUARD_STORAGE_SLOT = keccak256(toBytes("guard_manager.guard.address"))

// モジュールの一覧の先頭を表す値。
export const SENTINEL_MODULES: Address = "0x0000000000000000000000000000000000000001"


// EIP-2028 の calldata のガス。0 のバイトは 4、それ以外は 16。
export function calldataGas(data: Hex): bigint {
    let gas = 0n
    for (const byte of toBytes(data)) gas += byte === 0 ? 4n : 16n
    return gas
}

// EIP-7623（Pectra）の calldata の下限。calldata の多い tx は、実行したガスに関わらず
// 21000 + 10 × トークン数（0 のバイトは 1、それ以外は 4）を払う。
export function calldataFloorGas(data: Hex): bigint {
    let tokens = 0n
    for (const byte of toBytes(data)) tokens += byte === 0 ? 1n : 4n
    return 21_000n + 10n * tokens
}

export type ExecutionResult = "success" | "failed" | "unknown"

// Safe は内部の呼び出しが失敗しても、払い戻しがあれば tx 自体は成功させる。
// 結果は ExecutionSuccess と ExecutionFailure のイベントで判定する。
export function executionResult(safe: Address, logs: readonly { address: Address; topics: readonly Hex[] }[]): ExecutionResult {
    for (const log of logs) {
        if (log.address.toLowerCase() !== safe.toLowerCase()) continue
        if (log.topics[0] === EXECUTION_SUCCESS) return "success"
        if (log.topics[0] === EXECUTION_FAILURE) return "failed"
    }
    return "unknown"
}

export const EXECUTION_SUCCESS = toEventSelector("ExecutionSuccess(bytes32,uint256)")
export const EXECUTION_FAILURE = toEventSelector("ExecutionFailure(bytes32,uint256)")

export function encodeCreateProxy(singleton: Address, initializer: Hex, saltNonce: bigint): Hex {
    return encodeFunctionData({
        abi: PROXY_FACTORY_ABI,
        functionName: "createProxyWithNonce",
        args: [singleton, initializer, saltNonce],
    })
}

// Multicall3。どのチェーンでも同じアドレスにある。https://github.com/mds1/multicall3
// Safe の作成と最初の送金を1つの tx にまとめるのに使う。どちらかが失敗すれば、両方とも取り消される。
export const MULTICALL3_ADDRESS: Address = "0xcA11bde05977b3631167028862bE2a173976CA11"

const MULTICALL3_ABI = [
    {
        type: "function",
        name: "aggregate3",
        stateMutability: "payable",
        inputs: [
            {
                name: "calls",
                type: "tuple[]",
                components: [
                    { name: "target", type: "address" },
                    { name: "allowFailure", type: "bool" },
                    { name: "callData", type: "bytes" },
                ],
            },
        ],
        outputs: [
            {
                name: "returnData",
                type: "tuple[]",
                components: [
                    { name: "success", type: "bool" },
                    { name: "returnData", type: "bytes" },
                ],
            },
        ],
    },
] as const

// 呼び出しを順に実行し、1つでも失敗すれば全体を revert させる。
export function encodeAggregate(calls: { target: Address; callData: Hex }[]): Hex {
    return encodeFunctionData({
        abi: MULTICALL3_ABI,
        functionName: "aggregate3",
        args: [calls.map((call) => ({ ...call, allowFailure: false }))],
    })
}

export function decodeCreateProxy(data: Hex): Address {
    return decodeFunctionResult({ abi: PROXY_FACTORY_ABI, functionName: "createProxyWithNonce", data })
}

export function encodeNonce(): Hex {
    return encodeFunctionData({ abi: SAFE_ABI, functionName: "nonce" })
}

export function decodeNonce(data: Hex): bigint {
    return decodeFunctionResult({ abi: SAFE_ABI, functionName: "nonce", data })
}

// SafeProxyFactory v1.4.1 の proxyCreationCode()。factory から読んだ値で、どのチェーンでも同じ。
// Safe のアドレスを RPC に頼らず手元で計算するために使う。
export const PROXY_CREATION_CODE: Hex =
    "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564"

// createProxyWithNonce が CREATE2 で作る Safe のアドレスを手元で計算する。
// salt は keccak256(keccak256(initializer), saltNonce)、コードは proxyCreationCode と singleton をつなげたもの。
export function predictSafeAddress(proxyFactory: Address, singleton: Address, initializer: Hex, nonce: bigint): Address {
    return getContractAddress({
        opcode: "CREATE2",
        from: proxyFactory,
        salt: keccak256(concatHex([keccak256(initializer), encodeAbiParameters([{ type: "uint256" }], [nonce])])),
        bytecode: concatHex([PROXY_CREATION_CODE, encodeAbiParameters([{ type: "address" }], [singleton])]),
    })
}

// 同じエージェントからは常に同じ Safe のアドレスが導かれるよう、keyid から salt を作る。
export function saltNonce(seed: string): bigint {
    return BigInt(keccak256(toBytes(seed)))
}
