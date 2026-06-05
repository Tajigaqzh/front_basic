// Promise 只会处于这三种状态之一，而且状态一旦改变就不能回退。
type MyPromiseState = "pending" | "fulfilled" | "rejected";

// 执行器函数会在 new MyPromise(...) 时立刻执行，并拿到 resolve/reject。
type MyPromiseExecutor<T> = (
    resolve: (value?: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
) => void;

// then 成功回调：接收当前 Promise 的成功值，返回普通值或新的 thenable。
type OnFulfilled<T, TResult> = (value: T) => TResult | PromiseLike<TResult>;
// then 失败回调：接收拒绝原因，返回普通值或新的 thenable。
type OnRejected<TResult> = (reason: unknown) => TResult | PromiseLike<TResult>;
// finally 回调不接收参数，只做收尾逻辑。
type OnFinally = () => unknown;

// allSettled 的单项结果只有两种：成功或失败。
type MyPromiseSettledResult<T> =
    | { status: "fulfilled"; value: T }
    | { status: "rejected"; reason: unknown };

export class MyPromise<T = unknown> {
    // 当前 Promise 的内部状态，初始一定是 pending。
    private state: MyPromiseState = "pending";
    // fulfilled 时保存成功值。
    private value!: T;
    // rejected 时保存失败原因。
    private reason: unknown;
    // pending 阶段注册的成功回调队列。
    private onFulfilledCallbacks: Array<() => void> = [];
    // pending 阶段注册的失败回调队列。
    private onRejectedCallbacks: Array<() => void> = [];

    // 原生 Promise 的回调是放进微任务队列里执行的，这里用 queueMicrotask 模拟。
    private runAsync(callback: () => void) {
        queueMicrotask(callback);
    }

    // 状态变成 fulfilled 后，把之前缓存的成功回调依次异步执行。
    private flushFulfilledCallbacks() {
        this.onFulfilledCallbacks.forEach((callback) => {
            this.runAsync(callback);
        });
        // 执行后清空，避免重复触发。
        this.onFulfilledCallbacks = [];
    }

    // 状态变成 rejected 后，把之前缓存的失败回调依次异步执行。
    private flushRejectedCallbacks() {
        this.onRejectedCallbacks.forEach((callback) => {
            this.runAsync(callback);
        });
        // 执行后清空，避免重复触发。
        this.onRejectedCallbacks = [];
    }

    // Promise/A+ 里很多地方都要判断“是不是对象或函数”，因为 thenable 可能是任意对象。
    private static isObjectOrFunction(value: unknown): value is object | Function {
        return (typeof value === "object" && value !== null) || typeof value === "function";
    }

    // 统一读取 then，避免 constructor / resolve / resolvePromise 重复同一段逻辑。
    private static getThen<T>(value: unknown) {
        if (!MyPromise.isObjectOrFunction(value)) {
            return undefined;
        }

        return (value as PromiseLike<T>).then;
    }

    constructor(executor: MyPromiseExecutor<T>) {
        // resolve 负责把 Promise 从 pending 推进到 fulfilled，
        // 或者继续“吸收”传入的 thenable / PromiseLike。
        const resolve = (value?: T | PromiseLike<T>) => {
            // Promise 状态只能改一次，后续 resolve/reject 都忽略。
            if (this.state !== "pending") {
                return;
            }

            // 自己 resolve 自己会产生循环引用，必须直接拒绝。
            if (value === this) {
                reject(new TypeError("Chaining cycle detected for promise"));
                return;
            }

            // 如果传入的是对象或函数，尝试把它当作 thenable 吸收。
            if (MyPromise.isObjectOrFunction(value)) {
                try {
                    const then = MyPromise.getThen<T>(value);
                    if (typeof then === "function") {
                        // 如果它有 then，就跟随它的最终状态，而不是立刻 fulfilled。
                        then.call(
                            value,
                            (resolvedValue: T) => resolve(resolvedValue as Awaited<T>),
                            reject,
                        );
                        return;
                    }
                } catch (error) {
                    reject(error);
                    return;
                }
            }

            // 走到这里说明 value 只是普通值，当前 Promise 正式 fulfilled。
            this.state = "fulfilled";
            this.value = value as T;
            this.flushFulfilledCallbacks();
        };

        // reject 负责把 Promise 从 pending 推进到 rejected。
        const reject = (reason?: unknown) => {
            if (this.state !== "pending") {
                return;
            }

            this.state = "rejected";
            this.reason = reason;
            this.flushRejectedCallbacks();
        };

        try {
            // new MyPromise(...) 时执行器会被同步调用。
            executor(resolve, reject);
        } catch (error) {
            // 执行器内部同步抛错，等价于直接 reject(error)。
            reject(error);
        }
    }

    // 这是 Promise/A+ 的核心解析函数：
    // then 回调返回什么，就把 promise2 解析成什么。
    private static resolvePromise<TResult>(
        promise2: MyPromise<TResult>,
        x: TResult | PromiseLike<TResult>,
        resolve: (value?: TResult | PromiseLike<TResult>) => void,
        reject: (reason?: unknown) => void,
    ) {
        // then 返回自身会造成死循环，必须拒绝。
        if (promise2 === x) {
            reject(new TypeError("Chaining cycle detected for promise"));
            return;
        }

        // 如果返回值是对象或函数，就有可能是 thenable，需要继续拆解。
        if (MyPromise.isObjectOrFunction(x)) {
            // Promise/A+ 规范要求 thenable 只能被 resolve/reject 一次。
            let called = false;

            try {
                const then = MyPromise.getThen<TResult>(x);
                if (typeof then === "function") {
                    then.call(
                        x,
                        (y: TResult | PromiseLike<TResult>) => {
                            if (called) {
                                return;
                            }
                            called = true;
                            // y 还可能是新的 thenable，所以继续递归解析。
                            MyPromise.resolvePromise(promise2, y, resolve, reject);
                        },
                        (r: unknown) => {
                            if (called) {
                                return;
                            }
                            called = true;
                            reject(r);
                        },
                    );
                    return;
                }
            } catch (error) {
                // 如果 then 取值或执行过程中抛错，并且还没 settle，就直接 reject。
                if (called) {
                    return;
                }
                reject(error);
                return;
            }
        }

        // 不是 thenable，说明 x 是普通值，直接 resolve。
        resolve(x);
    }

    // then 是 Promise 链式调用的核心。
    public then<TResult1 = T, TResult2 = never>(
        onFulfilled?: OnFulfilled<T, TResult1>,
        onRejected?: OnRejected<TResult2>,
    ) {
        // 成功回调不是函数时，按规范做值透传。
        const realOnFulfilled: OnFulfilled<T, TResult1> =
            typeof onFulfilled === "function"
                ? onFulfilled
                : (value) => value as unknown as TResult1;
        // 失败回调不是函数时，按规范继续把错误往后抛。
        const realOnRejected: OnRejected<TResult2> =
            typeof onRejected === "function"
                ? onRejected
                : (reason) => {
                    throw reason;
                };

        // then 必须返回一个全新的 Promise，用来承接回调返回值。
        const promise2 = new MyPromise<TResult1 | TResult2>((resolve, reject) => {
            const handleFulfilled = () => {
                try {
                    // 执行成功回调，拿到它的返回值 x。
                    const x = realOnFulfilled(this.value);
                    // 再把 x 解析给新的 promise2。
                    MyPromise.resolvePromise(promise2, x as TResult1 | PromiseLike<TResult1>, resolve, reject);
                } catch (error) {
                    reject(error);
                }
            };

            const handleRejected = () => {
                try {
                    // 执行失败回调，拿到它的返回值 x。
                    const x = realOnRejected(this.reason);
                    // 失败回调如果返回普通值，后续链会转成 fulfilled。
                    MyPromise.resolvePromise(promise2, x as TResult2 | PromiseLike<TResult2>, resolve, reject);
                } catch (error) {
                    reject(error);
                }
            };

            // 如果当前 Promise 已成功，异步执行成功分支。
            if (this.state === "fulfilled") {
                this.runAsync(handleFulfilled);
                return;
            }

            // 如果当前 Promise 已失败，异步执行失败分支。
            if (this.state === "rejected") {
                this.runAsync(handleRejected);
                return;
            }

            // 如果当前还在 pending，就先把回调缓存起来，等状态落定后再执行。
            this.onFulfilledCallbacks.push(handleFulfilled);
            this.onRejectedCallbacks.push(handleRejected);
        });

        return promise2;
    }

    // catch 本质上就是只传失败回调的 then。
    public catch<TResult = never>(onRejected?: OnRejected<TResult>) {
        return this.then<T, TResult>(undefined, onRejected);
    }

    // finally 无论成功还是失败都会执行，但不能吞掉原值/原错误。
    public finally(onFinally?: OnFinally) {
        const runFinally = () => {
            if (typeof onFinally !== "function") {
                return MyPromise.resolve(undefined);
            }

            // finally 里也可能返回 thenable，所以统一包成 MyPromise。
            return MyPromise.resolve(onFinally());
        };

        return this.then(
            // 成功时先执行 finally，再把原值透传下去。
            (value) =>
                runFinally().then(() => {
                    return value;
                }),
            // 失败时先执行 finally，再把原错误继续抛下去。
            (reason) =>
                runFinally().then(() => {
                    throw reason;
                }),
        );
    }

    // resolve 会返回一个成功态 Promise；
    // 如果传入 Promise/thenable，则跟随它的最终状态。
    public static resolve<T>(value?: T | PromiseLike<T>) {
        if (value instanceof MyPromise) {
            return value as MyPromise<Awaited<T>>;
        }

        return new MyPromise<Awaited<T>>((resolve, reject) => {
            if (MyPromise.isObjectOrFunction(value)) {
                try {
                    const then = MyPromise.getThen<T>(value);
                    if (typeof then === "function") {
                        then.call(
                            value,
                            (resolvedValue: T) => resolve(resolvedValue as Awaited<T>),
                            reject,
                        );
                        return;
                    }
                } catch (error) {
                    reject(error);
                    return;
                }
            }

            resolve(value as Awaited<T>);
        });
    }

    // reject 直接返回一个失败态 Promise，不会展开传入值。
    public static reject(reason?: unknown) {
        return new MyPromise<never>((_, reject) => {
            reject(reason);
        });
    }

    // all 要求全部成功才成功，并且返回值顺序与输入顺序一致。
    public static all<T extends readonly unknown[]>(
        promises: T,
    ): MyPromise<{ [K in keyof T]: Awaited<T[K]> }> {
        return new MyPromise<{ [K in keyof T]: Awaited<T[K]> }>((resolve, reject) => {
            // 空数组要立刻成功，结果也是空数组。
            if (promises.length === 0) {
                resolve([] as unknown as { [K in keyof T]: Awaited<T[K]> });
                return;
            }

            const results: unknown[] = [];
            // 记录已经成功完成了多少项。
            let fulfilledCount = 0;

            promises.forEach((promise, index) => {
                MyPromise.resolve(promise).then(
                    (value) => {
                        // 即使完成顺序不同，也要按原始索引写回结果。
                        results[index] = value;
                        fulfilledCount += 1;

                        // 全部成功后再整体 resolve。
                        if (fulfilledCount === promises.length) {
                            resolve(results as { [K in keyof T]: Awaited<T[K]> });
                        }
                    },
                    // 只要有一个失败，all 就立刻失败。
                    (reason) => {
                        reject(reason);
                    },
                );
            });
        });
    }

    // race 谁先 settle，就跟随谁的结果。
    public static race<T extends readonly unknown[]>(promises: T): MyPromise<Awaited<T[number]>> {
        return new MyPromise<Awaited<T[number]>>((resolve, reject) => {
            promises.forEach((promise) => {
                MyPromise.resolve(promise).then(
                    (value) => resolve(value as Awaited<T[number]>),
                    reject,
                );
            });
        });
    }

    // allSettled 会等待全部结束，但不会因为单个失败而整体 reject。
    public static allSettled<T extends readonly unknown[]>(
        promises: T,
    ): MyPromise<{ [K in keyof T]: MyPromiseSettledResult<Awaited<T[K]>> }> {
        return new MyPromise<{ [K in keyof T]: MyPromiseSettledResult<Awaited<T[K]>> }>((resolve) => {
            if (promises.length === 0) {
                resolve([] as unknown as { [K in keyof T]: MyPromiseSettledResult<Awaited<T[K]>> });
                return;
            }

            // 每个位置都保存自己的 settled 结果。
            const results: Array<MyPromiseSettledResult<unknown>> = [];
            let settledCount = 0;

            promises.forEach((promise, index) => {
                MyPromise.resolve(promise).then(
                    (value) => {
                        results[index] = {
                            status: "fulfilled",
                            value,
                        };
                        settledCount += 1;

                        // 全部 settle 后统一 resolve 结果数组。
                        if (settledCount === promises.length) {
                            resolve(results as { [K in keyof T]: MyPromiseSettledResult<Awaited<T[K]>> });
                        }
                    },
                    (reason) => {
                        results[index] = {
                            status: "rejected",
                            reason,
                        };
                        settledCount += 1;

                        if (settledCount === promises.length) {
                            resolve(results as { [K in keyof T]: MyPromiseSettledResult<Awaited<T[K]>> });
                        }
                    },
                );
            });
        });
    }

    // any 只要有一个成功就成功；只有全部失败时才失败。
    public static any<T extends readonly unknown[]>(promises: T): MyPromise<Awaited<T[number]>> {
        return new MyPromise<Awaited<T[number]>>((resolve, reject) => {
            // 原生 Promise.any([]) 会直接拒绝一个 AggregateError。
            if (promises.length === 0) {
                reject(new AggregateError([], "All promises were rejected"));
                return;
            }

            // 保存每一项失败原因，全部失败时一起抛出。
            const errors: unknown[] = [];
            let rejectedCount = 0;

            promises.forEach((promise, index) => {
                MyPromise.resolve(promise).then(
                    (value) => {
                        // 任意一项成功，整体就成功。
                        resolve(value as Awaited<T[number]>);
                    },
                    (reason) => {
                        errors[index] = reason;
                        rejectedCount += 1;

                        // 只有所有项都失败时，才整体 reject。
                        if (rejectedCount === promises.length) {
                            reject(new AggregateError(errors, "All promises were rejected"));
                        }
                    },
                );
            });
        });
    }
}
