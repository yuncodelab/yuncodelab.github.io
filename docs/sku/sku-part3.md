# 电商 SKU 系统设计（三）：Android SKU 选择引擎实现

在前两篇中：

👉 [电商 SKU 系统设计（一）：基于笛卡尔积的 SKU 建模实践](sku-part1.md)

👉 [电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计](sku-part2.md)

我们已经完成了：

* SKU 的本质（规格组合）
* 服务端数据结构（`specList` + `skuList`）

---

这一篇进入客户端部分，目标是实现 SKU 选择能力。

---

## 1. 我们要实现什么效果？

<img src="assets/android-sku-preview.png" width="32%"/>

从页面可以拆解出 3 个核心能力：

1. 展示**规格列表**
2. 处理规格的**选中 / 取消选中**
3. 动态计算每个规格值的**状态: 可选 / 不可选 / 售罄 / 已选中**

---

### SKU 状态是怎么来的？

这里简单说明一下 SKU 状态的来源。

在第一篇中我们提到：规格组合本质是**笛卡尔积**。

假设规格组合一共有 `18` 种，但实际 `skuList` 只包含其中一部分，那么：

* ❌ 不存在的组合 → 不可选（DISABLED）
* ⚠️ 存在但库存为 0 → 售罄（OUT_OF_STOCK）
* ✅ 存在且有库存 → 可选（ENABLED）

---

👉 因此，每个规格值的状态，本质都是：

> 根据当前选择，在 skuList 中匹配计算得到的结果

---

接下来，我们开始实战。

---

## 2. 从 UI 出发：我们到底需要什么数据？

从 UI 出发，我们只需要两类数据：

1. `List<SpecResult>`：用于规格展示（带状态）
2. `SkuResult`：当前选中的 SKU 结果

---

### 1. 规格状态枚举

```kotlin
enum class SpecValueStatus {
    ENABLED,      // 可选
    DISABLED,     // 不可选
    OUT_OF_STOCK, // 售罄
    SELECTED      // 已选中
}
```

---

### 2. UI 展示结构

```kotlin
data class SpecResult(
    val specId: String,
    val specName: String,
    val values: List<SpecValueResult>
)

data class SpecValueResult(
    val id: String,
    val name: String,
    val status: SpecValueStatus
)
```

`SpecResult` 相较于服务端 `specList`，在规格值层增加了 `SpecValueStatus`，用于描述当前规格值在不同选择状态下的可用性。

---

### 3. SKU 选择结果

```kotlin
data class SkuResult(
    val skuId: String,
    val price: Double,
    val stock: Int,
    val specs: List<SelectedSpec>
)

data class SelectedSpec(
    val specId: String,
    val specName: String,
    val valueId: String,
    val valueName: String
)
```

`SkuResult` 相较于服务端 `skuList`，将规格信息从 `Map` 结构转换为结构化的 `SelectedSpec` 列表，用于更清晰地表达当前 SKU
的完整规格组合信息。

---

## 3. UI 与 ViewModel 职责划分

有了数据结构后，UI 需要随着用户操作自动更新。在 Android 中，推荐使用 StateFlow 驱动 UI。

---

### 1. UI 层职责

UI 只做两件事：

1. 初始化 → 渲染数据
2. 点击规格 → 更新页面

```kotlin
// 规格 UI
viewModel.specUiList.collect { list ->
    specAdapter.submitList(list)
}

// SKU 结果
viewModel.selectedSku.collect { sku ->
    updateSkuUi(sku)
}

// 初始化
viewModel.initSku()

// 点击规格
specAdapter = SpecAdapter { specId, valueId ->
    viewModel.selectSpec(specId, valueId)
}

```

---

### 2. ViewModel 职责

`ViewModel` 同样只做两件事：

1. 初始化 → 返回 `List<SpecResult>` + `SkuResult`
2. 点击规格 → 返回 `List<SpecResult>` + `SkuResult`

---

代码如下：

```kotlin
class SkuViewModel : ViewModel() {

    private val _specUiList = MutableStateFlow<List<SpecResult>>(emptyList())
    val specUiList = _specUiList.asStateFlow()

    private val _selectedSku = MutableStateFlow<SkuResult?>(null)
    val selectedSku = _selectedSku.asStateFlow()

    fun initSku() {
        _specUiList.value = skuEngine.initSpecStatus()
        _selectedSku.value = skuEngine.getSelectedSku()
    }

    fun selectSpec(specId: String, valueId: String) {
        _specUiList.value = skuEngine.select(specId, valueId)
        _selectedSku.value = skuEngine.getSelectedSku()
    }
}
```

---

👉 可以看到：

`ViewModel` 不负责任何 SKU 计算，只负责状态流转，所有计算交给 `SkuEngine`。

如果把 SKU 逻辑直接写在 `ViewModel` 中，会导致：

* 逻辑混乱
* 难以维护
* 无法复用

因此，将其抽离为独立模块：

> 👉 SkuEngine

---

## 4. SkuEngine 设计

---

### 4.1 SkuEngine 职责

`SkuEngine` 只负责一件事：

