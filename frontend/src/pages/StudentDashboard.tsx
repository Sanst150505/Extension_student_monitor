import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, BookOpen, Flame, Sparkles, UserCircle2 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import DashboardLayout from "@/components/DashboardLayout";
import { joinStudent, type StudentJoinResponse } from "@/lib/api";

const STORAGE_KEY = "smartengage_student_session";

export default function StudentDashboard() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [student, setStudent] = useState<StudentJoinResponse["student"] | null>(null);
  const [message, setMessage] = useState("Save your session details to start streaming attention data.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as StudentJoinResponse["student"];
    setStudent(parsed);
    setName(parsed.name || "");
    setSubject(parsed.subject || "");
    setMeetLink(parsed.meet_link || "");
  }, []);

  const summaryCards = useMemo(() => {
    const streak = student?.streak ?? 0;
    const badge = student?.badge || "No badge yet";

    return [
      { label: "Student", value: student?.name || "Not joined" },
      { label: "Subject", value: student?.subject || "General" },
      { label: "Streak", value: `${streak} min` },
      { label: "Badge", value: badge },
    ];
  }, [student]);

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("Joining session...");

    try {
      const response = await joinStudent({
        student_id: student?.student_id,
        name,
        subject,
        meet_link: meetLink,
      });

      setStudent(response.student);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.student));
      setMessage(`Joined ${response.student.subject} session.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to join session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                <UserCircle2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-xl font-bold text-foreground">{student?.name || "Guest"}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="text-xl font-bold text-foreground">{student?.subject || "General"}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Flame className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-xl font-bold text-foreground">{student?.streak ?? 0} min</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard hover={false}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <BadgeCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Badge</p>
                <p className="text-xl font-bold text-foreground">{student?.badge || "None"}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard hover={false}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Student Login</p>
              <h2 className="font-display text-2xl font-bold text-foreground">Join your classroom session</h2>
              <p className="text-sm text-muted-foreground">Save your details once so the extension can stream the right Meet session.</p>
            </div>
            <div className="rounded-full border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
              {message}
            </div>
          </div>

          <form onSubmit={handleJoin} className="mt-6 grid gap-4 lg:grid-cols-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              className="w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
            />
            <div className="lg:col-span-2 flex gap-3">
              <input
                value={meetLink}
                onChange={(event) => setMeetLink(event.target.value)}
                placeholder="Google Meet link"
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground outline-none transition focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !name.trim() || !subject.trim() || !meetLink.trim()}
                className="rounded-xl gradient-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Saving" : "Join"}
              </button>
            </div>
          </form>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {summaryCards.map((item) => (
            <GlassCard key={item.label} hover={false}>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{item.value}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard hover={false}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Open your detailed timeline</h3>
              <p className="text-sm text-muted-foreground">The detail page shows live logs, the attention graph, and the session summary.</p>
            </div>
            <Link
              to={student?.student_id ? `/student/details?studentId=${student.student_id}` : "/student/details"}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary"
            >
              <Sparkles className="h-4 w-4" />
              View detail
            </Link>
          </div>
        </GlassCard>
      </div>
    </DashboardLayout>
  );
}