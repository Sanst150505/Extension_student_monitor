import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Brain, BarChart3, Users, Zap, Target, Shield, ChevronRight,
  Lightbulb, LineChart, BookOpen, Star, ArrowRight
} from "lucide-react";
import GlassCard from "@/components/GlassCard";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const features = [
  { icon: BarChart3, title: "Engagement Tracking", desc: "Real-time monitoring of student focus, participation, and interaction patterns." },
  { icon: Brain, title: "AI Coach", desc: "Personalized suggestions powered by AI to help students stay on track." },
  { icon: LineChart, title: "Smart Reports", desc: "Detailed analytics and insights for teachers, students, and parents." },
];

const steps = [
  { num: "01", title: "Connect", desc: "Students join their virtual classroom and start learning." },
  { num: "02", title: "Monitor", desc: "AI tracks engagement levels, focus patterns, and weak areas." },
  { num: "03", title: "Improve", desc: "Get personalized recommendations and watch performance soar." },
];

const benefits = [
  { icon: BookOpen, role: "Students", items: ["Personalized learning paths", "Real-time focus feedback", "Gamified rewards & streaks"] },
  { icon: Users, role: "Teachers", items: ["Class-wide analytics", "At-risk student alerts", "Topic confusion insights"] },
  { icon: Shield, role: "Parents", items: ["Weekly engagement reports", "Performance trends", "Actionable suggestions"] },
];

const testimonials = [
  { name: "Sarah K.", role: "Teacher", text: "SmartEngage transformed how I understand my students. The at-risk alerts saved two students from falling behind.", avatar: "S" },
  { name: "James L.", role: "Student", text: "The AI coach feels like a personal tutor. My focus score went from 45 to 82 in just three weeks!", avatar: "J" },
  { name: "Maria R.", role: "Parent", text: "Finally, I can see exactly how my child is doing without guessing. The weekly reports are incredibly helpful.", avatar: "M" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">SmartEngage AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link to="/signup" className="text-sm px-5 py-2 rounded-lg gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl animate-pulse-glow" />
        <div className="container mx-auto px-6 relative">
          <motion.div className="text-center max-w-4xl mx-auto" {...fadeUp}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-primary mb-8"
            >
              <Zap className="h-4 w-4" />
              <span>Powered by Advanced AI</span>
            </motion.div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="text-foreground">AI-Powered Learning</span>
              <br />
              <span className="gradient-text">Engagement System</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Track, Improve, and Personalize Learning in Real-Time. Empower students, teachers, and parents with actionable insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold text-lg glow-primary hover:opacity-90 transition-all flex items-center gap-2"
              >
                Get Started <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 rounded-xl glass text-foreground font-semibold text-lg hover:bg-muted/50 transition-all"
              >
                Login
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-foreground mb-4">Powerful Features</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Everything you need to transform online learning engagement.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <GlassCard key={i} className="text-center">
                <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-5">
                  <f.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 bg-muted/20" />
        <div className="container mx-auto px-6 relative">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg">Three simple steps to smarter learning.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <GlassCard key={i}>
                <span className="font-display text-5xl font-bold gradient-text">{s.num}</span>
                <h3 className="font-display text-xl font-semibold text-foreground mt-4 mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-6">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-foreground mb-4">Benefits for Everyone</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((b, i) => (
              <GlassCard key={i}>
                <div className="h-12 w-12 rounded-xl gradient-secondary flex items-center justify-center mb-5">
                  <b.icon className="h-6 w-6 text-secondary-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-4">{b.role}</h3>
                <ul className="space-y-3">
                  {b.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2 text-muted-foreground">
                      <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32 relative">
        <div className="absolute inset-0 bg-muted/20" />
        <div className="container mx-auto px-6 relative">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-foreground mb-4">What People Say</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <GlassCard key={i}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full gradient-accent flex items-center justify-center text-accent-foreground font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">"{t.text}"</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-6">
          <motion.div className="glass rounded-2xl p-12 lg:p-16 text-center glow-primary" {...fadeUp}>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-4">Ready to Transform Learning?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of educators and students already using SmartEngage AI.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl gradient-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              Start Free Today <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          © 2026 SmartEngage AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
