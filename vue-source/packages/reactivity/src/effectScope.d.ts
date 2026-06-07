import type { ReactiveEffect } from './effect';
export declare let activeEffectScope: EffectScope | undefined;
export declare class EffectScope {
    detached: boolean;
    /**
     * @internal
     */
    private _active;
    /**
     * @internal track `on` calls, allow `on` call multiple times
     */
    private _on;
    /**
     * @internal
     */
    effects: ReactiveEffect[];
    /**
     * @internal
     */
    cleanups: (() => void)[];
    private _isPaused;
    private _warnOnRun;
    /**
     * only assigned by undetached scope
     * @internal
     */
    parent: EffectScope | undefined;
    /**
     * record undetached scopes
     * @internal
     */
    scopes: EffectScope[] | undefined;
    /**
     * track a child scope's index in its parent's scopes array for optimized
     * removal
     * @internal
     */
    private index;
    readonly __v_skip = true;
    constructor(detached?: boolean);
    get active(): boolean;
    pause(): void;
    /**
     * Resumes the effect scope, including all child scopes and effects.
     */
    resume(): void;
    run<T>(fn: () => T): T | undefined;
    prevScope: EffectScope | undefined;
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    on(): void;
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    off(): void;
    stop(fromParent?: boolean): void;
}
/**
 * Creates an effect scope object which can capture the reactive effects (i.e.
 * computed and watchers) created within it so that these effects can be
 * disposed together. For detailed use cases of this API, please consult its
 * corresponding {@link https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md | RFC}.
 *
 * @param detached - Can be used to create a "detached" effect scope.
 * @see {@link https://vuejs.org/api-source/reactivity-advanced.html#effectscope}
 */
export declare function effectScope(detached?: boolean): EffectScope;
/**
 * Returns the current active effect scope if there is one.
 *
 * @see {@link https://vuejs.org/api-source/reactivity-advanced.html#getcurrentscope}
 */
export declare function getCurrentScope(): EffectScope | undefined;
/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 * @see {@link https://vuejs.org/api-source/reactivity-advanced.html#onscopedispose}
 */
export declare function onScopeDispose(fn: () => void, failSilently?: boolean): void;
//# sourceMappingURL=effectScope.d.ts.map