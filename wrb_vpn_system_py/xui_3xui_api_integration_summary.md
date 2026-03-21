# x-ui / 3x-ui 接口与参数集成总结

## 1. 文档说明

本文基于当前仓库中的实际调用代码，对项目里已经使用到的 x-ui / 3x-ui 面板接口做“集成视角”的归纳。

目标不是复述业务流程，而是回答下面几个问题：

- 新项目要接 x-ui / 3x-ui，至少需要封装哪些接口。
- 每个接口大致承担什么功能。
- 创建节点时，真实提交体包含哪些字段。
- x-ui 和 3x-ui 在路径、请求头、返回值处理上有哪些差异。

本文内容主要来自以下源码：

- `users/views.py`
- `panels/views.py`
- `panels/models.py`
- `xui_3xui_node_workflows.md`

说明：

- 本文只总结当前项目里“已经出现过”的接口和参数。
- 对于面板接口的功能判断，属于基于调用方式和返回处理做的推断。
- 若面板版本不同，字段兼容性可能存在差异，尤其是 x-ui 的 `vless.flow` 逻辑。

## 2. 集成时的基础对象

### 2.1 面板连接参数

无论是 x-ui 还是 3x-ui，实际都需要一组面板上下文参数：

| 字段 | 类型 | 必要性 | 说明 |
| --- | --- | --- | --- |
| `id` | `number` | 项目内需要 | 本地面板记录 ID |
| `ip` | `string` | 必填 | 实际上对应项目里的 `ip_address`，用于拼接 URL |
| `port` | `number` | 可选 | 本项目会保存，但请求 URL 主要直接使用 `ip_address` |
| `username` | `string` | 必填 | 面板登录用户名 |
| `password` | `string` | 必填 | 面板登录密码 |
| `panel_type` | `x-ui \| 3x-ui` | 必填 | 决定路径、请求头、返回值处理 |
| `tag` | `string` | 仅 3x-ui 需要 | 3x-ui 创建后绑定路由时要用到的出站 tag |

### 2.2 当前项目中的面板模型字段

项目里与面板交互最相关的字段如下：

| 字段 | 作用 |
| --- | --- |
| `ip_address` | 面板访问地址，实际用于拼 URL |
| `ip` | 纯 IP，节点记录里优先作为 `host` 保存 |
| `username` | 面板账号 |
| `password` | 面板密码 |
| `panel_type` | `x-ui` 或 `3x-ui` |
| `cookie` | 登录成功后的 Cookie |
| `used_ports` | 已用端口列表 |
| `nodes_count` | 面板当前节点数 |
| `is_online` | 面板在线状态 |
| `is_active` | 面板启用状态 |

## 3. 接口总览

### 3.1 已识别到的面板接口

| 面板 | 方法 | 路径 | 推定功能 | 是否在当前项目中实际使用 |
| --- | --- | --- | --- | --- |
| x-ui / 3x-ui | `POST` | `/login` | 登录并获取 Cookie | 是 |
| x-ui / 3x-ui | `POST` | `/server/status` | 获取 Xray / 面板状态信息 | 是 |
| x-ui | `POST` | `/xui/inbound/add` | 新增 inbound 节点 | 是 |
| 3x-ui | `POST` | `/panel/api/inbounds/add` | 新增 inbound 节点 | 是 |
| x-ui | `POST` | `/xui/inbound/list` | 查询 inbound 列表 | 是 |
| 3x-ui | `POST` | `/panel/inbound/list` | 查询 inbound 列表 | 是 |
| x-ui | `POST` | `/xui/inbound/update/{id}` | 更新 inbound | 是 |
| 3x-ui | `POST` | `/panel/inbound/update/{id}` | 更新 inbound | 是 |
| x-ui | `POST` | `/xui/inbound/del/{id}` | 删除 inbound | 是 |
| 3x-ui | `POST` | `/panel/inbound/del/{id}` | 删除 inbound | 是 |
| 3x-ui | `POST` | `/panel/xray/` | 获取当前 Xray 配置 | 是 |
| 3x-ui | `POST` | `/panel/xray/update` | 更新 Xray 配置 | 是 |
| 3x-ui | `POST` | `/server/restartXrayService` | 重启 Xray 服务 | 是 |

