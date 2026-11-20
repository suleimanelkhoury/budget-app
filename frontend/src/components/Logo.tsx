/**
 * LogoMark — the app logo: a piggy bank catching a falling coin,
 * with two motion dashes trailing the coin's drop.
 *
 * Rendered inline (not an <img>) so it scales crisply at any size.
 * Variants:
 *  - "light": brand-950 mark for light surfaces (login, register, favicon)
 *  - "dark":  metallic gradient mark for dark surfaces (sidebar, dark headers)
 *
 * Source of truth: design/logos/C-coin-drop.svg (light) and
 * design/logos/C-coin-drop-dark.svg (dark).
 */

export function LogoMark({
  variant = 'light',
  size = 28,
  className,
}: {
  variant?: 'light' | 'dark';
  size?: number;
  className?: string;
}) {
  // light variant uses the theme token so it stays in sync with the palette
  // (Tailwind v4 @theme emits --color-brand-600 as a real CSS variable)
  const paint = variant === 'dark' ? 'url(#logo-dark-grad)' : 'var(--color-brand-600)';

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {variant === 'dark' && (
        <defs>
          <linearGradient
            id="logo-dark-grad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="60"
            x2="0"
            y2="420"
          >
            <stop offset="0" stopColor="#F8F8F8" />
            <stop offset="1" stopColor="#C4C4C4" />
          </linearGradient>
        </defs>
      )}
      <g
        transform="translate(58 62) scale(16.5)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z M16 8.9a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0 -2.2z M14.5 10.85a0.55 0.55 0 1 0 0 1.1a0.55 0.55 0 1 0 0 -1.1z M16.05 11.25a0.55 0.55 0 1 0 0 1.1a0.55 0.55 0 1 0 0 -1.1z M17.6 10.85a0.55 0.55 0 1 0 0 1.1a0.55 0.55 0 1 0 0 -1.1z"
          fill={paint}
          stroke={paint}
          strokeWidth="0.6"
          fillRule="evenodd"
        />
        <circle cx="4.8" cy="3.1" r="1.6" stroke={paint} strokeWidth="0.9" />
        <g stroke={paint} strokeWidth="0.6">
          <path d="M5.81 -0.27 L5.69 0.28" />
          <path d="M4.98 -0.45 L4.86 0.10" />
        </g>
        <path d="M2 8v1a2 2 0 0 0 2 2h1" stroke={paint} strokeWidth="0.9" />
      </g>
    </svg>
  );
}
