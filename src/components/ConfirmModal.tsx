import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = React.memo(function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="custom-confirm-modal-overlay">
          {/* Backdrop Blur and Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            id="modal-backdrop-underlay"
          />

          {/* Modal Dialog Card wrapper */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
            className="relative bg-[var(--bg-card)] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[var(--border-card)] overflow-hidden z-50 transition-colors duration-200"
            id="modal-dialog-card"
          >
            {/* Top Close icon button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-[var(--bg-input-hover)] text-[var(--text-sub)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              id="btn-close-modal-x"
            >
              <X size={16} />
            </button>

            {/* Content body layout */}
            <div className="flex flex-col items-center text-center mt-2">
              {/* Type colored icon badge */}
              <div 
                className={`p-3.5 rounded-2xl mb-4 ${
                  type === 'danger' 
                    ? 'bg-red-500/10 text-red-500 dark:text-red-400' 
                    : 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                }`}
                id="modal-status-badge"
              >
                {type === 'danger' ? (
                  <Trash2 size={24} className="stroke-2" />
                ) : (
                  <AlertTriangle size={24} className="stroke-2" />
                )}
              </div>

              {/* Title display */}
              <h3 className="font-display font-extrabold text-[var(--text-main)] text-lg leading-tight mb-2">
                {title}
              </h3>

              {/* Description message */}
              <p className="text-[var(--text-sub)] text-sm font-semibold leading-relaxed px-1">
                {description}
              </p>
            </div>

            {/* Action buttons list */}
            <div className="flex gap-3 mt-6 sm:mt-7">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 text-xs font-bold text-[var(--text-body)] hover:text-[var(--text-main)] bg-[var(--bg-input)] hover:bg-[var(--bg-input-hover)] border border-[var(--border-input)] rounded-xl transition-all cursor-pointer text-center"
                id="btn-modal-cancel"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onCancel(); // Close after confirming
                }}
                className={`flex-1 py-3 px-4 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-sm text-center ${
                  type === 'danger'
                    ? 'bg-[#d31919] hover:bg-[#b51414] shadow-red-100/10 hover:shadow-md'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100/10 hover:shadow-md'
                }`}
                id="btn-modal-confirm"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

export default ConfirmModal;
