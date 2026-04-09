import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  Switch,
} from "antd";
import { HolderOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FC, HTMLAttributes, Key } from "react";
import { DndContext } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fetchAddCateLog,
  fetchDeleteCatelog,
  fetchUpdateCateLog,
} from "../../../utils/api";
import { useData } from "../hooks/useData";
export interface CatelogProps {}

interface DataType {
  id: number;
  name: string;
  sort: number;
  [key: string]: any;
}

interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
}

const RowContext = React.createContext<RowContextProps>({});

const DragHandle: FC = () => {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: "move", touchAction: "none" }}
      ref={setActivatorNodeRef}
      {...listeners}
    />
  );
};

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': Key;
}

const Row = ({ children, ...props }: RowProps) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"]?.toString() || "",
  });

  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 9999 } : {}),
  };

  const contextValue = useMemo<RowContextProps>(
    () => ({ setActivatorNodeRef, listeners }),
    [setActivatorNodeRef, listeners],
  );

  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {children}
      </tr>
    </RowContext.Provider>
  );
};

export const Catelog: FC<CatelogProps> = () => {
  const { store, loading, reload } = useData();
  const [requestLoading, setRequestLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [updateForm] = Form.useForm();
  const [showAddModel, setShowAddModel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [passwordFilter, setPasswordFilter] = useState<"all" | "locked" | "unlocked">("all");
  const [dataSource, setDataSource] = useState<DataType[]>([]);
  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await fetchDeleteCatelog(id);
        message.success("删除成分类功!");
      } catch (err) {
        message.warning("删除分类失败!");
      } finally {
        reload();
      }
    },
    [reload]
  );
  const handleCreate = useCallback(
    async (record: any) => {
      try {
        await fetchAddCateLog(record);
        message.success("添加成功!");
      } catch (err) {
        message.warning("添加失败!");
      } finally {
        setShowAddModel(false);
        reload();
      }
    },
    [reload, setShowAddModel]
  );

  const handleUpdate = useCallback(
    async (record: any) => {
      setRequestLoading(true);
      try {
        await fetchUpdateCateLog(record);
        message.success("更新成功! ");
        setTimeout(() => {
          reload();
        }, 3000);
      } catch (err) {
        message.warning("更新失败!");
      } finally {
        setRequestLoading(false);
        setShowEdit(false);
        reload();
      }
    },
    [reload, setShowEdit, setRequestLoading]
  );
  const handleBatchHide = useCallback(
    async (hidden: boolean) => {
      try {
        for (const each of selectedRows) {
          try {
            // 分类批量隐藏同样复用单条更新接口，保持前后端模型一致。
            await fetchUpdateCateLog({ ...each, hide: hidden });
          } catch (err) { }
        }
        message.success(hidden ? "批量隐藏分类成功!" : "批量取消隐藏分类成功!");
      } catch (err) {
        message.warning(hidden ? "批量隐藏分类失败!" : "批量取消隐藏分类失败!");
      } finally {
        reload();
      }
    },
    [reload, selectedRows]
  );
  const handleBatchClearPassword = useCallback(async () => {
    try {
      for (const each of selectedRows) {
        try {
          await fetchUpdateCateLog({ ...each, accessPassword: "", clearAccessPassword: true });
        } catch (err) { }
      }
      message.success("批量清空分类密码成功!");
    } catch (err) {
      message.warning("批量清空分类密码失败!");
    } finally {
      reload();
    }
  }, [reload, selectedRows]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      setDataSource((previous) => {
        const activeIndex = previous.findIndex((item) => item.id.toString() === active.id);
        const overIndex = previous.findIndex((item) => item.id.toString() === over?.id);
        const newData = arrayMove(previous, activeIndex, overIndex);
        const updates = newData.map((item, index) => ({
          ...item,
          sort: index + 1,
        }));

        Promise.all(updates.map((item) => fetchUpdateCateLog(item)))
          .then(() => {
            message.success("分类排序更新成功");
            reload();
          })
          .catch(() => {
            message.error("分类排序更新失败");
          });

        return updates;
      });
    }
  };

  useEffect(() => {
    const filteredData = (store?.catelogs || [])
      .filter((item: any) => {
        if (passwordFilter === "locked") {
          return Boolean(item.passwordProtected);
        }
        if (passwordFilter === "unlocked") {
          return !Boolean(item.passwordProtected);
        }
        return true;
      })
      .sort((a: DataType, b: DataType) => a.sort - b.sort);
    setDataSource(filteredData);
  }, [passwordFilter, store?.catelogs]);

  return (
    <Card
      title={
        <Space>
          <span>{`当前共 ${store?.catelogs?.length ?? 0} 条`}</span>
          {selectedRows.length > 0 && (
            <Popconfirm title="确定隐藏这些分类吗？" onConfirm={() => handleBatchHide(true)}>
              <Button type="link">批量隐藏</Button>
            </Popconfirm>
          )}
          {selectedRows.length > 0 && (
            <Popconfirm title="确定清空这些分类密码吗？" onConfirm={() => handleBatchClearPassword()}>
              <Button type="link">清空密码</Button>
            </Popconfirm>
          )}
          {selectedRows.length > 0 && (
            <Popconfirm title="确定取消隐藏这些分类吗？" onConfirm={() => handleBatchHide(false)}>
              <Button type="link">取消隐藏</Button>
            </Popconfirm>
          )}
        </Space>
      }
      extra={
        <Space>
          <Select
            value={passwordFilter}
            options={[
              { label: "全部密码状态", value: "all" },
              { label: "仅看已加密", value: "locked" },
              { label: "仅看未加密", value: "unlocked" },
            ]}
            onChange={(value) => setPasswordFilter(value)}
            style={{ width: 132 }}
          />
          <Button
            type="primary"
            onClick={() => {
              setShowAddModel(true);
            }}
          >
            添加
          </Button>
          <Button
            type="primary"
            onClick={() => {
              reload();
            }}
          >
            刷新
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={dataSource.map((item) => item.id.toString())} strategy={verticalListSortingStrategy}>
            <Table
              components={{
                body: {
                  row: Row,
                },
              }}
              dataSource={dataSource}
              rowKey="id"
              size="small"
              rowSelection={{
                type: "checkbox",
                onChange: (_selectedRowKeys: Key[], rows: any[]) => {
                  setSelectedRows(rows);
                },
              }}
            >
          <Table.Column
            key="sortHandle"
            align="center"
            width={50}
            title="拖动"
            render={() => <DragHandle />}
          />
          <Table.Column title="序号" dataIndex="id" width={30} />
          <Table.Column
            title="名称"
            dataIndex="name"
            width={150}
            render={(_, record: any) => {
              return (
                <div>
                  <span style={{ marginLeft: 8 }}>{record.name}</span>
                </div>
              );
            }}
          />
          <Table.Column
            title={
              <span>
                排序
                <Tooltip title="升序，按数字从小到大排序">
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </span>
            }
            dataIndex="sort"
            width={150}
          />
          <Table.Column
            title={
              <span>
                密码
                <Tooltip title="设置后，前台访问该分类时需要额外输入分类密码，即使管理员已登录也不会直接跳过">
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </span>
            }
            dataIndex={"passwordProtected"}
            width={70}
            render={(val) => {
              return Boolean(val) ? "已加密" : "未加密";
            }}
          />
          <Table.Column
            title={
              <span>
                隐藏
                <Tooltip title="开启后只有登录后才会展示该工具分类">
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
              </span>
            }
            dataIndex={"hide"}
            width={50}
            render={(val) => {
              return Boolean(val) ? "是" : "否";
            }}
          />
          <Table.Column
            title="操作"
            width={40}
            dataIndex="action"
            key="action"
            render={(_, record: any) => {
              return (
                <Space>
                    <Button
                      type="link"
                      onClick={() => {
                        updateForm.setFieldsValue({
                          ...record,
                          accessPassword: "",
                          clearAccessPassword: false,
                        });
                        setShowEdit(true);
                      }}
                    >
                    修改
                  </Button>
                  <Popconfirm
                    onConfirm={() => {
                      handleDelete(record.id);
                    }}
                    title={`确定要删除分类 ${record.name} 吗？`}
                  >
                    <Button type="link">删除</Button>
                  </Popconfirm>
                </Space>
              );
            }}
          />
            </Table>
          </SortableContext>
        </DndContext>
      </Spin>
      <Modal
        open={showAddModel}
        title={"新建分类"}
        onCancel={() => {
          setShowAddModel(false);
        }}
        onOk={() => {
          const values = addForm?.getFieldsValue();
          handleCreate(values);
        }}
      >
        <Form form={addForm}>
          <Form.Item name="name" required label="名称" labelCol={{ span: 4 }}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="sort"
            required
            initialValue={1}
            label={
              <span>
                <Tooltip title="升序，按数字从小到大排序">
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
                &nbsp;排序
              </span>
            }
            labelCol={{ span: 4 }}
          >
            <InputNumber
              placeholder="请输入分类排序"
              type="number"
              defaultValue={1}
            />
          </Form.Item>
          <Form.Item
            name="hide"
            initialValue={false}
            required
            valuePropName="checked"
            label={
              <span>
                <Tooltip title="开启后只有登录后才会展示该工具">
                  <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                </Tooltip>
                &nbsp;隐藏
              </span>
            }
            labelCol={{ span: 4 }}
          >
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item
            name="accessPassword"
            label="分类密码"
            tooltip="填写后，进入该分类前必须先输入正确密码"
            labelCol={{ span: 4 }}
          >
            <Input.Password placeholder="可选，留空表示不加密" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={showEdit}
        title={"修改分类"}
        onCancel={() => {
          setShowEdit(false);
        }}
        onOk={() => {
          const values = updateForm?.getFieldsValue();
          handleUpdate(values);
        }}
      >
        <Spin spinning={requestLoading}>
          <Form form={updateForm}>
            <Form.Item name="id" label="序号" labelCol={{ span: 4 }}>
              <Input disabled />
            </Form.Item>
            <Form.Item name="name" required label="名称" labelCol={{ span: 4 }}>
              <Input placeholder="请输入分类名称" />
            </Form.Item>
            <Form.Item
              name="sort"
              required
              label={
                <span>
                  <Tooltip title="升序，按数字从小到大排序">
                    <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                  </Tooltip>
                  &nbsp;排序
                </span>
              }
              labelCol={{ span: 4 }}
            >
              <InputNumber placeholder="请输入分类排序" defaultValue={1} />
            </Form.Item>
            <Form.Item
              name="hide"
              required
              valuePropName="checked"
              label={
                <span>
                  <Tooltip title="开启后只有登录后才会展示该工具">
                    <QuestionCircleOutlined style={{ marginLeft: "5px" }} />
                  </Tooltip>
                  &nbsp;隐藏
                </span>
              }
              labelCol={{ span: 4 }}
            >
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
            <Form.Item
              name="accessPassword"
              label="新密码"
              tooltip="留空表示保持现有密码不变"
              labelCol={{ span: 4 }}
            >
              <Input.Password placeholder="如需修改密码请填写新密码" />
            </Form.Item>
            <Form.Item
              name="clearAccessPassword"
              valuePropName="checked"
              label="清空密码"
              tooltip="开启后会移除当前分类密码"
              labelCol={{ span: 4 }}
            >
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </Card>
  );
};
