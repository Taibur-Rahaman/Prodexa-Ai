const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Normalize a merchant site host for license binding.
 * Staging hosts are not auto-allowed; they must be activated explicitly.
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 253) {
    return null;
  }

  let host: string;
  if (trimmed.includes("://")) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      return null;
    }
  } else {
    const withoutPath = trimmed.split("/")[0] ?? "";
    const withoutQuery = withoutPath.split("?")[0] ?? "";
    const withoutUser = withoutQuery.includes("@")
      ? (withoutQuery.split("@").pop() ?? "")
      : withoutQuery;
    host = withoutUser;
    if (host.startsWith("[")) {
      return null;
    }
    if (host.includes(":")) {
      host = host.slice(0, host.indexOf(":"));
    }
  }

  host = host.replace(/\.$/, "");
  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  if (host === "localhost") {
    return host;
  }

  if (!DOMAIN_PATTERN.test(host) || host.includes("..")) {
    return null;
  }

  return host;
}
