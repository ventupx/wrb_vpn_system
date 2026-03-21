## Why

项目中的 x-ui/3x-ui 节点新建、节点修改、面板迁移和版本分支逻辑分散在 `users/views.py` 与 `panels/views.py` 的多个流程中，当前缺少一份可直接用于排查、对接和二次开发的统一说明。现在需要把新建节点提交到面板的参数、面板登录与鉴权参数、节点修改时的更新载荷，以及 x-ui vless 场景下的版本号判断规则集中整理出来，降低维护成本和误改风险。

## What Changes

- 新增一份面向项目维护者的 x-ui/3x-ui 节点流程说明，覆盖新建节点、修改节点、迁移节点三个主流程。
- 归纳新建节点时需要准备的面板参数、节点参数、协议差异参数，以及 `host_config` / `config_text` 的来源与结构。
- 归纳节点修改与迁移时复用的更新接口、请求路径、请求头、提交体结构和字段转换规则。
- 单独总结 x-ui 面板在 `vless` 场景下的版本号检查逻辑，包括 `/server/status` 请求、版本分支和 `flow` 字段赋值规则。
- 在仓库根目录生成一份 Markdown 文档，便于后续检索、评审和实现参考。

## Capabilities

### New Capabilities
- `xui-3xui-node-documentation`: 为项目内 x-ui/3x-ui 节点创建、修改、迁移和版本判断流程提供统一的结构化参考文档。

### Modified Capabilities

## Impact

- 主要影响文档资产和变更说明，不改变线上业务行为。
- 直接参考的代码范围包括 `users/views.py`、`panels/views.py`、`panels/models.py`。
- 输出产物包括 OpenSpec 变更工件和仓库根目录的 x-ui/3x-ui 说明文档。
