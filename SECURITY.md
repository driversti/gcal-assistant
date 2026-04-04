# Security

## Session Management

Sessions are stored as encrypted JWE tokens (`A256GCM`) in an `httpOnly` cookie. The cookie uses `sameSite: lax` and `secure: true` in production.

### SESSION_SECRET

The `SESSION_SECRET` environment variable must be at least 32 characters. Generate one with:

```bash
openssl rand -hex 32
```

The application will refuse to start if the secret is missing or too short.

### Token Storage

Google OAuth tokens (including the refresh token) are stored inside the encrypted session cookie. On logout, the application revokes the Google access token. If you suspect your `SESSION_SECRET` has been compromised, rotate it immediately (this invalidates all sessions) and revoke app access from [Google Account Settings](https://myaccount.google.com/permissions).

## CSRF Protection

- **OAuth flow**: The `state` parameter is validated via a short-lived cookie to prevent login CSRF.
- **Mutating API routes**: Protected by `sameSite: lax` cookies, which prevent cross-origin `POST`/`PATCH`/`DELETE` requests from sending credentials. No additional CSRF token is used.
- If deploying publicly, consider upgrading to `sameSite: strict` or adding a CSRF token mechanism.

## Rate Limiting

The auth endpoints (`/api/auth/google`, `/api/auth/callback`) are unauthenticated and do not have built-in rate limiting. If deploying publicly, add rate limiting via your hosting provider or a reverse proxy.

## Reporting Vulnerabilities

If you find a security issue, please open a GitHub issue or contact the maintainer directly.
