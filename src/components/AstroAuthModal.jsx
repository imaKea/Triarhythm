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

  const inputClass = "w-full px-4 py-2.5 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] text-[#5b2a47] placeholder-[#a8556f] focus:border-[#ff4d80] focus:shadow-[0_2px_12px_rgba(255,77,128,0.2)] focus:outline-none transition-all text-sm font-bold";

  return (
    <div className="fixed inset-0 z-50 bg-[#5b2a47]/30 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="w-full max-w-sm bg-white/95 rounded-3xl border border-[#f3dbe4] p-6 shadow-[0_20px_60px_rgba(126,47,79,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffaec9] via-[#ff85a2] to-[#ff4d80] flex items-center justify-center shadow-[0_2px_12px_rgba(255,133,162,0.4)] text-base select-none">
              🐰
            </div>
            <div>
              <h3 className="font-bold text-base text-[#5b2a47] flex items-center gap-1.5 font-torus">
                <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                <span>🎀</span>
              </h3>
              <p className="text-[10px] text-[#ff4d80] font-bold">Sync scores & leaderboards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white hover:bg-[#fff0f4] text-[#a8556f] hover:text-[#ff4d80] flex items-center justify-center text-xs transition-colors cursor-pointer border border-[#f3dbe4] shadow-sm"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-2xl bg-[#ffeef2] border border-[#f5b8c7] text-[#e94267] text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username or email"
            className={inputClass}
          />

          {isRegister && (
            <>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className={inputClass}
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name (Nickname)"
                className={inputClass}
              />
            </>
          )}

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-1 rounded-full osu-btn text-sm font-black tracking-wide cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-[0_4px_18px_rgba(255,77,128,0.3)]"
          >
            <span>🐰</span>
            <span>{loading ? 'Connecting...' : (isRegister ? 'Create Account 🎀' : 'Sign In 🎀')}</span>
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[#a8556f] font-medium">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setErrorMsg(''); }}
                className="text-[#ff4d80] hover:underline font-bold ml-1 cursor-pointer"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setErrorMsg(''); }}
                className="text-[#ff4d80] hover:underline font-bold ml-1 cursor-pointer"
              >
                Register now
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
