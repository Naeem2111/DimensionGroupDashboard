/** Opens the user's default mail app (Outlook, Apple Mail, Thunderbird, etc.) via mailto. */
export function mailComposeUrl(
  to: string,
  options?: { subject?: string; body?: string }
): string {
  const params = new URLSearchParams();
  if (options?.subject) params.set("subject", options.subject);
  if (options?.body) params.set("body", options.body);
  const qs = params.toString();
  return `mailto:${to.trim()}${qs ? `?${qs}` : ""}`;
}

/** @deprecated Use mailComposeUrl — opens default mailbox, not Gmail web. */
export function gmailComposeUrl(
  to: string,
  options?: { subject?: string; body?: string }
): string {
  return mailComposeUrl(to, options);
}
