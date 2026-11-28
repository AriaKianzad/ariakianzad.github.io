/**
 * Validate every content image before the published blog is exported.
 * Code samples are skipped because Markdown does not render their contents as images.
 */
export function extractMarkdownImages(markdown) {
  const images = [];
  let fenceLength = 0;
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(\x60{3,})/);
    if (fenceLength) {
      if (fence && fence[1].length >= fenceLength) fenceLength = 0;
      continue;
    }
    if (fence) {
      fenceLength = fence[1].length;
      continue;
    }

    const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const match of line.matchAll(pattern)) {
      images.push({ alt: String(match[1] || ""), url: String(match[2] || "") });
    }
  }

  return images;
}

export function getBlogImageAltIssues(posts, settings) {
  const issues = [];

  for (const post of Array.isArray(posts) ? posts : []) {
    const slug = String(post?.slug || "بدون نامک");
    if (String(post?.hero_image_url || "").trim() && !String(post?.hero_image_alt || "").trim()) {
      issues.push(slug + ": تصویر شاخص متن جایگزین ندارد.");
    }

    for (const image of extractMarkdownImages(post?.content)) {
      if (!image.alt.trim()) {
        issues.push(slug + ": تصویر درون‌متنی بدون alt (" + image.url + ").");
      }
    }
  }

  for (const banner of Array.isArray(settings?.ad_banners) ? settings.ad_banners : []) {
    if (banner?.enabled === true && String(banner?.image_url || "").trim() && !String(banner?.alt || "").trim()) {
      issues.push(String(banner.id || "بنر") + ": بنر فعال متن جایگزین ندارد.");
    }
  }

  return issues;
}
