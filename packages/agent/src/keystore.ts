import { chmod, mkdir, open, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import type { Address } from "viem"
import { exportPublicJwk, generateKeyPair, thumbprint, type PublicJwk } from "@nyquist/signature"
import { WalletError } from "./errors"

// 鍵はこの端末の中だけに置く。nyquist のサーバーにも、MCP の応答にも出さない。
// secp256k1 の鍵は Safe の唯一のオーナーなので、失うと資金を動かせなくなる。

type KeyFile = {
    version: 1
    environment: string
    ed25519: JsonWebKey
    secp256k1: `0x${string}`
    registration: { agentId: string; safe: Address } | null
}

export type Keys = {
    agentId: string
    publicKey: PublicJwk
    signingKey: CryptoKey
    signer: PrivateKeyAccount
    registration: { agentId: string; safe: Address } | null
}

export class Keystore {
    readonly #path: string
    readonly #home: string
    readonly #environment: string

    constructor(home: string, environment: string) {
        this.#home = home
        this.#environment = environment
        this.#path = join(home, `agent.${environment}.json`)
    }

    get path(): string {
        return this.#path
    }

    async #read(): Promise<KeyFile | null> {
        try {
            return JSON.parse(await readFile(this.#path, "utf8")) as KeyFile
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
            throw error
        }
    }

    async #write(file: KeyFile, create: boolean): Promise<void> {
        await mkdir(this.#home, { recursive: true, mode: 0o700 })
        await chmod(this.#home, 0o700)
        const body = `${JSON.stringify(file, null, 2)}\n`
        if (create) {
            // 新規作成では既存のファイルを上書きしない。鍵を失わないため。
            await writeFile(this.#path, body, { mode: 0o600, flag: "wx" })
            await chmod(this.#path, 0o600)
            return
        }
        // 書き換えは一時ファイルに書いてから置き換える。途中で止まっても、元の鍵ファイルは壊れない。
        // 名前を推測されにくくし、前に止まったときの一時ファイルとも重ならないようにする。
        const temporary = `${this.#path}.${randomUUID()}.tmp`
        const handle = await open(temporary, "wx", 0o600)
        try {
            await handle.writeFile(body)
            await handle.sync()
        } finally {
            await handle.close()
        }
        await rename(temporary, this.#path)
    }

    async #keys(file: KeyFile): Promise<Keys> {
        const signingKey = await crypto.subtle.importKey("jwk", file.ed25519, { name: "Ed25519" }, false, ["sign"])
        const { d: _private, ...publicPart } = file.ed25519
        const publicKey = await exportPublicJwk(
            await crypto.subtle.importKey("jwk", { ...publicPart, key_ops: ["verify"] }, { name: "Ed25519" }, true, ["verify"]),
        )
        return {
            agentId: await thumbprint(publicKey),
            publicKey,
            signingKey,
            signer: privateKeyToAccount(file.secp256k1),
            registration: file.registration,
        }
    }

    async load(): Promise<Keys | null> {
        const file = await this.#read()
        return file ? this.#keys(file) : null
    }

    // 鍵がなければ作る。あればそのまま返す。
    async loadOrCreate(): Promise<{ keys: Keys; created: boolean }> {
        const existing = await this.#read()
        if (existing) return { keys: await this.#keys(existing), created: false }
        const pair = await generateKeyPair()
        const file: KeyFile = {
            version: 1,
            environment: this.#environment,
            ed25519: (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey,
            secp256k1: generatePrivateKey(),
            registration: null,
        }
        await this.#write(file, true)
        return { keys: await this.#keys(file), created: true }
    }

    async saveRegistration(registration: { agentId: string; safe: Address }): Promise<void> {
        const file = await this.#read()
        if (!file) throw new WalletError("鍵ファイルがありません")
        await this.#write({ ...file, registration }, false)
    }
}