### 3.2 新项目推荐最小封装接口

如果你要重新集成，建议先封装这几个能力：

1. `login(panel)`  
   返回 Cookie，并能刷新。
2. `get_status(panel)`  
   用于在线检查和 x-ui `vless` 版本判断。
3. `list_inbounds(panel)`  
   用于同步节点列表、回收 `panel_node_id`、刷新 `used_ports`。
4. `create_inbound(panel, payload)`  
   创建节点。
5. `update_inbound(panel, inboundId, payload)`  
   更新节点。
6. `delete_inbound(panel, inboundId)`  
   删除节点。
7. `get_3xui_xray(panel)`  
   仅 3x-ui，用于读取 Xray 配置。
8. `update_3xui_xray(panel, xraySetting)`  
   仅 3x-ui，用于更新路由。
9. `restart_xray(panel)`  
   仅 3x-ui 迁移场景需要。

## 4. 鉴权与请求头

### 4.1 登录接口

#### 请求

- 方法：`POST`
- 路径：`http://{ip}/login`
- Body：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | `string` | 是 | 面板用户名 |
| `password` | `string` | 是 | 面板密码 |

#### 登录头差异

##### x-ui

| Header | 值 |
| --- | --- |
| `Content-Type` | `application/x-www-form-urlencoded; charset=UTF-8` |
| `host` | `{ip}` |
| `Origin` | `http://{ip}` |
| `Referer` | `http://{ip}/` |

##### 3x-ui

| Header | 值 |
| --- | --- |
| `Content-Type` | `application/x-www-form-urlencoded; charset=UTF-8` |
| `host` | `{ip.split('/')[0]}` |
| `Origin` | `http://{ip.split('/')[0]}` |
| `Referer` | `http://{ip}/` |

#### 结论

- 当前项目把 `ip_address` 当作“完整地址片段”使用，3x-ui 可能带路径，所以 `host` 和 `Origin` 会额外 `split('/')`。
- 登录成功后，从响应头 `Set-Cookie` 提取 Cookie 并缓存到数据库。

### 4.2 Cookie 刷新机制

请求统一经过 `make_request_with_cookie`。

当前逻辑：

1. 如果已有 `panel.cookie`，先带上。
2. 发请求。
3. 如果返回 `401/404`，或者响应内容包含“请重新登录 / 登录已过期”，则视为 Cookie 失效。
4. 自动重新调用 `/login`。
5. 重新登录仍失败，则把面板标记为离线。

### 4.3 一个必须注意的实现细节

创建和更新接口使用的是：

- `requests.post(url, headers=headers, params=form_data, ...)`

也就是：

- Header 写的是 `application/x-www-form-urlencoded`
- 但真正传值用的是 `params=...`
- 数据最终表现为查询参数，而不是常规 `data=...`

如果你的新项目想保持和当前系统一致，最好保留这一行为；否则可能出现同样的 payload 在新系统里能发出去，但和旧系统表现不一致。

## 5. 节点创建接口

## 5.1 创建接口路径

| 面板 | 方法 | 路径 |
| --- | --- | --- |
| x-ui | `POST` | `/xui/inbound/add` |
| 3x-ui | `POST` | `/panel/api/inbounds/add` |

## 5.2 创建请求的通用字段

两类面板最终都会构造 `form_data`，公共字段如下：

| 字段 | 类型 | 必填 | 默认值/来源 | 说明 |
| --- | --- | --- | --- | --- |
| `up` | `number` | 是 | `0` | 初始上传流量 |
| `down` | `number` | 是 | `0` | 初始下载流量 |
| `total` | `number` | 是 | `0` | 总流量 |
| `remark` | `string` | 否 | `自动创建` 或业务入参 | 备注 |
| `enable` | `boolean` | 是 | `true` | 是否启用 |
| `expiryTime` | `number` | 是 | 业务计算结果 | 毫秒时间戳 |
| `listen` | `string` | 是 | `""` | 监听地址 |
| `port` | `number` | 是 | 自动生成或指定 | 节点端口 |
| `protocol` | `string` | 是 | 业务入参小写化 | 协议 |
| `settings` | `object` | 是 | 协议相关 | 认证和协议参数 |
| `streamSettings` | `object \| string` | 是 | 协议相关 | 传输层参数 |
| `sniffing` | `object` | 是 | 面板默认模板 | 嗅探参数 |
| `allocate` | `object` | 仅 3x-ui | 3x-ui 固定模板 | 分配参数 |

