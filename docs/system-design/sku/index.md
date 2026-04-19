# 🧩 电商 SKU 系统设计开篇

在电商 App 中，我们经常会看到这样的商品规格选择界面：

<img src="./assets/android-sku-demo.gif" width="32%"/>

---

它看起来只是几个按钮的切换，但背后隐藏着一些复杂的逻辑，系统需要实时判断：

* 哪些规格可以选择
* 哪些规格应该置灰
* 哪些规格是库存不足

这背后是一个经典问题：

> SKU 系统的状态计算问题：这本质上是一个‘假设路径校验’的算法问题。  
> 👉 我们将在第三篇：Android 引擎实现中详细拆解其核心逻辑。

---

本项目将从「数据建模 → 服务端设计 → Android 选择引擎实现」完整讲解 SKU 系统的实现逻辑。

## 🛰️ 核心设计

本系列统一采用如下数据结构作为前后端通信协议：

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
````

- `specList`：规格全集（定义有哪些维度）
- `skuList`：有效 SKU 列表（定义哪些组合存在）
- `defaultSkuId`：默认选中的 SKU

---

> 关于为什么采用该结构，以及其数学本质（笛卡尔积）。  
> 👉 我们将在第一篇 SKU 建模与数据结构设计中详细展开：

## 🚧 设计边界

为了聚焦核心 SKU 模型，本示例做了适当简化：

* ❌ 未包含 SKU 图片 / 名称联动
* ❌ 未处理价格区间（如 ¥199~¥299）
* ❌ defaultSkuId 为服务端固定返回
* ❌ 未涉及库存锁定 / 并发扣减

### ✔ 实际业务扩展方向

* SKU 图片随规格联动变化
* 多价格体系（活动价 / 会员价）
* 默认 SKU 动态推荐（库存 / 销量）
* 更复杂的库存与促销体系

## 🧱 章节导航

1. [电商 SKU 系统设计（一）：SKU 数据结构设计（基于笛卡尔积）](./sku-part1.md)

   > **重点**：为什么 `specList + skuList` 是一种通用且合理的建模方式

2. [电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计](./sku-part2.md)

   > **重点**：数据库如何存储，以及如何聚合数据生成上述 JSON 结构。

3. [电商 SKU 系统设计（三）：Android SKU 选择引擎实现](./sku-part3.md)

   > **重点**：Android 端拿到 JSON 后，如何实现动态规格选择与状态计算。

## 🛠️ 开源仓库

本系列配套了完整的代码实现，包含 Java 服务端 Demo 与 Android 客户端 Demo。

* **Java 服务端 Demo**：[sku-engine-java](https://github.com/yuncodelab/sku-engine-java)
* **Android 客户端 Demo**：[sku-engine-android](https://github.com/yuncodelab/sku-engine-android)

## 下一篇预告

我们首先来看第一个问题：
> 为什么采用 specList + skuList + defaultId 结构？

👉 下一篇将进入：

[电商 SKU 系统设计（一）：SKU 数据结构设计（基于笛卡尔积）](./sku-part1.md)
