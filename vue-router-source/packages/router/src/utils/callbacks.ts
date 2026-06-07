/**
 * Create a list of callbacks that can be reset. Used to create before and after navigation guards list
 */
export function useCallbacks<T>() {
  // 这是一个极简订阅列表实现。
  // router.ts 用它维护 beforeEach / beforeResolve / afterEach 等回调集合。
  let handlers: T[] = []

  function add(handler: T): () => void {
    // 返回值是解绑函数，方便调用方像事件监听一样随时注销。
    handlers.push(handler)
    return () => {
      const i = handlers.indexOf(handler)
      if (i > -1) handlers.splice(i, 1)
    }
  }

  function reset() {
    // reset 主要用于 router 被销毁或测试重置场景。
    handlers = []
  }

  return {
    add,
    list: () => handlers.slice(),
    reset,
  }
}
