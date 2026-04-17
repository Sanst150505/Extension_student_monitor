import { useEffect, useRef, useState } from "react";
import type { StudentCard } from "@/lib/api";
import { getWebsocketBase } from "@/lib/api";

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

function mergeStudents(current: StudentCard[], incoming: StudentCard) {
  const next = current.filter((student) => student.student_id !== incoming.student_id);
  next.unshift(incoming);
  return next.sort((left, right) => right.attention_score - left.attention_score);
}

export function useTeacherLiveFeed(meetLink: string) {
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const socketRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!meetLink) {
      setStudents([]);
      setConnectionState("idle");
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionState("connecting");
      const url = new URL(`${getWebsocketBase()}/ws/teacher`);
      url.searchParams.set("meet_link", meetLink);

      const socket = new WebSocket(url.toString());
      socketRef.current = socket;

      socket.onopen = () => {
        if (!cancelled) {
          setConnectionState("connected");
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);

          if (message.type === "snapshot" && Array.isArray(message.students)) {
            setStudents(message.students);
          }

          if (message.type === "student_update" && message.student) {
            setStudents((current) => mergeStudents(current, message.student));
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }

        setConnectionState("disconnected");
        retryTimerRef.current = window.setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        if (!cancelled) {
          setConnectionState("error");
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [meetLink]);

  return { students, connectionState };
}