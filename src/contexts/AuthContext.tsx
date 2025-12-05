import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  login: (id: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('bosch_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (id: string, password: string): boolean => {
    if (id === 'admin' && password === 'admin123') {
      const userData = { id: 'admin', role: 'admin' as const };
      setUser(userData);
      localStorage.setItem('bosch_user', JSON.stringify(userData));
      return true;
    } else if (id === 'user' && password === 'user123') {
      const userData = { id: 'user', role: 'user' as const };
      setUser(userData);
      localStorage.setItem('bosch_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('bosch_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
