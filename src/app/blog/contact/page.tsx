import type { Metadata } from "next";
import { site } from "@/lib/site";
import { BlogHeader, BlogFooter } from "../BlogHeader";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "تماس با من | درخواست همکاری و اسپانسری",
  description: "برای رپورتاژ، بنرهای تبلیغاتی، اسپانسری دوره‌ای و همکاری محتوایی با وبلاگ آریا کیانزاد پیام بفرستید.",
  alternates: { canonical: site.url + "/blog/contact/" },
  openGraph: {
    type: "website",
    url: site.url + "/blog/contact/",
    siteName: "Aria Kianzad",
    title: "تماس با من",
    description: "درخواست همکاری، رپورتاژ، بنر تبلیغاتی و اسپانسری وبلاگ آریا کیانزاد.",
    images: [{ url: site.url + "/og/og.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "تماس با من",
    description: "درخواست همکاری، رپورتاژ، بنر تبلیغاتی و اسپانسری وبلاگ آریا کیانزاد.",
    images: [site.url + "/og/og.jpg"],
  },
};

export default function BlogContactPage() {
  return (
    <>
      <BlogHeader />
      <main id="main" tabIndex={-1} className="blog-main" dir="rtl">
        <section className="blog-container blog-contact-intro">
          <div className="blog-contact-intro-copy">
            <p className="blog-contact-kicker">ارتباط و همکاری</p>
            <h1>برای شروع یک گفت‌وگوی خوب، از همین‌جا شروع کنیم.</h1>
            <p>
              برای پیشنهاد همکاری، انتشار محتوای تبلیغاتی، سفارش بنر تبلیغاتی، اسپانسری دوره‌ای یا هر موضوع مرتبط با این وبلاگ، جزئیات اولیه رو از طریق فرم بفرستید.
            </p>
          </div>
          <aside className="blog-contact-intro-aside">
            <strong>درخواست‌ها چطور بررسی می‌شن؟</strong>
            تناسب موضوع با مخاطب وبلاگ، کیفیت پیشنهاد و نحوۀ اجرا بررسی می‌شه. بعد از دریافت پیام، برای ادامۀ گفت‌وگو با شما تماس می‌گیرم.
          </aside>
        </section>

        <section className="blog-container blog-contact-layout" aria-label="فرم تماس">
          <aside className="blog-contact-details">
            <h2>چه نوع همکاری‌هایی؟</h2>
            <p>این فرم برای شروع ارتباطه؛ لازم نیست از همون ابتدا همۀ جزئیات نهایی شده باشن.</p>
            <div className="blog-contact-detail">
              <h3>رپورتاژ و محتوای تبلیغاتی</h3>
              <span>پیشنهاد انتشار مطلب، معرفی محصول یا خدمت و همکاری محتوایی با رسانه‌ها و برندها</span>
            </div>
            <div className="blog-contact-detail">
              <h3>اسپانسری دوره‌ای و بنرهای تبلیغاتی</h3>
              <span>همکاری ماهانه یا چندماهه برای نمایش بنر در جایگاه‌های مشخص صفحه‌های مقاله، در کنار قالب‌های محتوایی متناسب با مخاطب وبلاگ</span>
            </div>
            <div className="blog-contact-detail">
              <h3>همکاری و پیشنهادهای دیگر</h3>
              <span>پروژه‌های محتوایی، گفت‌وگو، مصاحبه و پیشنهادهای مرتبط</span>
            </div>
          </aside>
          <ContactForm />
        </section>
      </main>
      <BlogFooter />
    </>
  );
}