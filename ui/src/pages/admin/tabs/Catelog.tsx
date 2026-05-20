import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,

  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tooltip,
} from "antd";
import DraggableModal from "../../../components/DraggableModal";
import { DeleteOutlined, EditOutlined, HolderOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fetchAddCateLog, fetchDeleteCatelog, fetchUpdateCateLog, fetchUpdateCatelogsSort } from "../../../utils/api";
import { useData } from "../hooks/useData";

export interface CatelogProps {}

interface DataType {
  id: number;
  name: string;
  sort: number;
  hide?: boolean;
  [key: string]: any;
}

interface RowContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
}

const RowContext = React.createContext<RowContextProps>({});

const DragHandle: React.FC = () => {
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

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  "data-row-key": React.Key;
}

const Row = ({ children, ...props }: RowProps) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"]?.toString() || "",
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 9999 } : {}),
  };

  const contextValue = useMemo<RowContextProps>(
    () => ({ setActivatorNodeRef, listeners }),
    [setActivatorNodeRef, listeners]
  );

  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes}>
        {children}
      </tr>
    </RowContext.Provider>
  );
};

export const Catelog: React.FC<CatelogProps> = () => {
  const { message } = App.useApp();
  const { store, loading, reload } = useData();
  const [requestLoading, setRequestLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [updateForm] = Form.useForm();
  const [showAddModel, setShowAddModel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [dataSource, setDataSource] = useState<DataType[]>([]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await fetchDeleteCatelog(id);
        message.success("删除分类成功!");
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
        addForm.resetFields();
        reload();
      }
    },
    [reload, addForm]
  );

  const handleUpdate = useCallback(
    async (record: any) => {
      setRequestLoading(true);
      try {
        await fetchUpdateCateLog(record);
        message.success("更新成功!");
      } catch (err) {
        message.warning("更新失败!");
      } finally {
        setRequestLoading(false);
        setShowEdit(false);
        reload();
      }
    },
    [reload]
  );

  useEffect(() => {
    const nextData = [...(store?.catelogs || [])].sort(
      (a: DataType, b: DataType) => Number(a.sort || 0) - Number(b.sort || 0)
    );
    setDataSource(nextData);
  }, [store?.catelogs]);

  const onDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const previous = [...dataSource];
      const activeIndex = previous.findIndex((i) => i.id.toString() === active.id);
      const overIndex = previous.findIndex((i) => i.id.toString() === over.id);
      if (activeIndex < 0 || overIndex < 0) return;

      const nextData = arrayMove(previous, activeIndex, overIndex).map((item, index) => ({
        ...item,
        sort: index + 1,
      }));
      setDataSource(nextData);

      try {
        const updates = nextData.map((item) => ({ id: item.id, sort: item.sort }));
        await fetchUpdateCatelogsSort(updates);
        message.success("排序更新成功");
        reload();
      } catch (err) {
        message.error("排序更新失败");
        setDataSource(previous);
      }
    },
    [dataSource, reload]
  );

  return (
    <Card
      title={`当前共 ${store?.catelogs?.length ?? 0} 条`}
      extra={
        <Space>
          <Button type="primary" onClick={() => setShowAddModel(true)}>
            添加
          </Button>
          <Button type="primary" onClick={reload}>
            刷新
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={dataSource.map((i) => i.id.toString())} strategy={verticalListSortingStrategy}>
            <Table
              components={{
                body: {
                  row: Row,
                },
              }}
              dataSource={dataSource}
              rowKey="id"
              size="small"
            >
              <Table.Column key="dragSort" align="center" width={56} title="排序" render={() => <DragHandle />} />
              <Table.Column title="序号" dataIndex="id" width={60} />
              <Table.Column title="名称" dataIndex="name" width={180} />
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
                width={100}
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
                dataIndex="hide"
                width={80}
                render={(val) => (Boolean(val) ? "是" : "否")}
              />
              <Table.Column
                title="操作"
                width={120}
                dataIndex="action"
                key="action"
                render={(_, record: any) => (
                  <Space>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => {
                        updateForm.setFieldsValue(record);
                        setShowEdit(true);
                      }}
                    />
                    <Popconfirm
                      onConfirm={() => handleDelete(record.id)}
                      title={`确定要删除分类 ${record.name} 吗？`}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )}
              />
            </Table>
          </SortableContext>
        </DndContext>
      </Spin>

      <DraggableModal
        open={showAddModel}
        title="新建分类"
        onCancel={() => {
          setShowAddModel(false);
          addForm.resetFields();
        }}
        onOk={() => {
          const values = addForm.getFieldsValue();
          handleCreate(values);
        }}
      >
        <Form form={addForm}>
          <Form.Item
            name="name"
            required
            label="名称"
            labelCol={{ span: 4 }}
            rules={[{ required: true, message: "请输入分类名称" }]}
          >
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
            rules={[{ required: true, message: "请输入分类排序" }]}
          >
            <InputNumber placeholder="请输入分类排序" type="number" />
          </Form.Item>
          <Form.Item
            name="hide"
            initialValue={false}
            required
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
        </Form>
      </DraggableModal>

      <DraggableModal
        open={showEdit}
        title="修改分类"
        onCancel={() => setShowEdit(false)}
        onOk={() => {
          const values = updateForm.getFieldsValue();
          handleUpdate(values);
        }}
      >
        <Spin spinning={requestLoading}>
          <Form form={updateForm}>
            <Form.Item name="id" label="序号" labelCol={{ span: 4 }}>
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="name"
              required
              label="名称"
              labelCol={{ span: 4 }}
              rules={[{ required: true, message: "请输入分类名称" }]}
            >
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
              rules={[{ required: true, message: "请输入分类排序" }]}
            >
              <InputNumber placeholder="请输入分类排序" />
            </Form.Item>
            <Form.Item
              name="hide"
              required
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
          </Form>
        </Spin>
      </DraggableModal>
    </Card>
  );
};



