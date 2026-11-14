import { describe, it, expect } from 'vitest';
import {
  normalizeUsername,
  usernameToEmail,
  validateCredentials,
  createPlayerProfile,
  translateAuthError,
  ACCOUNT_EMAIL_DOMAIN
} from '../src/core/online/authModel.js';

describe('normalizeUsername', () => {
  it('trim và lowercase', () => {
    expect(normalizeUsername('  Aster_01 ')).toBe('aster_01');
    expect(normalizeUsername()).toBe('');
  });
});

describe('usernameToEmail', () => {
  it('sinh email nội bộ ổn định', () => {
    expect(usernameToEmail('Aster')).toBe(`aster@${ACCOUNT_EMAIL_DOMAIN}`);
    expect(usernameToEmail(' Aster ')).toBe(`aster@${ACCOUNT_EMAIL_DOMAIN}`);
  });
});

describe('validateCredentials', () => {
  it('chấp nhận username 3-24 ký tự và mật khẩu >= 6', () => {
    expect(validateCredentials('aster', '123456').valid).toBe(true);
    expect(validateCredentials('a.b-c_d', 'secret123').valid).toBe(true);
  });

  it('từ chối username quá ngắn hoặc chứa ký tự lạ', () => {
    expect(validateCredentials('ab', '123456').valid).toBe(false);
    expect(validateCredentials('aster!', '123456').valid).toBe(false);
    expect(validateCredentials('a'.repeat(25), '123456').valid).toBe(false);
  });

  it('từ chối mật khẩu yếu', () => {
    const result = validateCredentials('aster', '123');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/6 ký tự/);
  });
});

describe('createPlayerProfile', () => {
  it('tạo hồ sơ với mặc định hợp lệ', () => {
    const profile = createPlayerProfile({ username: ' Aster ', displayName: '  ' });
    expect(profile.uid).toBe('aster');
    expect(profile.username).toBe('aster');
    expect(profile.displayName).toBe('aster');
    expect(profile.provider).toBe('local');
    expect(profile.rating).toBe(12.5);
    expect(profile.dan).toBeTruthy();
    expect(profile.avatar).toBe('🌟');
    expect(typeof profile.createdAt).toBe('number');
  });

  it('tôn trọng displayName, provider, uid và rating', () => {
    const profile = createPlayerProfile({
      uid: 'firebase-uid',
      username: 'aster',
      displayName: 'Aster The Great',
      provider: 'firebase',
      email: 'aster@example.com',
      rating: 14.2
    });
    expect(profile.uid).toBe('firebase-uid');
    expect(profile.displayName).toBe('Aster The Great');
    expect(profile.provider).toBe('firebase');
    expect(profile.email).toBe('aster@example.com');
    expect(profile.rating).toBe(14.2);
  });
});

describe('translateAuthError', () => {
  it('dịch các mã lỗi Firebase phổ biến', () => {
    expect(translateAuthError('auth/email-already-in-use')).toMatch(/đã tồn tại/);
    expect(translateAuthError('Firebase: Error (auth/wrong-password).')).toMatch(/Mật khẩu không chính xác/);
    expect(translateAuthError('auth/too-many-requests')).toMatch(/Quá nhiều lần thử/);
    expect(translateAuthError('permission-denied')).toMatch(/Firestore/);
  });

  it('giữ thông điệp gốc khi không khớp mã lỗi', () => {
    expect(translateAuthError('Lỗi mạng tạm thời')).toBe('Lỗi mạng tạm thời');
  });

  it('có fallback khi rỗng', () => {
    expect(translateAuthError('')).toMatch(/Lỗi thao tác tài khoản/);
  });
});