## 5.3 自动生成的参数

| 参数 | 生成方式 | 用途 |
| --- | --- | --- |
| `port` | 随机生成，且避开 `used_ports` | inbound 端口 |
| `uuid` | `uuid4()` | `vmess` / `vless` 客户端 ID |
| `subId` | 随机 16 位字符串 | 3x-ui 的客户端标识 |
| `email` | `subId + port` | 3x-ui 的 `vmess/vless/shadowsocks` 客户端字段 |

## 5.4 x-ui 默认模板

未按协议覆盖前，x-ui 的基础模板是：

```json
{
  "up": 0,
  "down": 0,
  "total": 0,
  "remark": "自动创建",
  "enable": true,
  "expiryTime": 0,
  "listen": "",
  "port": 0,
  "protocol": "vmess",
  "settings": {},
  "streamSettings": {
    "network": "tcp",
    "security": "none",
    "tcpSettings": {
      "header": {
        "type": "none"
      }
    }
  },
  "sniffing": {
    "enabled": true,
    "destOverride": ["http", "tls", "quic"]
  }
}
```

## 5.5 3x-ui 默认模板

未按协议覆盖前，3x-ui 的基础模板是：

```json
{
  "up": 0,
  "down": 0,
  "total": 0,
  "remark": "自动创建",
  "enable": true,
  "expiryTime": 0,
  "listen": "",
  "port": 0,
  "protocol": "vmess",
  "settings": {},
  "streamSettings": {
    "network": "tcp",
    "security": "none",
    "externalProxy": [],
    "tcpSettings": {
      "acceptProxyProtocol": false,
      "header": {
        "type": "none"
      }
    }
  },
  "sniffing": {
    "enabled": false,
    "destOverride": ["http", "tls", "quic", "fakedns"],
    "metadataOnly": false,
    "routeOnly": false
  },
  "allocate": {
    "strategy": "always",
    "refresh": 5,
    "concurrency": 3
  }
}
```

## 6. 协议参数矩阵

### 6.1 vmess

#### x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.clients[0].id` | UUID | 自动生成 |
| `settings.clients[0].alterId` | `0` | 固定 |
| `settings.disableInsecureEncryption` | `false` | 固定 |
| `sniffing.destOverride` | `["http","tls"]` | 固定 |

#### 3x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.clients[0].id` | UUID | 自动生成 |
| `settings.clients[0].security` | `auto` | 固定 |
| `settings.clients[0].email` | `subId + port` | 自动生成 |
| `settings.clients[0].limitIp` | `0` | 固定 |
| `settings.clients[0].totalGB` | `0` | 固定 |
| `settings.clients[0].expiryTime` | `0` | 固定 |
| `settings.clients[0].enable` | `true` | 固定 |
| `settings.clients[0].tgId` | `""` | 固定 |
| `settings.clients[0].subId` | `subId` | 自动生成 |
| `settings.clients[0].comment` | `""` | 固定 |
| `settings.clients[0].reset` | `0` | 固定 |

### 6.2 vless

#### x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.clients[0].id` | UUID | 自动生成 |
| `settings.clients[0].flow` | `""` 或 `xtls-rprx-direct` | 取决于 `/server/status` 返回版本 |
| `settings.decryption` | `none` | 固定 |
| `settings.fallbacks` | `[]` | 固定 |
| `sniffing.destOverride` | `["http","tls"]` | 固定 |

#### 3x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.clients[0].id` | UUID | 自动生成 |
| `settings.clients[0].flow` | `""` | 固定 |
| `settings.clients[0].email` | `subId + port` | 自动生成 |
| `settings.clients[0].limitIp` | `0` | 固定 |
| `settings.clients[0].totalGB` | `0` | 固定 |
| `settings.clients[0].expiryTime` | `0` | 固定 |
| `settings.clients[0].enable` | `true` | 固定 |
| `settings.clients[0].tgId` | `""` | 固定 |
| `settings.clients[0].subId` | `subId` | 自动生成 |
| `settings.clients[0].comment` | `""` | 固定 |
| `settings.clients[0].reset` | `0` | 固定 |
| `settings.decryption` | `none` | 固定 |
| `settings.fallbacks` | `[]` | 固定 |

