#!/usr/bin/env python3
"""
定时任务脚本：更新所有代理面板的节点数量

使用方法：
1. 修改配置部分（BASE_URL 等）
2. 添加到 crontab：crontab -e
3. 添加：0 * * * * /usr/bin/python3 /path/to/scripts/update_nodes_count.py
"""

import os
import sys
import logging
import requests
from datetime import datetime

# 配置日志
LOG_FILE = '/var/log/update_nodes_count.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

# ============ 配置部分 ============
# API 地址（请根据实际情况修改）
BASE_URL = 'http://localhost:8000'
API_ENDPOINT = '/api/agent-panel/update_all_nodes_count/'

# 如果需要认证，设置 token（目前接口不需要）
# TOKEN = 'your-token-here'

# 超时设置（秒）
TIMEOUT = 30

# ==================================

def update_nodes_count():
    """发送请求更新所有节点的数量"""
    url = f"{BASE_URL}{API_ENDPOINT}"
    
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Cron-Node-Updater/1.0'
    }
    
    # 如果需要认证，取消下面的注释
    # headers['Authorization'] = f'Bearer {TOKEN}'
    
    try:
        logging.info(f"开始请求: {url}")
        
        response = requests.post(
            url,
            headers=headers,
            timeout=TIMEOUT
        )
        
        # 记录响应
        logging.info(f"HTTP 状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logging.info(f"请求成功: {data.get('message', '')}")
            
            if 'data' in data and 'total_panels' in data['data']:
                total_panels = data['data']['total_panels']
                logging.info(f"待处理面板数量: {total_panels}")
            
            return True
        else:
            logging.error(f"请求失败: {response.status_code}")
            logging.error(f"响应内容: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        logging.error("请求超时")
        return False
    except requests.exceptions.ConnectionError:
        logging.error("连接错误，请检查服务是否运行")
        return False
    except Exception as e:
        logging.error(f"发生错误: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        return False


if __name__ == '__main__':
    logging.info("=" * 50)
    logging.info("开始执行节点数量更新任务")
    logging.info("=" * 50)
    
    success = update_nodes_count()
    
    if success:
        logging.info("任务执行成功")
        sys.exit(0)
    else:
        logging.error("任务执行失败")
        # 这里可以添加发送通知的逻辑
        sys.exit(1)

