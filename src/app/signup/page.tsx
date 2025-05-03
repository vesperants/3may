'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/config';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const saveUserProfile = async (userId: string, profileData: object) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        ...profileData,
        uid: userId,
        createdAt: serverTimestamp(),
      });
    } catch {
      setError('Could not save your profile, but the account was created.');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setRegistrationSuccess(false);

    if (!email || !password || !confirmPassword || !name) {
      setError('Please fill out all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsRegistering(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const profileData = {
        email: user.email,
        name,
        companyName,
        address,
        phoneNumber,
      };

      await saveUserProfile(user.uid, profileData);

      await updateProfile(user, { displayName: name });

      await sendEmailVerification(user, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });

      setRegistrationSuccess(true);
    } catch (err) {
      const firebaseError = err as AuthError;
      switch (firebaseError.code) {
        case 'auth/email-already-in-use':
          setError('This email is already registered.');
          break;
        case 'auth/weak-password':
          setError('Password is too weak.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email format.');
          break;
        default:
          setError('Registration failed. Please try again.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.container}>
          <h2 style={{ color: '#2e7d32', marginBottom: '15px' }}>Registration Successful!</h2>
          <p>Your account has been created. Please check your email and click the verification link.</p>
          <p style={{ marginTop: 20, textAlign: 'center' }}>
            <Link href="/login" style={styles.button}>
              Go to Login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <h1 style={styles.title}>Create a New Account</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="name" style={styles.label}>
            Full Name: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="email" style={styles.label}>
            Email: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="password" style={styles.label}>
            Password: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="confirmPassword" style={styles.label}>
            Confirm Password: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Retype your password"
            required
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="companyName" style={styles.label}>
            Company Name (optional):
          </label>
          <input
            type="text"
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="address" style={styles.label}>
            Address (optional):
          </label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isRegistering}
            style={styles.input}
          />

          <label htmlFor="phoneNumber" style={styles.label}>
            Phone Number (optional):
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isRegistering}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={isRegistering} style={styles.button}>
            {isRegistering ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account?{' '}
          <Link href="/login" style={styles.link}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    boxSizing: 'border-box',
  },
  container: {
    width: '100%',
    maxWidth: '450px',
    backgroundColor: '#fff',
    padding: '40px 30px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  title: {
    marginBottom: '30px',
    fontSize: '28px',
    fontWeight: 600,
    color: '#333',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#444',
    marginBottom: '6px',
  },
  input: {
    padding: '10px 12px',
    fontSize: '16px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    outlineColor: '#4a90e2',
    transition: 'border-color 0.3s',
  },
  error: {
    color: 'red',
    fontSize: '14px',
    textAlign: 'center',
    marginTop: '-10px',
  },
  button: {
    marginTop: '10px',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#4a90e2',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  footerText: {
    marginTop: '30px',
    fontSize: '14px',
    color: '#555',
    textAlign: 'center',
  },
  link: {
    color: '#4a90e2',
    textDecoration: 'none',
    fontWeight: 600,
  },
};