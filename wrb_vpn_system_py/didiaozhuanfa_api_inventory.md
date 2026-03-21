# didiaozhuanfa.uk 中转站接口梳理

## 说明

- 基础地址来自 `vpncms/settings.py:173`，当前配置为 `https://didiaozhuanfa.uk`。
- 本文档基于代码静态分析整理，只记录项目内实际调用到的中转站接口。
- 功能描述为代码行为推测，不等同于对方系统官方文档。

## 接口总览

| 接口路径 | 方法 | 功能推测 |
| --- | --- | --- |
| `/api/v1/auth/login` | `POST` | 登录中转站并获取 token |
| `/api/v1/user/info` | `GET` | 获取中转账号余额、流量、规则额度 |
| `/api/v1/user/forward?page=1&size=10` | `GET` | 获取转发规则分页列表 |
| `/api/v1/user/devicegroup` | `GET` | 获取入口/出口设备组列表 |
| `/api/v1/user/forward` | `PUT` | 创建转发规则 |
| `/api/v1/user/forward/search_rules` | `POST` | 按条件查询转发规则 |
| `/api/v1/user/forward` | `DELETE` | 批量删除转发规则 |
| `/api/v1/user/forward/{id}` | `POST` | 推测为更新指定转发规则 |

## 1. `POST /api/v1/auth/login`

- 代码位置：
  - `transits/views.py:47-67`
  - `users/views.py:2336-2352`
  - `users/views.py:6059-6075`
  - `users/views.py:6368-6384`
  - `users/views.py:6921-6937`
- 观察到的请求体：
  ```json
  {
    "username": "<中转账号>",
    "password": "<中转密码>"
  }
  ```
- 观察到的请求头：
  - 在 `transits/views.py` 中直接 `requests.post(url, json=payload)`
  - 在 `users/views.py` 中额外带：
    - `Content-Type: text/plain;charset=UTF-8`
    - `User-Agent`
    - `Accept: */*`
    - `Origin: https://didiaozhuanfa.uk`
- 关键响应字段：
  - `code == 0` 视为成功
  - `data` 被当作 token 使用
- 功能推测：
  - 登录中转站账号
  - 获取或刷新后续接口使用的认证 token

## 2. `GET /api/v1/user/info`

- 代码位置：
  - `transits/views.py:69-117`
- 观察到的请求头：
  ```json
  {
    "authorization": "<token>"
  }
  ```
- 关键响应字段：
  - `data.balance`
  - `data.traffic_used`
  - `data.traffic_enable`
  - `data.max_rules`
- 项目内用途：
  - 与规则列表接口组合，汇总账号余额、流量使用量、规则上限
- 功能推测：
  - 获取当前中转账号的账户信息

## 3. `GET /api/v1/user/forward?page=1&size=10`

- 代码位置：
  - `transits/views.py:87-110`
- 观察到的请求头：
  ```json
  {
    "authorization": "<token>"
  }
  ```
- 关键响应字段：
  - `count`
- 项目内用途：
  - 统计当前账号已使用的转发规则数量
- 功能推测：
  - 获取转发规则列表
  - 当前代码只取第一页，每页 10 条

## 4. `GET /api/v1/user/devicegroup`

- 代码位置：
  - `transits/views.py:621-664`
  - `users/views.py:2435-2451`
  - `users/views.py:6172-6188`
- 观察到的请求头：
  ```json
  {
    "authorization": "<token>"
  }
  ```
  或：
  ```json
  {
    "Authorization": "<token>",
    "Content-Type": "application/json"
  }
  ```
- 关键响应字段：
  - `data[].id`
  - `data[].type`
  - `data[].show_order`
- 项目内用途：
  - 按 `type` 分类出入口设备组：
    - `DeviceGroupType_Inbound`
    - `DeviceGroupType_OutboundBySite`
  - 根据规则里的 `device_group_in` 反查入口组，拼接 `udp_host`
- 功能推测：
  - 获取中转站的入口/出口设备组列表

## 5. `PUT /api/v1/user/forward`

- 代码位置：
  - `transits/views.py:901-921`
  - `users/views.py:2362-2410`
  - `users/views.py:6100-6147`
- 观察到的请求头：
  ```json
  {
    "Authorization": "<token>",
    "Content-Type": "application/json"
  }
  ```
- 观察到的请求体形态：
  ```json
  {
    "device_group_in": 123,
    "device_group_out": 456,
    "config": "{\"dest\":[\"host:port\"]}",
    "name": "国家-到期日-订单号"
  }
  ```
  或者直接复用历史保存的 `udp_peizhi` 对象发送。
