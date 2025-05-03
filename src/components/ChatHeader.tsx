'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './ChatHeader.module.css';
import Image from 'next/image';
import ProfileModal from '@/components/ProfileModal';
import SignOutConfirmModal from '@/components/SignOutConfirmModal';

interface ChatHeaderProps {
  profileImageUrl?: string;
  children?: React.ReactNode;
  title: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  children,
  profileImageUrl,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // Get signOut function from Auth context
  const { signOut } = useAuth();

  // Updated default profile image path assuming image is in public/images/
  const defaultProfileImage = '/images/default-profile.png';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (!btnRef.current) return;
      if (
        !(btnRef.current as HTMLElement).contains(e.target as Node) &&
        !(document.getElementById('profile-menu')?.contains(e.target as Node))
      ) {
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuOpen, btnRef]);

  // Handlers for modal control and menu
  const handleProfileClick = () => {
    setIsProfileModalOpen(true);
    setMenuOpen(false);
  };

  const handleSignOutClick = () => {
    setIsSignOutModalOpen(true);
    setMenuOpen(false);
  };

  const handleProfileModalClose = () => setIsProfileModalOpen(false);

  const handleSignOutModalClose = () => setIsSignOutModalOpen(false);

  const handleConfirmSignOut = async () => {
    // Close the modal
    setIsSignOutModalOpen(false);
    // Invoke sign-out logic
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <div className={styles.headerContainer}>
        <div className={styles.leftSection}>
          {/* Add chat shelf/toggle logic if desired */}
        </div>
        <h1 className={styles.headerTitle}>
          <span>{title}</span>
        </h1>
        <div className={styles.rightSection}>
          {children}
          <button
            ref={btnRef}
            onClick={() => setMenuOpen((open) => !open)}
            className={styles.profileButton}
            title="Open profile menu"
            aria-label="Open profile menu"
            style={{
              marginLeft: 25,
              borderRadius: '99px',
              overflow: 'hidden',
              border: '1.7px solid #ede4fe',
              background: 'white',
              width: 44,
              height: 44,
              boxShadow: '0 1.5px 8px 0 rgba(22,24,34, 0.07)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
            }}
          >
            <Image
              src={profileImageUrl || defaultProfileImage}
              alt="Profile"
              width={40}
              height={40}
              className={styles.profileImage}
            />
          </button>
          {menuOpen && (
            <div
              id="profile-menu"
              tabIndex={-1}
              style={{
                position: 'absolute',
                top: 60, // Adjust as needed
                right: 25,
                minWidth: 160,
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                padding: '4px 0',
                zIndex: 1040,
              }}
            >
              <button
                className={styles.menuItem}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 'none',
                  background: 'none',
                  padding: '13px 21px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
                onClick={handleProfileClick}
              >
                Edit Profile
              </button>
              <button
                className={styles.menuItem}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 'none',
                  background: 'none',
                  padding: '13px 21px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#c9212e',
                  fontSize: '1rem',
                }}
                onClick={handleSignOutClick}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ProfileModal open={isProfileModalOpen} onClose={handleProfileModalClose} />
      <SignOutConfirmModal
        open={isSignOutModalOpen}
        onClose={handleSignOutModalClose}
        onConfirm={handleConfirmSignOut}
      />
    </>
  );
};

export default ChatHeader;