```text
输入：
- specList（规格定义）
- skuList（有效 SKU）

输出：
- List<SpecResult>（UI 展示数据）
- SkuResult（当前选中结果）
```

---

👉 本质上，它解决的是：

> 将服务端返回的数据，转换为客户端可直接使用的状态数据

---

### 4.2 核心状态管理

`SkuEngine` 内部维护一个关键状态：

```kotlin
// 当前已选规格：specId → valueId
private val selectedSpecMap = mutableMapOf<String, String>()
```

它表示用户当前的选择，是所有计算的基础。

---

所有能力都依赖这个状态：

* 规格值是否可选
* 是否售罄
* 当前选中的 SKU 是哪个

---

### 4.3 默认选中逻辑

进入页面时，需要初始化默认选中状态。

处理逻辑如下：

```text
1. 优先使用服务端返回的 defaultSkuId

2. 如果该 SKU 不存在或库存为 0，
   则选择第一个有库存的 SKU

3. 根据目标 SKU，反推其规格组合，
   初始化“当前已选规格”
```

---

👉 本质是：

> 通过 SKU 反推出初始的规格选择状态

---

具体实现可参考：

```text
SkuEngine#initDefaultSelection
```

---

### 4.4 UI 数据构建

`SkuEngine` 需要将原始数据转换为 UI 可直接渲染的结构。

处理逻辑如下：

```text
遍历所有规格维度（specList）

→ 遍历每个规格值

→ 为每个规格值计算当前状态

→ 构建 SpecResult 列表
```

---

👉 本质是：

> 为“每一个规格值”补充一个动态状态

---

具体实现可参考：

```text
SkuEngine#buildSpecUI
```

---

### 4.5 规格状态计算规则（核心）

规格状态的计算基于一种“假设选择”机制。

---

### 计算流程：

```text
1. 如果当前规格值已经被选中
   → SELECTED

2. 否则，模拟将该规格值加入当前选择

3. 在 skuList 中查找所有匹配该组合的 SKU：

   - 无匹配 SKU
     → DISABLED（不可选）

   - 有匹配但库存为 0
     → OUT_OF_STOCK（售罄）

   - 有匹配且库存 > 0
     → ENABLED（可选）
```

---

👉 本质可以总结为：

> 当前选择 + 尝试组合 → 匹配 skuList

---

示例代码如下：

```kotlin
    private fun calculateStatus(specId: String, valueId: String): SpecValueStatus {

    if (selectedSpecMap[specId] == valueId) {
        return SpecValueStatus.SELECTED
    }

    val tempSelected = selectedSpecMap.toMutableMap()
    tempSelected[specId] = valueId

    val matchedSkus = skuList.filter { sku ->
        tempSelected.all { (sId, vId) ->
            sku.specs[sId] == vId
        }
    }

    if (matchedSkus.isEmpty()) {
        return SpecValueStatus.DISABLED
    }

    if (matchedSkus.all { it.stock <= 0 }) {
        return SpecValueStatus.OUT_OF_STOCK
    }

    return SpecValueStatus.ENABLED
}
```

---

### 4.6 对外能力（供 ViewModel 使用）

`SkuEngine` 对外提供三个核心能力：

---

#### 1. 初始化规格状态

```kotlin
// 初始化默认选中状态，并返回完整规格 UI 数据
fun initSpecStatus(): List<SpecResult> {
    ...
}
```

---

#### 2. 更新规格选择

```kotlin
// 更新当前选择状态，并重新计算所有规格值状态
fun select(specId: String, valueId: String): List<SpecResult> {
    ...
}
```

---

#### 3. 获取当前 SKU

```kotlin
// 根据当前选择，返回匹配的 SKU（若未选完整则返回空）
fun getSelectedSku(): SkuResult? {
    ...
}
```

---

更多具体实现可参考：

```text
SkuEngine
```

---

## 5. 性能优化与架构思考

### 1. 时间复杂度

每次点击都会遍历所有规格值。

假设：

* M 个规格
* N 个规格值
* K 个 SKU

复杂度约为：

O(M × N × K)

在普通电商场景（K < 500）中，Android 端通常 < 5ms，可忽略。

---

### 2. 为什么不推荐复杂算法？

虽然图结构或邻接矩阵更高效，但：

* 实现复杂
* 调试困难
* 可维护性差

对于 95% 的业务场景：

> “假设校验法”才是工程上的最优解

---

## 6. 总结

这一篇完成了 SKU 系统最关键的一环：

> **逻辑与 UI 的彻底分离**

---

* `UI`：只负责响应用户操作
* `ViewModel`：负责状态流转
* `SkuEngine`：负责复杂逻辑计算与转换

---

最终效果：

<img src="assets/android-sku-demo.gif" width="32%"/>

---

**Android 完整代码示例：**
👉 [sku-engine-android](https://github.com/yuncodelab/sku-engine-android)

---

> 系列回顾：
>
> * [第一篇：基于笛卡尔积的 SKU 建模实践](sku-part1.md)
> * [第二篇：服务端 SKU 接口与数据设计](sku-part2.md)
> * 第三篇：Android SKU 选择引擎实现（本文）

---
