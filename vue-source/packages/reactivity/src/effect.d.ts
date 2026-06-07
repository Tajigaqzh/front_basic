import type { ComputedRefImpl } from './computed';
import type { TrackOpTypes, TriggerOpTypes } from './constants';
import { type Link } from './dep';
export type EffectScheduler = (...args: any[]) => any;
export type DebuggerEvent = {
    effect: Subscriber;
} & DebuggerEventExtraInfo;
export type DebuggerEventExtraInfo = {
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key: any;
    newValue?: any;
    oldValue?: any;
    oldTarget?: Map<any, any> | Set<any>;
};
export interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
}
export interface ReactiveEffectOptions extends DebuggerOptions {
    scheduler?: EffectScheduler;
    allowRecurse?: boolean;
    onStop?: () => void;
}
export interface ReactiveEffectRunner<T = any> {
    (): T;
    effect: ReactiveEffect;
}
export declare let activeSub: Subscriber | undefined;
export declare enum EffectFlags {
    /**
     * ReactiveEffect only
     */
    ACTIVE = 1,
    RUNNING = 2,
    TRACKING = 4,
    NOTIFIED = 8,
    DIRTY = 16,
    ALLOW_RECURSE = 32,
    PAUSED = 64,
    EVALUATED = 128
}
/**
 * Subscriber is a type that tracks (or subscribes to) a list of deps.
 */
export interface Subscriber extends DebuggerOptions {
    /**
     * Head of the doubly linked list representing the deps
     * @internal
     */
    deps?: Link;
    /**
     * Tail of the same list
     * @internal
     */
    depsTail?: Link;
    /**
     * @internal
     */
    flags: EffectFlags;
    /**
     * @internal
     */
    next?: Subscriber;
    /**
     * returning `true` indicates it's a computed that needs to call notify
     * on its dep too
     * @internal
     */
    notify(): true | void;
}
export declare class ReactiveEffect<T = any> implements Subscriber, ReactiveEffectOptions {
    fn: () => T;
    /**
     * @internal
     */
    deps?: Link;
    /**
     * @internal
     */
    depsTail?: Link;
    /**
     * @internal
     */
    flags: EffectFlags;
    /**
     * @internal
     */
    next?: Subscriber;
    /**
     * @internal
     */
    cleanup?: () => void;
    scheduler?: EffectScheduler;
    onStop?: () => void;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
    constructor(fn: () => T);
    pause(): void;
    resume(): void;
    /**
     * @internal
     */
    notify(): void;
    run(): T;
    stop(): void;
    trigger(): void;
    /**
     * @internal
     */
    runIfDirty(): void;
    get dirty(): boolean;
}
export declare function batch(sub: Subscriber, isComputed?: boolean): void;
/**
 * @internal
 */
export declare function startBatch(): void;
/**
 * Run batched effects when all batches have ended
 * @internal
 */
export declare function endBatch(): void;
/**
 * Returning false indicates the refresh failed
 * @internal
 */
export declare function refreshComputed(computed: ComputedRefImpl): undefined;
export declare function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions): ReactiveEffectRunner<T>;
/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export declare function stop(runner: ReactiveEffectRunner): void;
/**
 * @internal
 */
export declare let shouldTrack: boolean;
/**
 * Temporarily pauses tracking.
 */
export declare function pauseTracking(): void;
/**
 * Re-enables effect tracking (if it was paused).
 */
export declare function enableTracking(): void;
/**
 * Resets the previous global effect tracking state.
 */
export declare function resetTracking(): void;
/**
 * Registers a cleanup function for the current active effect.
 * The cleanup function is called right before the next effect run, or when the
 * effect is stopped.
 *
 * Throws a warning if there is no current active effect. The warning can be
 * suppressed by passing `true` to the second argument.
 *
 * @param fn - the cleanup function to be registered
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 */
export declare function onEffectCleanup(fn: () => void, failSilently?: boolean): void;
//# sourceMappingURL=effect.d.ts.map