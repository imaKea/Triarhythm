import React from 'react';
import { playHover, playSelect } from './sound/uiAudio.js';

export default function Tabs({
  tabs = [], // [{ id, label, icon, badge }]
  activeTab,
  onChange,
  size = 'md', // 'sm' | 'md'
  variant = 'pill', // 'pill' | 'underline'
  className = '',
  ...props
}) {
  const handleTabClick = (tabId) => {
    if (tabId === activeTab) return;
    playSelect();
    if (onChange) onChange(tabId);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-[#fff1f5] backdrop-blur-md rounded-full border border-[#f3dbe4] select-none max-w-full overflow-x-auto mobile-slide-bar ${className}`}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            data-active={isActive ? "true" : "false"}
            onClick={() => handleTabClick(tab.id)}
            onMouseEnter={() => !isActive && playHover()}
            className={`relative min-h-[44px] sm:min-h-0 px-3.5 sm:px-4 py-2 sm:py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
              isActive
                ? 'bg-gradient-to-r from-[#ff85a2] via-[#ff6b93] to-[#ff4d80] text-white shadow-[0_2px_14px_rgba(255,77,128,0.25)] scale-[1.02]'
                : 'text-[#5b2a47] hover:text-[#ff4d80] hover:bg-white'
            }`}
          >
            {tab.icon && <span className="text-xs">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-white/30 text-white' : 'bg-white text-[#ff4d80] border border-[#f3dbe4]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
