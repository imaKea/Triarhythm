import React, { useRef, useState, useEffect } from 'react';

/**
 * SlideBar: Một container thanh trượt ngang mượt mà cho mobile.
 * Khi nội dung đủ chỗ: hiển thị flex bình thường.
 * Khi nội dung tràn: tự động chuyển thành thanh trượt ngang (overflow-x: auto),
 * hỗ trợ scroll-snap, ẩn thanh cuộn, vuốt mượt (-webkit-overflow-scrolling: touch),
 * flex-shrink: 0 cho các nút và có hiệu ứng làm mờ mép gợi ý còn nội dung.
 */
export default function SlideBar({
  children,
  className = '',
  itemGap = 'gap-2',
  autoCenterActive = true,
  activeSelector = '[data-active="true"]',
  fadeColor = 'from-[#fffafc]',
  ...props
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    // Observer để tự động kiểm tra lại khi nội dung con thay đổi
    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      observer.disconnect();
    };
  }, [children]);

  // Tự động cuộn nút active vào giữa tầm nhìn
  useEffect(() => {
    if (!autoCenterActive) return;
    const el = scrollRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      const activeEl = el.querySelector(activeSelector);
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [autoCenterActive, activeSelector, children]);

  return (
    <div className={`relative min-w-0 max-w-full flex items-center ${className}`} {...props}>
      {/* Left Fade Hint */}
      {canScrollLeft && (
        <div
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r ${fadeColor} to-transparent z-10 pointer-events-none transition-opacity duration-200`}
        />
      )}

      {/* Horizontal Scroller */}
      <div
        ref={scrollRef}
        className={`mobile-slide-bar w-full py-1 px-0.5 ${itemGap}`}
      >
        {children}
      </div>

      {/* Right Fade Hint */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className={`absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l ${fadeColor} to-transparent z-10 pointer-events-none transition-opacity duration-200`}
        />
      )}
    </div>
  );
}
