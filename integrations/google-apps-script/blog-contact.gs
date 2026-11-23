/**
 * Personal blog contact-mail relay.
 *
 * Deploy as a web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Configure these Script Properties before deployment:
 *   BLOG_CONTACT_TOKEN      - long random shared secret (not committed)
 *   BLOG_CONTACT_TO_EMAIL   - your own destination Gmail address
 *
 * The public endpoint accepts requests only when the shared token matches.
 * Supabase Edge Function performs origin checks, validation and rate limiting
 * before forwarding a request here.
 */

const BLOG_CONTACT_FROM_NAME = "وبلاگ آریا کیانزاد";

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    const raw = event && event.postData && event.postData.contents
      ? event.postData.contents
      : "";

    if (!raw || raw.length > 14000) {
      return jsonOutput({ ok: false, error: "حجم درخواست معتبر نیست." });
    }

    const payload = JSON.parse(raw);
    const properties = PropertiesService.getScriptProperties();
    const configuredToken = properties.getProperty("BLOG_CONTACT_TOKEN") || "";
    const receivedToken = typeof payload.token === "string" ? payload.token : "";

    if (!configuredToken || !receivedToken || receivedToken !== configuredToken) {
      return jsonOutput({ ok: false, error: "درخواست مجاز نیست." });
    }

    const recipient = (properties.getProperty("BLOG_CONTACT_TO_EMAIL") || "").trim();
    const submissionId = safeString(payload.submissionId, 80);
    const subject = safeString(payload.subject, 220);
    const textBody = safeString(payload.text, 8000);
    const htmlBody = safeString(payload.html, 12000);
    const replyTo = safeString(payload.replyTo, 254).toLowerCase();

    if (!isEmail(recipient) || !isEmail(replyTo)) {
      return jsonOutput({ ok: false, error: "آدرس ایمیل مقصد یا پاسخ معتبر نیست." });
    }
    if (!/^[0-9a-f-]{20,80}$/i.test(submissionId)) {
      return jsonOutput({ ok: false, error: "شناسهٔ درخواست معتبر نیست." });
    }
    if (!subject || !textBody || !htmlBody) {
      return jsonOutput({ ok: false, error: "محتوای ایمیل کامل نیست." });
    }

    if (!lock.tryLock(5000)) {
      return jsonOutput({ ok: false, error: "سرویس ارسال مشغوله؛ دوباره تلاش کنید." });
    }

    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = "blog-contact-sent-" + submissionId;
      if (cache.get(cacheKey) === "1") {
        return jsonOutput({ ok: true, duplicate: true });
      }

      if (MailApp.getRemainingDailyQuota() < 1) {
        return jsonOutput({ ok: false, error: "سهمیۀ روزانۀ ارسال ایمیل Gmail تکمیل شده." });
      }

      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        body: textBody,
        htmlBody: htmlBody,
        replyTo: replyTo,
        name: BLOG_CONTACT_FROM_NAME,
      });

      // Prevent a retry of the same submission from sending another email.
      cache.put(cacheKey, "1", 21600);
      return jsonOutput({ ok: true });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error("Blog contact mail relay failed", String(error).slice(0, 180));
    return jsonOutput({ ok: false, error: "ارسال ایمیل با خطا روبه‌رو شد." });
  }
}

function safeString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
