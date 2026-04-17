import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, LogOut, User, Bell, Brain, Users,
  BookOpen, BarChart3, Calendar, Trophy, Settings, Menu, X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = {
  student: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/student" },
    { label: "Focus Timeline", icon: BarChart3, path: "/student/details" },
    { label: "AI Coach", icon: Brain, path: "/student" },
    { label: "Calendar", icon: Calendar, path: "/student" },
    { label: "Rewards", icon: Trophy, path: "/student" },
    { label: "Profile", icon: User, path: "/student/details" },
  ],
  teacher: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/teacher" },
    { label: "Students", icon: Users, path: "/teacher" },
    { label: "Analytics", icon: BarChart3, path: "/teacher" },
    { label: "Attendance", icon: Calendar, path: "/teacher" },
    { label: "Settings", icon: Settings, path: "/teacher" },
  ],
  parent: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/parent" },
    { label: "Reports", icon: BarChart3, path: "/parent" },
    { label: "Attendance", icon: Calendar, path: "/parent" },
    { label: "Settings", icon: Settings, path: "/parent" },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const items = navItems[user.role];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 glass border-r border-border flex flex-col transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">SmartEngage</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 glass border-b border-border flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="font-display font-semibold text-lg text-foreground capitalize">
            {user.role} Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
