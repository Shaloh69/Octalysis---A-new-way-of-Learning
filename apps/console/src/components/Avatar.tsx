import { useEffect, useState, type CSSProperties } from "react";
import type { Avatar as AvatarData } from "@octa/contracts";

/**
 * A person's picture, or the planet generated from their student ID (PROFILES,
 * 8 Oct 2026; packages/tokens/avatar.css). The API decides which: `url` is a
 * short-lived signed link, present only when this viewer may see the picture.
 *
 * Decorative by default (`aria-hidden`, empty alt): the person's name is
 * always beside it. Pass `label` where it stands alone, as in the top strip.
 * A link that has expired or fails to load falls back to the generated one
 * rather than a broken-image glyph. Never drawn on a stage check or an exam
 * paper: `[data-paper]` is identical for everyone.
 */
export function Avatar({
  avatar,
  size = "md",
  label,
}: {
  avatar: AvatarData | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  // A new picture is a new link: try it.
  useEffect(() => setFailed(false), [avatar?.url]);
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };

  if (!avatar) return <span className="avatar" data-size={size} {...a11y} />;
  if (avatar.url && !failed) {
    return (
      <span className="avatar" data-avatar="picture" data-size={size} {...a11y}>
        <img src={avatar.url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span
      className="avatar"
      data-avatar="generated"
      data-variant={avatar.variant}
      data-size={size}
      style={{ ["--avatar-hue" as string]: avatar.hue } as CSSProperties}
      {...a11y}
    />
  );
}
