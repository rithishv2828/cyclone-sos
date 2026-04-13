/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  AlertTriangle, 
  Activity,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import DashboardPage from './pages/Dashboard';
import HospitalsPage from './pages/Hospitals';

export const AuthContext = React.createContext<{
  user: FirebaseUser | null;
  loading: boolean;
} | null>(null);

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const authContext = React.useContext(AuthContext);
  
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-100">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-red-600 p-1.5 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Cyclone SOS</h1>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                to="/" 
                className={`text-sm font-medium transition-colors hover:text-red-600 ${location.pathname === '/' ? 'text-red-600' : 'text-slate-600'}`}
              >
                Dashboard
              </Link>
              <Link 
                to="/hospitals" 
                className={`text-sm font-medium transition-colors hover:text-red-600 flex items-center gap-1.5 ${location.pathname === '/hospitals' ? 'text-red-600' : 'text-slate-600'}`}
              >
                <Activity className="w-4 h-4" />
                Hospitals
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {authContext?.user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-medium text-slate-900">{authContext.user.displayName}</p>
                  <p className="text-[10px] text-slate-500">{authContext.user.email}</p>
                </div>
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={authContext.user.photoURL || ''} />
                  <AvatarFallback><UserIcon className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleLogin} className="gap-2">
                <LogIn className="w-4 h-4" />
                Login
              </Button>
            )}
            
            <div className="flex items-center gap-2 md:hidden">
              <Link to="/hospitals" className="p-2 text-slate-600 hover:text-red-600">
                <Activity className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-10 border-t bg-white mt-10">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-slate-400">
            Cyclone SOS is an emergency prototype. In a real emergency, always prioritize instructions from local authorities and emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/hospitals" element={<HospitalsPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthContext.Provider>
  );
}
