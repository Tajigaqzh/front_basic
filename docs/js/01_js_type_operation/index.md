# 01 基础语法

这个目录表示 JavaScript 类型、表达式、操作符、语句等简单语法内容的总和。

## 可补充内容

- 数据类型
- 表达式
- 操作符
- 条件语句与循环语句
- 类型转换
- 相等性比较

## 导航

- 返回 [JavaScript 模块](../index.md)
### 原始类型
字符串，数字，布尔值，符号，null，undefined，bigint

object不是原始类型，是引用类型

typeof null 返回 "object"，这是 JavaScript 的历史遗留问题，但 null 仍然是原始类型


### null和undefined区别
null表示某个值不存在，typeof null 是object，可以用来表示数值，字符串以及对象没有值
undefined是什么都不做，什么也不赋值。出现场景：1. 声明变量未赋值；2.访问不存在的属性；3.定义形参但是为传参；4.方法无返回值
typeof undefined 是undefined


### 全局对象
globalThis