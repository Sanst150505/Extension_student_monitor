// Focus timeline data
export const focusTimelineData = [
  { time: "9:00", focus: 85 },
  { time: "9:30", focus: 78 },
  { time: "10:00", focus: 92 },
  { time: "10:30", focus: 65 },
  { time: "11:00", focus: 70 },
  { time: "11:30", focus: 88 },
  { time: "12:00", focus: 45 },
  { time: "12:30", focus: 30 },
  { time: "13:00", focus: 55 },
  { time: "13:30", focus: 72 },
  { time: "14:00", focus: 80 },
  { time: "14:30", focus: 75 },
];

// Weak areas
export const weakAreas = [
  { subject: "Mathematics", topic: "Calculus", score: 42, trend: "down" as const },
  { subject: "Physics", topic: "Thermodynamics", score: 55, trend: "up" as const },
  { subject: "Chemistry", topic: "Organic Reactions", score: 38, trend: "down" as const },
  { subject: "English", topic: "Essay Writing", score: 61, trend: "up" as const },
];

// AI Coach suggestions
export const aiSuggestions = [
  { id: 1, text: "Take a 5-minute break every 25 minutes to maintain focus.", type: "focus" as const },
  { id: 2, text: "Review Calculus fundamentals — your weak area needs attention.", type: "study" as const },
  { id: 3, text: "Try practice problems in Organic Chemistry before tomorrow's class.", type: "prep" as const },
  { id: 4, text: "Your engagement peaks in the morning. Schedule hard topics before 11 AM.", type: "schedule" as const },
  { id: 5, text: "Great streak! Keep it up for 3 more days to earn the Gold Badge.", type: "motivation" as const },
];

// Calendar engagement data (day of month → engagement level)
export const calendarData: Record<number, number> = {
  1: 85, 2: 72, 3: 90, 4: 0, 5: 0, 6: 78, 7: 65, 8: 88, 9: 92, 10: 70,
  11: 55, 12: 80, 13: 0, 14: 0, 15: 75, 16: 82, 17: 68, 18: 91, 19: 77,
  20: 0, 21: 0, 22: 84, 23: 79, 24: 86, 25: 73, 26: 90, 27: 0, 28: 0,
  29: 88, 30: 76,
};

// Student list for teacher
export const studentList = [
  { id: "1", name: "Alex Johnson", engagement: 92, trend: "up" as const, atRisk: false, attendance: 96 },
  { id: "2", name: "Emma Wilson", engagement: 78, trend: "up" as const, atRisk: false, attendance: 88 },
  { id: "3", name: "Ryan Chen", engagement: 45, trend: "down" as const, atRisk: true, attendance: 72 },
  { id: "4", name: "Sophie Brown", engagement: 85, trend: "up" as const, atRisk: false, attendance: 94 },
  { id: "5", name: "Marcus Davis", engagement: 38, trend: "down" as const, atRisk: true, attendance: 65 },
  { id: "6", name: "Lily Martinez", engagement: 88, trend: "up" as const, atRisk: false, attendance: 91 },
  { id: "7", name: "Noah Taylor", engagement: 52, trend: "down" as const, atRisk: true, attendance: 78 },
  { id: "8", name: "Olivia White", engagement: 95, trend: "up" as const, atRisk: false, attendance: 98 },
];

// Class performance data
export const classPerformanceData = [
  { subject: "Math", avg: 72, high: 95, low: 38 },
  { subject: "Physics", avg: 68, high: 90, low: 42 },
  { subject: "Chemistry", avg: 75, high: 92, low: 50 },
  { subject: "English", avg: 82, high: 98, low: 55 },
  { subject: "History", avg: 78, high: 94, low: 48 },
];

// Topic confusion data
export const topicConfusionData = [
  { topic: "Calculus Derivatives", confusionRate: 68, students: 12 },
  { topic: "Thermodynamics Laws", confusionRate: 55, students: 9 },
  { topic: "Organic Nomenclature", confusionRate: 72, students: 14 },
  { topic: "Shakespeare Analysis", confusionRate: 35, students: 6 },
  { topic: "World War II Causes", confusionRate: 28, students: 5 },
];

// Weekly engagement for parent view
export const weeklyEngagement = [
  { day: "Mon", engagement: 82, hours: 4.5 },
  { day: "Tue", engagement: 75, hours: 3.8 },
  { day: "Wed", engagement: 90, hours: 5.2 },
  { day: "Thu", engagement: 68, hours: 3.2 },
  { day: "Fri", engagement: 85, hours: 4.8 },
  { day: "Sat", engagement: 45, hours: 1.5 },
  { day: "Sun", engagement: 30, hours: 0.8 },
];

// Performance trends for parent
export const performanceTrends = [
  { week: "Week 1", score: 65 },
  { week: "Week 2", score: 70 },
  { week: "Week 3", score: 68 },
  { week: "Week 4", score: 75 },
  { week: "Week 5", score: 78 },
  { week: "Week 6", score: 82 },
  { week: "Week 7", score: 80 },
  { week: "Week 8", score: 85 },
];

// Engagement distribution
export const engagementDistribution = [
  { name: "Highly Engaged", value: 35, color: "hsl(145, 65%, 48%)" },
  { name: "Moderately Engaged", value: 40, color: "hsl(173, 80%, 50%)" },
  { name: "Low Engagement", value: 18, color: "hsl(38, 92%, 55%)" },
  { name: "At Risk", value: 7, color: "hsl(0, 72%, 55%)" },
];

// Notifications
export const notifications = [
  { id: 1, text: "Focus level dropped below 50% during Physics class", type: "warning" as const, time: "2m ago" },
  { id: 2, text: "Great job! 7-day streak achieved 🔥", type: "success" as const, time: "1h ago" },
  { id: 3, text: "New AI Coach suggestion available", type: "info" as const, time: "3h ago" },
  { id: 4, text: "Weekly report ready for download", type: "info" as const, time: "1d ago" },
];
