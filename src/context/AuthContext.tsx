// src/context/AuthContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase/config'; // Correct path relative to this file

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => { console.error("AuthContext Error: SignOut function not provided by AuthProvider"); },
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until first auth check completes
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    console.log("AuthContext: Setting up Firebase auth state listener...");
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log(`AuthContext: Auth state change - User logged in: ${currentUser.uid} (Email: ${currentUser.email}, Verified: ${currentUser.emailVerified})`);
      } else {
        console.log("AuthContext: Auth state change - User logged out.");
      }
      setUser(currentUser);
      setLoading(false); // Set loading to false once the check is done
      setAuthInitialized(true);
    });

    // Add a timeout to ensure loading state changes even if Firebase is slow
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("AuthContext: Auth check taking too long, setting loading to false");
        setLoading(false);
        setAuthInitialized(true);
      }
    }, 5000); // 5 second timeout

    // Cleanup listener on component unmount
    return () => {
      console.log("AuthContext: Cleaning up Firebase auth state listener.");
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Sign out handler
  const handleSignOut = async () => {
    try {
      console.log("AuthContext: Attempting sign out...");
      await firebaseSignOut(auth);
      console.log("AuthContext: Sign out successful via Firebase.");
      // The onAuthStateChanged listener will automatically update the user state to null
    } catch (error) {
      console.error("❌ AuthContext: Error during sign out:", error);
      // Optionally re-throw or handle the error (e.g., show a notification)
      throw error;
    }
  };

  // Provide context value to children
  const value = { user, loading, signOut: handleSignOut };

  // Log provider state for debugging
  if (typeof window !== 'undefined') { // Avoid logging during server-side rendering if applicable
      console.log(`AuthContext: Provider rendering - Loading: ${loading}, User UID: ${user?.uid ?? 'null'}, Initialized: ${authInitialized}`);
  }

  // If auth is initialized but user is null, we know the user is not logged in for sure
  // This prevents the loading screen when we're definitely logged out
  if (!loading || authInitialized) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  // Otherwise, show a blank div (the page components will handle loading states themselves)
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This error means useAuth was called outside of an AuthProvider
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};