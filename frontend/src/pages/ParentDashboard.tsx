import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  BookOpen,
  Brain,
  CheckCircle,
  AlertCircle,
  Star,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import GlassCard from "@/components/GlassCard";
import DashboardLayout from "@/components/DashboardLayout";
import { getStats, getStudentProfile, getSummary } from "@/lib/api";

export default function ParentDashboard() {
  const summaryQuery = useQuery({
    queryKey: ["summary"],
    queryFn: getSummary,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const profileQuery = useQuery({
    queryKey: ["student-profile", "demo_user"],
    queryFn: () => getStudentProfile("demo_user"),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const summary = summaryQuery.data;
  const stats = statsQuery.data ?? [];
  const profile = profileQuery.data;

  const weeklyEngagement = stats
    .slice(0, 7)
    .reverse()
    .map((entry, index) => ({
      day: `S${index + 1}`,
      engagement: Math.round(entry.engagement_score ?? 0),
    }));

  const performanceTrend = stats
    .slice(0, 8)
    .reverse()
    .map((entry, index) => ({
      week: `W${index + 1}`,
      score: Math.round(entry.engagement_score ?? 0),
    }));

  const strengths = [
    { subject: "Attention consistency", score: Math.max(Math.round(profile?.avg_score ?? 0), 0) },
    { subject: "Session participation", score: Math.max(Math.round(summary?.avg_engagement_score ?? 0), 0) },
  ].sort((a, b) => b.score - a.score);

  const weaknesses = [
    { subject: "Idle behavior", score: Math.min((summary?.total_idle_events ?? 0) * 10, 100) },
    { subject: "Tab switching", score: Math.min((summary?.total_tab_switches ?? 0) * 10, 100) },
  ].sort((a, b) => b.score - a.score);

  const parentSuggestions = [
    (summary?.total_idle_events ?? 0) > 1
      ? "Repeated idle events suggest breaks or lost focus. Ask about the class timing and environment."
      : "Idle behavior stayed low. The current study setup looks stable.",
    (summary?.total_tab_switches ?? 0) > 0
      ? "Tab switching was detected. Encourage full-screen Meet during class."
      : "No tab switching issues were recorded in the recent session.",
    `Most common observed emotion: ${summary?.most_common_emotion ?? "not enough data yet"}. Use that as a conversation starter after class.`,
    `Current engagement risk is ${profile?.risk_level ?? "unknown"}. Review the trend page regularly for changes.`,
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Engagement</p>
                <p className="text-2xl font-display font-bold text-foreground">{Math.round(summary?.avg_engagement_score ?? 0)}%</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center">
                <Calendar className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frames Logged</p>
                <p className="text-2xl font-display font-bold text-foreground">{summary?.total_frames ?? 0}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-secondary flex items-center justify-center">
                <Star className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <p className="text-2xl font-display font-bold text-foreground capitalize">{profile?.risk_level ?? "unknown"}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Observed Emotion</p>
                <p className="text-xl font-display font-bold text-foreground">{summary?.most_common_emotion ?? "N/A"}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard hover={false}>
            <h3 className="font-display font-semibold text-foreground mb-4">Recent Engagement</h3>
            {weeklyEngagement.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyEngagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="day" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  <Bar dataKey="engagement" fill="hsl(173 80% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No recent engagement data yet.</p>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="font-display font-semibold text-foreground mb-4">Performance Trend</h3>
            {performanceTrend.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="week" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(260 60% 55%)" strokeWidth={2} dot={{ fill: "hsl(260 60% 55%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Trend data will appear after monitored sessions.</p>
            )}
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard hover={false}>
            <h3 className="font-display font-semibold text-foreground mb-4">Strengths</h3>
            <div className="space-y-3 mb-6">
              {strengths.map((item) => (
                <div key={item.subject} className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-foreground">{item.subject}</span>
                  </div>
                  <span className="text-sm font-bold text-success">{item.score}%</span>
                </div>
              ))}
            </div>
            <h3 className="font-display font-semibold text-foreground mb-4">Areas to Watch</h3>
            <div className="space-y-3">
              {weaknesses.map((item) => (
                <div key={item.subject} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-foreground">{item.subject}</span>
                  </div>
                  <span className="text-sm font-bold text-destructive">{item.score}%</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Suggestions for Parents</h3>
            </div>
            <div className="space-y-3">
              {parentSuggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{suggestion}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
