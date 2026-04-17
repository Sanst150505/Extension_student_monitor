const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export interface StatsFilters {
  subject?: string;
  batch?: string;
  session_id?: string;
}

function buildQuery(filters?: StatsFilters) {
  const params = new URLSearchParams();
  if (filters?.subject) params.set("subject", filters.subject);
  if (filters?.batch) params.set("batch", filters.batch);
  if (filters?.session_id) params.set("session_id", filters.session_id);
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function fetchJson<T>(path: string, filters?: StatsFilters): Promise<T> {
  const response = await fetch(`${API_BASE}${path}${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export interface SummaryResponse {
  avg_engagement_score: number;
  avg_question_score: number;
  avg_final_score: number;
  most_common_emotion: string;
  total_logs: number;
  total_idle_events: number;
  total_tab_switches: number;
  total_students: number;
  distracted_students: number;
}

export interface StatEntry {
  timestamp: string;
  student_id?: string;
  student_name?: string;
  subject?: string;
  batch?: string;
  session_id?: string;
  engagement_score: number;
  emotion: string;
  attention_status?: string;
  head_direction?: string;
  phone_detected?: boolean;
}

export interface StudentHistoryEntry {
  timestamp: string;
  engagement_score: number;
  emotion: string;
  attention_status?: string;
  head_direction?: string;
  phone_detected: boolean;
  eyes_closed?: boolean;
  closed_frames?: number;
  gaze_away: boolean;
  yawning: boolean;
}

export interface StudentAssessmentEntry {
  timestamp: string;
  question_id?: string;
  score: number;
  correct: boolean;
  response_time: number;
}

export interface StudentProfileResponse {
  student_id: string;
  total_logs: number;
  avg_score: number;
  risk_level: "low" | "medium" | "high" | "unknown";
  current_state: string;
  emotion: string;
  trend: "up" | "down" | "stable";
  history: StudentHistoryEntry[];
  assessments: StudentAssessmentEntry[];
  avg_question_score: number;
  question_attempts: number;
  avg_response_time: number;
  final_score: number;
}

export interface StudentOverview {
  student_id: string;
  name: string;
  engagement_score: number;
  avg_engagement_score: number;
  attention_status: string;
  emotion: string;
  head_direction: string;
  phone_detected: boolean;
  trend: "up" | "down" | "stable";
  score_band: "high" | "moderate" | "low";
  dominant_emotion: string;
  avg_question_score: number;
  question_attempts: number;
  correct_answers: number;
  avg_response_time: number;
  final_score: number;
}

export interface HealthResponse {
  status: string;
  mongo: string;
}

export function getSummary(filters?: StatsFilters) {
  return fetchJson<SummaryResponse>("/summary", filters);
}

export function getStats(filters?: StatsFilters) {
  return fetchJson<StatEntry[]>("/stats", filters);
}

export function getStudentProfile(studentId: string, filters?: StatsFilters) {
  return fetchJson<StudentProfileResponse>(`/student/${studentId}`, filters);
}

export function getStudentsOverview(filters?: StatsFilters) {
  return fetchJson<StudentOverview[]>("/students", filters);
}

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}
