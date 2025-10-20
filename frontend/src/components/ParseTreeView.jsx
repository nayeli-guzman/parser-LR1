import { useRef, useEffect, useState } from "react";
import Tree from "react-d3-tree";

export default function ParseTreeView({ treeData }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    handleResize(); // initial measure
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-[450px] bg-neutral-900 border border-neutral-700 rounded-xl"
    >
      {dimensions.width > 0 && (
        <Tree
          data={treeData}
          orientation="vertical"
          translate={{
            x: dimensions.width / 2,
            y: 60,
          }}
          pathClassFunc={() => "stroke-blue-400"}
          styles={{
            nodes: {
              node: {
                circle: { fill: "#3b82f6", stroke: "#93c5fd", r: 12 },
                name: { fill: "#e5e7eb", fontSize: "0.9rem" },
              },
              leafNode: {
                circle: { fill: "#1e40af", stroke: "#60a5fa", r: 10 },
                name: { fill: "#d1d5db", fontSize: "0.9rem" },
              },
            },
          }}
        />
      )}
    </div>
  );
}
