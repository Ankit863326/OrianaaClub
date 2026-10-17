// Phase 1: Provide a safe hook for reading the shared account context.
import { useContext } from 'react';
import AuthContext from './auth-context.js';

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
