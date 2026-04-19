# 电商 SKU 系统设计（一）：SKU 数据结构设计（基于笛卡尔积）

在 [电商 SKU 系统设计开篇](./index.md) 中，我们已经明确了：

* 本系列的核心数据结构：

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
```

但问题是：

> ❓ 为什么是这个结构？  
> ❓ 有没有更本质的建模方式？

本文将从“数学抽象”出发，推导出一套通用的 SKU 建模方案。

## 1. SKU 基本概念

在开始之前，我们先搞清楚 3 个核心概念。

### 1. SPU（Standard Product Unit）

SPU 表示**标准商品单元**，即“商品本体”。

例如：

* iPhone 15
* Nike Air Force 1

👉 SPU = 不带规格的抽象商品

### 2. Spec（规格维度）

Spec 表示商品的**可选维度**，例如：

* 颜色（黑 / 白 / 蓝）
* 尺码（M / L / XL）
* 款式（运动 / 休闲）

👉 Spec = 决策维度（维度本身）

### 3. SKU（Stock Keeping Unit）

SKU 是**最小库存单元**，由一组规格组合唯一确定。

例如：

```
黑色 + M + 运动款
```

每个 SKU 对应：

* 唯一 ID
* 价格
* 库存

---

### ✔ 核心关系总结

> SPU 是商品本体  
> Spec 是规格维度  
> SKU 是规格组合结果

## 2. SKU 的数学本质：笛卡尔积

### 举个例子

一个商品有如下规格：

```
颜色：3种（黑 / 白 / 蓝）
尺码：3种（M / L / XL）
款式：2种（运动 / 休闲）
```

理论组合数量为：

```
3 × 3 × 2 = 18
```

在数学上，这种组合关系称为：

> 👉 笛卡尔积（Cartesian Product）

### 可视化理解

<img src="./assets/sku-cartesian-product.png" width="60%" />

---

### ⚠️ 现实情况

实际业务中：

❌ 并不是所有组合都存在

例如：

```text
黑色 + L + 休闲  ❌（不存在该 SKU）
```

因此：

> 实际 SKU = 规格全集笛卡尔积的「有效子集」。

## 3. 如何设计一个通用 SKU 数据模型？

SKU 系统本质是对“组合关系”的表达，因此需要描述两类信息：

```
① 规格维度（Spec）
② 真实 SKU 组合（SKU）
```

核心模型为：

```
specList
skuList
```

### specList

规格全集：有哪些维度可以选。

```json
{
  "specList": [
    {
      "specId": "style",
      "specName": "款式",
      "values": [
        {
          "id": "sport",
          "name": "运动款"
        },
        {
          "id": "casual",
          "name": "休闲款"
        }
      ]
    },
    {
      "specId": "color",
      "specName": "颜色",
      "values": [
        {
          "id": "black",
          "name": "黑色"
        },
        {
          "id": "white",
          "name": "白色"
        },
        {
          "id": "blue",
          "name": "蓝色"
        }
      ]
    },
    {
      "specId": "size",
      "specName": "尺码",
      "values": [
        {
          "id": "m",
          "name": "M"
        },
        {
          "id": "l",
          "name": "L"
        },
        {
          "id": "xl",
          "name": "XL"
        }
      ]
    }
  ]
}
```

> 💡 Tips：这里的 specId 并不局限于颜色或尺码。
> 
> 由于我们采用了数组结构存储 specList，系统可以支持 N 维规格（如：产地、套餐、年份等），而无需修改任何核心算法代码。

### skuList

SKU 列表：哪些组合存在。

```json
{
  "skuList": [
    {
      "skuId": "1",
      "price": 199.0,
      "stock": 12,
      "specs": {
        "color": "black",
        "size": "m",
        "style": "sport"
      }
    },
    {
      "skuId": "2",
      "price": 199.0,
      "stock": 0,
      "specs": {
        "color": "black",
        "size": "l",
        "style": "sport"
      }
    }
    ...
  ]
}
```

## 4. SKU 选择算法（核心思想）

回到最核心问题：

> 系统如何判断某个规格是否可选？

### 示例

当前选择：

```
颜色 = 黑色
尺码 = M
```

判断：

```
款式 = 运动 是否可选？
```

### 算法过程

#### Step 1：构造假设组合

```
黑色 + M + 运动
```

#### Step 2：匹配 skuList

检查是否存在该组合 SKU。

#### Step 3：状态判断

结果分三类：

```
不存在 SKU → DISABLED（不可选）

存在但库存 = 0 → OUT_OF_STOCK（售罄）

存在且库存 > 0 → ENABLED（可选）
```

### ✔ 核心算法本质

> 当前选择 + 组合推演 + SKU 匹配

## 5. 为什么 SKU 选择必须在客户端执行？

这是一个典型的架构分工问题。

### ❌ 如果放在服务端

* 每次点击都请求接口
* 状态组合爆炸
* 延迟高、体验差

### ✔ 正确方式

> 一次性返回 skuList，由客户端计算状态

### 优势

* 无网络延迟
* 状态实时更新
* 可扩展性强
* 逻辑集中在本地

## 6. 总结

本文完成了 SKU 系统最核心的建模推导：

* SKU 本质：**规格集合的笛卡尔积**
* 实际 SKU：**笛卡尔积的子集**
* 数据结构：`specList + skuList`
* 计算位置：**客户端执行**

## 7. 下一篇预告

在完成数据建模之后，下一个问题是：

> ❓ 服务端如何设计数据库，并生成 `specList + skuList`？

👉 下一篇将进入：

[电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计](./sku-part2.md)

👉 如果你更关注客户端实现，也可以直接阅读：

[电商 SKU 系统设计（三）：Android SKU 选择引擎实现](./sku-part3.md)