#### x-ui 的版本特判

x-ui 的 `vless` 在创建前会请求：

- `POST /server/status`

并读取：

- `obj.xray.version`

当前项目的判定规则：

- 如果版本是 `25.3.6`，则 `flow = ""`
- 否则 `flow = "xtls-rprx-direct"`

这说明新项目如果要完全兼容当前行为，不能把 `flow` 写死。

### 6.3 shadowsocks

#### x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.method` | `aes-256-gcm` | 固定 |
| `settings.password` | `nodePassword` | 业务入参 |
| `settings.network` | `tcp,udp` | 固定 |

#### 3x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.method` | `aes-256-gcm` | 固定 |
| `settings.password` | `nodePassword` | 业务入参 |
| `settings.network` | `tcp,udp` | 固定 |
| `settings.clients[0].method` | `aes-256-gcm` | 固定 |
| `settings.clients[0].password` | `nodePassword` | 业务入参 |
| `settings.clients[0].email` | `subId + port` | 自动生成 |
| `settings.clients[0].limitIp` | `0` | 固定 |
| `settings.clients[0].totalGB` | `0` | 固定 |
| `settings.clients[0].expiryTime` | `0` | 固定 |
| `settings.clients[0].enable` | `true` | 固定 |
| `settings.clients[0].tgId` | `""` | 固定 |
| `settings.clients[0].subId` | `subId` | 自动生成 |
| `settings.clients[0].comment` | `""` | 固定 |
| `settings.clients[0].reset` | `0` | 固定 |
| `settings.ivCheck` | `false` | 固定 |

### 6.4 socks

#### x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.auth` | `password` | 固定 |
| `settings.accounts[0].user` | `nodeUser` | 业务入参 |
| `settings.accounts[0].pass` | `nodePassword` | 业务入参 |
| `settings.udp` | `false` | 固定 |
| `settings.ip` | `127.0.0.1` | 固定 |
| `sniffing` | `{}` | 固定 |

#### 3x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `streamSettings` | `""` | 固定 |
| `settings.auth` | `password` | 固定 |
| `settings.accounts[0].user` | `nodeUser` | 业务入参 |
| `settings.accounts[0].pass` | `nodePassword` | 业务入参 |
| `settings.udp` | `false` | 固定 |
| `settings.ip` | `127.0.0.1` | 固定 |
| `sniffing` | `{}` | 固定 |

### 6.5 http

#### x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `settings.accounts[0].user` | `nodeUser` | 业务入参 |
| `settings.accounts[0].pass` | `nodePassword` | 业务入参 |
| `sniffing` | `{}` | 固定 |

#### 3x-ui

| 路径 | 字段 | 值/来源 |
| --- | --- | --- |
| `streamSettings` | `""` | 固定 |
| `settings.accounts[0].user` | `nodeUser` | 业务入参 |
| `settings.accounts[0].pass` | `nodePassword` | 业务入参 |
| `settings.allowTransparent` | `false` | 固定 |

## 7. 节点列表接口

### 7.1 路径

| 面板 | 方法 | 路径 |
| --- | --- | --- |
| x-ui | `POST` | `/xui/inbound/list` |
| 3x-ui | `POST` | `/panel/inbound/list` |

### 7.2 用途

当前项目里，这个接口有 4 个用途：

1. 拉取面板节点列表。
2. 同步 `nodes_count`。
3. 从返回结果中提取 `port` 刷新 `used_ports`。
4. 在 x-ui 创建成功后，按 `port` 反查新节点的 `id`。

### 7.3 返回值处理

当前项目假定返回结构类似：

```json
{
  "success": true,
  "obj": [
    {
      "id": 1,
      "port": 12345
    }
  ]
}
```

其中被明确使用到的字段只有：

