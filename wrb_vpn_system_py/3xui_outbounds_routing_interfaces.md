# 3x-ui 路由规则 / 出站规则接口总结

## 1. 文档目的

本文只总结当前项目里与 **3x-ui 出站规则、路由规则、入站与出站绑定** 相关的本地 API 和实际面板调用方式。

重点回答：

- 本地 API `api/agent-panel/{id}/outbounds/` 到底做什么。
- 新增出站规则、修改出站规则、删除出站规则，在当前项目里应该怎么做。
- 入站和出站绑定是否有单独接口。
- 保存后是否需要重启 Xray。

本文基于以下代码整理：

- `panels/views.py`
- `vpncms/urls.py`
- `users/views.py`

## 2. 路由前缀

`AgentPanelViewSet` 注册在：

- `/api/agent-panel/`

因此本文提到的 detail action 实际路径格式都是：

- `/api/agent-panel/{panel_id}/{action_name}/`

例如你提到的：

- `/api/agent-panel/286/outbounds/`

对应的就是 `AgentPanelViewSet.outbounds`。

## 3. 本地 API 总览

当前项目里与 3x-ui 路由/出站相关的本地 API 实际上只有 3 个：

| 本地 API | 方法 | 视图方法 | 作用 |
| --- | --- | --- | --- |
| `/api/agent-panel/{id}/outbounds/` | `GET` | `outbounds` | 读取 3x-ui 当前完整 Xray 配置 |
| `/api/agent-panel/{id}/save_outbounds/` | `POST` | `save_outbounds` | 保存整个 Xray 配置 |
| `/api/agent-panel/{id}/restart_xray/` | `POST` | `restart_xray` | 重启 3x-ui 的 Xray 服务 |

结论先说：

- **没有单独的**“新增出站规则 API”
- **没有单独的**“修改出站规则 API”
- **没有单独的**“删除出站规则 API”
- **没有单独的**“绑定入站到出站 API”

这些操作在当前项目里本质上都归结为：

1. 先获取完整 `xraySetting`
2. 在调用方修改 `outbounds` 或 `routing.rules`
3. 再把完整 `xraySetting` 整体提交回去

## 4. 本地 API 与 3x-ui 面板接口的映射

### 4.1 获取配置

本地 API：

- `GET /api/agent-panel/{id}/outbounds/`

实际调用 3x-ui：

- `POST http://{panel.ip_address}/panel/xray/`

### 4.2 保存配置

本地 API：

- `POST /api/agent-panel/{id}/save_outbounds/`

实际调用 3x-ui：

- `POST http://{panel.ip_address}/panel/xray/update`

### 4.3 重启 Xray

本地 API：

- `POST /api/agent-panel/{id}/restart_xray/`

实际调用 3x-ui：

- `POST http://{panel.ip_address}/server/restartXrayService`

## 5. 获取出站规则接口

### 5.1 本地接口

- 路径：`/api/agent-panel/{id}/outbounds/`
- 方法：`GET`

### 5.2 代码位置

- `panels/views.py` 中的 `outbounds`

### 5.3 逻辑

该接口只支持 `panel_type == '3x-ui'`。

主要流程：

1. 根据 `panel_id` 找到 `AgentPanel`
2. 读取面板连接参数
3. 如果没有 Cookie，就先登录
4. 调用 3x-ui 的 `/panel/xray/`
5. 解析返回中的 `obj`
6. 把解析后的完整对象直接返回给前端

### 5.4 实际返回的不是“仅出站规则”

虽然本地接口名字叫 `outbounds`，但它返回的其实不是单独的 `outbounds` 数组，而是：

- 3x-ui `/panel/xray/` 返回的 `obj` JSON 字符串
- 经过 `json.loads(...)` 后得到的 **完整配置对象**

也就是说，这个接口返回的数据通常是完整的：

- `xraySetting.outbounds`
- `xraySetting.routing.rules`
- 以及其他 Xray 配置项

因此：

- 这个接口更准确的理解是“获取整个 Xray 配置”
- 不是一个只查“出站列表”的轻量接口

### 5.5 请求头

当前项目在读取 `/panel/xray/` 时使用的头：

