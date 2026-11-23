"use client";

import { useState, type FormEvent } from "react";

const BLOG_CONTACT_ENDPOINT = "https://bkohdqwecnvbmeaiuyyx.supabase.co/functions/v1/blog-contact";
const BLOG_CONTACT_PUBLIC_KEY = "sb_publishable_FZBK8LPOyf2nAtS8jhchUw_3SVXvo6h";

type RequestType = "advertorial" | "sponsorship" | "collaboration" | "general";

type ContactValues = {
  name: string;
  email: string;
  organization: string;
  requestType: RequestType;
  websiteUrl: string;
  targetUrl: string;
  anchorText: string;
  sponsorshipDuration: string;
  message: string;
  companyFax: string;
};

const emptyValues: ContactValues = {
  name: "",
  email: "",
  organization: "",
  requestType: "advertorial",
  websiteUrl: "",
  targetUrl: "",
  anchorText: "",
  sponsorshipDuration: "three_months",
  message: "",
  companyFax: "",
};

export function ContactForm() {
  const [values, setValues] = useState<ContactValues>(emptyValues);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const update = <K extends keyof ContactValues>(key: K, value: ContactValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (status) setStatus(null);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const submissionId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(36).slice(2);

      const response = await fetch(BLOG_CONTACT_ENDPOINT, {
        method: "POST",
        headers: {
          apikey: BLOG_CONTACT_PUBLIC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...values, submissionId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "ارسال پیام ناموفق بود. لطفاً دوباره تلاش کنید.");
      }

      setValues(emptyValues);
      setStatus({
        kind: "success",
        message: "پیامتون با موفقیت ارسال شد. بعد از بررسی، از طریق ایمیل با شما در ارتباط می‌مونم.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error
          ? error.message
          : "ارتباط با سرویس ارسال پیام برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isAdvertorial = values.requestType === "advertorial";
  const isSponsorship = values.requestType === "sponsorship";

  return (
    <form className="blog-contact-form" onSubmit={handleSubmit}>
      <div className="blog-contact-form-heading">
        <h2>پیامتون رو بفرستید</h2>
        <p>فیلدهای ستاره‌دار برای ارسال پیام ضروری‌ان. باقی اطلاعات رو می‌تونید در صورت نیاز اضافه کنید.</p>
      </div>

      <div className="blog-contact-fields">
        <div className="blog-contact-field">
          <label htmlFor="contact-name">نام و نام خانوادگی *</label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            maxLength={100}
            required
            value={values.name}
            onChange={(event) => update("name", event.currentTarget.value)}
            placeholder="نام شما"
            disabled={submitting}
          />
        </div>

        <div className="blog-contact-field">
          <label htmlFor="contact-email">ایمیل کاری *</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={values.email}
            onChange={(event) => update("email", event.currentTarget.value)}
            placeholder="name@company.com"
            dir="ltr"
            disabled={submitting}
          />
        </div>

        <div className="blog-contact-field">
          <label htmlFor="contact-organization">برند یا مجموعه</label>
          <input
            id="contact-organization"
            name="organization"
            autoComplete="organization"
            maxLength={140}
            value={values.organization}
            onChange={(event) => update("organization", event.currentTarget.value)}
            placeholder="نام برند یا شرکت"
            disabled={submitting}
          />
        </div>

        <div className="blog-contact-field">
          <label htmlFor="contact-type">موضوع درخواست *</label>
          <select
            id="contact-type"
            name="requestType"
            value={values.requestType}
            onChange={(event) => update("requestType", event.currentTarget.value as RequestType)}
            disabled={submitting}
          >
            <option value="advertorial">رپورتاژ یا محتوای تبلیغاتی</option>
            <option value="sponsorship">اسپانسری دوره‌ای</option>
            <option value="collaboration">همکاری محتوایی یا حرفه‌ای</option>
            <option value="general">پیام عمومی یا موضوع دیگر</option>
          </select>
        </div>

        {(isAdvertorial || isSponsorship) ? (
          <div className="blog-contact-field full">
            <label htmlFor="contact-website">آدرس وب‌سایت برند یا رسانه</label>
            <input
              id="contact-website"
              name="websiteUrl"
              type="url"
              inputMode="url"
              maxLength={2048}
              value={values.websiteUrl}
              onChange={(event) => update("websiteUrl", event.currentTarget.value)}
              placeholder="https://example.com"
              dir="ltr"
              disabled={submitting}
            />
          </div>
        ) : null}

        {isAdvertorial ? (
          <>
            <div className="blog-contact-field">
              <label htmlFor="contact-target">آدرس صفحۀ مقصد لینک</label>
              <input
                id="contact-target"
                name="targetUrl"
                type="url"
                inputMode="url"
                maxLength={2048}
                value={values.targetUrl}
                onChange={(event) => update("targetUrl", event.currentTarget.value)}
                placeholder="https://example.com/page"
                dir="ltr"
                disabled={submitting}
              />
            </div>
            <div className="blog-contact-field">
              <label htmlFor="contact-anchor">انکرتکست پیشنهادی</label>
              <input
                id="contact-anchor"
                name="anchorText"
                maxLength={160}
                value={values.anchorText}
                onChange={(event) => update("anchorText", event.currentTarget.value)}
                placeholder="متن لینک، در صورت وجود"
                disabled={submitting}
              />
            </div>
          </>
        ) : null}

        {isSponsorship ? (
          <div className="blog-contact-field full">
            <label htmlFor="contact-duration">مدت پیشنهادی اسپانسری</label>
            <select
              id="contact-duration"
              name="sponsorshipDuration"
              value={values.sponsorshipDuration}
              onChange={(event) => update("sponsorshipDuration", event.currentTarget.value)}
              disabled={submitting}
            >
              <option value="one_month">یک ماه</option>
              <option value="three_months">سه ماه</option>
              <option value="six_months">شش ماه</option>
              <option value="annual">یک سال</option>
              <option value="open">قابل گفت‌وگو</option>
            </select>
          </div>
        ) : null}

        <div className="blog-contact-field full">
          <label htmlFor="contact-message">توضیحات درخواست *</label>
          <textarea
            id="contact-message"
            name="message"
            minLength={20}
            maxLength={3000}
            required
            value={values.message}
            onChange={(event) => update("message", event.currentTarget.value)}
            placeholder="کمی درباره پیشنهاد، هدف همکاری و زمان‌بندی مدنظرتون بنویسید..."
            disabled={submitting}
          />
          <small>حداقل ۲۰ کاراکتر. نیازی نیست اطلاعات محرمانه یا مالی حساس رو اینجا وارد کنید.</small>
        </div>
      </div>

      <div className="blog-contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-company-fax">این فیلد رو خالی بگذارید</label>
        <input
          id="contact-company-fax"
          name="companyFax"
          tabIndex={-1}
          autoComplete="off"
          value={values.companyFax}
          onChange={(event) => update("companyFax", event.currentTarget.value)}
        />
      </div>

      <p className="blog-contact-policy">
        اطلاعات فرم برای پاسخ‌گویی به درخواست شما به ایمیل من ارسال می‌شه. در همکاری‌های تبلیغاتی و پولی، لینک‌ها مطابق
        {" "}
        <a href="https://developers.google.com/search/docs/essentials/spam-policies" target="_blank" rel="noopener noreferrer">سیاست‌های Google</a>
        {" "}
        با ویژگی sponsored یا nofollow مشخص می‌شن؛ لینک Follow در ازای پرداخت ارائه نمی‌شه.
      </p>

      <button className="blog-contact-submit" type="submit" disabled={submitting}>
        {submitting ? "در حال ارسال..." : "ارسال درخواست"}
        <span aria-hidden="true">↗</span>
      </button>

      {status ? (
        <p className={"blog-contact-status " + status.kind} role={status.kind === "error" ? "alert" : "status"} aria-live="polite">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}