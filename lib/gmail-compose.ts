/** Opens Gmail compose in the browser (signed-in account). */
export function gmailComposeUrl(
  to: string,
  options?: { subject?: string; body?: string }
): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  params.set("to", to.trim());
  if (options?.subject) params.set("su", options.subject);
  if (options?.body) params.set("body", options.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
