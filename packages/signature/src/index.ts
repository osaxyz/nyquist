// RFC 9421 の HTTP Message Signatures のうち、nyquist が使う部分だけを実装する。
// 鍵は Ed25519、keyid は公開鍵 JWK の RFC 7638 サムプリント。Web Bot Auth と同じ形にそろえる。

import {
    parseDictionary,
    serializeByteSequence,
    serializeInnerList,
    type InnerList,
    type Parameters,
} from "structured-headers"

export const ALGORITHM = "ed25519"
export const TAG = "nyquist-agent"
export const LABEL = "sig1"

const DERIVED_COMPONENTS = ["@method", "@authority", "@path", "@query"] as const
const CONTENT_DIGEST = "content-digest"

export type PublicJwk = { kty: "OKP"; crv: "Ed25519"; x: string }

export type SignatureErrorCode = "required" | "invalid" | "expired" | "unknown-key"

export class SignatureError extends Error {
    override name = "SignatureError"
    readonly code: SignatureErrorCode

    constructor(code: SignatureErrorCode, message: string) {
        super(message)
        this.code = code
    }
}

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

function toBase64Url(bytes: Uint8Array): string {
    return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sha256(data: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", data))
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
    return diff === 0
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair
}

export async function exportPublicJwk(key: CryptoKey): Promise<PublicJwk> {
    const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
        throw new SignatureError("invalid", "Ed25519 の公開鍵ではありません")
    }
    return { kty: "OKP", crv: "Ed25519", x: jwk.x }
}

export async function importPublicJwk(jwk: PublicJwk): Promise<CryptoKey> {
    return crypto.subtle.importKey("jwk", { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, { name: "Ed25519" }, true, [
        "verify",
    ])
}

// RFC 7638。必須メンバーを辞書順に並べた JSON の SHA-256 を base64url にする。
export async function thumbprint(jwk: PublicJwk): Promise<string> {
    const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })
    return toBase64Url(await sha256(encoder.encode(canonical)))
}

// RFC 9530 の Content-Digest を sha-256 で作る。
export async function contentDigest(body: BufferSource): Promise<string> {
    return `sha-256=${serializeByteSequence(await sha256(body))}`
}

function componentValue(name: string, request: Request): string {
    const url = new URL(request.url)
    switch (name) {
        case "@method":
            return request.method.toUpperCase()
        case "@authority":
            return url.host.toLowerCase()
        case "@path":
            return url.pathname || "/"
        case "@query":
            return url.search || "?"
        default: {
            const value = request.headers.get(name)
            if (value === null) throw new SignatureError("invalid", `署名対象のヘッダー ${name} がありません`)
            return value.trim()
        }
    }
}

function signatureBase(request: Request, params: InnerList): string {
    const lines = params[0].map(([name]) => {
        if (typeof name !== "string") throw new SignatureError("invalid", "署名対象の名前が文字列ではありません")
        return `"${name}": ${componentValue(name, request)}`
    })
    lines.push(`"@signature-params": ${serializeInnerList(params)}`)
    return lines.join("\n")
}

async function readBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
    if (request.body === null) return new Uint8Array()
    return new Uint8Array(await request.clone().arrayBuffer())
}

export type SignOptions = {
    privateKey: CryptoKey
    keyid: string
    created?: number
    expiresIn?: number
    nonce?: string
}

export async function signRequest(request: Request, options: SignOptions): Promise<Request> {
    const body = await readBody(request)
    const headers = new Headers(request.headers)
    const components: string[] = [...DERIVED_COMPONENTS]
    if (body.length > 0) {
        headers.set(CONTENT_DIGEST, await contentDigest(body))
        components.push(CONTENT_DIGEST)
    }
    const created = options.created ?? Math.floor(Date.now() / 1000)
    const parameters: Parameters = new Map<string, string | number>([
        ["created", created],
        ["expires", created + (options.expiresIn ?? 60)],
        ["nonce", options.nonce ?? toBase64Url(crypto.getRandomValues(new Uint8Array(16)))],
        ["keyid", options.keyid],
        ["alg", ALGORITHM],
        ["tag", TAG],
    ])
    const params: InnerList = [components.map((name) => [name, new Map()]), parameters]
    const unsigned = new Request(request, { headers, ...(body.length > 0 ? { body } : {}) })
    const base = signatureBase(unsigned, params)
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", options.privateKey, encoder.encode(base)))
    headers.set("signature-input", `${LABEL}=${serializeInnerList(params)}`)
    headers.set("signature", `${LABEL}=${serializeByteSequence(signature)}`)
    return new Request(request, { headers, ...(body.length > 0 ? { body } : {}) })
}

