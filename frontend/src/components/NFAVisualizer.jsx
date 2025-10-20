import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";

export default function NFAVisualizer({ nodes, edges }) {
  return (
    <div className="h-[400px] bg-neutral-900 border border-neutral-700 rounded-xl">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="#555" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
