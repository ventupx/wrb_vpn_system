# x-ui / 3x-ui 节点新建与修改逻辑梳理

## 1. 文档目标

本文只梳理项目中已经实现的 x-ui / 3x-ui 相关逻辑，重点回答 4 个问题：

- 新建节点时，系统实际向面板提交了哪些参数。
- 修改节点或迁移节点时，系统复用了哪些字段、请求了哪些接口。
- 面板自身需要准备哪些连接参数，运行时 `panel_info` / `host_config` 里有哪些关键字段。
- x-ui 在 `vless` 场景下为什么要做版本号判断，以及判断结果如何影响提交体。

## 2. 主要代码位置

- 面板模型：`panels/models.py`
- 面板连通性、登录、节点列表同步：`panels/views.py`
- 面板登录 cookie 与请求封装：`users/views.py`
  - `get_login_cookie`
  - `make_request_with_cookie`
- 新建节点参数组装：`users/views.py`
  - 支付下单流程中的节点模板生成
- 实际异步创建节点：`users/views.py`
  - `process_node_creation`
- 续费更新时间：`users/views.py`
  - `process_node_creation_time`
- 修改单个节点所属面板：`users/views.py`
  - `change_node_panel`
  - `migrate_node`
- 修改订单下全部节点所属面板：`users/views.py`
  - `change_order_panel`

## 3. 面板基础参数

### 3.1 `AgentPanel` 模型里的核心字段

项目里真正会影响 x-ui / 3x-ui 节点操作的字段如下：

| 字段 | 作用 |
| --- | --- |
| `ip_address` | 面板访问地址，后续会拼接登录、创建、更新、列表、状态查询等 URL |
| `ip` | 纯 IP，部分节点记录会优先保存这个值作为 `host` |
| `port` | 面板端口 |
| `username` | 面板登录用户名 |
| `password` | 面板登录密码 |
| `panel_type` | `x-ui` 或 `3x-ui`，决定请求路径、请求头和返回值处理方式 |
| `is_active` | 面板是否启用 |
| `is_online` | 面板是否在线；面板不可用时很多流程会直接返回错误 |
| `country` | 新建节点时用于按国家挑选可用面板 |
| `used_ports` | 已使用端口列表，创建和迁移节点时会检查并占用端口 |
| `cookie` | 登录成功后的 Cookie，后续请求依赖它 |
| `nodes_count` | 面板当前节点数，用于排序或负载分配 |

### 3.2 运行时面板参数结构

项目运行时不会只依赖 `AgentPanel` 实例，而是把它转成 `panel_info` 或 `host_config` 结构在流程中传递。

常见字段如下：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `id` | `AgentPanel.id` | 当前面板主键 |
| `ip` | `AgentPanel.ip_address` | 实际用于拼 URL 的面板地址 |
| `port` | `AgentPanel.port` | 面板端口 |
| `username` | `AgentPanel.username` | 登录参数 |
| `password` | `AgentPanel.password` | 登录参数 |
| `panel_type` | `AgentPanel.panel_type` | 路径分支依据 |
| `tag` | 3x-ui 的出站规则标签 | 仅 3x-ui 流程中会被追加，用于绑定路由规则 |
| `type` | 临时描述字段 | 代码里会写成 `x-ui` 或 `3x-ui`，更多是标识用途 |

### 3.3 新建一个“可用于下发节点”的面板，最少要具备哪些参数

如果只从项目现有代码出发，面板至少要具备：

- `ip_address`
- `username`
- `password`
- `panel_type`
- `country`
- `is_online=True`
- `is_active=True`

否则会在以下位置被拦住：

- 按国家筛选不到可用面板
- 登录拿不到 Cookie
- 面板版本检查失败
- 更新节点或迁移节点时被判定为“面板不存在”或“所选面板不可用”

## 4. 面板登录与鉴权参数

### 4.1 登录接口

两类面板都走：

- `POST http://{ip}/login`

提交参数：

| 参数 | 说明 |
| --- | --- |
| `username` | 面板用户名 |
| `password` | 面板密码 |

### 4.2 登录请求头差异

#### x-ui

- `host` 使用完整 `panel_info['ip']`
- `Origin` 为 `http://{ip}`
- `Referer` 为 `http://{ip}/`

#### 3x-ui

- `host` 使用 `panel_info['ip'].split('/')[0]`
- `Origin` 为 `http://{ip.split('/')[0]}`
- `Referer` 为 `http://{ip}/`

这说明一个很关键的实现细节：

