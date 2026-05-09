import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchSheet } from '../utils/api';

interface User {
  id: string;
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (id: string, password: string) => Promise<boolean>;
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

  const login = async (id: string, password: string): Promise<boolean> => {
    try {
      const rows = await fetchSheet('Login');
      
      // Start from 1 assuming row 0 is the header (UserName, UserId, Password, Role)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Ensure row has enough columns
        if (!row || row.length < 3) continue;
        
        const sheetUserId = String(row[1] || '').trim();
        const sheetPassword = String(row[2] || '').trim();
        
        if (sheetUserId === id && sheetPassword === password) {
          const userData = { 
            name: String(row[0] || '').trim(),
            id: sheetUserId, 
            role: String(row[3] || 'user').trim() 
          };
          setUser(userData);
          localStorage.setItem('bosch_user', JSON.stringify(userData));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
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
