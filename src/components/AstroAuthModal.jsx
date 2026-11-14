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

  const inputClass = "w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#6b7280] focus:border-[#ff66ab]/50 focus:outline-none transition-colors text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="w-full max-w-sm bg-[#111122] rounded-2xl border border-white/[0.06] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff66ab] to-[#cc5289] flex items-center justify-center shadow-[0_0_12px_rgba(255,102,171,0.4)]">
              <span className="text-white font-black text-xs">▲</span>
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isRegister ? 'Create Account' : 'Sign In'}
              </h3>
              <p className="text-[10px] text-[#6b7280]">Sync scores & leaderboards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#6b7280] hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#ef5350]/10 border border-[#ef5350]/30 text-[#ef5350] text-xs">
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
                placeholder="Display name"
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
            className="w-full py-2.5 mt-1 rounded-full osu-btn text-sm font-bold tracking-wide cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Connecting...' : (isRegister ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[#6b7280]">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setErrorMsg(''); }}
                className="text-[#ff66ab] hover:underline font-bold cursor-pointer"
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
                className="text-[#ff66ab] hover:underline font-bold cursor-pointer"
              >
                Sign Up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
