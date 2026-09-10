// Blocks creation of directus_users accounts (including Google SSO auto-provisioning)
// whose email is not in ALLOWED_EMAIL_DOMAINS. Google's own "Internal" org restriction
// can't be used here because the company's real accounts are Microsoft 365, not a
// Google Workspace/Cloud Identity org, so the domain check has to happen here instead.
export default ({ filter }, { env, logger }) => {
  const allowedDomains = String(env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  const allowedEmails = String(env.ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedDomains.length && !allowedEmails.length) {
    logger.warn("restrict-email-domain: no ALLOWED_EMAIL_DOMAINS or ALLOWED_EMAILS set, no restriction is active.");
    return;
  }

  filter("users.create", (payload) => {
    const email = String(payload.email || "").toLowerCase();
    const domain = email.split("@")[1] || "";

    if (allowedDomains.includes(domain) || allowedEmails.includes(email)) {
      return payload;
    }

    logger.warn(`restrict-email-domain: blocked account creation for ${email}`);
    throw new Error(`Sign-in is restricted to approved accounts (${[...allowedDomains, ...allowedEmails].join(", ")}).`);
  });
};
