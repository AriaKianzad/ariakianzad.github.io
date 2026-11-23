# Gmail delivery for the blog contact form

This small Google Apps Script replaces the Resend dependency. It sends contact requests through the Gmail account that owns the script, so no email provider account or custom DNS domain is needed.

## 1. Create the script

1. Sign in to the Google account that should receive contact requests.
2. Open [Google Apps Script](https://script.google.com/home/start) and create a new project named **Blog Contact Mailer**.
3. Replace the contents of `Code.gs` with the code in `blog-contact.gs`.

## 2. Add private Script Properties

Open **Project Settings → Script Properties** and add:

| Property | Value |
| --- | --- |
| `BLOG_CONTACT_TOKEN` | A long random secret (at least 32 random bytes, hex-encoded) |
| `BLOG_CONTACT_TO_EMAIL` | `kianzadaria@gmail.com` |

Do not put the token in this repository or in the browser.

## 3. Authorize and deploy

1. Choose **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Deploy and approve Google's permission request to send email.
6. Copy the Web App URL ending in `/exec`.

The endpoint is public at the HTTP layer because the Supabase Edge Function must be able to call it. The script checks the shared token before processing any request. Do not remove that check or publish the token.

## 4. Add two Supabase Edge Function Secrets

Open the [Supabase Edge Function Secrets page](https://supabase.com/dashboard/project/bkohdqwecnvbmeaiuyyx/functions/secrets) and set:

| Secret | Value |
| --- | --- |
| `GOOGLE_APPS_SCRIPT_URL` | The deployed Apps Script Web App URL ending in `/exec` |
| `GOOGLE_APPS_SCRIPT_TOKEN` | The exact same random secret saved as `BLOG_CONTACT_TOKEN` in Apps Script |

No Resend account, Resend API key, custom domain, or DNS record is needed.

## 5. Mail quota

Google's current Apps Script quotas list 100 email recipients per day for consumer Gmail accounts. Quotas can change and are enforced by Google. This route is intended for ordinary contact-form submissions, not newsletters or bulk email. See [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).
