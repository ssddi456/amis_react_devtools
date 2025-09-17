import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    ControlButton,
    MiniMap,
    Background,
    BackgroundVariant,
    NodeTypes,
    Handle,
    Position,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { MrScopeNodeData } from '../sql_ls/types';
import { useContextManager } from './ContextManagerContext';
import { DisplayMRScope } from './DisplayMRScope';
import './MrScopeDagFlow.css';
import { SourceLink } from './source_link';
import { WithSource } from '../sql_ls/helpers/util';
// 自定义节点类型
const MrScopeNode = ({ data, id }: { data: WithSource<MrScopeNodeData>; id: string }) => {
    const { contextManager } = useContextManager();
    const nodeRef = useRef<HTMLDivElement>(null);

    const mrScope = data.type === 'local' ? contextManager?.getMrScopeById(data.id) : null;

    if (!mrScope && data.type === 'local') {
        console.error('MrScopeNode: cannot find mrScope for id', data.id);
    }
    // 测量节点尺寸并上报
    useEffect(() => {
        if (nodeRef.current && data.onNodeSizeChange) {
            const { offsetWidth, offsetHeight } = nodeRef.current;
            data.onNodeSizeChange(id, { width: offsetWidth, height: offsetHeight });
        }
    }, [id, data, mrScope]); // 依赖mrScopt确保内容变化时重新测量

    return (
        <div
            ref={nodeRef}
            style={{
                padding: '10px 15px',
                borderRadius: '8px',
                backgroundColor: '#fff',
                border: data.isOrphan ? '2px solid #d83b01' : '2px solid #0078d4',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                minWidth: '120px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#323130',
                cursor: 'pointer',
            }}
        >
            {
                data.deps.map((depId, index) => {
                    // Keep position as Top but use style to spread handlers evenly
                    const totalHandlers = data.deps.length;
                    const spacing = 100 / (totalHandlers + 1); // Percentage spacing
                    const leftOffset = spacing * (index + 1);

                    return (
                        <Handle
                            type="target"
                            position={Position.Top}
                            id={depId}
                            key={depId}
                            style={{
                                left: `${leftOffset}%`,
                                transform: 'translateX(-50%)', // Center the handle
                                background: '#0078d4',
                                border: '2px solid #fff',
                                width: '8px',
                                height: '8px'
                            }}
                        />
                    );
                })
            }
            {mrScope
                ? (
                    <>
                        {
                            data.isOrphan
                                ? (
                                    <div style={{ color: '#a19f9d', fontStyle: 'italic' }}>
                                        orphaned
                                    </div>
                                )
                                : null
                        }
                        <DisplayMRScope mrScope={mrScope!} />
                    </>
                )
                : (
                    <div style={{ color: '#a19f9d', fontStyle: 'italic' }}>
                        {data.label}
                        {/* <SourceLink source={data?.__source} /> */}
                    </div>
                )}
            <Handle type="source" position={Position.Bottom} id="input" />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    mrScopeNode: MrScopeNode,
};

// 使用 Dagre 进行自动布局
const getLayoutedElements = (nodes: Node[], edges: Edge[], nodeSizes: Map<string, { width: number; height: number }>, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // 默认尺寸
    const defaultNodeWidth = 150;
    const defaultNodeHeight = 60;

    dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

    nodes.forEach((node) => {
        const nodeSize = nodeSizes.get(node.id);
        const width = nodeSize?.width || defaultNodeWidth;
        const height = nodeSize?.height || defaultNodeHeight;
        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const nodeSize = nodeSizes.get(node.id);
        const width = nodeSize?.width || defaultNodeWidth;
        const height = nodeSize?.height || defaultNodeHeight;

        node.targetPosition = Position.Top;
        node.sourcePosition = Position.Bottom;
        node.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
        };
    });

    return { nodes, edges };
};

interface MrScopeDagFlowProps {
    nodes: Array<{
        id: string;
        data: MrScopeNodeData;
        position: { x: number; y: number };
        measured?: { width: number; height: number };
    }>;
    edges: Array<{
        id: string;
        from: string;
        to: string;
        sourceHandle: string;
        targetHandle: string;
    }>;
}

