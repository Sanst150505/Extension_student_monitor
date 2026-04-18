import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Database,
  Eye,
  ShieldAlert,
  Volume2,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DashboardLayout from "@/components/DashboardLayout";
import GlassCard from "@/components/GlassCard";
import { getHealth, getStats, getStudentsOverview, getSummary, type StatsFilters } from "@/lib/api";
import { extractSessionId } from "@/lib/session";
import { useSmoothedNumber } from "@/hooks/useSmoothedNumber";

const POLL_INTERVAL = 2000;

const COLORS = {
  high: "hsl(145 65% 48%)",
  moderate: "hsl(38 92% 55%)",
  low: "hsl(0 72% 55%)",
  info: "hsl(173 80% 50%)",
};

function formatLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function scoreTone(score: number) {
  if (score >= 80) return "text-success bg-success/10";
  if (score >= 60) return "text-warning bg-warning/10";
  return "text-destructive bg-destructive/10";
}

export default function TeacherDashboard() {
  const [filters, setFilters] = useState<StatsFilters>({
    subject: "",
    batch: "",
    session_id: "",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("smartengage_teacher_filters");
      if (stored) {
        setFilters((current) => ({ ...current, ...JSON.parse(stored) }));
      }
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("smartengage_teacher_filters", JSON.stringify(filters));
  }, [filters]);

  const activeFilters: StatsFilters = {
    subject: filters.subject?.trim() || undefined,
    batch: filters.batch?.trim() || undefined,
    session_id: extractSessionId(filters.session_id),
  };

  const summaryQuery = useQuery({
    queryKey: ["summary", activeFilters],
    queryFn: () => getSummary(activeFilters),
    refetchInterval: POLL_INTERVAL,
  });
  const statsQuery = useQuery({
    queryKey: ["stats", activeFilters],
    queryFn: () => getStats(activeFilters),
    refetchInterval: POLL_INTERVAL,
  });
  const studentsQuery = useQuery({
    queryKey: ["students", activeFilters],
    queryFn: () => getStudentsOverview(activeFilters),
    refetchInterval: POLL_INTERVAL,
  });
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: POLL_INTERVAL * 2,
  });

  const summary = summaryQuery.data;
  const stats = statsQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const health = healthQuery.data;

  const smoothedAverage = Math.round(useSmoothedNumber(summary?.avg_engagement_score ?? 0));
  const smoothedFinal = Math.round(useSmoothedNumber(summary?.avg_final_score ?? 0));

  const recentTrend = stats
    .slice(0, 20)
    .reverse()
    .map((entry) => ({
      time: formatLabel(entry.timestamp),
      score: Math.round(entry.engagement_score ?? 0),
    }));

  const distribution = [
    { name: "Focused", value: students.filter((student) => student.engagement_score >= 80).length, color: COLORS.high },
    { name: "Watch", value: students.filter((student) => student.engagement_score >= 60 && student.engagement_score < 80).length, color: COLORS.moderate },
    { name: "Intervene", value: students.filter((student) => student.engagement_score < 60).length, color: COLORS.low },
  ].filter((item) => item.value > 0);

  const loading = summaryQuery.isLoading || studentsQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Live Review</p>
            <h2 className="font-display text-3xl font-bold text-foreground">Continuous Assessment Console</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Real-time classroom engagement, intervention signals, and question performance for the current subject and batch.
            </p>
          </div>

          <div className="grid w-full gap-3 rounded-2xl border border-border bg-card/60 p-4 lg:max-w-3xl lg:grid-cols-3">
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Subject"
              value={filters.subject ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))}
            />
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Batch"
              value={filters.batch ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, batch: event.target.value }))}
            />
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Session ID (optional)"
              value={filters.session_id ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, session_id: event.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
                <p className="text-2xl font-display font-bold text-foreground">{smoothedAverage}%</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent">
                <Brain className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Question Score</p>
                <p className="text-2xl font-display font-bold text-foreground">{Math.round(summary?.avg_question_score ?? 0)}%</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Voice Score</p>
                <p className="text-2xl font-display font-bold text-foreground">{Math.round(summary?.avg_voice_score ?? 0)}%</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Need Attention</p>
                <p className="text-2xl font-display font-bold text-foreground">{summary?.distracted_students ?? 0}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/20">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Final Score</p>
                <p className="text-2xl font-display font-bold text-foreground">{smoothedFinal}%</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <GlassCard hover={false} className="lg:col-span-2">
            <h3 className="mb-4 font-display font-semibold text-foreground">Class Engagement Trend</h3>
            {recentTrend.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={recentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="score" stroke={COLORS.info} strokeWidth={3} dot={{ r: 3, fill: COLORS.info }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No recent engagement logs for the current filters.</p>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="mb-4 font-display font-semibold text-foreground">Engagement Distribution</h3>
            {distribution.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={distribution} dataKey="value" innerRadius={52} outerRadius={84}>
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {distribution.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                      </div>
                      <span className="font-medium text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No student records for the selected scope.</p>
            )}
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Student Monitoring Table</h3>
            </div>
            {students.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Student</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Attention</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Engagement</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Emotion</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Voice</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Question</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.student_id} className="border-b border-border/50">
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.student_id}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{student.attention_status}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{Math.round(student.engagement_score)}%</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{student.emotion}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{Math.round(student.avg_voice_score)}%</td>
                        <td className="px-4 py-3 text-sm text-foreground">{Math.round(student.avg_question_score)}%</td>
                        <td className="px-4 py-3 text-sm text-foreground">{Math.round(student.final_score)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No students found for the current subject and batch.</p>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Classroom Summary</h3>
            </div>
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Current Scope</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {(activeFilters.subject ?? "All Subjects")} · {(activeFilters.batch ?? "All Batches")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeFilters.session_id ? `Session ${activeFilters.session_id}` : "All active sessions"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">System Health</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{health?.mongo ?? "--"}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Idle + Tab Switch Events</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {(summary?.total_idle_events ?? 0) + (summary?.total_tab_switches ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Stored Engagement Logs</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{summary?.total_logs ?? 0}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false}>
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">At-Risk Students</h3>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading classroom analytics...</p>
          ) : students.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {students
                .filter((student) => student.attention_status !== "Focused" || student.avg_question_score < 60)
                .map((student) => (
                  <div key={student.student_id} className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.attention_status}</p>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-xs font-medium ${scoreTone(student.final_score)}`}>
                        {Math.round(student.final_score)}%
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Engagement</span>
                        <span className="text-foreground">{Math.round(student.engagement_score)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Voice</span>
                        <span className="text-foreground">{Math.round(student.avg_voice_score)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Question Score</span>
                        <span className="text-foreground">{Math.round(student.avg_question_score)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Emotion</span>
                        <span className="text-foreground">{student.emotion}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Trend</span>
                        <div className="flex items-center gap-1">
                          <TrendIcon trend={student.trend} />
                          <span className="capitalize text-foreground">{student.trend}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data to review yet.</p>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
