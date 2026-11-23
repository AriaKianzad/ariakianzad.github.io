export function ContactForm() {
  return (
    <form className="blog-contact-form" data-blog-contact-form noValidate>
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
            minLength={2}
            required
            placeholder="نام شما"
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
            placeholder="name@company.com"
            dir="ltr"
          />
        </div>

        <div className="blog-contact-field">
          <label htmlFor="contact-organization">برند یا مجموعه</label>
          <input
            id="contact-organization"
            name="organization"
            autoComplete="organization"
            maxLength={140}
            placeholder="نام برند یا شرکت"
          />
        </div>

        <div className="blog-contact-field">
          <label htmlFor="contact-type">موضوع درخواست *</label>
          <select id="contact-type" name="requestType" defaultValue="advertorial" required>
            <option value="advertorial">رپورتاژ یا محتوای تبلیغاتی</option>
            <option value="editorial_link">بررسی ارجاع تحریریه‌ای Follow بدون پرداخت بابت لینک</option>
            <option value="sponsorship">اسپانسری دوره‌ای</option>
            <option value="collaboration">همکاری محتوایی یا حرفه‌ای</option>
            <option value="general">پیام عمومی یا موضوع دیگر</option>
          </select>
        </div>

        <div className="blog-contact-field full" data-show-for="advertorial editorial_link sponsorship">
          <label htmlFor="contact-website">آدرس وب‌سایت برند یا رسانه</label>
          <input
            id="contact-website"
            name="websiteUrl"
            type="url"
            inputMode="url"
            maxLength={2048}
            placeholder="https://example.com"
            dir="ltr"
          />
        </div>

        <div className="blog-contact-field full" data-show-for="editorial_link" hidden>
          <small>این درخواست فقط برای ارجاع تحریریه‌ای مستقل و بدون پرداخت بابت لینک بررسی می‌شه؛ درج Follow تضمین نمی‌شه.</small>
        </div>

        <div className="blog-contact-field full" data-show-for="sponsorship" hidden>
          <label htmlFor="contact-duration">مدت پیشنهادی اسپانسری</label>
          <select id="contact-duration" name="sponsorshipDuration" defaultValue="three_months">
            <option value="one_month">یک ماه</option>
            <option value="three_months">سه ماه</option>
            <option value="six_months">شش ماه</option>
            <option value="annual">یک سال</option>
            <option value="open">قابل گفت‌وگو</option>
          </select>
        </div>

        <div className="blog-contact-field full">
          <label htmlFor="contact-message">توضیحات درخواست *</label>
          <textarea
            id="contact-message"
            name="message"
            minLength={20}
            maxLength={3000}
            required
            placeholder="کمی درباره پیشنهاد، هدف همکاری و زمان‌بندی مدنظرتون بنویسید..."
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
        />
      </div>

      <p className="blog-contact-policy">
        اطلاعات فرم فقط برای بررسی درخواست و پاسخ‌گویی به شما استفاده می‌شه.
      </p>

      <button className="blog-contact-submit" type="submit">
        <span data-submit-label>ارسال درخواست</span>
        <span aria-hidden="true">↗</span>
      </button>

      <p className="blog-contact-status" data-contact-status role="status" aria-live="polite" hidden />
    </form>
  );
}
