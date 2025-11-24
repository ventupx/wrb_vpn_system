import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, message, Modal, Form, Input, Tag, Select } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, SaveOutlined, PoweroffOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import request from '@/utils/request';

interface OutboundRule {
  tag: string;
  protocol: string;
  ip: string;
  port: string;
  username: string;
  password: string;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<OutboundRule[]>([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<OutboundRule | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [isRouteModalVisible, setIsRouteModalVisible] = useState(false);
  const [currentOutboundTag, setCurrentOutboundTag] = useState<string>('');
  const [inboundTags, setInboundTags] = useState<string[]>([]);
  const [selectedInboundTags, setSelectedInboundTags] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchRules();
    }
  }, [id]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xaryConfig, setXaryConfig] = useState<any>(null);
  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await request.get(`/agent-panel/${id}/outbounds/`);
      if (response.code === 200 && response.data?.xraySetting?.outbounds) {
        setXaryConfig(response.data);
        setInboundTags(response.data.inboundTags || []);
        setRules(response.data.xraySetting.outbounds.map((outbound: any) => ({
          tag: outbound.tag,
          protocol: outbound.protocol,
          ip: outbound.settings?.servers?.[0]?.address || '',
          port: outbound.settings?.servers?.[0]?.port || '',
          username: outbound.settings?.servers?.[0]?.users?.[0]?.user || '',
          password: outbound.settings?.servers?.[0]?.users?.[0]?.pass || ''
        })));
      } else {
        message.error(response.message || '获取出站规则失败');
      }
    } catch (error) {
      console.error('获取出站规则失败:', error);
      message.error('获取出站规则失败');
    }
    setLoading(false);
  };

  const handleAddRule = async (values: OutboundRule) => {
    try {
      // 检查标签是否已存在
      const isTagExists = rules.some(rule => rule.tag === values.tag);
      if (isTagExists) {
        message.error('标签名称已存在，请使用其他名称');
        return;
      }

      setRules([...rules, values]);
      message.success('添加规则成功');
      setIsAddModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('添加规则失败:', error);
      message.error('添加规则失败');
    }
  };

  const handleDeleteRule = (rule: OutboundRule) => {
    Modal.confirm({
      title: '确认删除规则',
      content: `确定要删除规则 ${rule.tag} 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setRules(rules.filter(item => item.tag !== rule.tag));
        message.success('删除规则成功');
      }
    });
  };

  const handleSave = async () => {
    try {
      if (!xaryConfig) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await request.post<any>(`/agent-panel/${id}/save_outbounds/`, {
        data: xaryConfig.xraySetting
      });

      if (response.code === 200) {
        message.success('保存成功');
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleRestart = async () => {
    Modal.confirm({
      title: '确认重启服务',
      content: '重启服务将导致所有连接断开，确定要重启吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await request.post<any>(`/agent-panel/${id}/restart_xray/`);
          if (response.code === 200) {
            message.success('重启Xray服务成功');
          } else {
            message.error(response.message || '重启服务失败');
          }
        } catch (error) {
          console.error('重启服务失败:', error);
          message.error('重启服务失败');
        }
      }
    });
  };

  const handleEdit = (rule: OutboundRule) => {
    setEditingRule(rule);
    editForm.setFieldsValue({
      tag: rule.tag,
      ip: rule.ip,
      port: rule.port,
      username: rule.username,
      password: rule.password
    });
    setIsEditModalVisible(true);
  };

  const handleEditSubmit = () => {
    editForm.validateFields().then(values => {
      if (editingRule) {
        // 检查标签是否已存在（排除当前编辑的规则）
        const isTagExists = rules.some(rule => 
          rule.tag !== editingRule.tag && rule.tag === values.tag
        );
        if (isTagExists) {
          message.error('标签名称已存在，请使用其他名称');
          return;
        }

        // 更新出站规则
        const updatedRules = rules.map(rule => {
          if (rule.tag === editingRule.tag) {
            return {
              ...rule,
              tag: values.tag,
              ip: values.ip,
              port: values.port,
              username: values.username,
              password: values.password
            };
          }
          return rule;
        });
        setRules(updatedRules);

        // 如果标签名称发生变化，更新路由规则
        if (editingRule.tag !== values.tag && xaryConfig) {
          const updatedRoutingRules = (xaryConfig.xraySetting?.routing?.rules || []).map((routingRule: { outboundTag: string; inboundTag: string[]; type: string }) => {
            if (routingRule.outboundTag === editingRule.tag) {
              return {
                ...routingRule,
                outboundTag: values.tag
              };
            }
            return routingRule;
          });

          setXaryConfig({
            ...xaryConfig,
            xraySetting: {
              ...xaryConfig.xraySetting,
              routing: {
                ...xaryConfig.xraySetting?.routing,
                rules: updatedRoutingRules
              }
            }
          });
        }

        setIsEditModalVisible(false);
        editForm.resetFields();
        message.success('修改成功');
      }
    });
  };

  const handleRouteClick = (record: OutboundRule) => {
    setCurrentOutboundTag(record.tag);
    // 获取当前已选中的 inboundTags
    const currentRules = xaryConfig?.xraySetting?.routing?.rules || [];
    const currentSelected = currentRules
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((rule: any) => rule.outboundTag === record.tag)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((rule: any) => rule.inboundTag);
    setSelectedInboundTags(currentSelected);
    setIsRouteModalVisible(true);
  };

  const handleRouteSave = () => {
    if (!xaryConfig) return;

    // 删除所有与当前 outboundTag 相关的规则
    const updatedRules = (xaryConfig.xraySetting?.routing?.rules || []).filter(
      (rule: { outboundTag: string; inboundTag: string[]; type: string }) => rule.outboundTag !== currentOutboundTag
    );

    // 为每个选中的 inboundTag 创建新规则
    selectedInboundTags.forEach(inboundTag => {
      updatedRules.push({
        type: 'field',
        inboundTag: [inboundTag],
        outboundTag: currentOutboundTag
      });
    });

    // 更新 xaryConfig
    setXaryConfig({
      ...xaryConfig,
      xraySetting: {
        ...xaryConfig.xraySetting,
        routing: {
          ...xaryConfig.xraySetting?.routing,
          rules: updatedRules
        }
      }
    });

    setIsRouteModalVisible(false);
    message.success('路由规则保存成功');
  };

  const columns = [
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => (
        <Tag color="green">{protocol}</Tag>
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (password: string) => (
        <span>{password}</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: OutboundRule) => (
        <Space size="middle">
          <Button 
            type="link" 
            onClick={() => handleEdit(record)}
          >
            修改
          </Button>
          <Button 
            type="link"
            onClick={() => handleRouteClick(record)}
          >
            路由规则
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRule(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button 
              type="text" 
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
            <span>出站规则设置</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsAddModalVisible(true)}
            >
              添加规则
            </Button>
            <Button 
              icon={<SaveOutlined />}
              onClick={handleSave}
            >
              保存
            </Button>
            <Button 
              icon={<PoweroffOutlined />}
              onClick={handleRestart}
            >
              重启
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={fetchRules}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table 
          columns={columns} 
          dataSource={rules}
          rowKey="tag"
          pagination={false}
          loading={loading}
        />
      </Card>

      <Modal
        title="添加出站规则"
        open={isAddModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsAddModalVisible(false);
          form.resetFields();
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddRule}
          initialValues={{ protocol: 'socks' }}
        >
          <Form.Item
            name="tag"
            label="标签"
            rules={[
              { required: true, message: '请输入标签' },
              { validator: (_, value) => {
                if (rules.some(rule => rule.tag === value)) {
                  return Promise.reject('标签名称已存在');
                }
                return Promise.resolve();
              }}
            ]}
          >
            <Input placeholder="请输入标签" />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="协议"
          >
            <Input disabled defaultValue={'socks'} value="socks" />
          </Form.Item>
          <Form.Item
            name="ip"
            label="IP地址"
            rules={[{ required: true, message: '请输入IP地址' }]}
          >
            <Input placeholder="请输入IP地址" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <Input type="number" placeholder="请输入端口" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: 'outbounds' }]}
          >
            <Input placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改出站规则"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setIsEditModalVisible(false);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            name="tag"
            label="标签"
            rules={[
              { required: true, message: '请输入标签' },
              { validator: (_, value) => {
                if (rules.some(rule => 
                  rule.tag !== editingRule?.tag && rule.tag === value
                )) {
                  return Promise.reject('标签名称已存在');
                }
                return Promise.resolve();
              }}
            ]}
          >
            <Input placeholder="请输入标签" />
          </Form.Item>
          <Form.Item
            name="ip"
            label="IP地址"
            rules={[{ required: true, message: '请输入IP地址' }]}
          >
            <Input placeholder="请输入IP地址" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <Input type="number" placeholder="请输入端口" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="路由规则设置"
        open={isRouteModalVisible}
        onOk={handleRouteSave}
        onCancel={() => {
          setIsRouteModalVisible(false);
          setSelectedInboundTags([]);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="请选择入站标签"
          value={selectedInboundTags}
          onChange={setSelectedInboundTags}
          options={inboundTags.map(tag => ({
            label: tag,
            value: tag
          }))}
        />
      </Modal>
    </div>
  );
};

export default Settings; 