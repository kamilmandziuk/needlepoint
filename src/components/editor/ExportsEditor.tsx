import { Plus, Trash2 } from 'lucide-react';
import type { ExportSignature } from '../../lib/types';

interface ExportsEditorProps {
  exports: ExportSignature[];
  onChange: (exports: ExportSignature[]) => void;
}

export default function ExportsEditor({ exports, onChange }: ExportsEditorProps) {
  const addExport = () => {
    onChange([
      ...exports,
      { name: '', type: '', description: '' },
    ]);
  };

  const updateExport = (index: number, field: keyof ExportSignature, value: string) => {
    const updated = [...exports];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeExport = (index: number) => {
    onChange(exports.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Exported Functions/Classes
        </h3>
        <button
          type="button"
          onClick={addExport}
          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded transition-colors"
        >
          <Plus size={14} />
          Add Export
        </button>
      </div>

      {exports.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-700 rounded-md">
          No exports defined yet.
          <br />
          Click "Add Export" to define what this file should export.
        </div>
      ) : (
        <div className="space-y-3">
          {exports.map((exp, index) => (
            <div
              key={index}
              className="p-3 bg-gray-800/50 border border-gray-700 rounded-md space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <input
                    value={exp.name}
                    onChange={(e) => updateExport(index, 'name', e.target.value)}
                    placeholder="Function/class name"
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    value={exp.type}
                    onChange={(e) => updateExport(index, 'type', e.target.value)}
                    placeholder="Type signature, e.g., (id: string) => Promise<User>"
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea
                    value={exp.description}
                    onChange={(e) => updateExport(index, 'description', e.target.value)}
                    placeholder="What does this export do?"
                    rows={2}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeExport(index)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Define the functions, classes, or variables that this file should export.
        The LLM will use these signatures when generating the code.
      </p>
    </div>
  );
}
