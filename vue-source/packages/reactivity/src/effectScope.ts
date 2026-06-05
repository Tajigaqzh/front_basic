import {ReactiveEffect} from "./effect";

export let activeEffectScope: EffectScope | undefined
export class EffectScope {
    /**
     * @internal
     */
    private _active = true
    /**
     * @internal 记录 `on()` 调用层数，允许嵌套或重复开启。
     */
    private _on = 0
    /**
     * @internal
     */
    effects: ReactiveEffect[] = []
    /**
     * @internal
     */
    cleanups: (() => void)[] = []

    private _isPaused = false
    private _warnOnRun = true

    /**
     * 只会在非 detached 作用域上赋值的父作用域引用。
     * @internal
     */
    parent: EffectScope | undefined
    /**
     * 记录当前作用域下挂着的非 detached 子作用域。
     * @internal
     */
    scopes: EffectScope[] | undefined
    /**
     * 记录当前子作用域在父作用域 `scopes` 数组中的下标，
     * 以便后续 O(1) 移除。
     * @internal
     */
    private index: number | undefined

    readonly __v_skip = true
    // TODO isolatedDeclarations ReactiveFlags.SKIP

    constructor(public detached = false) {
        if (!detached && activeEffectScope) {
            if (activeEffectScope.active) {
                this.parent = activeEffectScope
                this.index =
                    (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
                        this,
                    ) - 1
            } else {
                // 父作用域已经停止时，这个子作用域不能再变成一个“活着的 detached 作用域”。
                this._active = false
                this._warnOnRun = false
            }
        }
    }

    get active(): boolean {
        return this._active
    }

    pause(): void {
        if (this._active) {
            this._isPaused = true
            let i, l
            if (this.scopes) {
                for (i = 0, l = this.scopes.length; i < l; i++) {
                    this.scopes[i].pause()
                }
            }
            for (i = 0, l = this.effects.length; i < l; i++) {
                this.effects[i].pause()
            }
        }
    }

    /**
     * 恢复当前 effect scope，以及它下面的所有子 scope 和 effect。
     */
    resume(): void {
        if (this._active) {
            if (this._isPaused) {
                this._isPaused = false
                let i, l
                if (this.scopes) {
                    for (i = 0, l = this.scopes.length; i < l; i++) {
                        this.scopes[i].resume()
                    }
                }
                for (i = 0, l = this.effects.length; i < l; i++) {
                    this.effects[i].resume()
                }
            }
        }
    }

    run<T>(fn: () => T): T | undefined {
        if (this._active) {
            const currentEffectScope = activeEffectScope
            try {
                activeEffectScope = this
                return fn()
            } finally {
                activeEffectScope = currentEffectScope
            }
        }
    }

    prevScope: EffectScope | undefined
    /**
     * 这个方法只应该在非 detached 的作用域上调用。
     * @internal
     */
    on(): void {
        if (++this._on === 1) {
            this.prevScope = activeEffectScope
            activeEffectScope = this
        }
    }

    /**
     * 这个方法只应该在非 detached 的作用域上调用。
     * @internal
     */
    off(): void {
        if (this._on > 0 && --this._on === 0) {
            // 快路径：最常见的 LIFO 场景下，当前 scope 仍在激活链顶部，
            // 这时可以直接恢复上一个 scope。
            if (activeEffectScope === this) {
                activeEffectScope = this.prevScope
            } else {
                // 异步上下文交错时，当前 scope 可能已经不在激活链顶端。
                // 这时需要把它从链表中间摘掉，避免过期 scope 仍然全局可达。
                let current = activeEffectScope
                while (current) {
                    if (current.prevScope === this) {
                        current.prevScope = this.prevScope
                        break
                    }
                    current = current.prevScope
                }
            }
            this.prevScope = undefined
        }
    }

    stop(fromParent?: boolean): void {
        if (this._active) {
            this._active = false
            let i, l
            for (i = 0, l = this.effects.length; i < l; i++) {
                this.effects[i].stop()
            }
            this.effects.length = 0

            for (i = 0, l = this.cleanups.length; i < l; i++) {
                this.cleanups[i]()
            }
            this.cleanups.length = 0

            if (this.scopes) {
                for (i = 0, l = this.scopes.length; i < l; i++) {
                    this.scopes[i].stop(true)
                }
                this.scopes.length = 0
            }

            // 嵌套 scope 停止后，要从父 scope 上解除引用，避免内存泄漏。
            if (!this.detached && this.parent && !fromParent) {
                // 通过尾元素交换实现 O(1) 移除。
                const last = this.parent.scopes!.pop()
                if (last && last !== this) {
                    this.parent.scopes![this.index!] = last
                    last.index = this.index!
                }
            }
            this.parent = undefined
        }
    }
}


/**
 * 创建一个新的 effect 作用域。
 *
 * 作用域可以把其内部创建的 effect、computed、watch 统一收集起来，
 * 以便后续整体暂停、恢复或停止。
 *
 * @param detached - 是否创建一个脱离父作用域链的独立作用域。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#effectscope}
 */
export function effectScope(detached?: boolean): EffectScope {
    return new EffectScope(detached)
}

/**
 * 如果当前存在激活中的 effect scope，就返回它。
 *
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#getcurrentscope}
 */
export function getCurrentScope(): EffectScope | undefined {
    return activeEffectScope
}

/**
 * 在当前激活的 effect 作用域上注册一个清理回调。
 * 当关联的 effect 作用域被停止时，这个回调会被调用。
 *
 * @param fn - 要挂到当前 scope 清理列表上的回调函数。
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#onscopedispose}
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
    if (activeEffectScope) {
        activeEffectScope.cleanups.push(fn)
    }
}
