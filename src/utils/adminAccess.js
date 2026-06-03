/**
 * Validates if the given user or session has admin access.
 * Server-side check.
 * @param {Object} userOrSession - The user object or session object containing user details.
 * @returns {boolean} true if user is admin, false otherwise.
 */
export function isAdmin(userOrSession) {
  if (!userOrSession) return false;
  
  // Extract user depending on if it's a full session or just a user object
  const user = userOrSession.user || userOrSession;
  if (!user || !user.email) return false;

  const email = user.email.toLowerCase();

  // Primary owner email rule - from environment or fallback
  const ownerEmail = (typeof process !== "undefined" && process.env && process.env.OWNER_EMAIL) 
    ? process.env.OWNER_EMAIL 
    : "m.dharaaneesh123@gmail.com";
    
  if (ownerEmail && email === ownerEmail.toLowerCase()) {
    return true;
  }

  // Check additional admins via environment variables
  // Format: ADMIN_EMAILS="admin1@example.com,admin2@example.com"
  if (typeof process !== "undefined" && process.env && process.env.ADMIN_EMAILS) {
    const adminEmails = process.env.ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase());
    if (adminEmails.includes(email)) {
      return true;
    }
  }

  // If user object contains role flags (e.g. injected into session)
  if (user.platformRole === "owner" || user.isPlatformAdmin === true) {
    return true;
  }

  return false;
}
