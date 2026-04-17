export function extractSessionId(value: string | undefined | null): string | undefined {
  const raw = (value || "").trim();
  if (!raw) return undefined;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || undefined;
    } catch {
      return raw;
    }
  }

  return raw;
}
