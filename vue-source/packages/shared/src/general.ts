

export const EMPTY_OBJ: { readonly [key: string]: any } = {}
export const NOOP = (): void => {}

export const objectToString: typeof Object.prototype.toString =
    Object.prototype.toString

export const toTypeString = (value: unknown): string =>
    objectToString.call(value)

export const toRawType = (value: unknown): string => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1)
}


export const isPlainObject = (val: unknown): val is object =>
    toTypeString(val) === '[object Object]'

export const remove = <T>(arr: T[], el: T): void => {
    const i = arr.indexOf(el)
    if (i > -1) {
        arr.splice(i, 1)
    }
}

export const isArray: typeof Array.isArray = Array.isArray
export const isMap = (val: unknown): val is Map<any, any> =>
    toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> =>
    toTypeString(val) === '[object Set]'

export const isDate = (val: unknown): val is Date =>
    toTypeString(val) === '[object Date]'
export const isRegExp = (val: unknown): val is RegExp =>
    toTypeString(val) === '[object RegExp]'
export const isFunction = (val: unknown): val is Function =>
    typeof val === 'function'
export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (val: unknown): val is Record<any, any> =>
    val !== null && typeof val === 'object'


export const def = (
    obj: object,
    key: string | symbol,
    value: any,
    writable = false,
): void => {
    Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: false,
        writable,
        value,
    })
}

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
    const cache: Record<string, string> = Object.create(null)
    return ((str: string) => {
        const hit = cache[str]
        return hit || (cache[str] = fn(str))
    }) as T
}
export const extend: typeof Object.assign = Object.assign

/**
 * @private
 */
export const capitalize: <T extends string>(str: T) => Capitalize<T> =
    cacheStringFunction(<T extends string>(str: T) => {
        return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>
    })

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
    val: object,
    key: string | symbol,
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isIntegerKey = (key: unknown): boolean =>
    isString(key) &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key


// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean =>
    !Object.is(value, oldValue)
