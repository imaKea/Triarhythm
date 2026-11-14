import React from 'react';

/**
 * Cute ribbon bow component
 */
export default function Bow({ className = '' }) {
  return (
    <span className={`bow ${className}`}>
      <i />
      <b />
      <i />
    </span>
  );
}