| Header | 值 |
| --- | --- |
| `Content-Type` | `application/x-www-form-urlencoded; charset=UTF-8` |
| `host` | `panel_info['ip'].split('/')[0]` |
| `Accept` | `application/json, text/plain, */*` |
| `User-Agent` | 浏览器 UA |
| `Origin` | `http://{panel_info['ip'].split('/')[0]}` |
| `Referer` | `http://{panel_info['ip']}/panel` |

认证方式依赖：

- 面板 Cookie

## 6. 保存出站规则接口

### 6.1 本地接口

- 路径：`/api/agent-panel/{id}/save_outbounds/`
- 方法：`POST`

### 6.2 代码位置

- `panels/views.py` 中的 `save_outbounds`

### 6.3 关键结论

这个接口不是 patch 风格，也不是增量更新。

它的做法是：

1. 直接读取 `request.data`
2. 把 `request.data` 做 `json.dumps`
3. 包装成：

```json
{
  "xraySetting": "<json string>"
}
```

4. 发给 3x-ui 的 `/panel/xray/update`

也就是说，**调用方传入的 `request.data` 必须就是完整的 Xray 配置对象**，至少应该是完整的 `xraySetting` 内容，而不是“只传一条新增规则”。

### 6.4 当前项目对 `save_outbounds` 的真实要求

从代码看，`save_outbounds` 期望接收的是：

- 一整份可直接写回 3x-ui 的 Xray 配置对象

不是：

- `{"action": "add", ...}`
- `{"new_outbound": {...}}`
- `{"delete_tag": "xxx"}`

这种局部操作指令

### 6.5 请求头

保存时使用的头和读取时基本一致：

| Header | 值 |
| --- | --- |
| `Content-Type` | `application/x-www-form-urlencoded; charset=UTF-8` |
| `host` | `panel_info['ip'].split('/')[0]` |
| `Accept` | `application/json, text/plain, */*` |
| `User-Agent` | 浏览器 UA |
| `Origin` | `http://{panel_info['ip'].split('/')[0]}` |
| `Referer` | `http://{panel_info['ip']}/panel` |

## 7. 重启 Xray 接口

### 7.1 本地接口

- 路径：`/api/agent-panel/{id}/restart_xray/`
- 方法：`POST`

### 7.2 代码位置

- `panels/views.py` 中的 `restart_xray`

### 7.3 作用

该接口只做一件事：

- 调用 3x-ui 的 `/server/restartXrayService`

没有额外参数。

## 8. 新增出站规则：当前项目里的做法

当前项目**没有单独的“新增出站规则”接口**。

正确理解应该是：

1. 调 `GET /api/agent-panel/{id}/outbounds/`
2. 从返回结果中取出完整配置
3. 在调用方往 `xraySetting.outbounds` 里追加新的 outbound
4. 把修改后的完整 `xraySetting` 整体提交到：
   - `POST /api/agent-panel/{id}/save_outbounds/`
5. 如有需要，再调：
   - `POST /api/agent-panel/{id}/restart_xray/`

也就是说，新增出站规则在当前项目里属于：

- **读整份配置 -> 本地修改数组 -> 全量回写**

## 9. 修改出站规则：当前项目里的做法

当前项目**没有单独的“修改出站规则”接口**。

修改方式也是：

1. 先取完整配置
2. 在调用方找到目标 outbound
3. 修改 outbound 内容
4. 整体回写完整 `xraySetting`
5. 视情况重启

所以它不是：

- `PATCH /outbound/{tag}`

而是：

- **全量覆盖写回**

## 10. 删除出站规则：当前项目里的做法

当前项目**没有单独的“删除出站规则”接口**。

删除方式同样是：

1. 先取完整配置
2. 在调用方从 `xraySetting.outbounds` 中删除目标 outbound
3. 把剩余的完整配置整体回写
4. 视情况重启

所以删除也不是面板级别的独立删除接口，而是：

- **先读后改，再整体保存**

## 11. 入站与出站绑定功能

## 11.1 是否有单独绑定接口

没有。

当前项目里“入站与出站绑定”不是通过专门的本地 API 暴露出来的，而是嵌在节点创建和迁移逻辑里自动完成。

相关代码位置：

- `users/views.py` 中的节点创建流程
- `users/views.py` 中的 `migrate_node`

## 11.2 绑定是怎么做的

当 3x-ui 新建 inbound 成功后，代码会：

1. 从创建结果里拿到新 inbound 的 `tag`
2. 读取当前 `/panel/xray/`
3. 在 `xraySetting.routing.rules` 末尾追加一条规则：

