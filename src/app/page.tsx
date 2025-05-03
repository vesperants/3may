// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Page() {
  // Redirect unauthenticated users to login by default
  redirect('/login');
}