- 关键响应判断：
  - HTTP `200`
  - 部分逻辑额外判断返回 `code != 403`
- 项目内用途：
  - 新建 UDP 中转规则
  - 节点开通后重新恢复中转转发
  - 面板变更后重新写入中转目的地址
- 功能推测：
  - 创建一条新的转发规则

## 6. `POST /api/v1/user/forward/search_rules`

- 代码位置：
  - `transits/views.py:857-895`
  - `transits/views.py:923-981`
  - `users/views.py:2412-2432`
  - `users/views.py:6149-6169`
  - `users/views.py:6394-6415`
  - `users/views.py:6952-6977`
- 观察到的请求头：
  ```json
  {
    "Authorization": "<token>",
    "Content-Type": "application/json"
  }
  ```
- 观察到的请求体：
  ```json
  {
    "gid": 0,
    "gid_in": 0,
    "gid_out": 0,
    "name": "",
    "dest": "host:port",
    "listen_port": 0
  }
  ```
- 关键响应字段：
  - `code`
  - `data[].id`
  - `data[].listen_port`
  - `data[].device_group_in`
- 项目内用途：
  - 按目标地址 `dest` 搜索规则
  - 创建规则后回查监听端口
  - 根据现有规则 ID 做更新或删除
- 功能推测：
  - 查询转发规则列表
  - 支持按入口组、出口组、目标地址、监听端口等条件过滤

## 7. `DELETE /api/v1/user/forward`

- 代码位置：
  - `transits/views.py:875-877`
  - `transits/views.py:894-895`
- 观察到的请求头：
  ```json
  {
    "Authorization": "<token>",
    "Content-Type": "application/json"
  }
  ```
