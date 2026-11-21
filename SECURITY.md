# Security policy

This repository publishes a static personal website, a standalone book microsite and a static admin dashboard frontend. The dashboard uses a separate Supabase backend for authentication and analytics. Security issues can therefore involve frontend code, build scripts, GitHub Actions, Supabase Edge Functions, SQL migrations or browser session handling.

## Reporting a vulnerability

Please report suspected vulnerabilities privately by email to **kianzadaria@gmail.com**. Include the affected URL or file, the impact you believe is possible, and concise reproduction steps. Do not include live passwords, access tokens, service-account JSON files or other credentials in the report.

Please do not publish an exploitable issue, proof-of-concept or sensitive data before there has been a reasonable opportunity to investigate it. I do not promise a response time, but I will review reports and make a best effort to address valid issues.

## Security design

- The dashboard URL and its noindex metadata are not access controls. Every data request is authenticated and authorized by the Supabase Edge Functions.
- The functions validate the Supabase access token, require a confirmed user email and check that email against the active public.dashboard_admins allowlist.
- The browser uses only the Supabase publishable key. Supabase secret keys and the Google service-account JSON are kept in Supabase Edge Function Secrets.
- The download_snapshots and dashboard_admins tables have RLS enabled, and browser roles have no table privileges.
- The Google service account uses read-only Analytics and Search Console scopes and property-level permissions.
- Google Analytics is loaded only after a visitor accepts the consent prompt.
- The optional remembered dashboard session stores a rotating Supabase refresh token in browser localStorage. It does not store the password or access token, but same-origin JavaScript can read local storage. Disable the option and sign out on shared devices.
- The build checks common credential patterns and validates the static Content Security Policy. This scan is a guard against accidental commits; it is not a substitute for reviewing changes or scanning the complete Git history.

## Supported version

The main branch is the supported version. The site is deployed through GitHub Actions. No static-hosting configuration or third-party service control can eliminate every risk.

If a credential is suspected to be exposed, revoke or rotate it at the issuing provider first, replace the corresponding Supabase secret if applicable, and review the affected repository history and deployment logs.
