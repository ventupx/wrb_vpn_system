# Ubuntu Cron 定时任务 - 更新节点数量

这个目录包含用于定时请求 `/api/agent-panel/update_all_nodes_count/` 接口的所有脚本和配置文件。

## 快速开始

### 方法一：使用自动安装脚本（推荐）

```bash
cd scripts
sudo ./install_cron_job.sh
```

按照提示操作即可完成配置。

### 方法二：手动配置

#### 1. 编辑脚本配置

**使用 Bash 脚本**（推荐）：
```bash
nano update_nodes_count.sh
```

修改以下配置：
- `API_URL`: API 地址
- `LOG_FILE`: 日志文件路径

**使用 Python 脚本**：
```bash
nano update_nodes_count.py
```

修改以下配置：
- `BASE_URL`: 服务器地址
- `API_ENDPOINT`: API 端点
- `LOG_FILE`: 日志文件路径

#### 2. 添加执行权限

```bash
chmod +x update_nodes_count.sh
# 或
chmod +x update_nodes_count.py
```

#### 3. 测试脚本

```bash
# 测试 Bash 脚本
./update_nodes_count.sh

# 测试 Python 脚本
python3 update_nodes_count.py

# 查看日志
tail -f /var/log/update_nodes_count.log
```

#### 4. 添加到 Cron

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时执行一次）
0 * * * * /path/to/your/project/scripts/update_nodes_count.sh >> /var/log/cron_nodes_update.log 2>&1
```

## 文件说明

- `update_nodes_count.sh` - Bash 脚本版本
- `update_nodes_count.py` - Python 脚本版本
- `install_cron_job.sh` - 自动安装脚本
- `cron_setup_guide.md` - 详细的配置指南
- `README.md` - 本文件

## 常用命令

```bash
# 查看当前的 cron 任务
crontab -l

# 编辑 cron 任务
crontab -e

# 删除所有 cron 任务
crontab -r

# 查看脚本执行日志
tail -f /var/log/update_nodes_count.log

# 查看 cron 系统日志
sudo tail -f /var/log/syslog | grep CRON

# 测试脚本
./update_nodes_count.sh
python3 update_nodes_count.py
```

## 时间格式说明

```
0 * * * *  - 每小时的第 0 分钟执行
*/30 * * * * - 每 30 分钟执行一次
0 0 * * * - 每天凌晨 0 点执行
0 9 * * 1 - 每周一早上 9 点执行
```

## 故障排查

### 脚本不执行

1. 检查 cron 服务状态：
```bash
sudo systemctl status cron
```

2. 检查脚本权限：
```bash
ls -l update_nodes_count.sh
chmod +x update_nodes_count.sh
```

3. 检查日志：
```bash
sudo tail -f /var/log/syslog | grep CRON
```

### 连接错误

确保 Django 服务器正在运行：
```bash
# 检查服务器状态
curl http://localhost:8000/api/agent-panel/total_nodes_count/
```

### 权限问题

如果需要，调整日志文件权限：
```bash
sudo chmod 664 /var/log/update_nodes_count.log
sudo chown $(whoami):$(whoami) /var/log/update_nodes_count.log
```

## 安全建议

1. **限制脚本访问权限**：
```bash
chmod 700 update_nodes_count.sh
```

2. **不要硬编码敏感信息**，使用环境变量

3. **定期清理日志文件**

## 卸载

如需删除 cron 任务：
```bash
# 编辑 crontab
crontab -e

# 删除相关行，或使用命令
crontab -l | grep -v "update_nodes_count" | crontab -
```

## 更多信息

详细配置说明请查看：[cron_setup_guide.md](cron_setup_guide.md)

