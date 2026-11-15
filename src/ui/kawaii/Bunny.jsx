import React from 'react';

/**
 * Cute Bunny mascot SVG component
 */
export default function Bunny({ mood = 'happy', className = '' }) {
  return (
    <svg className={`bunny ${className}`} viewBox="0 0 180 190" aria-label="Bunny mascot">
      <path className="ear" d="M55 72C38 48 39 10 54 9c16-1 20 37 21 58" />
      <path className="ear" d="M108 66c4-36 15-59 29-54 14 6 5 42-9 65" />
      <path
        className="inner-ear"
        d="M55 58c-7-16-8-32-3-36 7-4 12 18 13 39M120 59c3-18 9-34 14-33 6 2 1 22-7 38"
      />
      <ellipse className="body" cx="90" cy="125" rx="57" ry="55" />
      <path
        className="arm"
        d={
          mood === 'cheer'
            ? 'M46 117 22 88M134 117l25-30'
            : 'M48 125c-17 5-23 17-17 25M133 125c15 4 21 16 15 25'
        }
      />
      {mood === 'sleepy' ? (
        <>
          <path className="face" d="M58 118q10 8 20 0M103 118q10 8 20 0M85 132q5 5 10 0" />
          <text x="135" y="73" className="zzz">
            Z
          </text>
          <text x="151" y="51" className="zzz small">
            z
          </text>
        </>
      ) : (
        <>
          <ellipse className="eye" cx="68" cy="117" rx="5" ry="7" />
          <ellipse className="eye" cx="112" cy="117" rx="5" ry="7" />
          <path className="face" d="M82 134q8 9 16 0" />
          <ellipse className="blush" cx="52" cy="133" rx="10" ry="5" />
          <ellipse className="blush" cx="128" cy="133" rx="10" ry="5" />
        </>
      )}
      <g transform="translate(124 68) rotate(14)">
        <path
          className="bow-fill"
          d="M0 2C-18-15-33-10-30 7c3 17 20 13 31 3M0 2c18-17 33-12 30 5-3 17-20 13-31 3"
        />
        <circle className="bow-knot" cx="0" cy="7" r="8" />
      </g>
    </svg>
  );
}
