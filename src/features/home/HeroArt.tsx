/**
 * Placeholder hero illustration: a medal podium with a trophy and a judge's scorecard.
 * Drawn for the navy hero band, so its colours are fixed rather than theme-aware.
 */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 260" role="img" aria-label="A medal podium with a trophy">
      <defs>
        <linearGradient id="hero-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffdd99" />
          <stop offset="1" stopColor="#e39500" />
        </linearGradient>
        <linearGradient id="hero-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef2f9" />
          <stop offset="1" stopColor="#869dcb" />
        </linearGradient>
        <linearGradient id="hero-bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2b888" />
          <stop offset="1" stopColor="#b0612c" />
        </linearGradient>
        <radialGradient id="hero-glow">
          <stop offset="0" stopColor="#ffb018" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffb018" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="180" cy="95" r="110" fill="url(#hero-glow)" />

      {/* Sparkles */}
      <g fill="#ffdd99">
        <path d="M70 60 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" opacity="0.8" />
        <path d="M292 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" opacity="0.7" />
        <path d="M300 120 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" opacity="0.5" />
        <circle cx="110" cy="30" r="2.5" opacity="0.6" />
        <circle cx="250" cy="20" r="2" opacity="0.6" />
      </g>

      {/* Trophy */}
      <g transform="translate(180 30)">
        <path d="M-28 0 h56 v22 a28 28 0 0 1 -56 0z" fill="url(#hero-gold)" />
        <path
          d="M-28 6 h-12 a12 12 0 0 0 14 18 M28 6 h12 a12 12 0 0 1 -14 18"
          fill="none"
          stroke="#ffca62"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <rect x="-5" y="48" width="10" height="12" fill="#e39500" />
        <rect x="-18" y="60" width="36" height="8" rx="2" fill="url(#hero-gold)" />
        <path d="M-14 4 v16 a16 16 0 0 0 8 12" fill="none" stroke="#fff8e0" strokeWidth="3" opacity="0.6" />
      </g>

      {/* Podium */}
      <g fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif" fontWeight="800" textAnchor="middle">
        <rect x="80" y="152" width="70" height="88" rx="4" fill="url(#hero-silver)" />
        <rect x="145" y="112" width="70" height="128" rx="4" fill="url(#hero-gold)" />
        <rect x="210" y="176" width="70" height="64" rx="4" fill="url(#hero-bronze)" />
        <text x="115" y="200" fontSize="40" fill="#28488c">
          2
        </text>
        <text x="180" y="168" fontSize="52" fill="#0b1d3a">
          1
        </text>
        <text x="245" y="220" fontSize="36" fill="#6b3712">
          3
        </text>
      </g>
      <rect x="40" y="238" width="280" height="4" rx="2" fill="#ffb018" />

      {/* Scorecard */}
      <g transform="translate(292 150) rotate(8)">
        <rect x="-26" y="-34" width="52" height="68" rx="6" fill="#ffffff" />
        <rect x="-26" y="-34" width="52" height="16" rx="6" fill="#ffb018" />
        <rect x="-26" y="-24" width="52" height="6" fill="#ffb018" />
        <text
          x="0"
          y="18"
          textAnchor="middle"
          fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
          fontWeight="800"
          fontSize="30"
          fill="#0b1d3a"
        >
          8.3
        </text>
      </g>
    </svg>
  );
}
