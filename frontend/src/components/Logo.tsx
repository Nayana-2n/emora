interface LogoProps {
  size?: number
  className?: string
}

/**
 * EMORA wordmark mark — a face arc (upper), a voice arc (lower) and a
 * fusion dot at the centre. Dusty rose gradient #F4C9C9 → #E8A0A0 → #F5F3EF.
 */
export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="emoraGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F4C9C9" />
          <stop offset="55%" stopColor="#E8A0A0" />
          <stop offset="100%" stopColor="#F5F3EF" />
        </linearGradient>
      </defs>
      <path
        d="M13 22 C13 14.5 20.5 10 24 10 C27.5 10 35 14.5 35 22"
        stroke="url(#emoraGradient)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M13 26 C13 33.5 20.5 38 24 38 C27.5 38 35 33.5 35 26"
        stroke="url(#emoraGradient)"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="24" cy="24" r="3.4" fill="url(#emoraGradient)" />
    </svg>
  )
}
