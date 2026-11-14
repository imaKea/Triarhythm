/**
 * Các hàm thuần cho tài khoản (không phụ thuộc Firebase / IndexedDB)
 * Được tách riêng để unit-test dễ dàng.
 */

export const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/;
export const ACCOUNT_EMAIL_DOMAIN = 'triarhythm.local';

export function normalizeUsername(raw = '') {
  return String(raw).trim().toLowerCase();
}

/**
 * Firebase Auth dùng email; người chơi chỉ nhập username.
 * Sinh email nội bộ ổn định từ username.
 */
export function usernameToEmail(raw = '') {
  return `${normalizeUsername(raw)}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export function validateCredentials(username, password) {
  const name = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: 'Tên đăng nhập phải dài 3-24 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.'
    };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' };
  }
  return { valid: true, error: null };
}

export function createPlayerProfile({ uid = null, username, displayName = '', provider = 'local', email = null, avatar = '🌟', rating = 12.5, dan = '初段 (1st Dan)' } = {}) {
  const name = normalizeUsername(username);
  return {
    uid: uid || name,
    username: name,
    displayName: String(displayName || '').trim() || name,
    email: email || null,
    avatar,
    rating: Number(rating) || 12.5,
    dan: dan || '初段 (1st Dan)',
    provider,
    createdAt: Date.now()
  };
}

/**
 * Chuyển lỗi Firebase Auth sang thông báo tiếng Việt thân thiện.
 */
export function translateAuthError(codeOrMessage = '') {
  const text = String(codeOrMessage);
  const map = [
    ['auth/email-already-in-use', 'Tên tài khoản này đã tồn tại!'],
    ['auth/invalid-credential', 'Tài khoản hoặc mật khẩu không chính xác!'],
    ['auth/wrong-password', 'Mật khẩu không chính xác!'],
    ['auth/user-not-found', 'Tài khoản không tồn tại!'],
    ['auth/weak-password', 'Mật khẩu quá yếu (tối thiểu 6 ký tự).'],
    ['auth/too-many-requests', 'Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.'],
    ['auth/network-request-failed', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'],
    ['auth/operation-not-allowed', 'Phương thức đăng nhập Email/Password chưa được bật trong Firebase Console.'],
    ['auth/invalid-api-key', 'Firebase API key không hợp lệ. Kiểm tra file .env.'],
    ['permission-denied', 'Firestore từ chối truy cập. Kiểm tra Firestore Rules.']
  ];
  for (const [needle, message] of map) {
    if (text.includes(needle)) return message;
  }
  return text.replace(/^Firebase:\s*/i, '').replace(/\(auth\/[^)]+\)\.?/i, '').trim() || 'Lỗi thao tác tài khoản.';
}
