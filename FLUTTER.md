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

## 6. StatelessWidget

`StatelessWidget` 是无状态组件，组件自身不保存可变状态。

它的 UI 只依赖：

```text
构造函数传入的参数
父组件传入的数据
InheritedWidget / Provider 等外部状态
```

基本写法：

```dart
class UserCard extends StatelessWidget {
  const UserCard({
    super.key,
    required this.name,
    required this.age,
  });

  final String name;
  final int age;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(name),
        Text('$age'),
      ],
    );
  }
}
```

适合场景：

```text
纯展示组件
按钮、文本、图标封装
列表项展示
页面中的静态区域
状态由父组件或状态管理提供的组件
```

注意：

```text
StatelessWidget 不是不会 rebuild。
父组件 rebuild、依赖的 InheritedWidget 变化时，它也会重新 build。
它只是自身没有 State 对象，不能通过 setState 管理内部状态。
```

## 7. Flutter 常用组件

Flutter 里一切皆 Widget，常用组件可以按功能分类。

### 基础展示组件

```text
Text：文本
Icon：图标
Image：图片
Container：容器
Placeholder：占位
FlutterLogo：Flutter logo
```

示例：

```dart
const Text(
  'Hello Flutter',
  style: TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.bold,
  ),
)
```

### 布局组件

```text
Row：水平布局
Column：垂直布局
Stack：层叠布局
Positioned：配合 Stack 定位
Wrap：自动换行布局
Center：居中
Align：对齐
Padding：内边距
SizedBox：固定尺寸或间距
Expanded：填满剩余空间
Flexible：弹性占用空间
Spacer：弹性空白
AspectRatio：宽高比
ConstrainedBox：约束盒子
```

常见居中：

```dart
const Center(
  child: Text('center'),
)
```

Row 中文字超出时：

```dart
Row(
  children: const [
    Icon(Icons.person),
    Expanded(
      child: Text(
        'very long text',
        overflow: TextOverflow.ellipsis,
      ),
    ),
  ],
)
```

### 输入和表单组件

```text
TextField：输入框
TextFormField：表单输入框
Form：表单容器
Checkbox：复选框
Radio：单选框
Switch：开关
Slider：滑块
DropdownButton：下拉选择
```

表单校验常见写法：

```dart
final formKey = GlobalKey<FormState>();

Form(
  key: formKey,
  child: TextFormField(
    validator: (value) {
      if (value == null || value.isEmpty) {
        return '请输入内容';
      }

      return null;
    },
  ),
)
```

### 按钮组件

```text
ElevatedButton
TextButton
OutlinedButton
IconButton
FloatingActionButton
```

示例：

```dart
ElevatedButton(
  onPressed: () {},
  child: const Text('提交'),
)
```

### 滚动组件

```text
SingleChildScrollView：单子组件滚动
ListView：列表
ListView.builder：懒加载列表
GridView：网格
PageView：分页滑动
CustomScrollView：自定义滚动
SliverAppBar：可滚动 AppBar
```

大列表推荐：

```dart
ListView.builder(
  itemCount: list.length,
  itemBuilder: (context, index) {
    return ListTile(
      title: Text(list[index].name),
    );
  },
)
```

### 导航和页面结构组件

```text
MaterialApp：应用入口
Scaffold：页面脚手架
AppBar：顶部导航栏
Drawer：抽屉
BottomNavigationBar：底部导航
TabBar / TabBarView：标签页
Navigator：页面导航
```

典型页面：

```dart
Scaffold(
  appBar: AppBar(
    title: const Text('首页'),
  ),
  body: const Center(
    child: Text('Hello'),
  ),
)
```

### 异步组件

```text
FutureBuilder：处理一次异步结果
StreamBuilder：处理连续数据流
```

示例：

```dart
FutureBuilder<String>(
  future: loadData(),
  builder: (context, snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting) {
      return const CircularProgressIndicator();
    }

    if (snapshot.hasError) {
      return Text('${snapshot.error}');
    }

    return Text(snapshot.data ?? '');
  },
)
```

