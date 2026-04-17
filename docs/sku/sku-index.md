# 🧩 SKU System Design

一个完整的电商 SKU 系统设计与落地实现方案。

本项目从「数据建模 → 服务端设计 → Android 选择引擎实现」完整讲解 SKU 系统的核心实现逻辑。

---

## 🎯 你可能正在遇到的问题

在电商商品系统中，SKU 通常会带来以下复杂问题：

- ❓ UI 层需要的数据结构到底是什么？
- ❓ 服务端如何组织 SKU 与规格数据？
- ❓ 前端如何实现“规格联动选择”（选了颜色后尺码动态变化）？
- ❓ SKU 选择逻辑应该放在服务端还是客户端？

本系列用一套完整 Demo 讲清楚这些问题的本质。

---

## 🧠 系列设计目标

本项目不是一个完整电商系统，而是一个**SKU 核心机制学习模型**：

- 用最小复杂度还原真实 SKU 问题
- 提取 SKU 系统的核心抽象模型
- 讲清楚服务端与客户端的职责边界
- 实现一个可运行的 Android SKU 选择引擎

---

## 🧱 系列内容结构

### 📘 ① SKU 建模基础（理论层）

👉 [电商 SKU 系统设计（一）：基于笛卡尔积的 SKU 建模实践](sku-part1.md)

核心内容：

- SKU 本质：笛卡尔积子集
- SKU 数据模型设计
- SKU 组合生成逻辑
- 设计边界说明

---

### 🏗️ ② 服务端设计（数据层）

👉 [电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计](sku-part2.md)

核心内容：

- SPU / SKU 表结构设计
- specList + skuList 数据结构
- 服务端数据组装逻辑
- defaultSkuId 设计思考
- 服务端职责边界

---

### 📱 ③ Android 选择引擎（客户端层）

👉 [电商 SKU 系统设计（三）：Android SKU 选择引擎实现](sku-part3.md)

核心内容：

- UI 需要的数据结构设计
- SkuEngine 核心算法实现
- 规格状态联动（可选 / 不可选）
- ViewModel 驱动 UI 更新

---

## 🚀 Demo 项目

### ☕ Java 服务端 Demo

[sku-engine-java](https://github.com/yuncodelab/sku-engine-java)

👉 提供 SKU 数据接口：

```
GET /v1/spu/1/detail
```

返回结构：

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
````

---

### 📱 Android Demo

[sku-engine-android](https://github.com/yuncodelab/sku-engine-android)

<img src="assets/android-sku-demo.gif" width="32%"/>

实现：

* SKU 选择界面
* SkuEngine 状态计算
* 规格联动逻辑
* ViewModel 状态驱动 UI

---

## ⚠️ 设计边界说明

为了聚焦核心 SKU 机制，本项目做了适当简化：

* ❌ 未包含 SKU 图片 / 名称联动
* ❌ 未处理价格区间（如 ¥199~¥299）
* ❌ defaultSkuId 为服务端固定返回
* ❌ 未涉及库存锁定 / 并发扣减 / 营销价格体系

---

## ✔ 实际业务扩展方向

在真实电商系统中，SKU 通常会扩展为：

* SKU 图片与规格联动展示
* 多价格体系（活动价 / 会员价 / 阶梯价）
* 默认 SKU 动态计算（库存 / 销量 / 推荐算法）
* 库存锁定与并发控制
* 更复杂的促销与组合优惠体系

---

## 📌 适合谁看？

* Android / Java 后端开发者
* 想理解 SKU 本质的人
* 想做电商系统设计的人
* 想提升架构设计能力的人

---

## 📎 项目链接

* Java Demo：[sku-engine-java](https://github.com/yuncodelab/sku-engine-java)
* Android Demo：[sku-engine-android](https://github.com/yuncodelab/sku-engine-android)

---

## 🧭 阅读建议

建议按顺序阅读：

1. [SKU 建模](sku-part1.md)（理解本质）
2. [服务端设计](sku-part2.md)（理解数据结构）
3. [Android 实现](sku-part3.md)（理解落地）

---

## ⭐ 核心一句话总结

> SKU 系统的本质，是“规格组合状态的可计算问题”，而不是简单的商品属性展示。
