import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import request from '@/utils/request';

interface User {
  id: number;
  username: string;
  email?: string;
  name?: string;
  user_type: 'admin' | 'agent_l1' | 'agent_l2' | 'customer';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 检查是否已经登录
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await request.get('/users/profile/');
          if (response.data.code === 200) {
            setUser(response.data.data);
          } else {
            localStorage.removeItem('token');
          }
        } catch (error) {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await request.post('/auth/login/', { username, password });
      if (response.data.code === 200) {
        const { access, user: userData } = response.data.data;
        localStorage.setItem('token', access);
        request.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete request.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 