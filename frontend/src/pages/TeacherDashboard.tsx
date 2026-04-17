import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Link as LinkIcon, PlayCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import DashboardLayout from "@/components/DashboardLayout";
import { joinStudent, startSession } from "@/lib/api";
import { useTeacherLiveFeed } from "@/hooks/useTeacherLiveFeed";

function scoreTone(score: number) {
  if (score > 75) {
    return "text-success bg-success/10 border-success/20";
  }

  if (score >= 50) {
    return "text-warning bg-warning/10 border-warning/20";
  }

  return "text-destructive bg-destructive/10 border-destructive/20";
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState("Professor");
  const [subject, setSubject] = useState("General");
  const [batchTime, setBatchTime] = useState("09:00 AM");
  const [meetLink, setMeetLink] = useState("");
  const [statusMessage, setStatusMessage] = useState("Start a session to connect the live websocket stream.");
  const [saving, setSaving] = useState(false);

  const liveFeed = useTeacherLiveFeed(meetLink.trim());
  const students = liveFeed.students;

  const stats = useMemo(() => {
    const total = students.length;
    const focused = students.filter((student) => student.attention_score > 75).length;
    const distracted = students.filter((student) => student.attention_score <= 75).length;
    const present = students.filter((student) => student.presence).length;

    return { total, focused, distracted, present };
  }, [students]);

  const handleStartSession = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("Starting session...");

    try {
      const response = await startSession({
        teacher_name: teacherName,
        subject,
        batch_time: batchTime,
        meet_link: meetLink.trim(),
      });

      setStatusMessage(`Session active: ${response.session.session_id}`);
      localStorage.setItem(
        "smartengage_teacher_session",
        JSON.stringify({
          teacher_name: teacherName,
          subject,
          batch_time: batchTime,
          meet_link: meetLink.trim(),
          session_id: response.session.session_id,
        })
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to start session.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickJoin = async (studentId: string) => {
    const student = students.find((item) => item.student_id === studentId);
    if (!student) {
      return;
    }

    await joinStudent({
      student_id: student.student_id,
      name: student.name,
      subject: student.subject,
      meet_link: student.meet_link,
    });

    navigate(`/teacher/student/${student.student_id}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Live Students</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Focused</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.focused}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.distracted}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/20 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connection</p>
                <p className="text-sm font-semibold text-foreground capitalize">{liveFeed.connectionState}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Session Control</p>
              <h2 className="font-display text-2xl font-bold text-foreground">Start a live class session</h2>
              <p className="text-sm text-muted-foreground">Teacher and extension traffic stays scoped to the same Meet link.</p>
            </div>
            <div className="rounded-full border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          </div>

          <form onSubmit={handleStartSession} className="mt-6 grid gap-4 lg:grid-cols-4">
            <input
              value={teacherName}
              onChange={(event) => setTeacherName(event.target.value)}
              placeholder="Teacher name"
              className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
            />
            <input
              value={batchTime}
              onChange={(event) => setBatchTime(event.target.value)}
              placeholder="Batch time"
              className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
            />
            <div className="flex gap-3">
              <input
                value={meetLink}
                onChange={(event) => setMeetLink(event.target.value)}
                placeholder="Google Meet link"
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
              />
              <button
                type="submit"
                disabled={saving || !meetLink.trim()}
                className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                {saving ? "Starting" : "Start"}
              </button>
            </div>
          </form>
        </GlassCard>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Live Grid</p>
            <h3 className="font-display text-2xl font-bold text-foreground">Students for the current Meet link</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
            <LinkIcon className="h-4 w-4" />
            {meetLink.trim() || "No meet link selected"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {students.map((student) => (
            <GlassCard key={student.student_id} hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.subject}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${scoreTone(student.attention_score)}`}>
                  {student.status}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Score</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{Math.round(student.attention_score)}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Presence</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{student.presence ? "Here" : "Away"}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Streak</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{student.streak}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>{student.badge || "No badge yet"}</span>
                <button
                  type="button"
                  onClick={() => handleQuickJoin(student.student_id)}
                  className="text-primary hover:underline"
                >
                  Open detail
                </button>
              </div>
            </GlassCard>
          ))}
        </div>

        {!students.length ? (
          <GlassCard hover={false}>
            <p className="text-sm text-muted-foreground">
              No students are connected for this Meet link yet. Start the session and make sure the extension popup has the same link saved.
            </p>
          </GlassCard>
        ) : null}
      </div>
    </DashboardLayout>
  );
}