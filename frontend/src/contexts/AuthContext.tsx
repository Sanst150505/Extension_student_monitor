import React, { createContext, useContext, useState, useCallback } from "react";

export type UserRole = "student" | "teacher" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("smartengage_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, _password: string) => {
    // Mock: look up stored users
    const users = JSON.parse(localStorage.getItem("smartengage_users") || "[]");
    const found = users.find((u: User & { password: string }) => u.email === email);
    if (!found) throw new Error("User not found. Please sign up first.");
    const { password: _, ...userData } = found;
    setUser(userData);
    localStorage.setItem("smartengage_user", JSON.stringify(userData));
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, role: UserRole) => {
    const users = JSON.parse(localStorage.getItem("smartengage_users") || "[]");
    if (users.find((u: any) => u.email === email)) throw new Error("Email already exists.");
    const newUser = { id: crypto.randomUUID(), name, email, password, role };
    users.push(newUser);
    localStorage.setItem("smartengage_users", JSON.stringify(users));
    const { password: _, ...userData } = newUser;
    setUser(userData);
    localStorage.setItem("smartengage_user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("smartengage_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
