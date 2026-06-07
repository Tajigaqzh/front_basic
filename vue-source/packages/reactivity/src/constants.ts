// 这里不用数字而用字符串，是为了让调试事件、断点观察和日志输出更直观。
// 当 onTrack / onTrigger 把这些类型抛给调试器时，直接看到 `get` / `set`
// 比看到 0 / 1 / 2 更容易定位当前发生的是哪一类响应式操作。

export enum TrackOpTypes {
  // 读取属性，如 `state.count`
  GET = 'get',
  // 判断属性是否存在，如 `'count' in state`
  HAS = 'has',
  // 枚举/遍历结构，如 `for...in`、`Object.keys`、Map/Set 迭代
  ITERATE = 'iterate',
}

export enum TriggerOpTypes {
  // 修改已有值
  SET = 'set',
  // 新增属性或集合成员
  ADD = 'add',
  // 删除属性或集合成员
  DELETE = 'delete',
  // 清空集合
  CLEAR = 'clear',
}

export enum ReactiveFlags {
  // 标记对象跳过 reactive/readonly 代理转换
  SKIP = '__v_skip',
  // 标记当前代理是否为 reactive
  IS_REACTIVE = '__v_isReactive',
  // 标记当前代理是否为 readonly
  IS_READONLY = '__v_isReadonly',
  // 标记当前代理是否为 shallow 模式
  IS_SHALLOW = '__v_isShallow',
  // 指向当前代理对应的原始对象
  RAW = '__v_raw',
  // 标记当前对象是否为 ref
  IS_REF = '__v_isRef',
}