export const MrScopeDagFlow: React.FC<MrScopeDagFlowProps> = ({ nodes: initialNodes, edges: initialEdges }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [nodeSizes, setNodeSizes] = useState<Map<string, { width: number; height: number }>>(new Map());
    const [isInitialLayoutDone, setIsInitialLayoutDone] = useState(false);

    // 处理节点尺寸变化的回调
    const handleNodeSizeChange = useCallback((nodeId: string, size: { width: number; height: number }) => {
        setNodeSizes(prev => {
            const newSizes = new Map(prev);
            const currentSize = newSizes.get(nodeId);

            // 只有尺寸真正变化时才更新
            if (!currentSize || currentSize.width !== size.width || currentSize.height !== size.height) {
                newSizes.set(nodeId, size);
                return newSizes;
            }
            return prev;
        });
    }, []);

    // 转换节点和边的格式
    const reactFlowNodes: Node[] = useMemo(() =>
        initialNodes.map(node => ({
            id: node.id,
            type: 'mrScopeNode',
            data: {
                ...node.data as any,
                onNodeSizeChange: handleNodeSizeChange,
            },
            position: node.position,
        })),
        [initialNodes, handleNodeSizeChange]
    );

    const reactFlowEdges: Edge[] = useMemo(() =>
        initialEdges.map(edge => ({
            id: edge.id,
            source: edge.from,
            target: edge.to,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            type: 'smoothstep',
            style: {
                stroke: '#0078d4',
                strokeWidth: 2,
            },
            markerEnd: {
                type: 'arrowclosed',
                color: '#0078d4',
            },
        })),
        [initialEdges]
    );

    // 应用自动布局
    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() =>
        getLayoutedElements(reactFlowNodes, reactFlowEdges, nodeSizes),
        [reactFlowNodes, reactFlowEdges, nodeSizes]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    // 当输入数据变化时更新布局
    useEffect(() => {
        const { nodes: newLayoutedNodes, edges: newLayoutedEdges } = getLayoutedElements(reactFlowNodes, reactFlowEdges, nodeSizes);
        setNodes(newLayoutedNodes);
        setEdges(newLayoutedEdges);
        setIsInitialLayoutDone(true);
    }, [reactFlowNodes, reactFlowEdges, nodeSizes, setNodes, setEdges]);

    // 当所有节点都有尺寸信息时触发重新布局
    useEffect(() => {
        if (nodeSizes.size === initialNodes.length && nodeSizes.size > 0 && !isInitialLayoutDone) {
            const { nodes: newLayoutedNodes, edges: newLayoutedEdges } = getLayoutedElements(reactFlowNodes, reactFlowEdges, nodeSizes);
            setNodes(newLayoutedNodes);
            setEdges(newLayoutedEdges);
            setIsInitialLayoutDone(true);
        }
    }, [nodeSizes, initialNodes.length, reactFlowNodes, reactFlowEdges, setNodes, setEdges, isInitialLayoutDone]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // 全屏切换函数
    const toggleFullscreen = useCallback(() => {
        const container = document.getElementById('mr-scope-dag-flow-container');
        if (!container) return;

        if (!isFullscreen) {
            // 进入全屏
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if ((container as any).webkitRequestFullscreen) {
                (container as any).webkitRequestFullscreen();
            } else if ((container as any).msRequestFullscreen) {
                (container as any).msRequestFullscreen();
            }
        } else {
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            } else if ((document as any).msExitFullscreen) {
                (document as any).msExitFullscreen();
            }
        }
    }, [isFullscreen]);

    // 监听全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).msFullscreenElement
            );
            setIsFullscreen(isCurrentlyFullscreen);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
        };
    }, []);

    return (
        <div
            id="mr-scope-dag-flow-container"
            style={{
                width: '100%',
                height: '100%',
                minHeight: '400px',
                backgroundColor: isFullscreen ? '#fff' : 'transparent'
            }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{
                    padding: 0.2,
                }}
                attributionPosition="bottom-left"
            >
                <Controls>
                    <ControlButton
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "退出全屏" : "全屏显示"}
                    >
                        {isFullscreen ? (
                            // 退出全屏图标
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M8 16H5v-3H3v5h5v-2zm3-8V3h-1v5H5v1h5v-1zm3 0h1V3h-1v5h5v1h-5V8zm3 8v2h2v-5h-2v3h-3v-2h-2v5h5z"
                                    fill="currentColor"
                                />
                            </svg>
                        ) : (
                            // 全屏图标
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
                                    fill="currentColor"
                                />
                            </svg>
                        )}
                    </ControlButton>
                </Controls>
                <MiniMap
                    nodeStrokeColor="#0078d4"
                    nodeColor="#fff"
                    nodeBorderRadius={8}
                />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            </ReactFlow>
        </div>
    );
};
