import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { control, type ControlTone } from "~/components/common/control";

interface HeaderControlBase {
  /** Named to a screen reader and, as its tooltip, to a pointer. */
  label: string;
  icon: LucideIcon;
  /** The icon drawn solid, as a favorite's star is. */
  filled?: boolean;
  tone?: ControlTone;
}

interface HeaderLink extends HeaderControlBase {
  href: string;
  /** Opened in a tab of its own, as a feed for a reader is. */
  newTab?: boolean;
  /** What the link leads to, e.g. `application/atom+xml`. */
  type?: string;
  onClick?: never;
  pressed?: never;
}

interface HeaderButton extends HeaderControlBase {
  onClick: () => void;
  /** A toggle's state, if it is one. */
  pressed?: boolean;
  href?: never;
}

export type HeaderControlProps = HeaderLink | HeaderButton;

/**
 * An icon control in a page's header: a 32px box, filled when hovered, around
 * a 16px icon. Every one in the header is drawn by this, so none can drift
 * from the rest. A link or, given `onClick`, a button.
 */
export function HeaderControl(props: HeaderControlProps) {
  const { label, icon: Icon, filled = false, tone } = props;
  const className = control({ tone, shape: "box", size: 8 });
  const glyph = (
    <Icon
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      aria-hidden
    />
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        type={props.type}
        {...(props.newTab && { target: "_blank", rel: "noreferrer noopener" })}
        aria-label={label}
        title={label}
        className={className}
      >
        {glyph}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.pressed}
      aria-label={label}
      title={label}
      className={className}
    >
      {glyph}
    </button>
  );
}
