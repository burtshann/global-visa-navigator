const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isPolicyDatabaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") || !url.hostname ||
    !url.username || url.pathname.length < 2 || url.searchParams.has("host") ||
    url.searchParams.has("hostaddr")
  ) {
    return false;
  }

  if (loopbackHosts.has(url.hostname)) return true;

  const modes = url.searchParams.getAll("sslmode");
  return modes.length === 1 && modes[0] === "verify-full" && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";
}
