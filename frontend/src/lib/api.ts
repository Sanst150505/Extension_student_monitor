const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export interface SummaryResponse {
  avg_engagement_score: number;
  most_common_emotion: string;
  total_frames: number;
  total_idle_events: number;
  total_tab_switches: number;
}

export interface StatEntry {
  timestamp: string;
  engagement_score: number;
  attention_score?: number;
  emotion: string;
  status?: string;
  student_id?: string;
  meet_link?: string;
}

export interface StudentHistoryEntry {
  timestamp: string;
  engagement_score: number;
  attention_score?: number;
  emotion: string;
  status?: string;
  face_detected: boolean;
  phone_detected: boolean;
  asleep: boolean;
  gaze_away: boolean;
  yawning: boolean;
  blink_rate?: number;
  head_pose?: string;
  metrics?: Record<string, unknown>;
}

export interface StudentProfileResponse {
  student_id: string;
  total_frames: number;
  avg_score: number;
  risk_level: "low" | "medium" | "high" | "unknown";
  history: StudentHistoryEntry[];
}

export interface HealthResponse {
  status: string;
  mongo: string;
}

export interface StudentJoinRequest {
  student_id?: string;
  name: string;
  subject: string;
  meet_link: string;
}

export interface SessionStartRequest {
  session_id?: string;
  teacher_name: string;
  subject: string;
  batch_time: string;
  meet_link: string;
}

export interface StudentCard {
  student_id: string;
  name: string;
  subject: string;
  meet_link: string;
  streak: number;
  badge: string;
  badges: string[];
  presence: boolean;
  attention_score: number;
  status: string;
  blink_rate: number;
  head_pose: string;
  yawning: boolean;
  last_seen?: string;
}

export interface StudentJoinResponse {
  ok: boolean;
  student: {
    student_id: string;
    name: string;
    subject: string;
    meet_link: string;
    streak?: number;
    badge?: string;
    badges?: string[];
  };
}

export interface SessionStartResponse {
  ok: boolean;
  session: {
    session_id: string;
    teacher_name: string;
    subject: string;
    batch_time: string;
    meet_link: string;
    active: boolean;
  };
}

export interface StudentLogSummary {
  total_focus_time: number;
  distraction_count: number;
  avg_score: number;
}

export interface StudentLogsResponse {
  student_id: string;
  history: StudentHistoryEntry[];
  summary: StudentLogSummary;
}

export function getSummary() {
  return fetchJson<SummaryResponse>("/summary");
}

export function getStats() {
  return fetchJson<StatEntry[]>("/stats");
}

export function getStudentProfile(studentId: string) {
  return fetchJson<StudentProfileResponse>(`/student/${studentId}`);
}

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}

export function joinStudent(payload: StudentJoinRequest) {
  return postJson<StudentJoinResponse>("/join", payload);
}

export function startSession(payload: SessionStartRequest) {
  return postJson<SessionStartResponse>("/start-session", payload);
}

export function getTeacherStudents(meetLink = "") {
  const query = meetLink ? `?meet_link=${encodeURIComponent(meetLink)}` : "";
  return fetchJson<StudentCard[]>(`/teacher/students${query}`);
}

export function getStudentLogs(studentId: string, limit = 120) {
  return fetchJson<StudentLogsResponse>(`/students/${studentId}/logs?limit=${limit}`);
}

export function getWebsocketBase() {
  return WS_BASE;
}
