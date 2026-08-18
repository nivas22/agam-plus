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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
    >
      <div className="bg-white rounded-xl max-w-md w-full p-6 animate-in fade-in-90 zoom-in-90">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h2 
              id="delete-modal-title"
              className="text-xl font-semibold text-gray-800"
            >
              {title}
            </h2>
          </div>
          {!isDeleting && (
            <button
              onClick={onCancel}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Message */}
        <p 
          id="delete-modal-description"
          className="text-gray-600 mb-6 leading-relaxed"
        >
          {message}
        </p>

        {/* Warning Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 text-sm">
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
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-500 text-white hover:bg-gray-600 active:scale-95'
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
                ? 'bg-red-400 text-white cursor-not-allowed' 
                : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
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
