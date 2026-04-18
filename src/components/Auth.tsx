import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, Sparkles, Loader2, ArrowRight, Lock, Mail } from 'lucide-react';

export const Auth: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Thông tin đăng nhập không chính xác hoặc bạn chưa được mời. 🌹");
    } else {
      onLogin();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] sm:min-h-screen flex items-start sm:items-center justify-center bg-[#fffafa] bg-gradient-to-br from-pink-50 via-white to-rose-50 p-3 sm:p-6 relative overflow-y-auto overflow-x-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-pink-100 rounded-full blur-[100px] opacity-40 animate-pulse" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-rose-100 rounded-full blur-[120px] opacity-40 animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
         <Sparkles className="w-12 h-12 text-pink-300 absolute top-1/4 left-1/4 animate-bounce" />
         <Heart className="w-10 h-10 text-rose-300 absolute bottom-1/4 right-1/3 animate-ping" />
      </div>

      <div className="max-w-md w-full relative z-10 py-4 sm:py-0">
        <div className="text-center mb-5 sm:mb-10">
          <div className="inline-flex p-4 sm:p-6 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-pink-200/50 mb-4 sm:mb-8 border border-pink-50 transform hover:scale-110 transition-transform cursor-pointer">
            <Heart className="w-9 h-9 sm:w-12 sm:h-12 text-pink-500 fill-pink-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black italic bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 bg-clip-text text-transparent mb-3 sm:mb-4 tracking-tight">LoveChat</h1>
          <p className="text-gray-400 font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] italic mb-2">Private Experience</p>
          <div className="flex items-center justify-center space-x-2 text-pink-300">
             <span className="h-px w-8 bg-pink-100"></span>
             <Sparkles className="w-4 h-4" />
             <span className="h-px w-8 bg-pink-100"></span>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl p-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl shadow-pink-200/20 border border-white relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent opacity-30"></div>
          
           <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-6 sm:mb-10">
             <Lock className="w-4 h-4 text-pink-400" />
             <h2 className="text-base sm:text-lg font-black text-gray-800 uppercase tracking-[0.16em] sm:tracking-widest italic text-center">Chat with your love</h2>
          </div>

           <form onSubmit={handleAuth} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-pink-400 uppercase tracking-wider ml-4">Thư tình (Email)</label>
              <div className="relative group">
                <Mail className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-300 group-focus-within:text-pink-400 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-5 sm:pr-8 py-4 sm:py-5 bg-gray-50/50 border-2 border-transparent focus:border-pink-200 focus:bg-white rounded-2xl sm:rounded-3xl outline-none transition-all font-medium text-sm sm:text-base text-gray-700 placeholder:text-gray-300"
                  placeholder="name@love.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-pink-400 uppercase tracking-wider ml-4">Mật mã yêu thương</label>
              <div className="relative group">
                <Lock className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-300 group-focus-within:text-pink-400 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-5 sm:pr-8 py-4 sm:py-5 bg-gray-50/50 border-2 border-transparent focus:border-pink-200 focus:bg-white rounded-2xl sm:rounded-3xl outline-none transition-all font-medium text-sm sm:text-base text-gray-700"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 text-rose-500 text-xs font-bold rounded-2xl flex items-center animate-in fade-in slide-in-from-top-2">
                <div className="w-2 h-2 bg-rose-500 rounded-full mr-3 animate-pulse" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 sm:py-5 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black rounded-[1.25rem] sm:rounded-[2rem] shadow-xl shadow-pink-200 hover:shadow-pink-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center group/btn disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-[0.16em] sm:tracking-[0.2em] italic mr-2 text-xs sm:text-sm">Vào ngay ❤❤</span>
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 sm:mt-10 pt-6 sm:pt-10 border-t border-gray-50 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
              Ứng dụng này đã được khóa. <br /> 
              Chỉ dành cho <span className="text-pink-400">Người đặc biệt</span> đã được mời. 🌹
            </p>
          </div>
        </div>
        
        <div className="mt-5 sm:mt-8 text-center text-pink-200">
           <Heart className="w-4 h-4 fill-pink-200 mx-auto" />
           <p className="text-[9px] font-black uppercase tracking-[0.5em] mt-3 italic">Mãi mãi là của nhau</p>
        </div>
      </div>
    </div>
  );
};
