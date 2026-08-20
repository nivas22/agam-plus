'use client';

import React from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  data: any;
  onCancel: () => void;
  onConfirm: () => void;
  message: string;
  isDeleting?: boolean;
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDeleteModal({ 
  data, 
  onCancel, 
  onConfirm, 
  message, 
  isDeleting = false,
  title = "Confirm Delete",
  confirmText = "Delete",
  cancelText = "Cancel"
}: ConfirmDeleteModalProps) {
  if (!data) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isDeleting) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-trace-background bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div className="bg-surface-paper rounded-xl max-w-md w-full p-6 animate-in fade-in-90 zoom-in-90">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-status-danger-soft rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-danger" />
          </div>
          <div className="flex-1">
            <h2
              id="delete-modal-title"
              className="text-xl font-semibold text-ink-900"
            >
              {title}
            </h2>
          </div>
          {!isDeleting && (
            <button
              onClick={onCancel}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-surface-canvas flex items-center justify-center transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-ink-500" />
            </button>
          )}
        </div>

        {/* Message */}
        <p
          id="delete-modal-description"
          className="text-ink-700 mb-6 leading-relaxed"
        >
          {message}
        </p>

        {/* Warning Note */}
        <div className="bg-status-warning-soft border border-status-warning/20 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
            <p className="text-status-warning text-sm">
              This action cannot be undone. All data associated with this item will be permanently removed.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`
              flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200
              ${isDeleting
                ? 'bg-surface-canvas text-ink-500 cursor-not-allowed'
                : 'bg-ink-700 text-white hover:bg-ink-900 active:scale-95'
              }
            `}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`
              flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200
              flex items-center justify-center gap-2
              ${isDeleting
                ? 'bg-status-danger text-white cursor-not-allowed'
                : 'bg-status-danger text-white hover:bg-status-danger-hover active:scale-95'
              }
            `}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
