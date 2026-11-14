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
      className={`inline-flex items-center gap-1 p-1 bg-[#111122]/80 backdrop-blur-md rounded-full border border-white/[0.06] select-none ${className}`}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            onMouseEnter={() => !isActive && playHover()}
            className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              isActive
                ? 'bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white shadow-[0_2px_12px_rgba(255,102,171,0.35)]'
                : 'text-[#8890a4] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.icon && <span className="text-xs">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/[0.08] text-[#7c849c]'
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
