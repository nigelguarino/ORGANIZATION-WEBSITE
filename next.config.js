const csp = [
  "default-src 'self'", "img-src 'self' data: blob: https://*.supabase.co", "media-src 'self' blob: https://*.supabase.co",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co", "frame-src https://challenges.cloudflare.com", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "upgrade-insecure-requests",
].join("; ");
module.exports = {
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }];
  },
};