| 字段 | 用途 |
| --- | --- |
| `success` | 判断请求是否成功 |
| `obj` | inbound 列表 |
| `obj[].id` | x-ui 反查 `panel_node_id` |
| `obj[].port` | 同步已使用端口、x-ui 反查节点 |

## 8. 节点更新接口

### 8.1 路径

| 面板 | 方法 | 路径 |
| --- | --- | --- |
| x-ui | `POST` | `/xui/inbound/update/{panel_node_id}` |
| 3x-ui | `POST` | `/panel/inbound/update/{panel_node_id}` |

### 8.2 用途

当前项目主要用于：

- 节点续费时，仅更新过期时间及原配置内容。

### 8.3 请求体来源

更新不是重新拼协议模板，而是直接复用已有的 `config_text`：

1. 从数据库读取 `node.config_text`。
2. 反序列化为 `form_data`。
3. 对 `settings`、`streamSettings`、`sniffing`、`allocate` 做 JSON 字符串化。
4. 提交到更新接口。

结论：

- 对当前系统来说，`config_text` 是创建、更新、迁移三类操作的核心配置源。

## 9. 节点删除接口

### 9.1 路径

| 面板 | 方法 | 路径 |
| --- | --- | --- |
| x-ui | `POST` | `/xui/inbound/del/{id}` |
| 3x-ui | `POST` | `/panel/inbound/del/{id}` |

### 9.2 用途

- 删除指定 inbound。
- 删除成功后，当前项目会再次拉取列表以刷新本地的 `nodes_count` 和 `used_ports`。

### 9.3 返回值处理

当前项目认为以下任一条件满足即删除成功：

- `result.success == true`
- `result.msg == "删除成功"`

## 10. 面板状态接口

### 10.1 路径

| 面板 | 方法 | 路径 |
| --- | --- | --- |
| x-ui / 3x-ui | `POST` | `/server/status` |

### 10.2 用途

当前项目里主要有两个用途：

1. 获取面板/Xray 运行状态。
2. x-ui 的 `vless` 创建前读取版本，决定 `flow`。

### 10.3 已使用到的返回字段

| 路径 | 用途 |
| --- | --- |
| `obj` | 系统状态整体返回 |
| `obj.xray.version` | x-ui `vless` 的版本判断 |

## 11. 3x-ui 专有的 Xray 配置接口

### 11.1 获取 Xray 配置

| 面板 | 方法 | 路径 | 功能 |
| --- | --- | --- | --- |
| 3x-ui | `POST` | `/panel/xray/` | 读取当前 Xray 配置 |

当前项目假定返回结构中：

- `success` 表示是否成功
- `obj` 是一个 JSON 字符串

解析后实际使用到：

- `xraySetting.outbounds`
- `xraySetting.routing.rules`

### 11.2 更新 Xray 配置

| 面板 | 方法 | 路径 | 功能 |
| --- | --- | --- | --- |
| 3x-ui | `POST` | `/panel/xray/update` | 更新 Xray 配置 |

请求体：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `xraySetting` | `string` | JSON 字符串化后的 Xray 配置 |

### 11.3 当前项目中的 3x-ui 路由绑定逻辑

创建 3x-ui 节点成功后，当前项目会继续做一次“入站到出站”的路由绑定：

1. 从创建结果拿到：
   - `obj.id`
   - `obj.tag`
2. 调用 `/panel/xray/` 读取当前配置。
3. 在 `xraySetting.routing.rules` 末尾追加：

```json
{
  "type": "field",
  "outboundTag": "host_config.tag",
  "inboundTag": ["新建节点返回的 tag"]
}
```

4. 调用 `/panel/xray/update` 提交。

结论：

- 如果你新项目只做“纯粹创建 inbound”，可以不封装这部分。
- 如果你要完全复刻当前项目行为，则必须一起封装 `outboundTag`、Xray 配置读取、规则追加、回写。

## 12. 3x-ui 重启接口

| 面板 | 方法 | 路径 | 功能 |
| --- | --- | --- | --- |
| 3x-ui | `POST` | `/server/restartXrayService` | 重启 Xray 服务 |

当前项目主要在迁移到新 3x-ui 面板后调用。

## 13. 创建成功后的节点 ID 获取差异

### 13.1 x-ui

