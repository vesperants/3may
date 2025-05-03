// src/components/SignOutConfirmModal.tsx
'use client';
import React, { useEffect, useRef } from 'react';

interface SignOutConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function SignOutConfirmModal({
  open,
  onClose,
  onConfirm,
}: SignOutConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Click outside closes modal
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={styles.backdrop} aria-modal="true" tabIndex={-1}>
      <div style={styles.modal} ref={modalRef}>
        <div style={styles.content}>
          <h2 style={styles.title}>Sign Out</h2>
          <p style={styles.message}>Are you sure you want to sign out?</p>
          <div style={styles.buttonContainer}>
            <button onClick={onConfirm} style={{ ...styles.button, ...styles.primaryButton }}>
              Yes
            </button>
            <button onClick={onClose} style={{ ...styles.button, ...styles.secondaryButton }}>
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // no blur for plain style
  },
  modal: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 340,
    maxWidth: 400,
    width: '90vw',
    margin: 15,
    padding: 24,
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    userSelect: 'none',
    fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
  },
  content: {
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: 700,
    margin: '0 0 22px 0',
    fontSize: '1.15em',
    color: '#222',
  },
  message: {
    marginBottom: 36,
    fontSize: 15,
    color: '#444',
  },
  buttonContainer: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    minWidth: 90,
    padding: '10px 0',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.3s ease',
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#f3f3f7',
    color: '#333',
  },
};