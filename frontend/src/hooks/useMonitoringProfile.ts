import { useEffect, useState } from "react";

export interface MonitoringProfile {
  student_id: string;
  student_name: string;
  subject: string;
  batch: string;
  session_id: string;
}

const STORAGE_KEY = "smartengage_monitoring_profile";

export function useMonitoringProfile(defaults: MonitoringProfile) {
  const [profile, setProfile] = useState<MonitoringProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaults;
      return { ...defaults, ...JSON.parse(stored) };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    setProfile((current) => ({ ...defaults, ...current }));
  }, [defaults.student_id, defaults.student_name, defaults.subject, defaults.batch, defaults.session_id]);

  return { profile, setProfile };
}
