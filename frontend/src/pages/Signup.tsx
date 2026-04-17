import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, User, Mail, Lock, GraduationCap, BookOpen, Users } from "lucide-react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

const roles: { value: UserRole; label: string; icon: React.ElementType }[] = [
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "teacher", label: "Teacher", icon: BookOpen },
  { value: "parent", label: "Parent", icon: Users },
];

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password, role);
      navigate(`/${role}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Brain className="h-8 w-8 text-primary" />
            <span className="font-display font-bold text-xl text-foreground">SmartEngage AI</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join the future of learning</p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selection */}
          <div className="grid grid-cols-3 gap-3">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  role === r.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <r.icon className="h-5 w-5 mx-auto mb-1" />
                <span className="text-xs font-medium">{r.label}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Login</Link>
        </p>
      </motion.div>
    </div>
  );
}
