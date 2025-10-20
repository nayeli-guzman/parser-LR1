import { useState } from "react";

export default function TraceTable({ trace }) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < trace.length - 1) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div>
      <table className="w-full border border-neutral-700 text-sm rounded-lg overflow-hidden">
        <thead className="bg-neutral-700 text-gray-200">
          <tr>
            <th className="p-2">Step</th>
            <th className="p-2">Stack</th>
            <th className="p-2">Input</th>
            <th className="p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {trace.map((row, i) => (
            <tr
              key={row.step}
              className={`
                ${i % 2 === 0 ? "bg-neutral-800" : "bg-neutral-900"} 
                ${i === currentStep ? "bg-blue-600/50" : ""} 
                hover:bg-neutral-700/50 transition
              `}
            >
              <td className="p-2 border border-neutral-700">{row.step}</td>
              <td className="p-2 border border-neutral-700">{row.stack}</td>
              <td className="p-2 border border-neutral-700">{row.input}</td>
              <td className="p-2 border border-neutral-700">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center gap-3 mt-3">
        <button
          onClick={prevStep}
          className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded-md text-sm transition disabled:opacity-30"
          disabled={currentStep === 0}
        >
          ◀ Prev
        </button>
        <button
          onClick={nextStep}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition disabled:opacity-30"
          disabled={currentStep === trace.length - 1}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
