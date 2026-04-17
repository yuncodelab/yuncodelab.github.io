# 电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计

---

在上一篇 👉

[《电商 SKU 系统设计（一）：基于笛卡尔积的 SKU 建模实践》](sku-part1.md)

中，我们已经明确了三个核心结论：

* SKU 的本质是「笛卡尔积的子集」
* 通用数据结构为：`specList + skuList`
* SKU 状态计算由客户端完成

---

那么接下来一个更贴近工程的问题是：

> ❓ 服务端如何设计并构建 SKU 数据结构？

这一篇的目标非常明确：

> 👉 从数据库出发，构建出客户端可直接使用的 SKU 数据模型（specList + skuList）

---

## 1. 服务端的职责边界

在 SKU 系统中，服务端与客户端的职责必须严格拆分，否则系统会迅速复杂化。

---

### ❗ 服务端不负责

以下逻辑**不应出现在服务端**：

* ❌ SKU 是否可选（状态计算）
* ❌ 用户点击后的联动逻辑
* ❌ 规格禁用 / 高亮判断
* ❌ SKU 实时可选路径计算

---

### ✔ 服务端只负责

服务端的核心职责是：

```
1. 提供规格全集（specList）
2. 提供真实 SKU 集合（skuList）
3. 提供基础业务属性（价格 / 库存等）
```

---

### ✔ 一句话总结

> 服务端负责“数据构建”，客户端负责“状态计算”

---

## 2. 数据库表设计

SKU 系统本质是一个“多维组合关系模型”，因此需要拆解为四类实体：

```
SPU（商品主体）
SKU（具体组合）
Spec（规格维度）
SpecValue（规格值）
```

---

### 2.1 商品表（t_spu）

```sql
DROP TABLE IF EXISTS `t_spu`;
CREATE TABLE `t_spu`
(
    `id`             bigint(20) NOT NULL AUTO_INCREMENT,
    `name`           varchar(100) NOT NULL COMMENT '商品名称',
    `default_sku_id` bigint(20) DEFAULT NULL COMMENT '默认展示SKU',
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SPU表';
```

👉 SPU 是 SKU 的聚合上层

---

### 2.2 SKU 表（t_sku）

```sql
DROP TABLE IF EXISTS `t_sku`;
CREATE TABLE `t_sku`
(
    `id`     bigint(20) NOT NULL AUTO_INCREMENT,
    `spu_id` bigint(20) NOT NULL,
    `price`  decimal(10, 2) NOT NULL DEFAULT '0.00',
    `stock`  int(11) NOT NULL DEFAULT '0',
    PRIMARY KEY (`id`),
    INDEX    `idx_spu_id` (`spu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU表';
