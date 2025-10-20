import GrammarInput from "./components/GrammarInput";
import { mockParserData } from "./data/mockParserData";
import FirstTable from "./components/FirstTable";
import FollowsTable from "./components/FollowsTable";
import LRTable from "./components/LRTable";
import TraceTable from "./components/TraceTable";
import ParseTreeView from "./components/ParseTreeView";
import NFAVisualizer from "./components/NFAVisualizer";
import DFAVisualizer from "./components/DFAVisualizer";
import StringDerivation from "./components/StringDerivation";
import { useState } from "react";

function App() {
  const [data, setData] = useState(mockParserData);

  const handleGrammarSubmit = (grammar) => {
    console.log("Grammar received:", grammar);
    // later: call backend parser here
    setData(mockParserData);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-900 text-gray-100 p-8 overflow-x-hidden">
      <h1 className="text-4xl font-extrabold mb-8 text-white tracking-tight text-center">
        LR(1) <span className="text-blue-400">Parser Visualizer</span>
      </h1>
      
      <GrammarInput onSubmit={handleGrammarSubmit} />

      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 px-8">
        <div className="space-y-6">
          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">FIRST Table</h2>
            <FirstTable data={data.first_table} />
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">LR Table</h2>
            <LRTable data={data.lr_table} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">Trace</h2>
            <TraceTable trace={data.trace} />
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700 overflow-hidden">
            <h2 className="font-semibold text-blue-300 mb-2">Parse Tree</h2>
            <div className="h-[450px] overflow-auto">
              <ParseTreeView treeData={data.tree} />
            </div>
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">FOLLOW Table</h2>
            <FollowsTable data={data.follow_table} />
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <StringDerivation steps={data.derivation_steps} />
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">NFA</h2>
            <NFAVisualizer nodes={data.nfa.nodes} edges={data.nfa.edges} />
          </div>

          <div className="bg-neutral-800 p-4 rounded-2xl shadow-md border border-neutral-700">
            <h2 className="font-semibold text-blue-300 mb-2">DFA</h2>
            <DFAVisualizer nodes={data.dfa.nodes} edges={data.dfa.edges} />
          </div>

          
        </div>
      </div>
    </div>
  );
}

export default App;
