# Flutter 面试题

## 1. Flutter 是什么

Flutter 是 Google 推出的跨端 UI 框架，使用 Dart 语言开发，可以构建 iOS、Android、Web、桌面端应用。

核心特点：

```text
自绘 UI
跨平台一致性强
热重载
Widget 组件化
Skia / Impeller 渲染
Dart 语言
```

## 2. Flutter 和 React Native 区别

```text
Flutter：
使用 Dart
自绘 UI
跨端一致性强
性能稳定
包体相对较大

React Native：
使用 JavaScript / React
渲染原生组件
更贴近原生平台
依赖 JS Bridge / JSI
生态和前端联系更强
```

一句话：

```text
Flutter 更像自己带了一套 UI 渲染系统；
React Native 更像用 JS 调原生组件。
```

## 3. Flutter 渲染原理

Flutter 不依赖原生 UI 控件，而是自己绘制。

大致流程：

```text
Widget Tree
   ↓
Element Tree
   ↓
RenderObject Tree
   ↓
Layout
   ↓
Paint
   ↓
Compositing
   ↓
Raster
```

说明：

```text
Widget：配置描述
Element：Widget 的实例化和生命周期管理
RenderObject：真正负责布局和绘制
```

## 4. Widget、Element、RenderObject 区别

```text
Widget：
不可变配置对象，描述 UI 长什么样。

Element：
Widget 和 RenderObject 之间的桥梁，负责挂载、更新、生命周期。

RenderObject：
负责布局、绘制、命中测试。
```

常见回答：

```text
Widget 很轻量，可以频繁重建；
Element 会尽量复用；
真正昂贵的是布局和绘制。
```

## 5. StatelessWidget 和 StatefulWidget 区别

```text
StatelessWidget：
无内部可变状态
build 只依赖外部传入参数
适合静态 UI

StatefulWidget：
有 State 对象
可以通过 setState 触发更新
适合有交互和状态变化的 UI
```

## 6. StatefulWidget 生命周期

常见生命周期：

```text
createState
initState
didChangeDependencies
build
didUpdateWidget
deactivate
dispose
```

重点：

```text
initState：初始化，只执行一次
didChangeDependencies：依赖的 InheritedWidget 变化时触发
build：构建 UI
didUpdateWidget：父组件传入新配置时触发
dispose：销毁资源
```

## 7. setState 做了什么

`setState` 会标记当前 `Element` 为 dirty，然后在下一帧重新调用 `build`。

```text
setState
  ↓
markNeedsBuild
  ↓
下一帧重新 build
  ↓
diff widget
  ↓
更新 Element / RenderObject
```

注意：

```text
setState 不是立即重绘屏幕
不要在 build 中调用 setState
dispose 后不能调用 setState
```

## 8. Key 的作用

Key 用来帮助 Flutter 在 Widget 更新时正确复用 Element。

常见 Key：

```text
ValueKey
ObjectKey
UniqueKey
GlobalKey
```

使用场景：

```text
列表重排
保留组件状态
表单校验
跨层级访问 State
```

注意：

```text
GlobalKey 成本较高，不要滥用。
```

## 9. Flutter 状态管理

常见方案：

```text
setState
InheritedWidget
Provider
Riverpod
Bloc / Cubit
GetX
MobX
Redux
```

选择：

```text
局部简单状态：setState
跨组件共享状态：Provider / Riverpod
复杂业务流：Bloc
轻量快速开发：GetX
```

## 10. InheritedWidget 原理

`InheritedWidget` 用于向子树传递数据。

子组件通过：

```dart
context.dependOnInheritedWidgetOfExactType<T>()
```

建立依赖关系。

当 `InheritedWidget` 更新时，依赖它的子组件会重新 build。

Provider 本质上就是基于 InheritedWidget 封装的。

## 11. BuildContext 是什么

`BuildContext` 本质上是当前 Widget 对应的 Element。

它可以用来：

```text
查找祖先 Widget
获取 Theme
获取 Navigator
获取 MediaQuery
获取 Provider
```

注意：

```text
不要在异步后直接使用可能已经失效的 context。
```

可以检查：

```dart
if (!context.mounted) return;
```

## 12. FutureBuilder 和 StreamBuilder 区别