- 3x-ui 的 `ip_address` 很可能不仅仅是主机名，还可能带路径片段。
- 因此代码里反复使用 `split('/')[0]` 作为 Host 和 Origin。

### 4.3 Cookie 刷新机制

面板请求统一经过 `make_request_with_cookie`。

它的行为是：

1. 如果面板已有 `cookie`，先带上。
2. 发请求。
3. 如果 HTTP 状态码是 `401/404`，或者响应里出现“请重新登录 / 登录已过期”，则认定 Cookie 过期。
4. 自动重新调用 `get_login_cookie` 登录。
5. 刷新失败则把面板标记为离线。

这是新建节点、更新节点、迁移节点能够持续工作的基础。

## 5. 新建节点主流程

### 5.1 面板选择策略

新建节点模板生成时，会先按国家选择可用面板：

- 先查 `3x-ui`
- 再查 `x-ui`
- 条件：
  - `is_online=True`
  - `country__iexact=region`
  - 按 `nodes_count` 升序排序

也就是说，当前实现优先使用 3x-ui。

### 5.2 真正向面板提交创建请求的接口

#### x-ui

- `POST http://{panel.ip_address}/xui/inbound/add`

#### 3x-ui

- `POST http://{panel.ip_address}/panel/api/inbounds/add`

### 5.3 一个很重要的实现细节：提交方式不是常规 form body

创建和更新节点时，代码统一调用：

- `make_request_with_cookie(..., method='post_params', data=form_data)`

而 `post_params` 的实现是：

- `requests.post(url, headers=headers, params=data, ...)`

这意味着：

- 虽然请求头写的是 `Content-Type: application/x-www-form-urlencoded`
- 但实际提交时用的是 `params=...`
- 数据会以 URL 查询参数的形式附加到请求上

这是当前项目里最值得注意的一个实现特点。后续如果有人按常规 `data=form_data` 重写，很可能会改变现有行为。

### 5.4 创建节点时的通用提交字段

无论 x-ui 还是 3x-ui，最终都会整理成一个 `form_data` 提交给面板。常见字段如下：

| 字段 | 说明 |
| --- | --- |
| `up` | 初始上传流量，默认 `0` |
| `down` | 初始下载流量，默认 `0` |
| `total` | 总流量，默认 `0` |
| `remark` | 节点备注 |
| `enable` | 是否启用，默认 `True` |
| `expiryTime` | 过期时间，毫秒时间戳 |
| `listen` | 监听地址，默认空字符串 |
| `port` | 节点端口 |
| `protocol` | 协议名，小写 |
| `settings` | 协议相关配置 |
| `streamSettings` | 传输层配置 |
| `sniffing` | 嗅探配置 |
| `allocate` | 仅 3x-ui 流程默认带上 |

### 5.5 协议差异：3x-ui 创建体

3x-ui 的基础模板包含：

- `streamSettings.network = tcp`
- `streamSettings.security = none`
- `streamSettings.externalProxy = []`
- `streamSettings.tcpSettings.acceptProxyProtocol = False`
- `streamSettings.tcpSettings.header.type = none`
- `sniffing.enabled = False`
- `sniffing.destOverride = [http, tls, quic, fakedns]`
- `allocate.strategy = always`
- `allocate.refresh = 5`
- `allocate.concurrency = 3`

协议差异如下：

#### vmess

- `settings.clients[0].id = UUID`
- `settings.clients[0].security = auto`
- `settings.clients[0].email = subId + port`

#### vless

- `settings.clients[0].id = UUID`
- `settings.clients[0].flow = ""`
- `settings.decryption = none`
- `settings.fallbacks = []`

#### shadowsocks

- `settings.method = aes-256-gcm`
- `settings.password = node_password`
- `settings.network = tcp,udp`
- `settings.clients[0].password = node_password`
- `settings.ivCheck = False`

#### socks

- `streamSettings = ""`
- `settings.auth = password`
- `settings.accounts[0].user = node_user`
- `settings.accounts[0].pass = node_password`
- `settings.udp = False`
- `settings.ip = 127.0.0.1`
- `sniffing = {}`

#### http

- `streamSettings = ""`
- `settings.accounts[0].user = node_user`
- `settings.accounts[0].pass = node_password`
- `settings.allowTransparent = False`

### 5.6 协议差异：x-ui 创建体

x-ui 的基础模板包含：

- `streamSettings.network = tcp`
- `streamSettings.security = none`
- `streamSettings.tcpSettings.header.type = none`
- 默认 `sniffing.enabled = True`

协议差异如下：

#### vmess

