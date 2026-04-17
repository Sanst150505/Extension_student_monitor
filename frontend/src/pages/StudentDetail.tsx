import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Activity, Clock3, Eye, Wind } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import DashboardLayout from "@/components/DashboardLayout";
import { getStudentLogs, type StudentHistoryEntry } from "@/lib/api";

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StudentDetailPage() {
  const { studentId: routeStudentId = "" } = useParams();
  const [searchParams] = useSearchParams();

  const studentId = useMemo(() => {
    const fromQuery = searchParams.get("studentId");
    if (routeStudentId) {
      return routeStudentId;
    }

    if (fromQuery) {
      return fromQuery;
    }

    const stored = localStorage.getItem("smartengage_student_session");
    if (!stored) {
      return "demo_user";
    }

    try {
      const parsed = JSON.parse(stored) as { student_id?: string };
      return parsed.student_id || "demo_user";
    } catch {
      return "demo_user";
    }
  }, [routeStudentId, searchParams]);

  const query = useQuery({
    queryKey: ["student-logs", studentId],
    queryFn: () => getStudentLogs(studentId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    enabled: Boolean(studentId),
  });

  const history = query.data?.history ?? [];
  const summary = query.data?.summary;

  const chartData = history.map((entry) => ({
    time: formatTime(entry.timestamp),
    score: Math.round(entry.attention_score ?? entry.engagement_score ?? 0),
  }));

  const latest = history[history.length - 1];

  const metricCards = [
    { label: "Blink rate", value: `${latest?.blink_rate ?? 0} bpm`, icon: Eye },
    {
      label: "Head pose",
      value: String(latest?.head_pose ?? ((latest?.metrics as Record<string, string> | undefined)?.head_pose ?? "Forward")),
      icon: Activity,
    },
    { label: "Yawning", value: latest?.yawning ? "Yes" : "No", icon: Wind },
    { label: "Session summary", value: `${summary?.distraction_count ?? 0} distractions`, icon: Clock3 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">Student Detail</p>
          <h2 className="font-display text-3xl font-bold text-foreground">Realtime attention timeline</h2>
          <p className="text-sm text-muted-foreground">Student ID: {studentId}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {metricCards.map((item) => (
            <GlassCard key={item.label} hover={false}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-semibold text-foreground">{item.value}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard hover={false} className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Attention Score</h3>
            </div>
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(222 40% 10%)",
                      border: "1px solid hsl(222 20% 18%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="hsl(173 80% 50%)" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No logs yet. Join the session with the extension active to start collecting data.</p>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <h3 className="font-display font-semibold text-foreground mb-4">Session Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Total focus time</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{summary?.total_focus_time ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Distraction count</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{summary?.distraction_count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-muted-foreground">Average attention</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{Math.round(summary?.avg_score ?? 0)}%</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false}>
          <h3 className="font-display font-semibold text-foreground mb-4">Recent Samples</h3>
          {history.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Blink</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Head Pose</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(-10).reverse().map((entry: StudentHistoryEntry) => (
                    <tr key={entry.timestamp} className="border-b border-border/50">
                      <td className="px-4 py-3 text-sm text-foreground">{new Date(entry.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{Math.round(entry.attention_score ?? entry.engagement_score ?? 0)}%</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.status || entry.emotion || "Unknown"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.blink_rate ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.head_pose || "Forward"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No samples available yet.</p>
          )}
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}