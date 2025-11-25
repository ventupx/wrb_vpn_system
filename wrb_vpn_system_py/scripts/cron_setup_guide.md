# Ubuntu Cron 定时任务配置指南

## 1. 修改脚本配置

编辑 `scripts/update_nodes_count.sh` 文件，修改以下配置：

```bash
# API 地址（根据实际情况修改）
API_URL="http://localhost:8000/api/agent-panel/update_all_nodes_count/"

# 如果接口需要认证（如果需要的话）
# AUTH_TOKEN="your-token-here"

# 日志文件路径（确保有写入权限）
LOG_FILE="/var/log/update_nodes_count.log"
```

## 2. 添加 Cron 定时任务

### 方法一：使用 crontab 命令（推荐）

1. 编辑当前用户的 crontab：
```bash
crontab -e
```

2. 添加以下行（每小时执行一次）：
```cron
0 * * * * /path/to/your/project/scripts/update_nodes_count.sh >> /var/log/cron_nodes_update.log 2>&1
```

### 方法二：使用系统级 cron（需要 root 权限）

1. 将脚本复制到系统目录：
```bash
sudo cp scripts/update_nodes_count.sh /usr/local/bin/
```

2. 编辑系统 crontab：
```bash
sudo crontab -e
```

3. 添加以下行：
```cron
0 * * * * /usr/local/bin/update_nodes_count.sh
```

## 3. Cron 时间格式说明

```
* * * * * 命令
│ │ │ │ │
│ │ │ │ └───── 星期几 (0-7, 0和7都表示星期日)
│ │ │ └─────── 月份 (1-12)
│ │ └───────── 日期 (1-31)
│ └─────────── 小时 (0-23)
└───────────── 分钟 (0-59)
```

### 常用示例

- `0 * * * *` - 每小时的第 0 分钟执行
- `*/30 * * * *` - 每 30 分钟执行一次
- `0 0 * * *` - 每天凌晨 0 点执行
- `0 9 * * 1` - 每周一的早上 9 点执行
- `0 0 1 * *` - 每月 1 号凌晨 0 点执行

## 4. 测试脚本

在添加到 cron 之前，先手动测试脚本：

```bash
# 测试脚本是否正常工作
./scripts/update_nodes_count.sh

# 检查日志
tail -f /var/log/update_nodes_count.log
```

## 5. 查看和管理 Cron 任务

```bash
# 查看当前的 cron 任务
crontab -l

# 查看特定用户的 cron 任务（需要 root 权限）
sudo crontab -u username -l

# 删除所有 cron 任务
crontab -r

# 查看 cron 服务状态
sudo systemctl status cron
```

## 6. 查看日志

```bash
# 查看脚本日志
tail -f /var/log/update_nodes_count.log

# 查看 cron 执行日志（Ubuntu）
sudo tail -f /var/log/syslog | grep CRON
```

## 7. 故障排查

### 问题：脚本不执行

1. 检查 cron 服务是否运行：
```bash
sudo systemctl status cron
```

2. 检查脚本是否有执行权限：
```bash
ls -l scripts/update_nodes_count.sh
chmod +x scripts/update_nodes_count.sh
```

3. 检查日志目录权限：
```bash
sudo mkdir -p /var/log
sudo chmod 755 /var/log
```

### 问题：命令找不到

在 cron 中使用绝对路径，或者在脚本开头添加 PATH：
```bash
#!/bin/bash
export PATH=/usr/local/bin:/usr/bin:/bin
```

### 问题：Python 脚本找不到 Django 环境

如果需要在 cron 中运行 Django 脚本，在脚本开头激活虚拟环境：
```bash
#!/bin/bash
source /path/to/venv/bin/activate
cd /path/to/project
python manage.py your_command
```

## 8. 完整示例：每小时执行一次

添加到 crontab 的完整配置：

```cron
# 更新所有代理面板的节点数量
# 每小时的第 0 分钟执行
0 * * * * /home/your-username/wrb_vpn_system_py/scripts/update_nodes_count.sh >> /var/log/cron_nodes_update.log 2>&1
```

## 9. 高级配置：添加错误通知

如果需要失败时发送邮件通知，安装邮件工具：

```bash
sudo apt-get install mailutils
```

然后在脚本的邮件发送部分取消注释并配置：
```bash
if [ "$http_code" != "200" ]; then
    echo "节点数量更新失败，HTTP 状态码: $http_code" | mail -s "节点更新失败" admin@example.com
fi
```

## 10. 安全建议

1. **设置适当的文件权限**：
```bash
chmod 700 scripts/update_nodes_count.sh
```

2. **不要硬编码敏感信息**，使用环境变量或配置文件：
```bash
# 创建配置文件
sudo nano /etc/update_nodes_config
```

3. **定期清理日志文件**：
```cron
# 每天清理旧日志
0 2 * * * find /var/log -name "*.log" -mtime +30 -delete
```