export type VerifyOptions = {
    resolveKey: (keyid: string) => Promise<CryptoKey | null>
    maxAgeSeconds: number
    maxLifetimeSeconds: number
    clockSkewSeconds: number
    now?: number
}

export type Verified = {
    keyid: string
    nonce: string
    created: number
    expires: number
}

function parseField(request: Request, name: string) {
    const value = request.headers.get(name)
    if (value === null) throw new SignatureError("required", `${name} ヘッダーがありません`)
    try {
        return parseDictionary(value)
    } catch {
        throw new SignatureError("invalid", `${name} ヘッダーを解釈できません`)
    }
}

function integerParam(parameters: Parameters, name: string): number {
    const value = parameters.get(name)
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new SignatureError("invalid", `署名パラメータ ${name} がありません`)
    }
    return value
}

function stringParam(parameters: Parameters, name: string): string {
    const value = parameters.get(name)
    if (typeof value !== "string" || value.length === 0) {
        throw new SignatureError("invalid", `署名パラメータ ${name} がありません`)
    }
    return value
}

export async function verifyRequest(request: Request, options: VerifyOptions): Promise<Verified> {
    const inputs = parseField(request, "signature-input")
    const signatures = parseField(request, "signature")
    const input = inputs.get(LABEL)
    const signatureItem = signatures.get(LABEL)
    if (input === undefined || signatureItem === undefined) {
        throw new SignatureError("required", `ラベル ${LABEL} の署名がありません`)
    }
    if (!Array.isArray(input[0])) throw new SignatureError("invalid", "Signature-Input が内部リストではありません")
    const params = input as InnerList
    const signatureBytes = signatureItem[0]
    if (!(signatureBytes instanceof ArrayBuffer)) throw new SignatureError("invalid", "Signature がバイト列ではありません")

    const parameters = params[1]
    if (stringParam(parameters, "alg") !== ALGORITHM) throw new SignatureError("invalid", "alg は ed25519 のみ受け付けます")
    // 同じ鍵で別の用途に作った署名（Web Bot Auth など）を流用させないよう、tag で用途を限る。
    if (stringParam(parameters, "tag") !== TAG) throw new SignatureError("invalid", `tag は ${TAG} にしてください`)
    const keyid = stringParam(parameters, "keyid")
    const nonce = stringParam(parameters, "nonce")
    const created = integerParam(parameters, "created")
    const expires = integerParam(parameters, "expires")

    const now = options.now ?? Math.floor(Date.now() / 1000)
    if (expires <= created || expires - created > options.maxLifetimeSeconds) {
        throw new SignatureError("invalid", "署名の有効期間が長すぎるか不正です")
    }
    if (created > now + options.clockSkewSeconds) throw new SignatureError("invalid", "created が未来の時刻です")
    if (now - created > options.maxAgeSeconds || now > expires + options.clockSkewSeconds) {
        throw new SignatureError("expired", "署名の有効期限が切れています")
    }

    const covered = new Set(params[0].map(([name]) => name))
    for (const name of DERIVED_COMPONENTS) {
        if (!covered.has(name)) throw new SignatureError("invalid", `${name} が署名対象に含まれていません`)
    }
    const body = await readBody(request)
    if (body.length > 0) {
        if (!covered.has(CONTENT_DIGEST)) {
            throw new SignatureError("invalid", "content-digest が署名対象に含まれていません")
        }
        const digests = parseField(request, CONTENT_DIGEST)
        const digest = digests.get("sha-256")?.[0]
        if (!(digest instanceof ArrayBuffer) || !equalBytes(new Uint8Array(digest), await sha256(body))) {
            throw new SignatureError("invalid", "Content-Digest が本文と一致しません")
        }
    }

    const key = await options.resolveKey(keyid)
    if (key === null) throw new SignatureError("unknown-key", "keyid に対応する鍵が登録されていません")
    const base = signatureBase(request, params)
    const valid = await crypto.subtle.verify("Ed25519", key, signatureBytes, encoder.encode(base))
    if (!valid) throw new SignatureError("invalid", "署名を検証できません")
    return { keyid, nonce, created, expires }
}
