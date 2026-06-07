import type { ComputedRefImpl } from './computed';
import { type TrackOpTypes, TriggerOpTypes } from './constants';
import { type DebuggerEventExtraInfo, type Subscriber } from './effect';
/**
 * Incremented every time a reactive change happens
 * This is used to give computed a fast path to avoid re-compute when nothing
 * has changed.
 */
export declare let globalVersion: number;
/**
 * Represents a link between a source (Dep) and a subscriber (Effect or Computed).
 * Deps and subs have a many-to-many relationship - each link between a
 * dep and a sub is represented by a Link instance.
 *
 * A Link is also a node in two doubly-linked lists - one for the associated
 * sub to track all its deps, and one for the associated dep to track all its
 * subs.
 *
 * @internal
 */
export declare class Link {
    sub: Subscriber;
    dep: Dep;
    /**
     * - Before each effect run, all previous dep links' version are reset to -1
     * - During the run, a link's version is synced with the source dep on access
     * - After the run, links with version -1 (that were never used) are cleaned
     *   up
     */
    version: number;
    /**
     * Pointers for doubly-linked lists
     */
    nextDep?: Link;
    prevDep?: Link;
    nextSub?: Link;
    prevSub?: Link;
    prevActiveLink?: Link;
    constructor(sub: Subscriber, dep: Dep);
}
/**
 * @internal
 */
export declare class Dep {
    computed?: ComputedRefImpl | undefined;
    version: number;
    /**
     * Link between this dep and the current active effect
     */
    activeLink?: Link;
    /**
     * Doubly linked list representing the subscribing effects (tail)
     */
    subs?: Link;
    /**
     * Doubly linked list representing the subscribing effects (head)
     * DEV only, for invoking onTrigger hooks in correct order
     */
    subsHead?: Link;
    /**
     * For object property deps cleanup
     */
    map?: KeyToDepMap;
    key?: unknown;
    /**
     * Subscriber counter
     */
    sc: number;
    /**
     * @internal
     */
    readonly __v_skip = true;
    constructor(computed?: ComputedRefImpl | undefined);
    track(debugInfo?: DebuggerEventExtraInfo): Link | undefined;
    trigger(debugInfo?: DebuggerEventExtraInfo): void;
    notify(debugInfo?: DebuggerEventExtraInfo): void;
}
type KeyToDepMap = Map<any, Dep>;
export declare const targetMap: WeakMap<object, KeyToDepMap>;
export declare const ITERATE_KEY: unique symbol;
export declare const MAP_KEY_ITERATE_KEY: unique symbol;
export declare const ARRAY_ITERATE_KEY: unique symbol;
/**
 * Tracks access to a reactive property.
 *
 * This will check which effect is running at the moment and record it as dep
 * which records all effects that depend on the reactive property.
 *
 * @param target - Object holding the reactive property.
 * @param type - Defines the type of access to the reactive property.
 * @param key - Identifier of the reactive property to track.
 */
export declare function track(target: object, type: TrackOpTypes, key: unknown): void;
/**
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - The reactive object.
 * @param type - Defines the type of the operation that needs to trigger effects.
 * @param key - Can be used to target a specific reactive property in the target object.
 */
export declare function trigger(target: object, type: TriggerOpTypes, key?: unknown, newValue?: unknown, oldValue?: unknown, oldTarget?: Map<unknown, unknown> | Set<unknown>): void;
export declare function getDepFromReactive(object: any, key: string | number | symbol): Dep | undefined;
export {};
//# sourceMappingURL=dep.d.ts.map