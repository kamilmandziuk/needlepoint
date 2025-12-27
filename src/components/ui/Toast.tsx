import { X, Check, AlertCircle, Info } from 'lucide-react';
import { useToastStore, Toast as ToastType } from '../../stores/toastStore';

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToastStore();

  const icons = {
    success: <Check size={16} className="text-green-400" />,
    error: <AlertCircle size={16} className="text-red-400" />,
    info: <Info size={16} className="text-blue-400" />,
  };

  const backgrounds = {
    success: 'bg-green-900/80 border-green-700',
    error: 'bg-red-900/80 border-red-700',
    info: 'bg-blue-900/80 border-blue-700',
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${backgrounds[toast.type]} text-white text-sm shadow-lg animate-slide-in`}
    >
      {icons[toast.type]}
      <span>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 p-0.5 hover:bg-white/10 rounded"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