```text
FutureBuilder：
处理一次异步结果
适合接口请求

StreamBuilder：
处理连续异步数据流
适合 WebSocket、倒计时、实时数据
```

## 13. Flutter 导航

常见：

```dart
Navigator.push()
Navigator.pop()
Navigator.pushReplacement()
Navigator.pushNamed()
```

也可以用：

```text
go_router
auto_route
GetX route
```

## 14. Flutter 布局约束机制

Flutter 布局规则：

```text
Constraints go down
Sizes go up
Parent sets position
```

意思是：

```text
父组件向子组件传约束
子组件在约束内决定自己的尺寸
父组件决定子组件的位置
```

这是 Flutter 布局面试非常高频。

## 15. Row / Column 常见问题

`Row` / `Column` 中子元素超出时会 overflow。

解决：

```dart
Expanded(
  child: Text('long text'),
)
```

或：

```dart
Flexible(
  child: Text('long text'),
)
```

区别：

```text
Expanded：强制占满剩余空间
Flexible：可以占用剩余空间，但不一定占满
```

## 16. ListView 和 Column 区别

```text
Column：
一次性布局所有子组件
适合少量内容

ListView：
懒加载可滚动列表
适合大量数据
```

大列表应该用：

```dart
ListView.builder()
```

## 17. const Widget 的作用

`const` 可以让 Widget 在编译期创建并复用，减少不必要的对象创建。

```dart
const Text('hello')
```

建议：

```text
能加 const 就加 const。
```

## 18. Flutter 性能优化

常见点：

```text
减少不必要的 build
合理拆分 Widget
使用 const Widget
列表使用 ListView.builder
避免在 build 中做耗时操作
图片压缩和缓存
使用 RepaintBoundary
避免频繁 setState 大范围组件
DevTools 分析帧率和重绘
```

## 19. RepaintBoundary 是什么

`RepaintBoundary` 会创建独立绘制边界，减少重绘范围。

适合：

```text
复杂图表
动画区域
频繁变化但周围不变的区域
```

但不能滥用，因为每个边界也有额外成本。

## 20. Isolate 是什么

Dart 是单线程事件循环模型，但可以用 Isolate 做并行计算。

```text
Isolate 有独立内存
不能共享变量
通过消息通信
适合 CPU 密集型任务
```

Flutter 中可以用：

```dart
compute()
```

处理简单后台计算。

## 21. Future、async、await

```dart
Future<String> loadData() async {
  final result = await fetchData();
  return result;
}
```

`async` 函数返回 `Future`。

`await` 会等待 Future 完成，但不会阻塞 UI 线程。

## 22. async 和 Isolate 区别

```text
async / await：
处理异步等待，比如网络请求、文件 IO
不阻塞 UI，但不等于多线程

Isolate：
真正并行执行
适合 CPU 密集型计算
```

## 23. MethodChannel 是什么

Flutter 通过 Platform Channel 和原生通信。

常见通道：

```text
MethodChannel：方法调用
EventChannel：事件流
BasicMessageChannel：基础消息
```

MethodChannel 示例用途：

```text
调用原生相机
获取设备信息
调用支付 SDK
调用地图 SDK
```

## 24. Hot Reload 和 Hot Restart 区别

```text
Hot Reload：
保留当前状态
注入新代码
适合改 UI

Hot Restart：
重启 Dart VM
状态丢失
适合改初始化逻辑、全局变量
```

## 25. Flutter 包体积优化

```text
开启 release 构建
移除无用资源
压缩图片
按需引入依赖
开启代码混淆
拆分 ABI
分析 flutter build apk --analyze-size
```

## 26. Flutter 常见追问

```text
为什么 Widget 是不可变的？
Element 为什么要存在？
setState 为什么不是立即刷新？
GlobalKey 为什么不能滥用？
Provider 为什么能做到局部刷新？
Flutter 为什么跨端一致性好？
Flutter 和小程序/uni-app/Taro 有什么区别？
```

## 27. 优先掌握

```text
1. Flutter 渲染原理
2. Widget / Element / RenderObject
3. StatefulWidget 生命周期
4. setState 原理
5. Key 的作用
6. BuildContext
7. InheritedWidget / Provider
8. 布局约束机制
9. ListView.builder 性能
10. Flutter 性能优化
```
