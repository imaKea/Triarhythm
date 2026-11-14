import React, { useState } from 'react';

export default function Avatar({
  src,
  alt = 'User avatar',
  name = '',
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  status = null, // 'online' | 'offline' | null
  className = '',
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
  }[size] || 'w-9 h-9 text-sm';

  const statusDotSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5'
  }[size] || 'w-2.5 h-2.5';

  const fallbackLetter = (name || alt || 'U').charAt(0).toUpperCase();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`} {...props}>
      <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-[#2a2a44] to-[#1a1a2e] border-2 border-white/[0.12] shadow-md flex items-center justify-center text-white font-bold select-none">
        {src && !hasError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{fallbackLetter}</span>
        )}
      </div>

      {status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-[#1a1a2e] ${statusDotSize} ${
            status === 'online' ? 'bg-[#66bb6a] shadow-[0_0_6px_#66bb6a]' : 'bg-[#7c849c]'
          }`}
          title={status === 'online' ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