### 弹窗和反馈组件

```text
AlertDialog：弹窗
BottomSheet：底部弹层
SnackBar：底部提示
CircularProgressIndicator：圆形 loading
LinearProgressIndicator：线性 loading
```

SnackBar：

```dart
ScaffoldMessenger.of(context).showSnackBar(
  const SnackBar(
    content: Text('保存成功'),
  ),
);
```

### 动画组件

```text
AnimatedContainer
AnimatedOpacity
AnimatedPositioned
Hero
FadeTransition
SlideTransition
AnimationController
```

简单动画：

```dart
AnimatedOpacity(
  opacity: visible ? 1 : 0,
  duration: const Duration(milliseconds: 300),
  child: const Text('Hello'),
)
```

### 常用组件面试总结

```text
页面结构：MaterialApp、Scaffold、AppBar
布局：Container、Row、Column、Stack、Expanded、Flexible
展示：Text、Image、Icon
输入：TextField、Form、Checkbox、Switch
列表：ListView.builder、GridView、CustomScrollView
异步：FutureBuilder、StreamBuilder
反馈：Dialog、SnackBar、ProgressIndicator
动画：AnimatedContainer、Hero、AnimationController
```

## 8. StatefulWidget 生命周期

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

## 9. setState 做了什么

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

## 10. Key 的作用

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

## 11. Flutter 状态管理

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

## 12. InheritedWidget 原理

`InheritedWidget` 用于向子树传递数据。

子组件通过：

```dart
context.dependOnInheritedWidgetOfExactType<T>()
```

建立依赖关系。

当 `InheritedWidget` 更新时，依赖它的子组件会重新 build。

Provider 本质上就是基于 InheritedWidget 封装的。

## 13. BuildContext 是什么

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

## 14. FutureBuilder 和 StreamBuilder 区别

```text
FutureBuilder：
处理一次异步结果
适合接口请求

StreamBuilder：
处理连续异步数据流
适合 WebSocket、倒计时、实时数据
```

## 15. Flutter 导航

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

## 16. Flutter 布局约束机制

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

## 17. Row / Column 常见问题

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

## 18. ListView 和 Column 区别

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

## 19. const Widget 的作用

`const` 可以让 Widget 在编译期创建并复用，减少不必要的对象创建。

```dart
const Text('hello')
```

建议：

```text
能加 const 就加 const。
```

## 20. Flutter 性能优化

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

## 21. RepaintBoundary 是什么

`RepaintBoundary` 会创建独立绘制边界，减少重绘范围。

适合：

```text
复杂图表
动画区域
频繁变化但周围不变的区域
```

但不能滥用，因为每个边界也有额外成本。

## 22. Isolate 是什么

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

## 23. Future、async、await

```dart
Future<String> loadData() async {
  final result = await fetchData();
  return result;
}
```

`async` 函数返回 `Future`。

`await` 会等待 Future 完成，但不会阻塞 UI 线程。

## 24. async 和 Isolate 区别

```text
async / await：
处理异步等待，比如网络请求、文件 IO
不阻塞 UI，但不等于多线程

Isolate：
真正并行执行
适合 CPU 密集型计算
```

## 25. MethodChannel 是什么

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

## 26. Hot Reload 和 Hot Restart 区别

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

## 27. Flutter 包体积优化

```text
开启 release 构建
移除无用资源
压缩图片
按需引入依赖
开启代码混淆
拆分 ABI
分析 flutter build apk --analyze-size
```

## 28. Flutter 常见追问

```text
为什么 Widget 是不可变的？
Element 为什么要存在？
setState 为什么不是立即刷新？
GlobalKey 为什么不能滥用？
Provider 为什么能做到局部刷新？
Flutter 为什么跨端一致性好？
Flutter 和小程序/uni-app/Taro 有什么区别？
```

## 29. 优先掌握

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
