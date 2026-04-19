# 电商 SKU 系统设计（二）：服务端 SKU 建模与接口设计

在上一篇 👉 [电商 SKU 系统设计（一）：SKU 数据结构设计（基于笛卡尔积）](./sku-part1.md) 中，我们已经明确了三个核心结论：

* SKU 的本质是「笛卡尔积的子集」
* 通用数据结构为：`specList + skuList`
* SKU 状态计算由客户端完成

---

那么接下来一个更贴近工程的问题是：

> ❓ 服务端如何设计并构建 SKU 数据结构？

## 1. 服务端的职责边界

在 SKU 系统中，服务端与客户端的职责必须严格拆分，否则系统会迅速复杂化。

### ❗ 服务端不负责

以下逻辑**不应出现在服务端**：

* ❌ SKU 是否可选（状态计算）
* ❌ 用户点击后的联动逻辑
* ❌ 规格禁用 / 高亮判断
* ❌ SKU 实时可选路径计算

### ✔ 服务端只负责

服务端的核心职责是：

```
1. 提供规格全集（specList）
2. 提供真实 SKU 集合（skuList）
3. 提供基础业务属性（价格 / 库存等）
```

### ✔ 一句话总结

> 服务端负责“数据构建”，客户端负责“状态计算”

## 2. 数据库表设计

SKU 系统本质是一个“多维组合关系模型”，因此需要拆解为四类实体：

```
SPU（商品主体）
SKU（具体组合）
Spec（规格维度）
SpecValue（规格值）
```

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

### ✔ 关系总结

```
SPU (1)
 └── SKU (N)
       └── SKU_SPEC_REL (N)
              ↙        ↘
        SPEC_KEY     SPEC_VALUE
```

### ✔ 核心设计思想

> SKU = 多维规格组合  
> 👉 用“中间表”表达多对多关系

## 3. 为什么不使用“冗余字段设计”？

一种常见做法是：

```text
在 SKU 表中直接冗余字段：
color = "black"
size = "M"
```

这种方式看起来更简单，但存在明显问题：

---

### ❌ 问题 1：扩展性差

新增规格维度：

```text
需要改表结构（加字段）
```

### ❌ 问题 2：通用性差

* 无法支持动态规格
* 不适用于多品类商品

### ❌ 问题 3：维护复杂

* 查询逻辑分散
* 数据一致性难保证

---

👉 对比之下：

```text
映射表（t_sku_spec）方案更通用、更可扩展
```

## 4. SKU 查询流程设计

有了表结构后，核心问题变成：

> ❓ 如何从数据库构建 `specList + skuList`？

### 查询流程

```text
查询 SPU 基础信息（t_spu）
 ↓
查询 SKU 列表（t_sku）
 ↓
查询 SKU 关联关系（t_sku_spec_rel）
 ↓
查询规格定义（t_spec_key + t_spec_value）
 ↓
组装 specList + skuList
```

### 核心代码

核心伪代码如下：

```java
// 1. 查询 SPU 基础信息（t_spu）
SpuEntity spu = spuRepository.getById(spuId);

// 2. 查询 SKU 列表 
List<SkuEntity> skus = skuRepository.findBySpuId(spuId);

List<Long> skuIds = skus.stream().map(SkuEntity::getId).toList();

// 3. 查询 SKU 关联关系
List<SkuSpecRelEntity> rels = skuRepository.findRelsBySkuIds(skuIds);

// 提取所有涉及到的规格键 ID
List<Long> specKeyIds = rels.stream()
    .map(SkuSpecRelEntity::getSpecId)
    .distinct()
    .toList();

// 4. 查询规格定义
List<SpecKeyEntity> keys = specRepository.findKeysByIds(specKeyIds);
List<SpecValueEntity> values = specRepository.findValuesBySpecIds(specKeyIds);

// 构建 BO 对象执行转换逻辑
SpuDetailBO bo = new SpuDetailBO(spu, skus, keys, values, rels);

// 5. 转换为specList + skuList + defaultSkuId
SpuDetailResponse response = bo.transform();
```

> 💡 关于 `bo.transform()` 的实现思路：  
> 具体的代码实现并不复杂，核心是利用 **Map 结构** 将 `SpecKey` 和 `SpecValue` 进行归类。  
> 在 `skuList` 的构建中，将 `rel` 表中的规格标识转换为数组。

## 5. defaultSkuId 设计说明

当前 demo 中：

```
defaultSkuId = 手动写入 t_spu 表
```

### ✔ 设计目的

* 简化初始化逻辑
* 支持前端默认展示

### ❗ 实际业务中通常：

* 基于库存优先级
* 基于销量排序
* 基于推荐策略计算

> 👉 default SKU 本质是“策略问题”

## 6. 总结

这一篇我们完成了 SKU 系统中非常关键的一步：

> 👉 从数据库构建标准 SKU 数据结构

### ✔ 全流程回顾

```
1. 查询 SPU
2. 查询 SKU
3. 查询 SKU 关联关系
4. 查询规格定义
5. 构建 specList + skuList
6. 返回结构
```

### ✔ 最终输出

```json
{
  "specList": [],
  "skuList": [],
  "defaultSkuId": "xxx"
}
```

👉 Java 服务端 Demo：
[sku-engine-java](https://github.com/yuncodelab/sku-engine-java)

## 7. 下一篇预告

现在我们已经拿到了完整数据：

```
specList + skuList + defaultSkuId
```

下一步进入真正的核心：

> ❓ 客户端如何实现 SKU 选择状态计算？

👉 下一篇：[电商 SKU 系统设计（三）：Android SKU 选择引擎实现](./sku-part3.md)