```json
{
  "type": "field",
  "outboundTag": "<host_config.tag>",
  "inboundTag": ["<new inbound tag>"]
}
```

4. 再调 `/panel/xray/update` 提交

这就是当前项目里的“入站绑定到出站”的真实实现。

### 11.3 绑定规则依赖哪些字段

最关键的字段有两个：

| 字段 | 来源 | 作用 |
| --- | --- | --- |
| `outboundTag` | `host_config.tag` | 指向目标出站 |
| `inboundTag` | 新建 inbound 返回的 `tag` | 指向需要被绑定的入站 |

## 11.4 项目是如何选择可绑定的出站

项目会先读取 3x-ui 的 `xraySetting.outbounds`，然后只挑：

- `protocol == "socks"`

的出站。

之后从这些出站里提取：

| 字段 | 来源 |
| --- | --- |
| `address` | `outbound.settings.servers[*].address` |
| `port` | `outbound.settings.servers[*].port` |
| `user` | `outbound.settings.servers[*].users[0].user` |
| `pass` | `outbound.settings.servers[*].users[0].pass` |
| `tag` | `outbound.tag` |

最终真正用于绑定的是：

- `tag`

也就是说，项目当前把“可用于出站绑定的候选项”理解为：

- 3x-ui 配置里的 socks 出站

## 11.5 创建后是否自动重启

这里要区分两个场景：

### 普通创建流程

普通创建节点后，代码会自动追加 `routing.rules` 并保存，但：

- **重启逻辑是注释掉的**

也就是说，普通创建时当前项目默认：

- 自动绑定
- 自动保存
- **不自动重启**

### 迁移流程

节点迁移到新的 3x-ui 面板后，代码会：

1. 创建新 inbound
2. 自动追加绑定规则
3. 调 `/panel/xray/update`
4. 再调 `/server/restartXrayService`

因此迁移场景下是：

- 自动绑定
- 自动保存
- **自动重启**

## 12. 当前项目对“出站规则管理”的真实抽象

从实际实现看，这套系统对 3x-ui 出站/路由管理的抽象不是 CRUD 接口，而是：

### 12.1 读取层

- `GET /api/agent-panel/{id}/outbounds/`

返回完整 Xray 配置。

### 12.2 保存层

- `POST /api/agent-panel/{id}/save_outbounds/`

整体覆盖保存 Xray 配置。

### 12.3 生效层

- `POST /api/agent-panel/{id}/restart_xray/`

在需要时重启。

换句话说，当前项目实际上提供的是：

- **Get full config**
- **Save full config**
- **Restart**

而不是：

- Add outbound
- Update outbound
- Delete outbound
- Bind inbound to outbound

这些细分动作

## 13. 如果你要从接口层理解新增 / 修改 / 删除 / 绑定

可以按下面这样理解：

| 目标操作 | 当前项目是否有独立 API | 实际实现方式 |
| --- | --- | --- |
| 新增出站规则 | 否 | 取完整配置，追加 `xraySetting.outbounds`，再整体保存 |
| 修改出站规则 | 否 | 取完整配置，修改目标 outbound，整体保存 |
| 删除出站规则 | 否 | 取完整配置，删除目标 outbound，整体保存 |
| 绑定入站到出站 | 否 | 取完整配置，追加 `xraySetting.routing.rules`，整体保存 |
| 重启使配置生效 | 是 | 调 `restart_xray` |

## 14. 一页结论

如果只看你提到的：

- `/api/agent-panel/286/outbounds/`

那么它的真实含义不是“查询出站列表”，而是：

- **读取指定 3x-ui 面板的完整 Xray 配置**

与它配套的修改方式也不是单独 CRUD，而是：

1. 读取完整配置  
   `GET /api/agent-panel/{id}/outbounds/`

2. 在调用方修改：
   - `xraySetting.outbounds`
   - 或 `xraySetting.routing.rules`

3. 整体保存  
   `POST /api/agent-panel/{id}/save_outbounds/`

4. 必要时重启  
   `POST /api/agent-panel/{id}/restart_xray/`

而“入站和出站绑定”在当前项目里没有独立 API，它本质上也是：

- 往 `xraySetting.routing.rules` 里追加一条
  - `outboundTag`
  - `inboundTag`

然后整体保存。
