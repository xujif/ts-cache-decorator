import { RedisClient } from 'redis';

export interface CacheStore {
    forever (key: string, value: any): Promise<void>
    set (key: string, ttl: number, value: any): Promise<void>
    get<T>(key: string): Promise<T | undefined>
    delete (key: string): Promise<boolean>
    has (key: string): Promise<boolean>
}

export interface CachePayload {
    data: any,
    expireAt: number
}

export class RedisCacheStore implements CacheStore {
    constructor(protected redis: RedisClient) {

    }

    async forever (key: string, value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.redis.set(key, JSON.stringify(value), (err, replay) => {
                if (err) {
                    reject(err)
                }
                else {
                    resolve()
                }
            })
        })
    }

    async set (key: string, ttl: number, value: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.redis.set(key, JSON.stringify(value), 'EX', ttl, (err, replay) => {
                if (err) {
                    reject(err)
                }
                else {
                    resolve()
                }
            })
        })
    }
    async get<T>(key: string): Promise<T | undefined> {
        return new Promise<T>((resolve, reject) => {
            this.redis.get(key, (err, reply) => {
                if (err) {
                    return reject(err)
                }
                resolve(JSON.parse(reply))
            })
        })
    }
    async delete (key: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.redis.del(key, (err, reply) => {
                if (err) {
                    return reject(err)
                }
                resolve(true)
            })
        })
    }
    async has (key: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.redis.exists(key, (err, reply) => {
                if (err) {
                    return reject(err)
                }
                resolve(Boolean(reply))
            })
        })
    }
}
export class MemoryCacheStore implements CacheStore {
    protected cache = new Map<string, CachePayload>()

    async forever (key: string, value: any): Promise<void> {
        this.cache.set(key, {
            expireAt: 0,
            data: value
        })
    }

    async set (key: string, ttl: number, value: any): Promise<void> {
        this.cache.set(key, {
            expireAt: this.getTimestamp() + ttl,
            data: value
        })
    }

    async get<T>(key: string): Promise<T | undefined> {
        if (this.cache.has(key)) {
            const payload = this.cache.get(key)!
            if (payload.expireAt < this.getTimestamp()) {
                this.cache.delete(key)
                return
            }
            return payload.data
        } else {
            return
        }
    }

    async delete (key: string): Promise<boolean> {
        return this.cache.delete(key)
    }

    async has (key: string): Promise<boolean> {
        const payload = this.cache.get(key)
        if (!payload) {
            return false
        }
        if (payload.expireAt > 0 && payload.expireAt < this.getTimestamp()) {
            this.cache.delete(key)
            return false
        }
        return true
    }

    protected getTimestamp () {
        return (new Date).getTime() / 1000
    }
}

export let cacheStore: CacheStore = new MemoryCacheStore()

const ID_SYMBOL = Symbol('__OJBECT_ID__')
let OBJECT_ID = 1

export function setDefaultStore (store: CacheStore) {
    cacheStore = store
}

export interface MemoizeOption {
    ttl: number
    key?: (objId: string, methodName: string, args: any[]) => string
}
export function CacheMethod (opt: MemoizeOption, store?: CacheStore) {
    return function (target: Object, method: string, descriptor: TypedPropertyDescriptor<any>) {
        const usedCacheStore = store || cacheStore
        if (!descriptor.value) {
            throw new Error('decorator only support method')
        }
        const orginMethod = descriptor.value
        descriptor.value = async function (this: any, ...args: any[]) {
            if (!this[ID_SYMBOL]) {
                this[ID_SYMBOL] = OBJECT_ID++
            }
            const objId = this[ID_SYMBOL]
            const cacheKey = opt.key ? opt.key.call(this, objId, method, args) : `cache#{ojb_${objId}}#${method}#${JSON.stringify(args)}`
            if (await usedCacheStore.has(cacheKey)) {
                return usedCacheStore.get(cacheKey)
            }
            let value = await orginMethod.apply(this, args)
            await usedCacheStore.set(cacheKey, opt.ttl, value)
            return value
        }
    };
}

