import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Brain,
  Flame,
  Trophy,
  Target,
  AlertTriangle,
  Bell,
  BookOpen,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Link2,
  Mic,
  Award,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import GlassCard from "@/components/GlassCard";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMonitoringProfile } from "@/hooks/useMonitoringProfile";
import { useVoiceAnalysis } from "@/hooks/useVoiceAnalysis";
import { getStats, getStudentProfile, getSummary, postVoiceEvent } from "@/lib/api";
import { extractSessionId } from "@/lib/session";
import { useSmoothedNumber } from "@/hooks/useSmoothedNumber";

const POLL_INTERVAL = 2000;

const EngagementRing = ({ score }: { score: number }) => {
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "hsl(145 65% 48%)" : score >= 60 ? "hsl(38 92% 55%)" : "hsl(0 72% 55%)";

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" stroke="hsl(222 20% 18%)" strokeWidth="10" fill="none" />
        <motion.circle
          cx="70"
          cy="70"
          r="60"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { profile, setProfile } = useMonitoringProfile({
    student_id: user?.id || "demo_user",
    student_name: user?.name || "Student",
    subject: "General",
    batch: "General",
    session_id: "",
  });

  const filters = useMemo(
    () => ({
      subject: profile.subject.trim() || undefined,
      batch: profile.batch.trim() || undefined,
      session_id: extractSessionId(profile.session_id),
    }),
    [profile.subject, profile.batch, profile.session_id],
  );

  const summaryQuery = useQuery({
    queryKey: ["summary", filters],
    queryFn: () => getSummary(filters),
    refetchInterval: POLL_INTERVAL,
  });
  const statsQuery = useQuery({
    queryKey: ["stats", filters],
    queryFn: () => getStats(filters),
    refetchInterval: POLL_INTERVAL,
  });
  const profileQuery = useQuery({
    queryKey: ["student-profile", profile.student_id, filters],
    queryFn: () => getStudentProfile(profile.student_id, filters),
    refetchInterval: POLL_INTERVAL,
    enabled: Boolean(profile.student_id),
  });

  const summary = summaryQuery.data;
  const stats = (statsQuery.data ?? []).filter((entry) => (entry.student_id ?? "") === profile.student_id);
  const student = profileQuery.data;
  const voice = useVoiceAnalysis();
  const lastSubmittedRef = useRef("");
  const [savedVoiceScore, setSavedVoiceScore] = useState<number | null>(null);

  const voiceMutation = useMutation({
    mutationFn: postVoiceEvent,
    onSuccess: (data) => {
      setSavedVoiceScore(data.voice_score ?? null);
      queryClient.invalidateQueries({ queryKey: ["student-profile", profile.student_id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  useEffect(() => {
    if (voice.isListening || voice.status !== "stopped") return;
    if (!voice.transcript && voice.speakingDuration < 1) return;

    const key = `${voice.transcript}|${voice.speakingDuration.toFixed(1)}|${voice.voiceScore}`;
    if (lastSubmittedRef.current === key) return;
    lastSubmittedRef.current = key;

    voiceMutation.mutate({
      student_id: profile.student_id,
      student_name: profile.student_name,
      subject: profile.subject || "General",
      batch: profile.batch || "General",
      session_id: extractSessionId(profile.session_id) || "demo_session",
      transcript: voice.transcript,
      speaking_duration: Number(voice.speakingDuration.toFixed(1)),
      avg_volume: Number(voice.avgVolume.toFixed(3)),
      peak_volume: Number(voice.peakVolume.toFixed(3)),
      confidence: Number(voice.confidence.toFixed(2)),
      status: voice.status,
    });
  }, [profile.batch, profile.session_id, profile.student_id, profile.student_name, profile.subject, voice.avgVolume, voice.confidence, voice.isListening, voice.peakVolume, voice.speakingDuration, voice.status, voice.transcript, voice.voiceScore, voiceMutation]);

  const rawScore = Math.round(student?.history[0]?.engagement_score ?? student?.avg_score ?? summary?.avg_engagement_score ?? 0);
  const smoothScore = Math.round(useSmoothedNumber(rawScore));
  const currentState = student?.current_state || "No Data";
  const currentEmotion = student?.emotion || "No Data";
  const currentTrend = student?.trend || "stable";
  const voiceScore = Math.round(savedVoiceScore ?? student?.avg_voice_score ?? 0);
  const attentionStreak = student?.history.reduce((streak, item) => {
    if (item.attention_status === "Focused") return streak + 1;
    return streak;
  }, 0) ?? 0;
  const badges = [
    {
      title: "Focus Streak",
      unlocked: attentionStreak >= 3,
      detail: `${attentionStreak} focused snapshots in a row`,
      image: "/badge-focus-streak.svg",
      tint: "from-emerald-400/20 to-cyan-400/10",
    },
    {
      title: "Quiz Clutch",
      unlocked: (student?.avg_question_score ?? 0) >= 80 && (student?.question_attempts ?? 0) > 0,
      detail: `${Math.round(student?.avg_question_score ?? 0)}% question score`,
      image: "/badge-quiz-clutch.svg",
      tint: "from-amber-400/20 to-orange-400/10",
    },
    {
      title: "Voice Spark",
      unlocked: voiceScore >= 60 && (student?.voice_samples ?? 0) > 0,
      detail: `${voiceScore}% voice participation`,
      image: "/badge-voice-spark.svg",
      tint: "from-fuchsia-400/20 to-violet-400/10",
    },
  ];
  const rewardPoints =
    Math.round(smoothScore * 0.4) +
    Math.round((student?.avg_question_score ?? 0) * 0.4) +
    Math.round(voiceScore * 0.2);

  const recentTrend = stats
    .slice(0, 10)
    .reverse()
    .map((entry) => ({
      time: new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      focus: Math.round(entry.engagement_score ?? 0),
    }));

  const alertData = [
    { signal: "Phone usage", value: student?.history.filter((item) => item.phone_detected).length ?? 0 },
    { signal: "Looking away", value: student?.history.filter((item) => item.gaze_away).length ?? 0 },
    { signal: "Yawning", value: student?.history.filter((item) => item.yawning).length ?? 0 },
    { signal: "No face", value: student?.history.filter((item) => item.emotion === "No Face").length ?? 0 },
  ];

  const suggestions = [
    currentState === "Distracted" || currentState === "Slightly Distracted"
      ? "Attention is drifting. Keep the Meet window active and centered."
      : "Attention is stable right now.",
    currentState === "Sleeping"
      ? "The system is seeing prolonged eye-closure patterns. Take a short reset before the next segment."
      : "No strong sleepy signal is visible.",
    `Emotion is currently ${currentEmotion}.`,
    `Voice participation score is ${voiceScore}%.`,
    `Final score blends engagement and intervention answers: ${Math.round(student?.final_score ?? 0)}%.`,
  ];

  const notifications = [
    { text: `Current attention state: ${currentState === "No Face" ? "No Face Detected" : currentState}.`, type: currentState === "Focused" ? "success" : "warning" },
    { text: `Emotion label: ${currentEmotion}.`, type: "info" },
    { text: `Question score: ${Math.round(student?.avg_question_score ?? 0)}% across ${student?.question_attempts ?? 0} attempts.`, type: "info" },
    { text: `Voice score: ${voiceScore}% across ${student?.voice_samples ?? 0} mic samples.`, type: "info" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <GlassCard hover={false}>
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Realtime Monitoring Link</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Student ID"
              value={profile.student_id}
              onChange={(event) => setProfile((current) => ({ ...current, student_id: event.target.value }))}
            />
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Subject"
              value={profile.subject}
              onChange={(event) => setProfile((current) => ({ ...current, subject: event.target.value }))}
            />
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Batch"
              value={profile.batch}
              onChange={(event) => setProfile((current) => ({ ...current, batch: event.target.value }))}
            />
            <input
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Session ID (optional)"
              value={profile.session_id}
              onChange={(event) => setProfile((current) => ({ ...current, session_id: event.target.value }))}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the same values here that you saved in the Chrome extension popup. The last field accepts either the Meet link or just the Meet code.
          </p>
        </GlassCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <Target className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Engagement Score</p>
                <p className="text-2xl font-display font-bold text-foreground">{smoothScore}%</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent">
                <Flame className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current State</p>
                <p className="text-2xl font-display font-bold text-foreground">{currentState}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-secondary">
                <BookOpen className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emotion</p>
                <p className="text-2xl font-display font-bold text-foreground">{currentEmotion}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                <Trophy className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <div className="flex items-center gap-2">
                  <TrendIcon trend={currentTrend} />
                  <p className="text-xl font-display font-bold capitalize text-foreground">{currentTrend}</p>
                </div>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Voice Score</p>
                <p className="text-2xl font-display font-bold text-foreground">{voiceScore}%</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Attention Streak</h3>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current streak</p>
                  <p className="text-4xl font-display font-bold text-foreground">{attentionStreak}</p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {attentionStreak >= 5 ? "On fire" : attentionStreak >= 3 ? "Building momentum" : "Keep going"}
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, attentionStreak * 20)}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Stay focused, answer the intervention questions, and keep your streak alive.
              </p>
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Badges & Rewards</h3>
            </div>
            <div className="space-y-3">
              {badges.map((badge) => (
                <div key={badge.title} className={`flex items-center justify-between rounded-xl border border-border bg-gradient-to-r ${badge.tint} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className={`overflow-hidden rounded-xl border border-white/10 bg-background/70 p-1 ${badge.unlocked ? "" : "grayscale opacity-60"}`}>
                      <img src={badge.image} alt={badge.title} className="h-16 w-16 object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{badge.title}</p>
                      <p className="text-xs text-muted-foreground">{badge.detail}</p>
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {badge.unlocked ? "Unlocked" : "Locked"}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Reward Points</p>
                <p className="mt-1 text-2xl font-display font-bold text-foreground">{rewardPoints}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <GlassCard hover={false}>
            <h3 className="mb-4 font-display font-semibold text-foreground">Focus Score</h3>
            <EngagementRing score={smoothScore} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {currentState === "Focused"
                ? "Attention is stable and engaged."
                : currentState === "Slightly Distracted" || currentState === "Distracted"
                  ? "Distraction is being detected."
                  : currentState === "Sleeping"
                    ? "Sleepy cues are being detected."
                    : "No face detected in recent frames."}
            </p>
          </GlassCard>

          <GlassCard hover={false} className="lg:col-span-2">
            <h3 className="mb-4 font-display font-semibold text-foreground">Recent Focus Timeline</h3>
            {recentTrend.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={recentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="focus" stroke="hsl(173 80% 50%)" strokeWidth={2} dot={{ fill: "hsl(173 80% 50%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet for this student/profile match.</p>
            )}
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard hover={false}>
            <h3 className="mb-4 font-display font-semibold text-foreground">Distraction Signals</h3>
            {alertData.some((entry) => entry.value > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={alertData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 18%)" />
                  <XAxis dataKey="signal" stroke="hsl(215 20% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(222 40% 10%)", border: "1px solid hsl(222 20% 18%)", borderRadius: "8px" }} />
                  <Bar dataKey="value" fill="hsl(38 92% 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No distraction events logged yet.</p>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Voice Analysis</h3>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={voice.isListening ? voice.stopListening : voice.startListening}
                  disabled={!voice.isSupported}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {voice.isListening ? "Stop Voice Capture" : "Start Voice Capture"}
                </button>
                <span className="text-sm text-muted-foreground">
                  {voice.isSupported ? "Browser mic analysis is ready." : "Chrome microphone + speech recognition is required."}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Live voice energy</span>
                  <span className="font-medium text-foreground">{Math.round(voice.avgVolume * 100)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round(voice.avgVolume * 100))}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                  <span>Status: <span className="text-foreground">{voice.status}</span></span>
                  <span>Duration: <span className="text-foreground">{voice.speakingDuration.toFixed(1)}s</span></span>
                  <span>Confidence: <span className="text-foreground">{Math.round(voice.confidence * 100)}%</span></span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="mb-2 text-sm text-muted-foreground">Transcript</p>
                <p className="min-h-16 text-sm text-foreground">{voice.transcript || student?.latest_transcript || "Start speaking to capture a transcript."}</p>
              </div>
              {voice.error ? <p className="text-sm text-destructive">{voice.error}</p> : null}
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-foreground">AI Coach Suggestions</h3>
            </div>
            <div className="space-y-3">
              {suggestions.map((text, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false}>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Recent Notifications</h3>
          </div>
          <div className="space-y-2">
            {notifications.map((item, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                {item.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
                ) : (
                  <Zap className="h-4 w-4 flex-shrink-0 text-success" />
                )}
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}
