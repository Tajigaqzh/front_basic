// typed-routes 是对外暴露的类型安全路由类型总出口。
// 它把 params、route map、route location、route record、navigation guards
// 这些分散定义重新汇总，供 index.ts 一次性导出。
export type * from './params'
export type * from './route-map'
export type * from './route-location'
export type * from './route-records'
export type * from './navigation-guards'