x-ui 创建成功后，不直接依赖返回体里的 `obj.id`，而是：

1. 调用 `/xui/inbound/list`
2. 找到 `port == 请求端口` 的节点
3. 取对应 `id` 作为 `panel_node_id`

### 13.2 3x-ui

3x-ui 创建成功后，直接取：

- `result.obj.id`

作为 `panel_node_id`。

## 14. 迁移与复用逻辑

当前项目中“迁移节点到新面板”不是调用 update，而是：

1. 读取原 `config_text`
2. 重写 `host_config`
3. 修正端口
4. x-ui 的 `vless` 重新按版本判断 `flow`
5. 3x-ui 会重新选择 `tag`
6. 清空旧的 `panel_node_id`
7. 再次调用新增接口

结论：

- 新项目如果也要支持迁移，建议把“构建 payload”和“执行创建”拆成两个模块。
- 不要把更新和迁移混成一个接口抽象。

## 15. 新项目推荐的数据模型

### 15.1 推荐的统一面板模型

```json
{
  "panelType": "x-ui",
  "baseUrl": "1.2.3.4:54321",
  "username": "admin",
  "password": "******",
  "cookie": "",
  "outboundTag": ""
}
```

### 15.2 推荐的统一创建入参

```json
{
  "protocol": "vmess",
  "remark": "自动创建",
  "expiryTimeMs": 1740000000000,
  "requestedPort": 12345,
  "nodeUser": "",
  "nodePassword": ""
}
```

### 15.3 推荐的统一封装输出

```json
{
  "createUrl": "http://host/xui/inbound/add",
  "payload": {
    "up": 0,
    "down": 0,
    "total": 0,
    "remark": "自动创建",
    "enable": true,
    "expiryTime": 1740000000000,
    "listen": "",
    "port": 12345,
    "protocol": "vmess",
    "settings": "{...}",
    "streamSettings": "{...}",
    "sniffing": "{...}"
  }
}
```

## 16. 封装建议

### 16.1 建议拆分的模块

1. `panel_auth`
   - 登录
   - 刷新 Cookie
   - 通用请求封装

2. `panel_payload_builder`
   - `build_xui_payload(protocol, options)`
   - `build_3xui_payload(protocol, options)`

3. `panel_inbound_api`
   - 创建
   - 查询
   - 更新
   - 删除

4. `panel_3xui_route_api`
   - 读取 Xray 配置
   - 更新 Xray 配置
   - 重启 Xray

### 16.2 最容易踩坑的点

1. `ip_address` 在 3x-ui 里不能简单等同于纯 host，当前项目对 `host`/`Origin` 做了 `split('/')`。
2. 当前创建/更新用的是 `params=form_data` 而不是 `data=form_data`。
3. `settings`、`streamSettings`、`sniffing`、`allocate` 在提交前都要 JSON 字符串化。
4. x-ui 的 `vless.flow` 不能完全写死，需要看 `/server/status`。
5. x-ui 创建后要靠 `/xui/inbound/list` 按端口反查 `id`。
6. 3x-ui 如果要复刻当前行为，还要补 `/panel/xray/` 和 `/panel/xray/update`。

## 17. 一页结论

如果只从“可集成封装”的角度看，这套项目对 x-ui / 3x-ui 的抽象可以归结为：

- 登录：`POST /login`
- 状态：`POST /server/status`
- 列表：`x-ui -> /xui/inbound/list`，`3x-ui -> /panel/inbound/list`
- 创建：`x-ui -> /xui/inbound/add`，`3x-ui -> /panel/api/inbounds/add`
- 更新：`x-ui -> /xui/inbound/update/{id}`，`3x-ui -> /panel/inbound/update/{id}`
- 删除：`x-ui -> /xui/inbound/del/{id}`，`3x-ui -> /panel/inbound/del/{id}`
- 3x-ui 扩展：`/panel/xray/`、`/panel/xray/update`、`/server/restartXrayService`

而“创建节点”的本质就是：

- 先准备面板上下文
- 再按 `panelType + protocol` 生成 payload
- 把嵌套对象 JSON 字符串化
- 发到 add 接口
- 根据面板类型回收 `panel_node_id`
- 如有需要，再做 3x-ui 路由绑定和重启
