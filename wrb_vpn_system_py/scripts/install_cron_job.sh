#!/bin/bash

# Ubuntu Cron 定时任务快速安装脚本
# 使用方法: sudo ./install_cron_job.sh

set -e

echo "======================================"
echo "Ubuntu Cron 定时任务安装脚本"
echo "======================================"
echo ""

# 获取脚本目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "项目目录: $PROJECT_DIR"
echo ""

# 选择脚本类型
echo "请选择使用哪个脚本："
echo "1) Bash 脚本 (update_nodes_count.sh)"
echo "2) Python 脚本 (update_nodes_count.py)"
read -p "请输入选项 (1/2) [默认: 1]: " choice
choice=${choice:-1}

if [ "$choice" = "2" ]; then
    SCRIPT_NAME="update_nodes_count.py"
    SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"
    CRON_COMMAND="python3 $SCRIPT_PATH"
else
    SCRIPT_NAME="update_nodes_count.sh"
    SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"
    CRON_COMMAND="bash $SCRIPT_PATH"
fi

echo ""
echo "选择的脚本: $SCRIPT_NAME"

# 检查脚本是否存在
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "错误: 找不到脚本文件 $SCRIPT_PATH"
    exit 1
fi

# 确保脚本有执行权限
chmod +x "$SCRIPT_PATH"
echo "✓ 已设置脚本执行权限"

# 修改脚本中的路径（如果需要）
if [ "$choice" = "1" ]; then
    # 修改 Bash 脚本中的配置
    echo ""
    read -p "请输入 API 地址 [默认: http://localhost:8008]: " api_url
    api_url=${api_url:-"http://localhost:8008"}
    
    sed -i "s|API_URL=.*|API_URL=\"$api_url/api/agent-panel/update_all_nodes_count/\"|" "$SCRIPT_PATH"
    echo "✓ 已更新 API 地址: $api_url"
fi

# 创建日志目录
LOG_DIR="/var/log"
if [ ! -d "$LOG_DIR" ]; then
    sudo mkdir -p "$LOG_DIR"
fi

# 设置日志文件权限
sudo touch "$LOG_DIR/update_nodes_count.log"
sudo chmod 664 "$LOG_DIR/update_nodes_count.log"
echo "✓ 已创建日志文件: $LOG_DIR/update_nodes_count.log"

# 询问执行频率
echo ""
echo "请选择执行频率："
echo "1) 每小时执行一次 (0 * * * *)"
echo "2) 每 30 分钟执行一次 (*/30 * * * *)"
echo "3) 每天凌晨执行 (0 0 * * *)"
read -p "请输入选项 (1/2/3) [默认: 1]: " freq_choice
freq_choice=${freq_choice:-1}

case $freq_choice in
    1)
        CRON_SCHEDULE="0 * * * *"
        ;;
    2)
        CRON_SCHEDULE="*/30 * * * *"
        ;;
    3)
        CRON_SCHEDULE="0 0 * * *"
        ;;
    *)
        CRON_SCHEDULE="0 * * * *"
        ;;
esac

echo ""
echo "执行频率: $CRON_SCHEDULE"
echo ""

# 检查是否已存在相同的 cron 任务
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo "警告: 已存在相同的 cron 任务"
    read -p "是否要删除旧任务并添加新任务? (y/n) [默认: n]: " replace
    replace=${replace:-n}
    
    if [ "$replace" = "y" ]; then
        # 删除旧任务
        crontab -l 2>/dev/null | grep -v "$SCRIPT_PATH" | crontab -
        echo "✓ 已删除旧任务"
    else
        echo "已取消操作"
        exit 0
    fi
fi

# 添加 cron 任务
CRON_JOB="$CRON_SCHEDULE $CRON_COMMAND >> $LOG_DIR/cron_nodes_update.log 2>&1"
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✓ 已添加 cron 定时任务"
echo ""
echo "当前 cron 任务列表："
echo "--------------------------------------"
crontab -l | grep "$SCRIPT_PATH" || echo "未找到相关任务"
echo "--------------------------------------"
echo ""

# 询问是否立即测试
read -p "是否立即测试脚本? (y/n) [默认: y]: " test_script
test_script=${test_script:-y}

if [ "$test_script" = "y" ]; then
    echo ""
    echo "正在测试脚本..."
    echo "--------------------------------------"
    if [ "$choice" = "2" ]; then
        python3 "$SCRIPT_PATH"
    else
        bash "$SCRIPT_PATH"
    fi
    echo "--------------------------------------"
    echo ""
    echo "测试完成，请查看日志: tail -f $LOG_DIR/update_nodes_count.log"
fi

echo ""
echo "======================================"
echo "安装完成！"
echo "======================================"
echo ""
echo "查看 cron 任务: crontab -l"
echo "查看脚本日志: tail -f $LOG_DIR/update_nodes_count.log"
echo "查看 cron 日志: sudo tail -f /var/log/syslog | grep CRON"
echo ""
echo "卸载 cron 任务: crontab -e"
echo "编辑脚本配置: nano $SCRIPT_PATH"
echo ""