- `settings.clients[0].id = UUID`
- `settings.clients[0].alterId = 0`
- `settings.disableInsecureEncryption = False`
- `sniffing.destOverride = [http, tls]`

#### vless

- 会先请求版本接口 `/server/status`
- 再根据版本决定 `settings.clients[0].flow`
- 其余字段：
  - `decryption = none`
  - `fallbacks = []`
  - `sniffing.destOverride = [http, tls]`

#### shadowsocks

- `settings.method = aes-256-gcm`
- `settings.password = node_password`
- `settings.network = tcp,udp`

#### socks

- `settings.auth = password`
- `settings.accounts[0].user = node_user`
- `settings.accounts[0].pass = node_password`
- `settings.udp = False`
- `settings.ip = 127.0.0.1`
- `sniffing = {}`

#### http

- `settings.accounts[0].user = node_user`
- `settings.accounts[0].pass = node_password`
- `sniffing = {}`

### 5.7 端口处理

创建节点前，系统会检查 `panel.used_ports`：

1. 先生成随机端口。
2. 如果端口已存在，则继续随机直到拿到未占用端口。
3. 成功占用后，把端口追加到 `panel.used_ports` 并保存。

这个逻辑在：

- 新建节点
- 单节点迁移
- 整单迁移

三类流程里都存在。

### 5.8 `NodeInfo` 中会缓存哪些与面板相关的信息

在真正异步下发到面板前，系统会先把节点信息落库。与面板最相关的字段有：

| 字段 | 说明 |
| --- | --- |
| `host_config` | 面板运行时参数 JSON，包含 `id/ip/port/username/password/panel_type/tag` |
| `config_text` | 准备提交到面板的节点配置 JSON |
| `panel_id` | 当前面板 ID |
| `panel_node_id` | 面板里的节点 ID，创建前为空 |
| `host` | 节点主机，优先用 `panel.ip`，否则用 `panel.ip_address` |
| `port` | 节点端口 |

## 6. 3x-ui 创建成功后的额外动作

3x-ui 与 x-ui 最大的后处理差异是：

- 3x-ui 创建成功后，不只保存 `panel_node_id`
- 还会继续读取 Xray 配置并追加路由规则

具体动作：

1. 从创建返回结果里拿到：
   - `obj.id`
   - `obj.tag`
2. 调用：
   - `POST http://{panel.ip_address}/panel/xray/`
3. 解析当前 `xraySetting`
4. 追加一条路由规则：
   - `outboundTag = host_config.tag`
   - `inboundTag = [新建节点返回的 tag]`
5. 调用：
   - `POST http://{panel.ip_address}/panel/xray/update`
6. 在迁移流程中还会调用：
   - `POST http://{panel.ip_address}/server/restartXrayService`

这说明：

- 3x-ui 的节点创建不是单纯新增 inbound
- 还可能伴随 outbound 绑定和 Xray 路由更新

## 7. 节点 ID 的获取方式差异

### x-ui

x-ui 创建成功后，返回结果里并没有直接可靠地使用 `obj.id`，代码采取的是：

1. 调用 `POST /xui/inbound/list`
2. 用刚提交的 `port` 反查匹配节点
3. 取该节点的 `id` 作为 `panel_node_id`

### 3x-ui

3x-ui 创建成功后，直接使用：

- `result.obj.id`

作为 `panel_node_id`。

## 8. 修改节点功能梳理

这里要区分两类“修改”：

### 8.1 同面板内更新节点

这类逻辑出现在续费更新时间流程中，本质是更新已有 inbound。

#### 更新接口

- x-ui：`POST http://{panel.ip_address}/xui/inbound/update/{panel_node_id}`
- 3x-ui：`POST http://{panel.ip_address}/panel/inbound/update/{panel_node_id}`

#### 提交体来源

- 从 `node.config_text` 读取原始配置
- 反序列化为 `form_data`
- 对以下字段做序列化处理：
  - `settings`
  - `streamSettings`
  - `sniffing`
  - `allocate`

也就是说，更新节点时并不是重新拼一个全新请求体，而是：

1. 复用原来的 `config_text`
2. 把嵌套对象转成 JSON 字符串
3. 再提交给面板更新接口

### 8.2 修改节点所属面板

这类逻辑对应：

- `change_node_panel`
- `migrate_node`
- `change_order_panel`

它不是在新面板上调用 update，而是：

1. 重写 `host_config`
2. 按新面板重新修正 `config_text`
3. 清空旧 `panel_node_id`
4. 在新面板上重新调用 add 接口创建
5. 成功后再回填新的 `panel_node_id`

