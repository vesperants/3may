// src/components/ProfileModal.tsx
'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/services/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  AuthError,
} from 'firebase/auth';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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

  useEffect(() => {
    if (!open || !user || !user.emailVerified) return;

    const fetchProfile = async () => {
      setIsFetchingProfile(true);
      setProfileError(null);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setCompanyName(data.companyName || '');
          setAddress(data.address || '');
          setPhoneNumber(data.phoneNumber || '');
        } else {
          setProfileError('Profile not found.');
        }
      } catch (error) {
        setProfileError('Error fetching profile.');
      } finally {
        setIsFetchingProfile(false);
      }
    };
    fetchProfile();
  }, [user, open]);

  const handleProfileUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setProfileError(null);
    setProfileSuccess(null);
    setIsUpdatingProfile(true);

    if (!name) {
      setProfileError('Please fill in your name.');
      setIsUpdatingProfile(false);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name,
        companyName,
        address,
        phoneNumber,
        updatedAt: serverTimestamp(),
      });
      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (_error) {
      setProfileError('Error updating profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (error) {
      const firebaseError = error as AuthError;
      if (
        firebaseError.code === 'auth/wrong-password' ||
        firebaseError.code === 'auth/invalid-credential'
      )
        setPasswordError('Current password is incorrect.');
      else if (firebaseError.code === 'auth/weak-password')
        setPasswordError('New password is too weak.');
      else setPasswordError('Error changing password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!open) return null;

  if (!user) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.modal} ref={modalRef}>
          <div style={styles.messageContainer}>
            Please log in to access your profile.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop} aria-modal="true" tabIndex={-1}>
      <div style={styles.modal} ref={modalRef}>
        <div style={styles.scrollArea}>
          <h1 style={styles.pageTitle}>Profile</h1>

          {/* Profile Update Form */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Personal Information</h2>
            <form onSubmit={handleProfileUpdate} style={styles.form}>
              {/* Name */}
              <div style={styles.fieldContainer}>
                <label htmlFor="profileName" style={styles.label}>
                  Full Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  id="profileName"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  disabled={isUpdatingProfile}
                  style={styles.input}
                  autoComplete="name"
                />
              </div>

              {/* Company */}
              <div style={styles.fieldContainer}>
                <label htmlFor="companyName" style={styles.label}>
                  Company Name
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  disabled={isUpdatingProfile}
                  style={styles.input}
                  autoComplete="organization"
                />
              </div>

              {/* Address */}
              <div style={styles.fieldContainer}>
                <label htmlFor="address" style={styles.label}>
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  disabled={isUpdatingProfile}
                  style={styles.input}
                  autoComplete="street-address"
                />
              </div>

              {/* Phone */}
              <div style={styles.fieldContainer}>
                <label htmlFor="phoneNumber" style={styles.label}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  disabled={isUpdatingProfile}
                  style={styles.input}
                  autoComplete="tel"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {profileError && <p style={styles.error}>{profileError}</p>}
              {profileSuccess && <p style={styles.success}>{profileSuccess}</p>}

              <div style={styles.buttonContainer}>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  style={{
                    ...styles.button,
                    opacity: isUpdatingProfile ? 0.6 : 1,
                    cursor: isUpdatingProfile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Password Change Form */}
          <section style={{ ...styles.section, marginBottom: 0 }}>
            <h2 style={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handlePasswordChange} style={styles.form}>
              {/* Current Password */}
              <div style={styles.fieldContainer}>
                <label htmlFor="currentPassword" style={styles.label}>
                  Current Password <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  disabled={isChangingPassword}
                  style={styles.input}
                  autoComplete="current-password"
                />
              </div>

              {/* New Password */}
              <div style={styles.fieldContainer}>
                <label htmlFor="newPassword" style={styles.label}>
                  New Password <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={isChangingPassword}
                  style={styles.input}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>

              {/* Confirm New Password */}
              <div style={styles.fieldContainer}>
                <label htmlFor="confirmNewPassword" style={styles.label}>
                  Confirm New Password <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  required
                  disabled={isChangingPassword}
                  style={styles.input}
                  autoComplete="new-password"
                />
              </div>

              {passwordError && <p style={styles.error}>{passwordError}</p>}
              {passwordSuccess && <p style={styles.success}>{passwordSuccess}</p>}

              <div style={styles.buttonContainer}>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  style={{
                    ...styles.button,
                    opacity: isChangingPassword ? 0.6 : 1,
                    cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // No backdrop blur for simplicity
  },
  modal: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.12)',
    minWidth: 480,
    maxWidth: '90vw',
    margin: 15,
    overflow: 'hidden',
    padding: 0,
    maxHeight: '90vh',
    fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`,
  },
  scrollArea: {
    overflowY: 'auto',
    maxHeight: '80vh',
    padding: '32px 32px 24px',
    minHeight: 0,
    // Use browser native scrollbar
  },
  pageTitle: {
    margin: 0,
    marginBottom: 24,
    fontSize: 24,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  section: {
    marginBottom: 36,
    borderBottom: '1px solid #e1e1e1',
    paddingBottom: 24,
  },
  sectionTitle: {
    marginBottom: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
    userSelect: 'none',
  },
  input: {
    padding: '10px 12px',
    fontSize: 15,
    borderRadius: 4,
    border: '1px solid #ccc',
    outlineColor: '#4a90e2',
    transition: 'border-color 0.2s ease',
    fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`,
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  button: {
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#4a90e2',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.3s ease',
  },
  error: {
    color: '#b00020',
    fontSize: 13,
    textAlign: 'left',
    marginTop: -8,
    fontWeight: '600',
    userSelect: 'none',
  },
  success: {
    color: '#2e7d32',
    fontSize: 13,
    textAlign: 'left',
    marginTop: -8,
    fontWeight: '600',
    userSelect: 'none',
  },
  messageContainer: {
    textAlign: 'center',
    padding: 48,
    color: '#444',
    fontSize: 16,
    fontWeight: '600',
    userSelect: 'none',
  },
};