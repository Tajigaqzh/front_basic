// 读取阶段的操作类型。
// `track()` 会根据这些类型记录当前是以什么方式访问了目标对象。
export enum TrackOpTypes {
    // 读取某个具体属性，例如 `obj.foo`
    GET = 'get',
    // 判断某个属性是否存在，例如 `'foo' in obj`
    HAS = 'has',
    // 遍历目标对象，例如 `for...in`、`Object.keys()`、集合迭代
    ITERATE = 'iterate',
}

// 写入阶段的操作类型。
// `trigger()` 会根据这些类型决定应该触发哪些依赖。
export enum TriggerOpTypes {
    // 修改已有属性或已有集合项
    SET = 'set',
    // 新增属性或新增集合项
    ADD = 'add',
    // 删除属性或删除集合项
    DELETE = 'delete',
    // 清空整个集合
    CLEAR = 'clear',
}

// Vue 响应式系统挂在对象上的内部标记字段。
export enum ReactiveFlags {
    // 标记该对象应跳过代理
    SKIP = '__v_skip',
    // 标记该对象是否为 reactive 代理
    IS_REACTIVE = '__v_isReactive',
    // 标记该对象是否为 readonly 代理
    IS_READONLY = '__v_isReadonly',
    // 标记该对象是否为 shallow 模式代理
    IS_SHALLOW = '__v_isShallow',
    // 指向代理背后的原始对象
    RAW = '__v_raw',
    // 标记该对象是否为 ref
    IS_REF = '__v_isRef',
}