#### 单节点修改入口参数

`change_node_panel` 需要：

| 参数 | 说明 |
| --- | --- |
| `node_id` | 节点 ID |
| `panel_id` | 新面板 ID |

#### 整单修改入口参数

`change_order_panel` 需要：

| 参数 | 说明 |
| --- | --- |
| `order_id` | 订单 ID |
| `panel_id` | 新面板 ID |

## 9. 面板迁移时的关键字段处理

### 9.1 新 `host_config`

迁移到新面板时，系统会生成：

| 字段 | 说明 |
| --- | --- |
| `id` | 新面板 ID |
| `ip` | 新面板 `ip_address` |
| `username` | 新面板用户名 |
| `password` | 新面板密码 |
| `panel_type` | 新面板类型 |
| `tag` | 默认空，3x-ui 流程中后续会填充 |

### 9.2 `config_text` 的复用

迁移不是重新从零构造协议配置，而是：

1. 从旧节点 `config_text` 读取 `new_config`
2. 针对新面板做少量修正：
   - 端口冲突处理
   - x-ui `vless` 的 `flow` 版本分支
   - 3x-ui 的 `email` 去重
   - 3x-ui 的 `tag` 绑定
3. 再把修正后的 `new_config` 保存回节点

### 9.3 迁移后的真实请求路径

迁移成功执行时，仍然走“新增”接口：

- x-ui：`/xui/inbound/add`
- 3x-ui：`/panel/api/inbounds/add`

不是走 update 接口。

## 10. 版本号判断逻辑

### 10.1 触发条件

当前代码里只有在以下条件同时满足时才检查版本：

- 面板类型是 `x-ui`
- 协议是 `vless`

### 10.2 请求接口

- `POST http://{panel.ip_address}/server/status`

### 10.3 读取的版本字段

从响应中读取：

- `obj.xray.version`

### 10.4 分支规则

当前实现是硬编码判断：

- 如果版本是 `25.3.6`
  - `settings.clients[0].flow = ""`
- 否则
  - `settings.clients[0].flow = "xtls-rprx-direct"`

### 10.5 出现位置

这套逻辑在多个流程里重复出现：

- x-ui 新建节点模板生成
- 面板迁移前的配置修正
- 整单迁移前的配置修正

结论很明确：

- `25.3.6` 在当前代码里被当作特殊兼容版本处理
- 该版本下不会给 `vless` 客户端写入 `xtls-rprx-direct`

## 11. 重点结论

### 11.1 新建节点时，和面板相关的关键提交参数

最核心的是两层：

#### 第一层：面板连接参数

- `ip_address`
- `username`
- `password`
- `panel_type`
- `cookie`

#### 第二层：提交给面板的节点参数

- `port`
- `protocol`
- `settings`
- `streamSettings`
- `sniffing`
- `allocate`（主要是 3x-ui）
- `expiryTime`
- `remark`

### 11.2 x-ui / 3x-ui 的主要差异

| 维度 | x-ui | 3x-ui |
| --- | --- | --- |
| 创建路径 | `/xui/inbound/add` | `/panel/api/inbounds/add` |
| 更新路径 | `/xui/inbound/update/{id}` | `/panel/inbound/update/{id}` |
| 节点 ID 获取 | 创建后查列表按端口反查 | 创建返回直接拿 `obj.id` |
| `vless` 版本判断 | 有 | 无 |
| 创建后路由处理 | 无额外 Xray 路由绑定 | 会读取/更新 `/panel/xray/` |
| 创建后重启 Xray | 通常无 | 迁移时会重启 |

### 11.3 代码层面最值得留意的实现点

- `post_params` 实际是 `requests.post(..., params=data)`。
- `config_text` 是后续更新、迁移的核心来源。
- 新面板迁移不是 update，而是重新 add。
- x-ui 的 `vless` 行为取决于 `/server/status` 返回的 Xray 版本。
- 3x-ui 额外依赖 outbound tag 和 Xray 路由规则更新。

## 12. 建议后续排查顺序

如果后续有人要继续改这部分逻辑，建议按下面顺序看代码：

1. 先看 `panels/models.py`，确认面板字段。
2. 再看 `get_login_cookie` 和 `make_request_with_cookie`，确认登录与请求方式。
3. 再看新建节点模板生成逻辑，区分 x-ui 与 3x-ui 的 `form_data`。
4. 再看 `process_node_creation`，确认真正的下发接口。
5. 最后看 `change_node_panel` / `migrate_node` / `change_order_panel`，确认修改与迁移逻辑。