```

👉 每一行代表一个“真实存在的组合”

---

### 2.3 规格定义表（t_spec_key）

```sql
DROP TABLE IF EXISTS `t_spec_key`;
CREATE TABLE `t_spec_key`
(
    `id`        bigint(20) NOT NULL AUTO_INCREMENT,
    `spec_code` varchar(50) NOT NULL COMMENT '规格标识',
    `spec_name` varchar(50) NOT NULL COMMENT '规格名称',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_spec_code` (`spec_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规格维度表';
```

👉 表示“有哪些维度”

---

### 2.4 规格值表（t_spec_value）

```sql
DROP TABLE IF EXISTS `t_spec_value`;
CREATE TABLE `t_spec_value`
(
    `id`         bigint(20) NOT NULL AUTO_INCREMENT,
    `spec_id`    bigint(20) NOT NULL,
    `value_code` varchar(50) NOT NULL,
    `value_name` varchar(50) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_value_code` (`spec_id`, `value_code`),
    INDEX        `idx_spec_id` (`spec_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规格值表';
```

👉 表示“维度下的取值空间”

---

### 2.5 SKU 关联表（t_sku_spec_rel）

```sql
DROP TABLE IF EXISTS `t_sku_spec_rel`;
CREATE TABLE `t_sku_spec_rel`
(
    `id`            bigint(20) NOT NULL AUTO_INCREMENT,
    `sku_id`        bigint(20) NOT NULL,
    `spec_id`       bigint(20) NOT NULL,
    `spec_value_id` bigint(20) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_sku_spec` (`sku_id`, `spec_id`),
    INDEX           `idx_sku_id` (`sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SKU规格映射表';
```

👉 用于表达 SKU ↔ 多维规格的映射关系

---

### ✔ 关系总结

```
SPU (1)
 └── SKU (N)
       └── SKU_SPEC_REL (N)
              ↙        ↘
        SPEC_KEY     SPEC_VALUE
```

---

### ✔ 核心设计思想

> SKU = 多维规格组合
> 👉 用“中间表”表达多对多关系

---

## 3. 为什么不使用“冗余字段设计”？

很多初学者会选择：

```sql
t_sku
- color
- size
- style
```

---

### ❌ 问题

这种设计存在结构性问题：

* 扩展维度必须改表结构
* SKU 模型强耦合业务
* 无法支持通用规格系统

---

### ✔ 当前设计优势

当前方案的本质是：

> 用结构复杂度换取系统扩展性

优势包括：

* 支持动态规格扩展
* 支持任意维度组合
* 更符合通用电商模型

---

## 4. SKU 查询流程设计

目标非常明确：

> 👉 根据 spuId 构建 specList + skuList

---

### ✔ 标准查询流程

#### Step 1：查询 SPU

```sql
SELECT *
FROM t_spu
WHERE id = ?
```

---

#### Step 2：查询 SKU 列表

```sql
SELECT *
FROM t_sku
WHERE spu_id = ?
```

---

#### Step 3：查询 SKU 关联关系

```sql
SELECT *
FROM t_sku_spec_rel
WHERE sku_id IN (...)
```

---

#### Step 4：提取规格维度

```java
List<Long> specIds = rels.stream()
    .map(SkuSpecRelEntity::getSpecId)
    .distinct()
    .toList();
```

---

#### Step 5：查询规格定义

```sql
SELECT *
FROM t_spec_key
WHERE id IN (...);

SELECT *
FROM t_spec_value
WHERE spec_id IN (...);
```

---

### ✔ 设计关键点

> 所有查询必须“批量化”，避免 N+1 查询问题

---

## 5. 数据组装

### 5.1 最终返回结构是什么

服务端的目标，并不是返回数据库中的原始表数据，而是构建一个可供客户端直接使用的结构：

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
```

其中：

* **specList**：描述所有规格维度及其可选值
* **skuList**：描述所有真实存在的 SKU 组合
* **defaultSkuId**：默认选中的 SKU

---

### 5.2 数据来源有哪些

上述结构的数据，来源于多张表的数据组合：

```text
specList 来自：
- SpecKey（规格定义）
- SpecValue（规格值）

skuList 来自：
- SKU 表
- SKU 与规格的关系表（SKU-Spec）
```

这些数据在数据库中是分散存储的，且通过关系进行关联。

---

### 5.3 转换过程做了什么

服务端需要在内存中完成一次数据结构转换，将分散的关系数据重组为目标结构。

这个过程可以抽象为三步：

---

1. 聚合规格维度：将规格定义（SpecKey）与规格值（SpecValue）按 specId 进行聚合，构建出每个规格维度及其可选值列表，形成
   specList。

2. 构建 SKU 组合：基于 SKU 表和 SKU-Spec 关系表，为每个 SKU 构建其规格组合信息，形成 specId → valueId 的映射关系，生成
   skuList。

3. 形成结构化数据：将上述结果组合为统一的接口返回结构（specList + skuList + defaultSkuId），供客户端直接使用。

---

整个过程的本质是：

```text
将“分散的关系数据”转换为“结构化的组合数据”
```

---

### 5.4 关于实现

数据组装过程涉及较多实现细节，本文不再展开。

具体实现可参考项目中的：

```text
SpuDetailBO#transform
```

---

## 6. defaultSkuId 设计说明

当前 demo 中：

```
defaultSkuId = 手动写入 t_spu 表
```

---

### ✔ 设计目的

* 简化初始化逻辑
* 支持前端默认展示

---

### ❗ 实际业务中通常：

* 基于库存优先级
* 基于销量排序
* 基于推荐策略计算

---

> 👉 default SKU 本质是“策略问题”

---

## 7. 总结

这一篇我们完成了 SKU 系统中非常关键的一步：

> 👉 从数据库构建标准 SKU 数据结构

---

### ✔ 全流程回顾

```
1. 查询 SPU
2. 查询 SKU
3. 查询 SKU 关联关系
4. 查询规格定义
5. 构建 specList
6. 构建 skuList
7. 返回结构
```

---

### ✔ 最终输出

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
```

---

👉 Java 服务端 Demo：
[sku-engine-java](https://github.com/yuncodelab/sku-engine-java)

---

## 8. 下一篇预告

现在我们已经拿到了完整数据：

```
specList + skuList + defaultSkuId
```

---

下一步进入真正的核心：

> ❓ 客户端如何实现 SKU 选择状态计算？

---

👉 下一篇：[《电商 SKU 系统设计（三）：Android SKU 选择引擎实现》](sku-part3.md)

将实现：

* SKU 状态计算模型
* SkuEngine 设计
* UI 状态联动机制

---