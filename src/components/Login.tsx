import React, { useState } from 'react';
import { useERPStore } from '../store';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const login = useERPStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setError('');
    setLoading(true);
    
    try {
      const result = await login(email, password, rememberMe);
      if (!result.success) {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection to security server failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900 via-slate-900 to-black p-4 relative overflow-hidden font-sans">
      {/* Abstract premium glowing lights in background */}
      <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-fade-in">
        {/* Visual Brand Header */}
        <div className="p-8 text-center border-b border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-900/0">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-3 shadow-lg shadow-teal-500/20 mb-4 animate-bounce-slow">
            <ShieldCheck className="text-slate-950 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{import.meta.env.VITE_APP_NAME || 'Qvoke'}</h1>
          <p className="text-teal-400 text-xs font-extrabold uppercase tracking-widest mt-1">{import.meta.env.VITE_APP_TAGLINE || 'Enterprise ERP Portal / بوابة النظام'}</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl text-xs flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="text-left">
                <span className="font-bold block">Security Exception</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2 text-left">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
              Corporate Email / البريد الإلكتروني
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white text-sm placeholder-slate-600 outline-none transition-all"
                placeholder="name@ajnetwork.sa"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2 text-left">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
              Secret Password / كلمة المرور
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-white text-sm placeholder-slate-600 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 text-teal-500 focus:ring-0 focus:ring-offset-0 bg-slate-950/50"
              />
              <span>Keep session active / تذكرني</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 active:scale-[0.99] focus:outline-none disabled:opacity-50 disabled:active:scale-100 transition-all cursor-pointer shadow-lg shadow-teal-500/10"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Authorizing Portal...</span>
              </>
            ) : (
              <span>Authorize Login / تسجيل الدخول</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
