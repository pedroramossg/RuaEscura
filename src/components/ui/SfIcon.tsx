import React from 'react';

export type SfIconName =
  | 'compass'
  | 'map'
  | 'lightbulb'
  | 'shield'
  | 'sun'
  | 'moon'
  | 'star';

export interface SfIconProps {
  name: SfIconName;
  filled?: boolean;
  size?: number;
  className?: string;
}

export const SfIcon: React.FC<SfIconProps> = ({
  name,
  filled = false,
  size = 18,
  className = '',
}) => {
  const baseClass = className ? `shrink-0 ${className}` : 'shrink-0';

  const renderGlyph = () => {
    switch (name) {
      case 'compass':
        if (filled) {
          return (
            <>
              <path
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm3.85 5.9-2.25 5.45-5.45 2.25 2.25-5.45 5.45-2.25Z"
              />
              <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            </>
          );
        }
        return (
          <>
            <circle cx="12" cy="12" r="9.25" />
            <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
          </>
        );

      case 'map':
        if (filled) {
          return (
            <>
              <path
                fill="currentColor"
                d="M3.25 6.1c0-.46.29-.88.72-1.05l4.28-1.72v14.72l-3.85 1.54a.85.85 0 0 1-1.15-.79V6.1Z"
              />
              <path
                fill="currentColor"
                d="m9.75 3.45 4.5 1.72v15.38l-4.5-1.72V3.45Z"
              />
              <path
                fill="currentColor"
                d="m15.75 5.15 3.85-1.54a.85.85 0 0 1 1.15.79v12.7c0 .46-.29.88-.72 1.05l-4.28 1.72V5.15Z"
              />
            </>
          );
        }
        return (
          <>
            <path d="M3.5 6.25 9 4l6 2.25L20.5 4v13.75L15 20l-6-2.25L3.5 20V6.25Z" />
            <path d="M9 4v13.75" />
            <path d="M15 6.25V20" />
          </>
        );

      case 'lightbulb':
        if (filled) {
          return (
            <>
              <path
                fill="currentColor"
                d="M12 2.75a6.5 6.5 0 0 0-5.12 10.5c.63.8 1.27 1.62 1.52 2.48a.75.75 0 0 0 .72.52h5.76a.75.75 0 0 0 .72-.52c.25-.86.89-1.68 1.52-2.48A6.5 6.5 0 0 0 12 2.75Z"
              />
              <path
                fill="currentColor"
                d="M9.25 17.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z"
              />
              <path
                fill="currentColor"
                d="M10.25 20.25h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5Z"
              />
            </>
          );
        }
        return (
          <>
            <path d="M8.75 15.75c-.22-.82-.85-1.55-1.52-2.4A6.25 6.25 0 1 1 16.77 13.35c-.67.85-1.3 1.58-1.52 2.4H8.75Z" />
            <path d="M9.25 18.25h5.5" />
            <path d="M10.25 20.75h3.5" />
          </>
        );

      case 'shield':
        if (filled) {
          return (
            <path
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 2.5 4.5 5.5v5.8c0 4.82 3.24 8.85 7.5 10.2 4.26-1.35 7.5-5.38 7.5-10.2V5.5L12 2.5Zm-.85 5.6a.85.85 0 0 1 1.7 0v4.3a.85.85 0 0 1-1.7 0V8.1Zm.85 6.35a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"
            />
          );
        }
        return (
          <>
            <path d="M12 2.75 4.75 5.65v5.65c0 4.65 3.12 8.53 7.25 9.95 4.13-1.42 7.25-5.3 7.25-9.95V5.65L12 2.75Z" />
            <path d="M12 8.25v4.4" />
            <circle cx="12" cy="15.75" r="0.9" fill="currentColor" stroke="none" />
          </>
        );

      case 'sun':
        if (filled) {
          return (
            <>
              <circle cx="12" cy="12" r="4.75" fill="currentColor" stroke="none" />
              <g stroke="currentColor" strokeWidth="2">
                <path d="M12 2.75v2" />
                <path d="M12 19.25v2" />
                <path d="M2.75 12h2" />
                <path d="M19.25 12h2" />
                <path d="m5.46 5.46 1.41 1.41" />
                <path d="m17.13 17.13 1.41 1.41" />
                <path d="m18.54 5.46-1.41 1.41" />
                <path d="m6.87 17.13-1.41 1.41" />
              </g>
            </>
          );
        }
        return (
          <>
            <circle cx="12" cy="12" r="4.25" />
            <path d="M12 2.75v2" />
            <path d="M12 19.25v2" />
            <path d="M2.75 12h2" />
            <path d="M19.25 12h2" />
            <path d="m5.46 5.46 1.41 1.41" />
            <path d="m17.13 17.13 1.41 1.41" />
            <path d="m18.54 5.46-1.41 1.41" />
            <path d="m6.87 17.13-1.41 1.41" />
          </>
        );

      case 'moon':
        if (filled) {
          return (
            <path
              fill="currentColor"
              d="M20.35 14.4A8.3 8.3 0 0 1 9.6 3.65a8.65 8.65 0 1 0 10.75 10.75Z"
            />
          );
        }
        return (
          <path d="M20.25 14.3A8.25 8.25 0 0 1 9.7 3.75a8.5 8.5 0 1 0 10.55 10.55Z" />
        );

      case 'star':
        if (filled) {
          return (
            <path
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.75"
              d="m12 3.25 2.63 5.33 5.88.86-4.26 4.15 1 5.86L12 16.68l-5.25 2.77 1-5.86-4.26-4.15 5.88-.86L12 3.25Z"
            />
          );
        }
        return (
          <path d="m12 3.25 2.63 5.33 5.88.86-4.26 4.15 1 5.86L12 16.68l-5.25 2.77 1-5.86-4.26-4.15 5.88-.86L12 3.25Z" />
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={baseClass}
    >
      {renderGlyph()}
    </svg>
  );
};
