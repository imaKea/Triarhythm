import React from 'react';

export default function Skeleton({
  variant = 'text', // 'text' | 'card' | 'circle' | 'rect'
  width,
  height,
  className = '',
  ...props
}) {
  const baseClasses = 'bg-white/[0.06] rounded animate-pulse';

  const variantClasses = {
    text: 'h-4 w-full rounded',
    circle: 'rounded-full',
    card: 'h-24 w-full rounded-xl',
    rect: 'rounded-xl'
  }[variant] || '';

  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      style={style}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    />
  );
}