- 观察到的请求体：
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```
- 项目内用途：
  - 在保存新的中转配置前，先删除指向同一 `dest` 的旧规则
- 功能推测：
  - 批量删除转发规则

## 8. `POST /api/v1/user/forward/{id}`

- 代码位置：
  - `users/views.py:6420-6424`
  - `users/views.py:6986-6990`
- 观察到的请求头：
  ```json
  {
    "Authorization": "<token>",
    "Content-Type": "application/json"
  }
  ```
- 观察到的请求体来源：
  - 先通过 `/api/v1/user/forward/search_rules` 拿到 `pass_item`
  - 再对 `pass_item` 做局部修改后回传：
    - 续费时修改 `name`
    - 迁移时修改 `config.dest`
- 项目内用途：
  - 续费后更新规则名称
  - 面板迁移后更新目标地址
- 功能推测：
  - 更新指定 ID 的转发规则

## 请求参数详细解读

### 1. `POST /api/v1/auth/login`

#### Body 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `username` | `string` | 是 | 中转站登录用户名 | 代码已确认 |
| `password` | `string` | 是 | 中转站登录密码 | 代码已确认 |

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `Content-Type` | `string` | 否 | 在部分调用中为 `text/plain;charset=UTF-8`，但请求本体仍通过 JSON 提交 | 代码已确认 |
| `User-Agent` | `string` | 否 | 浏览器模拟请求头，疑似为兼容目标站点校验 | 代码已确认 |
| `Accept` | `string` | 否 | 在部分调用中固定为 `*/*` | 代码已确认 |
| `Origin` | `string` | 否 | 固定为 `https://didiaozhuanfa.uk` | 代码已确认 |

#### 参数解读

- 这个接口的真正业务参数只有 `username` 和 `password`。
- 返回结果中的 `data` 被项目直接当作 token 使用，因此该接口本质是“登录并换取 token”。
- 尽管 header 中曾出现 `Content-Type: text/plain;charset=UTF-8`，但由于实际调用仍然是 `json=payload`，说明服务端对请求头校验并不严格，或者该写法是兼容历史前端。

### 2. `GET /api/v1/user/info`

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `authorization` | `string` | 是 | 登录成功后返回的 token，代码直接传 token 原值 | 代码已确认 |

#### 参数解读

- 该接口没有 query 参数，也没有 body 参数。
- 当前代码未加 `Bearer ` 前缀，说明对方接口接受裸 token。

### 3. `GET /api/v1/user/forward?page=1&size=10`

#### Query 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `page` | `int` | 是 | 页码，当前项目固定传 `1` | 代码已确认 |
| `size` | `int` | 是 | 分页条数，当前项目固定传 `10` | 代码已确认 |

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `authorization` | `string` | 是 | token | 代码已确认 |

#### 参数解读

- 这个接口在项目里只被用来取 `count`，用于统计当前账号已使用的规则数量。
- 没有发现排序、筛选类参数，当前可确认的只有分页参数。

### 4. `GET /api/v1/user/devicegroup`

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `authorization` | `string` | 是 | 某些调用使用小写 header 名 | 代码已确认 |
| `Authorization` | `string` | 是 | 某些调用使用大写 header 名 | 代码已确认 |
| `Content-Type` | `string` | 否 | 有些调用里附带 `application/json` | 代码已确认 |

#### 参数解读

- 该接口没有 query 参数和 body 参数。
- 真正重要的不是请求参数本身，而是返回结果里的设备组 ID，这些 ID 会被拿去作为 `device_group_in` 与 `device_group_out` 的输入值。
- 从响应使用方式可确认至少存在两种组类型：
  - `DeviceGroupType_Inbound`
  - `DeviceGroupType_OutboundBySite`

### 5. `PUT /api/v1/user/forward`

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `Authorization` | `string` | 是 | token，直接传原始 token | 代码已确认 |
| `Content-Type` | `string` | 是 | 固定 `application/json` | 代码已确认 |

#### Body 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `device_group_in` | `int` | 是 | 入口设备组 ID | 代码已确认 |
| `device_group_out` | `int` | 是 | 出口设备组 ID | 代码已确认 |
| `config` | `string` | 是 | JSON 字符串，不是 JSON 对象 | 代码已确认 |
| `name` | `string` | 是 | 规则名称，常见格式为 `国家-到期日-订单号` | 代码已确认 |

#### `config` 内层参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `dest` | `string[]` | 是 | 最终转发目标地址列表，当前代码只传 1 个元素，格式为 `host:port` | 代码已确认 |

#### 参数解读

- `device_group_in` 与 `device_group_out` 是这个接口最关键的两个控制参数，决定流量从哪个入口组进、从哪个出口组出。
- `config` 的格式是当前接口最容易误用的点：
  - 外层字段类型是字符串；
  - 字符串内容才是一段 JSON；
  - 当前项目只确认了其中的 `dest` 字段。
- `dest` 的值始终来自节点地址或面板地址拼接：
  - `node.host:node.port`
  - `panel.ip:node.port`
- `name` 不影响技术转发逻辑，但会被后续搜索和更新逻辑复用，因此建议保持可识别。

### 6. `POST /api/v1/user/forward/search_rules`

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `Authorization` | `string` | 是 | token | 代码已确认 |
| `Content-Type` | `string` | 是 | 固定 `application/json` | 代码已确认 |

#### Body 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `gid` | `int` | 是 | 推测为规则分组 ID；当前固定传 `0` | 基于命名推测 |
| `gid_in` | `int` | 是 | 推测为入口组筛选条件；当前固定传 `0` | 基于命名推测 |
| `gid_out` | `int` | 是 | 推测为出口组筛选条件；当前固定传 `0` | 基于命名推测 |
| `name` | `string` | 是 | 规则名筛选条件；当前固定传空字符串 | 基于调用方式推测 |
| `dest` | `string` | 是 | 按目标地址筛选规则，格式为 `host:port` | 代码已确认 |
| `listen_port` | `int` | 是 | 推测为监听端口筛选条件；当前固定传 `0` | 基于命名推测 |

#### 参数解读

- 在当前项目里，`dest` 是这个接口最关键的查询条件。
- 代码始终以 `dest` 去查找“某个目标地址对应的规则”，后续再拿结果做删除、回填监听端口或更新。
- `gid`、`gid_in`、`gid_out`、`name`、`listen_port` 看起来属于通用筛选器，但当前项目并未真正使用这些条件，而是统一传默认值：
  - `0`
  - `""`
- 因此可以合理推测：
  - `0` 或空字符串表示“不过滤该字段”；
  - 该接口支持更丰富的组合查询，只是当前业务没用到。

### 7. `DELETE /api/v1/user/forward`

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `Authorization` | `string` | 是 | token | 代码已确认 |
| `Content-Type` | `string` | 是 | 固定 `application/json` | 代码已确认 |

#### Body 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `ids` | `int[]` | 是 | 要删除的转发规则 ID 列表 | 代码已确认 |

#### 参数解读

- 这个接口不是按条件删除，而是按规则 ID 列表删除。
- 在项目中的标准用法是：
  1. 先用 `search_rules` 查出命中的规则；
  2. 提取每条规则的 `id`；
  3. 再用 `ids` 批量删除。

### 8. `POST /api/v1/user/forward/{id}`

#### Path 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `id` | `int` | 是 | 要更新的转发规则 ID | 代码已确认 |

#### Header 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `Authorization` | `string` | 是 | token | 代码已确认 |
| `Content-Type` | `string` | 是 | 固定 `application/json` | 代码已确认 |

#### Body 参数

| 参数 | 类型 | 必填 | 说明 | 确认程度 |
| --- | --- | --- | --- | --- |
| `pass_item` 全量对象 | `object` | 是 | 先从 `search_rules` 的返回结果中取出完整规则对象，再修改局部字段后整对象回传 | 代码已确认 |

#### 已确认会被修改的字段

| 字段 | 类型 | 说明 | 确认程度 |
| --- | --- | --- | --- |
| `name` | `string` | 续费场景下更新规则名 | 代码已确认 |
| `config` | `string` | 迁移面板场景下更新目标地址，格式仍是 JSON 字符串 | 代码已确认 |

#### 参数解读

- 这个接口没有显示出“最小更新参数集”，因为项目代码不是手工拼装更新体，而是直接回传 `search_rules` 返回的整条规则对象。
- 因此它更像“整对象更新接口”，而不是局部 patch 接口。
- 如果后续需要稳定调用这个接口，最安全的方式是：
  1. 先用 `search_rules` 查到规则；
  2. 拿到完整对象；
  3. 只改必要字段；
  4. 把完整对象再发回 `/api/v1/user/forward/{id}`。

## 核心参数语义汇总

| 参数 | 所属接口 | 语义 |
| --- | --- | --- |
| `username` | `/api/v1/auth/login` | 中转站登录账号 |
| `password` | `/api/v1/auth/login` | 中转站登录密码 |
| `authorization` / `Authorization` | 多个接口 | 登录后返回的 token |
| `page` | `GET /api/v1/user/forward` | 分页页码 |
| `size` | `GET /api/v1/user/forward` | 分页大小 |
| `device_group_in` | `PUT /api/v1/user/forward` | 入口设备组 ID |
| `device_group_out` | `PUT /api/v1/user/forward` | 出口设备组 ID |
| `config.dest` | `PUT /api/v1/user/forward`、`POST /api/v1/user/forward/{id}` | 真实转发目标地址，格式为 `host:port` |
| `name` | 多个规则接口 | 规则名称，也可作为查询条件 |
| `gid` | `POST /api/v1/user/forward/search_rules` | 推测为规则分组 ID |
| `gid_in` | `POST /api/v1/user/forward/search_rules` | 推测为入口组筛选条件 |
| `gid_out` | `POST /api/v1/user/forward/search_rules` | 推测为出口组筛选条件 |
| `listen_port` | `POST /api/v1/user/forward/search_rules` | 推测为监听端口筛选条件；返回里也会出现实际监听端口 |
| `ids` | `DELETE /api/v1/user/forward` | 待删除规则 ID 列表 |
| `{id}` | `POST /api/v1/user/forward/{id}` | 待更新规则 ID |

## 代码中的中转站交互链路

### 账号测试与概览

- `transits/views.py:180-210` 的 `test_connection`
- 先登录，再拉取：
  - `/api/v1/user/info`
  - `/api/v1/user/forward?page=1&size=10`

### 获取出入口列表

- `transits/views.py:621-664` 的 `_get_device_groups`
- `transits/views.py:667-760` 的 `order_endpoints`
- 核心依赖：`GET /api/v1/user/devicegroup`

### 创建中转规则

- `transits/views.py:778-1014` 的 `save_transit`
- 典型流程：
  1. 登录获取 token
  2. `search_rules` 查询旧规则
  3. `DELETE /api/v1/user/forward` 删除旧规则
  4. `PUT /api/v1/user/forward` 创建新规则
  5. 再次 `search_rules` 回查监听端口
  6. `GET /api/v1/user/devicegroup` 反查入口组并生成 `udp_host`

### 节点开通后的规则恢复

- `users/views.py:2325-2452`
- `users/views.py:6048-6189`
- 典型流程：
  1. 登录
  2. `PUT /api/v1/user/forward`
  3. `POST /api/v1/user/forward/search_rules`
  4. `GET /api/v1/user/devicegroup`

### 续费与迁移时更新规则

- `users/views.py:6359-6492`
- `users/views.py:6915-7055`
- 典型流程：
  1. 登录
  2. `POST /api/v1/user/forward/search_rules`
  3. `POST /api/v1/user/forward/{id}`

## 结论

- 项目中与 `https://didiaozhuanfa.uk` 的交互集中在账号认证、设备组查询、转发规则的增删改查这几类接口。
- 从现有调用方式看，核心对象是“转发规则”，其关键字段包括：
  - `device_group_in`
  - `device_group_out`
  - `config.dest`
  - `name`
  - `listen_port`
- 若后续需要进一步确认字段语义，建议在真实环境抓取这些接口的完整响应样例，再补一版字段说明文档。
