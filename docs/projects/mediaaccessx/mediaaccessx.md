# 我写了一个 Android 媒体库，把拍照、文件保存、选图、文件选择统一成一套 API

[English](mediaaccessx-en.md) | 中文

`MediaAccessX` 是一个 Android 媒体访问库，用于统一封装：

- 拍照 / 录视频
- 保存文件到系统共享目录
- 选择图片
- 选择文件

并提供一套简洁的 DSL API，同时自动适配 Android 不同版本的存储与权限机制。

## 为什么要做这个库

在 Android 开发中，我们经常会遇到几个非常常见的需求：

- 拍照
- 录视频
- 选择图片
- 选择文件
- 保存图片、视频或文件到系统共享目录

这些功能看起来都很简单，但真正实现起来其实会遇到很多细节问题，比如：

- Android 不同版本的存储策略差异
- FileProvider 配置
- 运行时权限处理
- ActivityResult API 的生命周期限制
- 不同系统组件返回结果的差异

很多项目中，这些逻辑往往是 **复制粘贴 + 局部修改** 完成的，代码不仅分散，而且容易踩坑。

---

在实际开发中，一个完整的拍照流程通常包括：

1. 处理运行时权限
2. 根据 Android 版本创建保存图片的 Uri
3. 注册 `ActivityResultLauncher`
4. 启动系统相机
5. 处理返回结果

如果把这些步骤简单展开（省略部分细节），代码大致会变成这样：

```kotlin
// 1. 处理运行时权限
if (!hasCameraPermission()) {
    requestCameraPermission()
    return
}

// 2. 根据 Android 版本创建 Uri
val uri = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {

    // Android 10 以下
    // 1. 使用 File API 创建文件
    val file = createImageFile()

    // 2. 通过 FileProvider 转换为 Uri
    FileProvider.getUriForFile(context, authority, file)

} else {

    // Android 10 及以上
    // 使用 MediaStore 创建 Uri
    createMediaStoreImageUri()
}

// 3. 注册 ActivityResultLauncher（通常需要在生命周期早期注册）
val launcher = registerForActivityResult(
    ActivityResultContracts.TakePicture()
) { success ->
    // 在回调中需要判断 success 标志位
    // 并在旧版本系统中手动刷新媒体库
}

// 4. 启动系统相机
launcher.launch(uri)
````

上面这段代码已经省略了很多细节，例如：

* `FileProvider` 配置
* `MediaStore` 插入逻辑
* 权限回调处理
* 生命周期问题

但即使是简化版本，也能看出拍照功能其实涉及不少步骤。

---

如果项目中还包含其他常见需求，比如：

* 选择图片
* 选择文件
* 保存媒体到共享目录

这些逻辑往往会分散在项目的不同地方。

虽然每一块代码本身都不复杂，但**整体结构会越来越分散，也越来越难统一维护**。

这也是我开始思考一个问题的原因：

**能不能把这些能力统一起来？**

于是我尝试写了一个 **MediaAccessX**。

目标很简单：

**统一 Android 的媒体访问能力，并提供更优雅的调用方式。**

## 设计目标

MediaAccessX 的设计目标主要有几个。

### 1 统一 API

统一处理以下功能：

* Camera
* Saver
* PhotoPicker
* FilePicker

避免在项目中维护多套工具类。

### 2 DSL 风格调用

希望 API 调用方式足够简洁。

例如拍照：

```kotlin
MediaAccessX.with(activity)
    .camera()
    .launch { /* 结果处理 */ }
```

保存文件：

```kotlin
MediaAccessX.with(activity)
    .saver()
    .launch { /* 结果处理 */ }
```

选择图片：

```kotlin
MediaAccessX.with(activity)
    .photoPicker()
    .maxCount(5)
    .launch { /* 结果处理 */ }
```

选择文件：

```kotlin
MediaAccessX.with(activity)
    .filePicker()
    .launch { /* 结果处理 */ }
```

所有功能都遵循同一套 DSL 调用结构。

```
MediaAccessX
   ↓
Feature
   ↓
Configuration
   ↓
launch()
```

这样的设计有两个明显好处：

* API 非常直观
* 不同功能之间保持一致

### 3 自动处理系统复杂度

库内部自动处理：

* Android 版本差异
* MediaStore / FileProvider
* ActivityResult
* 权限申请

开发者只需要关注功能本身，而不需要处理复杂的系统细节。

## 简单看一下内部架构

为了实现这些功能，MediaAccessX 在内部做了一些架构拆分。

整体执行流程大致如下：

```
MediaAccessX
     │
     ▼
MediaAccessXEngine
     │
     ▼
Builder API
(Camera / Saver / PhotoPicker / FilePicker)
     │
     ▼
Permission Executor
     │
     ▼
Media Executors
(Camera / Saver / PhotoPicker / FilePicker)
     │
     ▼
MediaActivityResultFragment
     │
     ▼
ActivityResultLauncher
     │
     ▼
System Apps
     │
     ▼
Result Callback
```

整个流程可以简单理解为：

1. API 收集用户配置
2. 执行权限检查
3. 调用对应的媒体执行器
4. 通过 Fragment 启动系统组件
5. 接收 ActivityResult 回调

### Builder + Executor 架构

MediaAccessX 中所有功能都遵循同一个模式：

```
Builder → Executor
```

* **Builder**：负责收集配置
* **Executor**：负责真正执行逻辑

例如：

| 功能          | Builder            | Executor            |
|-------------|--------------------|---------------------|
| Camera      | CameraBuilder      | CameraExecutor      |
| Saver       | SaverBuilder       | SaverExecutor       |
| PhotoPicker | PhotoPickerBuilder | PhotoPickerExecutor |
| FilePicker  | FilePickerBuilder  | FilePickerExecutor  |

这样配置层和执行层就完全解耦，每个类的职责也更加清晰。

### Headless Fragment 封装 ActivityResult

ActivityResult API 有一个限制：

> 您必须在创建 fragment 或 activity 之前调用 registerForActivityResult()；但在 fragment 或 activity 的 Lifecycle 达到
> CREATED 之前，您将无法启动 ActivityResultLauncher。

因此这个 API 不能在任意地方动态调用，否则很容易出现生命周期问题。

为了在库内部安全地使用 `ActivityResult`，`MediaAccessX` 使用了一个 `Headless Fragment` 作为桥接层：

```
MediaActivityResultFragment
```

这个 Fragment 专门负责：

* 注册 ActivityResultLauncher
* 启动系统 Intent
* 接收回调结果

这样库就可以：

* 非侵入式使用 ActivityResult
* 自动处理生命周期
* 不需要开发者额外配置

开发者在使用时完全感知不到这个 Fragment 的存在。

## 总结

MediaAccessX 的目标很简单：

**统一 Android 的媒体访问能力，并提供更简洁的调用方式。**

通过一套 DSL API，将常见功能统一起来：

* Camera
* Saver
* PhotoPicker
* FilePicker

最终开发者只需要写非常简单的代码：

```kotlin
MediaAccessX.with(activity)
    .camera()
    .launch { /* 结果处理 */ }
```

如果你在项目中经常需要处理拍照、选图或文件选择，希望 **MediaAccessX** 能帮你减少一些重复工作。

## 项目地址

GitHub
[https://github.com/yuncodelab/mediaaccessx](https://github.com/yuncodelab/mediaaccessx)

欢迎 Star 或提出 Issue，一起完善这个项目。


