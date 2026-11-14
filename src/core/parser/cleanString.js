/**
 * Tiện ích làm sạch chuỗi và loại bỏ các ký tự ẩn
 * Loại bỏ: U+200B (Zero-width space), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM)
 */

const HIDDEN_CHARS_REGEX = /[\u200B\u200C\u200D\uFEFF]/g;

/**
 * Loại bỏ toàn bộ ký tự ẩn và khoảng trắng thừa ở 2 đầu
 * @param {string} str Chuỗi cần làm sạch
 * @returns {string} Chuỗi sạch
 */
export function cleanString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(HIDDEN_CHARS_REGEX, '').trim();
}

/**
 * Đếm số lượng ký tự ẩn có trong chuỗi (dùng cho unit test)
 * @param {string} str
 * @returns {number}
 */
export function countHiddenChars(str) {
  if (typeof str !== 'string') return 0;
  const matches = str.match(HIDDEN_CHARS_REGEX);
  return matches ? matches.length : 0;
}
