import React, { useState } from 'react';
import { apiClient } from '../core/api/client.js';

export default function AstroAuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        const userEmail = email.trim() || `${username.trim()}@triarhythm.local`;
        const res = await apiClient.register({
          username: username.trim(),
          email: userEmail,
          password,
          name: displayName.trim() || username.trim(),
        });
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      } else {
        const res = await apiClient.login({
          login: username.trim(),
          password,
        });
        if (onLoginSuccess) onLoginSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-2xl bg-[#28152e] border border-[#ff85a2]/25 text-white placeholder-[#b89cb9] focus:border-[#ff85a2] focus:shadow-[0_0_12px_rgba(255,133,162,0.3)] focus:outline-none transition-all text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-[#140b17]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="w-full max-w-sm bg-[#1f1126] rounded-3xl border border-[#ff85a2]/30 p-6 shadow-[0_20px_50px_rgba(16,8,20,0.85),0_0_25px_rgba(255,133,162,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffaec9] via-[#ff85a2] to-[#ff4d80] flex items-center justify-center shadow-[0_0_14px_rgba(255,133,162,0.5)] text-base select-none">
              🐰
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-1.5 font-torus">
                <span>{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
                <span>🎀</span>
              </h3>
              <p className="text-[10px] text-[#ffaec9]">Đồng bộ điểm số & bảng xếp hạng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[#ffaec9] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer border border-[#ff85a2]/20"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tên người dùng hoặc email"
            className={inputClass}
          />

          {isRegister && (
            <>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Địa chỉ email"
                className={inputClass}
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tên hiển thị (Nickname)"
                className={inputClass}
              />
            </>
          )}

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-1 rounded-full osu-btn text-sm font-black tracking-wide cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-[0_4px_18px_rgba(255,133,162,0.4)]"
          >
            <span>🐰</span>
            <span>{loading ? 'Đang kết nối...' : (isRegister ? 'Tạo tài khoản 🎀' : 'Đăng nhập 🎀')}</span>
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[#b89cb9]">
          {isRegister ? (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setErrorMsg(''); }}
                className="text-[#ffaec9] hover:text-white font-bold underline ml-1 cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </span>
          ) : (
            <span>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setErrorMsg(''); }}
                className="text-[#ffaec9] hover:text-white font-bold underline ml-1 cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
