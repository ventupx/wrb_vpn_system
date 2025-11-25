#!/bin/bash

# 配置信息
# 请根据实际情况修改以下变量
API_URL="http://localhost:8008/api/agent-panel/update_all_nodes_count/"
# 如果需要认证，取消下面的注释并修改为实际的 token
# AUTH_TOKEN="your-token-here"

# 日志文件路径
LOG_FILE="/var/log/update_nodes_count.log"

# 创建日志目录（如果不存在）
mkdir -p "$(dirname "$LOG_FILE")"

# 记录开始时间
echo "$(date '+%Y-%m-%d %H:%M:%S') - 开始更新节点数量" >> "$LOG_FILE"

# 发送请求
# 如果不需要认证，使用下面的命令
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json")

# 如果需要认证，取消下面命令的注释，并注释掉上面的命令
# response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL" \
#     -H "Content-Type: application/json" \
#     -H "Authorization: Bearer $AUTH_TOKEN")

# 提取 HTTP 状态码
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
response_body=$(echo "$response" | sed '/HTTP_CODE/d')

# 记录响应
if [ "$http_code" = "200" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 请求成功 (HTTP $http_code)" >> "$LOG_FILE"
    echo "响应内容: $response_body" >> "$LOG_FILE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 请求失败 (HTTP $http_code)" >> "$LOG_FILE"
    echo "响应内容: $response_body" >> "$LOG_FILE"
fi

# 仅在出错时发送警告（可选，需要配置邮件或其他通知方式）
if [ "$http_code" != "200" ]; then
    # 可以在这里添加通知逻辑，例如发送邮件
    # mail -s "节点数量更新失败" admin@example.com <<< "HTTP $http_code"
    exit 1
fi

exit 0

