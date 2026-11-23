interface StudioLogoProps {
  className?: string;
}

interface StudioBrandLogoProps {
  kind?: 'full' | 'emblem';
  variant?: 'auto' | 'dark-ink' | 'light-ink';
  className?: string;
  alt?: string;
}

export function StudioBrandLogo({
  kind = 'full',
  variant = 'auto',
  className = 'w-12 h-12',
  alt = 'Logo PrangArt Lab',
}: StudioBrandLogoProps) {
  const darkSrc = kind === 'emblem' ? '/assets/brand/emblem-dark.png' : '/assets/brand/logo-dark.png';
  const lightSrc = kind === 'emblem' ? '/assets/brand/emblem-light.png' : '/assets/brand/logo-light.png';

  if (variant === 'dark-ink') {
    return (
      <img
        src={darkSrc}
        alt={alt}
        className={`${className} object-contain select-none`}
        draggable={false}
      />
    );
  }

  if (variant === 'light-ink') {
    return (
      <img
        src={lightSrc}
        alt={alt}
        className={`${className} object-contain select-none`}
        draggable={false}
      />
    );
  }

  return (
    <>
      <img
        src={darkSrc}
        alt={alt}
        className={`${className} object-contain select-none dark:hidden print:block`}
        draggable={false}
      />
      <img
        src={lightSrc}
        alt={alt}
        className={`${className} object-contain select-none hidden dark:block print:hidden`}
        draggable={false}
      />
    </>
  );
}

export function StudioLogoSvg({ className = 'w-11 h-11' }: StudioLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo PrangArt Lab"
      role="img"
    >
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0F172A" />
      <rect x="4" y="4" width="56" height="56" rx="14" stroke="#6366F1" strokeOpacity="0.45" strokeWidth="1.5" />
      {/* Acoustic Waveform Bars */}
      <rect x="16" y="28" width="4" height="12" rx="2" fill="#818CF8" />
      <rect x="23" y="20" width="4" height="24" rx="2" fill="#A5B4FC" />
      <rect x="30" y="14" width="4" height="34" rx="2" fill="#FFFFFF" />
      <rect x="37" y="22" width="4" height="22" rx="2" fill="#A5B4FC" />
      <rect x="44" y="27" width="4" height="14" rx="2" fill="#818CF8" />
      {/* Base Monogram Line */}
      <path d="M16 52H48" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface StudioStampProps {
  label?: string;
  sublabel?: string;
  dateText?: string;
  variant?: 'indigo' | 'emerald';
  className?: string;
}

export function StudioStampSvg({
  label = 'TERVERIFIKASI',
  sublabel = 'PRANGART LAB STUDIO',
  dateText = '',
  variant = 'indigo',
  className = 'w-32 h-32',
}: StudioStampProps) {
  const strokeMain = variant === 'emerald' ? '#059669' : '#4338CA';
  const fillSoft = variant === 'emerald' ? '#ECFDF5' : '#EEF2FF';

  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} -rotate-6 select-none`}
      aria-label={`Stempel Resmi ${label}`}
      role="img"
    >
      <circle cx="80" cy="80" r="72" fill={fillSoft} fillOpacity="0.35" stroke={strokeMain} strokeWidth="3.5" />
      <circle
        cx="80"
        cy="80"
        r="64"
        stroke={strokeMain}
        strokeWidth="1.25"
        strokeDasharray="4 3"
      />
      <circle cx="80" cy="80" r="46" stroke={strokeMain} strokeWidth="1" strokeOpacity="0.6" />

      <text
        x="80"
        y="37"
        textAnchor="middle"
        fill={strokeMain}
        fontSize="8.5"
        fontWeight="700"
        letterSpacing="1.6"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {sublabel}
      </text>

      {/* Stars */}
      <circle cx="29" cy="80" r="2.2" fill={strokeMain} />
      <circle cx="131" cy="80" r="2.2" fill={strokeMain} />

      {/* Center Status Banner */}
      <rect
        x="16"
        y="66"
        width="128"
        height="28"
        rx="5"
        fill="#FFFFFF"
        fillOpacity="0.92"
        stroke={strokeMain}
        strokeWidth="2"
      />
      <text
        x="80"
        y="83.5"
        textAnchor="middle"
        fill={strokeMain}
        fontSize="11.5"
        fontWeight="800"
        letterSpacing="1.2"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {label}
      </text>

      <text
        x="80"
        y="117"
        textAnchor="middle"
        fill={strokeMain}
        fontSize="7.8"
        fontWeight="700"
        letterSpacing="1"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        SAMARINDA · INDONESIA
      </text>
      {dateText && (
        <text
          x="80"
          y="130"
          textAnchor="middle"
          fill={strokeMain}
          fontSize="7.2"
          fontWeight="600"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {dateText}
        </text>
      )}
    </svg>
  );
}

interface OwnerSignatureProps {
  className?: string;
}

export function OwnerSignatureSvg({ className = 'w-44 h-16' }: OwnerSignatureProps) {
  return (
    <svg
      viewBox="0 0 220 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Tanda Tangan Pemilik PrangArt Lab"
      role="img"
    >
      {/* Stylized calligraphic signature strokes for Fikri Yassaar */}
      <path
        d="M22 48 C28 18, 42 12, 46 24 C49 34, 24 44, 18 46 C34 40, 56 32, 64 26 C60 36, 56 44, 62 45 C68 46, 75 30, 82 28 C86 27, 84 44, 92 43 C98 42, 106 24, 114 20 C118 18, 108 48, 102 56 C100 59, 106 42, 122 36 C132 32, 134 42, 142 40 C150 38, 158 31, 166 34 C172 36, 174 42, 184 37 C192 33, 200 32, 206 34"
        stroke="#0F172A"
        className="dark:stroke-slate-100"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 32 C34 26, 56 24, 72 25"
        stroke="#0F172A"
        className="dark:stroke-slate-100"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M44 57 C92 52, 148 49, 198 52"
        stroke="#4338CA"
        className="dark:stroke-indigo-400"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
