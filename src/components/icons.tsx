import type { SVGProps } from "react";
import paths from "@/lib/social-icons.json";

/**
 * Social glyphs use Simple Icons geometry (24x24 viewBox, filled, CC0):
 * youtube/instagram/x/unsplash/medium from simple-icons@15, linkedin from
 * simple-icons@9 (the glyph was removed from the set at v10). Vendored in
 * assets-src/icons/ and extracted to src/lib/social-icons.json.
 *
 * Icons are decorative; interactive elements that contain only an icon must
 * provide their own accessible name.
 */

type IconProps = SVGProps<SVGSVGElement>;

const socialPaths = paths as unknown as Record<string, string | null>;

export function SocialIcon({ id, ...rest }: { id: string } & IconProps) {
  const d = socialPaths[id];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d={d} />
    </svg>
  );
}

/** Small diagonal arrow marking external links. */
export function ExtArrow(props: IconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M2 12 12 2" />
      <path d="M4.5 2H12v7.5" />
    </svg>
  );
}

/** Long right arrow used in the disciplines bridge line. */
export function FlowArrow(props: IconProps) {
  return (
    <svg
      viewBox="0 0 34 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M1 7h31" />
      <path d="M26 1.5 32.5 7 26 12.5" />
    </svg>
  );
}
