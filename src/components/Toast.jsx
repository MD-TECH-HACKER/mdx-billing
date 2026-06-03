import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

let toastFn = null;
export function showToast(message, type = "success") {
  if (toastFn) toastFn({ message, type });
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastFn = ({ message, type }) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    };
    return () => {
      toastFn = null;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none no-print">
      {toasts.map((t) => {
        const tone =
          t.type === "error"
            ? "t-danger-bg"
            : t.type === "info"
              ? "t-accent-soft"
              : "t-success-bg";
        const Icon =
          t.type === "error"
            ? AlertCircle
            : t.type === "info"
              ? Info
              : CheckCircle2;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl backdrop-blur-xl px-4 py-3 flex items-center gap-3 shadow-2xl min-w-[260px] max-w-sm font-medium ${tone}`}
            style={{ animation: "mdxToastIn 0.25s ease-out" }}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{t.message}</span>
            <button
              onClick={() => setToasts((tl) => tl.filter((x) => x.id !== t.id))}
              className="ml-auto opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style jsx global>{`
        @keyframes mdxToastIn {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
