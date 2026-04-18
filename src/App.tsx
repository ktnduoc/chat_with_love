import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import type { Profile } from './types';
import { ChatBox } from './components/ChatBox';
import { Auth } from './components/Auth';
import { useChat } from './hooks/useChat';
import { LogOut, Loader2, Sparkles, Heart as HeartIcon, Edit2, Eye, EyeOff, Moon, Sun, X, ImagePlus } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { LoveEffects } from './components/LoveEffects';
import { MouseTrail } from './components/MouseTrail';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [effectType, setEffectType] = useState<'none' | 'hearts' | 'bubbles' | 'kiss'>('none');
  const [effectTrigger, setEffectTrigger] = useState(0);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [showAvatarSourceModal, setShowAvatarSourceModal] = useState(false);
  const [avatarLinkInput, setAvatarLinkInput] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const kissAudioRef = useRef<HTMLAudioElement>(null);
  const magicChannelRef = useRef<any>(null);
  
  const [themeIndex, setThemeIndex] = useState(0);

  const themes = [
    { name: 'Rose', header: 'from-rose-500/25 to-pink-500/25', sidebar: 'from-rose-500/25 to-pink-500/25', chat: 'bg-rose-100/70 dark:bg-rose-950/45', accent: 'text-rose-500', glow: 'bg-rose-400/35', pattern: 'hearts' },
    { name: 'Lavender', header: 'from-purple-500/25 to-indigo-500/25', sidebar: 'from-purple-500/25 to-indigo-500/25', chat: 'bg-purple-100/70 dark:bg-purple-950/45', accent: 'text-purple-500', glow: 'bg-purple-400/35', pattern: 'stars' },
    { name: 'Aurora', header: 'from-emerald-400/25 to-cyan-500/25', sidebar: 'from-emerald-400/25 to-cyan-500/25', chat: 'bg-emerald-100/70 dark:bg-emerald-950/45', accent: 'text-emerald-500', glow: 'bg-emerald-400/35', pattern: 'clouds' },
    { name: 'Sunset', header: 'from-orange-500/25 to-rose-600/25', sidebar: 'from-orange-500/25 to-rose-600/25', chat: 'bg-orange-100/70 dark:bg-orange-950/45', accent: 'text-orange-500', glow: 'bg-orange-400/35', pattern: 'bubbles' },
    { name: 'Midnight', header: 'from-slate-800/65 to-slate-900/65', sidebar: 'from-slate-800/65 to-slate-900/65', chat: 'bg-slate-900/95 dark:bg-slate-950', accent: 'text-amber-400', glow: 'bg-amber-400/25', pattern: 'diamonds' },
    { name: 'Ocean', header: 'from-blue-600/25 to-cyan-400/25', sidebar: 'from-blue-600/25 to-cyan-400/25', chat: 'bg-blue-100/70 dark:bg-blue-950/45', accent: 'text-blue-500', glow: 'bg-blue-400/35', pattern: 'waves' },
    { name: 'Cherry', header: 'from-pink-600/25 to-rose-400/25', sidebar: 'from-pink-600/25 to-rose-400/25', chat: 'bg-pink-100/70 dark:bg-pink-950/50', accent: 'text-pink-500', glow: 'bg-pink-400/35', pattern: 'sakura' },
    { name: 'Forest', header: 'from-green-600/25 to-emerald-400/25', sidebar: 'from-green-600/25 to-emerald-400/25', chat: 'bg-green-100/70 dark:bg-green-950/45', accent: 'text-green-500', glow: 'bg-green-400/35', pattern: 'leaves' },
    { name: 'Gold', header: 'from-yellow-400/25 to-amber-600/25', sidebar: 'from-yellow-400/25 to-amber-600/25', chat: 'bg-amber-100/70 dark:bg-stone-900/55', accent: 'text-amber-500', glow: 'bg-amber-400/35', pattern: 'geometry' },
    { name: 'Space', header: 'from-indigo-900/70 to-purple-900/70', sidebar: 'from-indigo-900/70 to-purple-900/70', chat: 'bg-black/95 dark:bg-black', accent: 'text-purple-400', glow: 'bg-indigo-500/35', pattern: 'stars' },
  ];

  const currentTheme = themes[themeIndex];
  
  const cycleTheme = (newIndex?: number, isBroadcast = false) => {
    const nextIndex = newIndex !== undefined ? newIndex : (themeIndex + 1) % themes.length;
    console.log(`🎨 [Universe] Shifting to theme index: ${nextIndex}...`);
    setThemeIndex(nextIndex);
    
    // Only broadcast if the channel is actually joined
    if (!isBroadcast && magicChannelRef.current && (magicChannelRef.current as any).state === 'joined') {
      magicChannelRef.current.send({
        type: 'broadcast',
        event: 'THEME_CHANGE',
        payload: { index: nextIndex }
      });
    }
  };

  const updateCustomBg = (url: string | null, isBroadcast = false) => {
    console.log('🖼️ [Universe] Custom background updated!');
    if (url) localStorage.setItem('love_chat_custom_bg', url);
    else localStorage.removeItem('love_chat_custom_bg');

    if (!isBroadcast && magicChannelRef.current && (magicChannelRef.current as any).state === 'joined') {
        magicChannelRef.current.send({
          type: 'broadcast',
          event: 'CUSTOM_BG_CHANGE',
          payload: { url }
        });
    }
  };

  const [bgOpacity, setBgOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('love_chat_bg_opacity');
    return saved ? parseFloat(saved) : 0.4;
  });
  const [bgBlur, setBgBlur] = useState<number>(() => {
    const saved = localStorage.getItem('love_chat_bg_blur');
    return saved ? parseInt(saved) : 12;
  });

  const updateBgStyle = (opacity: number, blur: number, isBroadcast = false) => {
    console.log(`📡 [Universe] Applying Style: Opacity ${opacity}, Blur ${blur} (Broadcast: ${isBroadcast})`);
    setBgOpacity(opacity);
    setBgBlur(blur);
    localStorage.setItem('love_chat_bg_opacity', opacity.toString());
    localStorage.setItem('love_chat_bg_blur', blur.toString());
    
    if (!isBroadcast && magicChannelRef.current) {
      const state = (magicChannelRef.current as any).state;
      if (state === 'joined') {
        magicChannelRef.current.send({
          type: 'broadcast',
          event: 'BG_STYLE_CHANGE',
          payload: { opacity, blur }
        });
        console.log('🚀 [Realtime] Atmospheric style broadcasted!');
      } else {
        console.warn('⚠️ [Realtime] Channel not ready, style update only local. Status:', state);
      }
    }
  };

  const [customBg, setAppCustomBg] = useState<string | null>(localStorage.getItem('love_chat_custom_bg'));

  const [isFocusedMode, setIsFocusedMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleFocusedMode = () => {
    setIsFocusedMode(prev => !prev);
  };

  useEffect(() => {
    const channel = supabase.channel('magic-interactions')
      .on('broadcast', { event: 'THEME_CHANGE' }, ({ payload }) => {
        console.log('📡 [Realtime] Theme shift received!', payload.index);
        cycleTheme(payload.index, true);
      })
      .on('broadcast', { event: 'CUSTOM_BG_CHANGE' }, ({ payload }) => {
        console.log('📡 [Realtime] Custom BG received!', payload.url);
        setAppCustomBg(payload.url);
        if (payload.url) localStorage.setItem('love_chat_custom_bg', payload.url);
        else localStorage.removeItem('love_chat_custom_bg');
      })
      .on('broadcast', { event: 'BG_STYLE_CHANGE' }, ({ payload }) => {
        console.log('📡 [Realtime] Style update received!', payload.opacity, payload.blur);
        // Direct call to state setter to avoid re-broadcasting
        setBgOpacity(payload.opacity);
        setBgBlur(payload.blur);
        localStorage.setItem('love_chat_bg_opacity', payload.opacity.toString());
        localStorage.setItem('love_chat_bg_blur', payload.blur.toString());
      })
      .subscribe((status) => {
        console.log('🛰️ [Universe] Interaction channel status:', status);
      });
      
    magicChannelRef.current = channel;
    return () => { 
        console.log('🛑 [Universe] Closing interaction channel...');
        supabase.removeChannel(channel); 
    };
  }, []);

  const { onlineUsers, typingUsers, updateProfile, uploadImage } = useChat(currentUser?.id || '', undefined, true);

  useEffect(() => {
    // Initial theme setup
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      setProfiles(data);
      if (session) {
        const me = data.find(p => p.id === session.user.id);
        if (me) {
          setCurrentUser(me);
          if (!isEditingName) setTempName(me.username);
          const partner = data.find(p => p.id !== session.user.id);
          if (partner) setSelectedUser(partner);
        }
      }
    }
  };

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      setProfiles([]);
      return;
    }
    fetchData();
    const channel = supabase.channel('profile-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSelectedUser(null);
    setCurrentUser(null);
  };

  const handleAvatarClick = () => setShowAvatarSourceModal(true);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Close source modal right after user picks a file.
    setShowAvatarSourceModal(false);
    setIsUpdatingAvatar(true);

    const url = await uploadImage(file);
    if (url) await updateProfile({ avatar_url: url });

    setIsUpdatingAvatar(false);
    e.currentTarget.value = '';
  };

  const handleStartEditingName = () => {
    setTempName(currentUser?.username || '');
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleSaveName = async () => {
    if (tempName.trim() && tempName !== currentUser?.username) {
      await updateProfile({ username: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const nameInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') setIsEditingName(false);
  };

  const isUserOnline = (userId: string) => !!onlineUsers[userId];

  if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 dark:from-slate-900 dark:to-slate-950"><Loader2 className="w-12 h-12 text-pink-500 animate-spin" /></div>;
  if (!session) return <Auth onLogin={() => {}} />;
  if (!currentUser) return null;

  const partner = profiles.find(p => p.id !== currentUser.id);

  const handlePartnerCardClick = () => {
    cycleTheme();
    if (window.innerWidth < 768) {
      setIsMobileSidebarOpen(false);
    }
  };

  return (
    <>
      <audio ref={kissAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" />
      
      {/* === GLOBAL BACKGROUND LAYER - Covers 100% screen including footer === */}
      {customBg && (
        <div className="fixed inset-0 z-0 transition-all duration-1000">
          <img 
            src={customBg} 
            className="w-full h-full object-cover" 
            style={{ opacity: Math.max(0, 1 - (bgOpacity ?? 0.4)) }} 
            alt="Background" 
          />
          <div 
            className="absolute inset-0" 
            style={{ 
              backdropFilter: `blur(${bgBlur}px)`, 
              backgroundColor: `rgba(0,0,0,${bgOpacity})` 
            }} 
          />
        </div>
      )}

      <div className={cn(
        "flex w-full h-[100dvh] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-500 relative z-10",
        (customBg || isFocusedMode) ? "bg-transparent" : "bg-[var(--bg-main)]"
      )}>
        {isMobileSidebarOpen && !isFocusedMode && (
          <button
            type="button"
            aria-label="Đóng sidebar"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-[1300] bg-black/40 backdrop-blur-[1px] md:hidden"
          />
        )}

        {/* Sidebar - Animated Disappearance */}
        <div className={cn(
          "fixed md:relative inset-y-0 left-0 w-full lg:w-96 lg:max-w-[420px] flex-shrink-0 bg-[var(--bg-sidebar)] backdrop-blur-2xl border-r border-pink-100 dark:border-slate-800 flex flex-col shadow-2xl z-[1400] transition-all duration-700 overflow-hidden",
          isFocusedMode
            ? "-translate-x-full opacity-0 md:w-0 md:border-none"
            : (isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        )}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-10 pb-6">
            <div className="flex items-center space-x-4 text-rose-500 dark:text-rose-400 -ml-2">
                <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-pink-200 dark:shadow-rose-900/40 transition-transform hover:rotate-12">
                  <HeartIcon className="text-white w-5 h-5 fill-white" />
                </div>
                <h2 className="text-2xl font-black italic tracking-tight">LoveChat</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="lg:hidden p-2.5 bg-[var(--bg-card)] text-rose-500 border border-gray-100 dark:border-slate-700 rounded-none shadow-sm transition-all hover:scale-110 active:scale-90"
                  aria-label="Đóng bảng thông tin"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={toggleDarkMode}
                  className="p-2.5 bg-[var(--bg-card)] text-rose-500 border border-gray-100 dark:border-slate-700 rounded-none shadow-sm transition-all hover:scale-110 active:scale-90"
                  aria-label="Toggle Dark Mode"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsPrivateMode(!isPrivateMode)}
                  className={cn(
                    "p-2.5 rounded-none transition-all hover:scale-110",
                    isPrivateMode ? "bg-slate-800 text-white shadow-lg" : "bg-[var(--bg-card)] text-rose-500 border border-gray-100 dark:border-slate-700 shadow-sm"
                  )}
                >
                  {isPrivateMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={handleLogout} className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 rounded-none hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all hover:rotate-12">
                   <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* MY ACCOUNT CARD - FULL WIDTH */}
            <div className="w-full mb-8">
               <div className="relative group p-10 bg-gradient-to-br from-pink-500 to-rose-600 dark:from-rose-600 dark:to-rose-800 rounded-none shadow-xl overflow-hidden border-y border-white/20">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-16 h-16 text-white" /></div>
                  <div className="flex items-center space-x-4 relative z-10">
                    <div onClick={handleAvatarClick} className="relative cursor-pointer group/avatar">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black overflow-hidden border-2 border-white/30 shadow-2xl transition-transform group-hover/avatar:scale-105">
                        {isUpdatingAvatar ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (currentUser.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover" /> : <span className="text-xl">{currentUser.username.substring(0, 2).toUpperCase()}</span>)}
                      </div>
                      <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                       {isEditingName ? (
                         <input 
                           ref={nameInputRef}
                           type="text" 
                           value={tempName} 
                           onChange={(e) => setTempName(e.target.value)}
                           onBlur={handleSaveName}
                           onKeyDown={nameInputKeyDown}
                           className="w-full bg-white/20 border-b-2 border-white text-white font-black outline-none py-1 placeholder:text-white/50"
                           placeholder="Nhập tên..."
                         />
                       ) : (
                         <h3 onClick={handleStartEditingName} className="text-lg font-black text-white truncate cursor-pointer flex items-center">
                           {currentUser.username}<Edit2 className="w-3 h-3 ml-2 opacity-60" />
                         </h3>
                       )}
                    </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 flex flex-col">
              <h4 className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] flex items-center justify-center px-10 mb-6">
                 <HeartIcon className="w-3 h-3 mr-2 fill-rose-600 dark:fill-rose-400" /> Một nửa của tôi
              </h4>
              
              {partner ? (
                <div 
                  onClick={handlePartnerCardClick}
                  onDoubleClick={() => {
                    console.log('💋 [Interaction] Sidebar Double-tap! Sending kiss through the heart...');
                    setEffectType('kiss');
                    setEffectTrigger(prev => prev + 1);
                    setTimeout(() => setEffectType('none'), 3000);
                  }}
                  className={cn(
                    "flex-1 w-full flex flex-col items-center justify-center p-12 py-14 rounded-none transition-all duration-1000 relative group border-t cursor-pointer active:scale-[0.99] overflow-hidden bg-gradient-to-b from-pink-100/90 via-rose-200/60 to-pink-200/90 dark:from-pink-900/30 dark:via-rose-950/40 dark:to-slate-900/60 backdrop-blur-3xl",
                    selectedUser?.id === partner.id ? "border-rose-400/20 dark:border-rose-500/10" : "border-transparent text-gray-400"
                  )}
                >
                  {/* Floating Ethereal SVG Hearts Animation */}
                  <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
                    {[...Array(10)].map((_, i) => (
                      <div 
                        key={i}
                        className="absolute bottom-[-50px] animate-float-up"
                        style={{
                          left: `${Math.random() * 100}%`,
                          animationDuration: `${Math.random() * 6 + 4}s`,
                          animationDelay: `${Math.random() * 5}s`,
                          transform: `scale(${Math.random() * 1 + 0.5})`
                        }}
                      >
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.372 0 2.615.553 3.52 1.448l.98.966.98-.966c.905-.895 2.148-1.448 3.52-1.448 2.786 0 5.25 2.322 5.25 5.25 0 3.924-2.438 7.11-4.74 9.259a25.181 25.181 0 01-4.244 3.17 15.116 15.116 0 01-.383.219l-.022.012-.007.004-.003.001z" fill="url(#heart-grad)" />
                            <defs>
                               <linearGradient id="heart-grad" x1="2.25" y1="3" x2="21.75" y2="20.91" gradientUnits="userSpaceOnUse">
                                  <stop stopColor="#fb7185" />
                                  <stop offset="1" stopColor="#e11d48" />
                               </linearGradient>
                            </defs>
                         </svg>
                      </div>
                    ))}
                  </div>

                  <div className="relative mb-10 z-10">
                    <div className={cn("w-40 h-40 rounded-full bg-gradient-to-tr from-pink-100 to-rose-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-pink-500 font-black overflow-hidden border-8 border-white dark:border-slate-900 shadow-2xl transition-all duration-1000 group-hover:scale-105", isPrivateMode && "blur-2xl grayscale")}>
                      {partner.avatar_url ? <img src={partner.avatar_url} className="w-full h-full object-cover" /> : <span className="text-5xl">{partner.username.substring(0, 2).toUpperCase()}</span>}
                    </div>
                    {isUserOnline(partner.id) && (
                      <div className="absolute bottom-2 right-4 w-10 h-10 bg-green-500 border-4 border-white dark:border-slate-900 rounded-full shadow-lg animate-pulse" />
                    )}
                  </div>
                  <div className="text-center w-full relative z-10">
                    <h4 className={cn("font-black transition-all duration-700 text-3xl truncate text-[var(--text-main)]", isPrivateMode && "blur-[12px]")}>
                      {isPrivateMode ? "Secret Love" : partner.username}
                    </h4>
                    <p className="text-[10px] font-black text-rose-500 dark:text-rose-500 mt-4 uppercase tracking-[0.3em] opacity-60">
                      Chạm hai lần để hôn 💋
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-10 border-2 border-dashed border-pink-100 dark:border-slate-800 rounded-none text-center m-6">
                   <p className="text-[10px] font-black text-rose-500 dark:text-rose-600 uppercase tracking-widest leading-relaxed">Đang chờ sự hiện diện của người thương...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area - Absolute Transparency Layer */}
        <div className={cn(
          "flex-1 flex flex-col relative text-gray-900 dark:text-gray-100 overflow-hidden",
          isFocusedMode ? "immersion-clear-ui" : "shadow-none border-none"
        )}>
          {selectedUser ? (
            <div className={cn("flex-1 flex flex-col overflow-hidden", isFocusedMode ? "immersion-clear-ui" : "bg-transparent")}>
              <ChatBox 
                key={selectedUser.id} 
                currentUser={currentUser} 
                receiver={selectedUser} 
                isOnline={isUserOnline(selectedUser.id)} 
                isDarkMode={isDarkMode}
                onOpenInfoPanel={() => {
                  if (!isFocusedMode) setIsMobileSidebarOpen(true);
                }}
                typingUsers={typingUsers}
                effectType={effectType} 
                theme={currentTheme || themes[0]}
                onThemeCycle={() => cycleTheme()}
                customBg={customBg}
                onCustomBgChange={(url) => {
                  setAppCustomBg(url);
                  updateCustomBg(url);
                }}
                bgOpacity={bgOpacity}
                bgBlur={bgBlur}
                onBgStyleChange={updateBgStyle}
                onForceSync={() => {
                  console.log('🔄 [Force Sync] Sending full atmospheric state to partner...');
                  if (magicChannelRef.current && (magicChannelRef.current as any).state === 'joined') {
                    magicChannelRef.current.send({
                      type: 'broadcast',
                      event: 'THEME_CHANGE',
                      payload: { index: themeIndex }
                    });
                    magicChannelRef.current.send({
                      type: 'broadcast',
                      event: 'CUSTOM_BG_CHANGE',
                      payload: { url: customBg }
                    });
                    magicChannelRef.current.send({
                      type: 'broadcast',
                      event: 'BG_STYLE_CHANGE',
                      payload: { opacity: bgOpacity, blur: bgBlur }
                    });
                  }
                }}
                isFocusedMode={isFocusedMode}
                onToggleFocus={toggleFocusedMode}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-transparent">
               <HeartIcon className="w-20 h-20 text-pink-200 dark:text-slate-800 animate-pulse" />
            </div>
          )}
        </div>
      </div>
      <LoveEffects type={effectType} trigger={effectTrigger} />
      <MouseTrail />

      {/* Avatar Source Selection Modal - ROMANTIC GLASS */}
      {showAvatarSourceModal && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
          <div className="bg-gradient-to-br from-pink-500/20 to-rose-600/20 backdrop-blur-3xl border border-white/20 w-full max-w-sm rounded-none sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/10 flex items-center justify-between text-white">
                 <div>
                    <h2 className="text-lg sm:text-xl font-black">Diện mạo mới 🌹</h2>
                    <p className="text-[9px] sm:text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Chọn nguồn ảnh đại diện của bạn</p>
                 </div>
                 <button onClick={() => setShowAvatarSourceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 group"><X className="w-6 h-6 group-hover:rotate-90 transition-transform" /></button>
              </div>

              <div className="p-8 space-y-6">
                 <button 
                   onClick={() => {
                     setShowAvatarSourceModal(false);
                     avatarInputRef.current?.click();
                   }}
                   className="w-full h-20 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl flex items-center px-6 space-x-5 transition-all group"
                 >
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg">
                       <ImagePlus className="w-6 h-6" />
                    </div>
                    <div className="text-left text-white">
                        <p className="font-black text-xs sm:text-sm">Tải lên kỷ niệm</p>
                       <p className="text-white/40 text-[10px] font-medium">Bản sắc cá nhân</p>
                    </div>
                 </button>

                 <div className="space-y-4">
                    <div className="flex items-center space-x-3 px-2">
                       <div className="h-px flex-1 bg-white/10"></div>
                       <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Hoặc dùng Link</span>
                       <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-3xl group-within:border-white/40 transition-colors">
                       <input 
                         type="text" 
                         value={avatarLinkInput}
                         onChange={(e) => setAvatarLinkInput(e.target.value)}
                         placeholder="Dán link ảnh đại diện..." 
                         className="flex-1 bg-transparent border-none text-white text-xs px-4 outline-none font-medium placeholder:text-white/20"
                       />
                       <button 
                         onClick={async () => {
                            if (avatarLinkInput.startsWith('http')) {
                               setIsUpdatingAvatar(true);
                               console.log('🌹 [Avatar] Updating via link:', avatarLinkInput);
                               const { error } = await supabase
                                 .from('profiles')
                                 .update({ avatar_url: avatarLinkInput })
                                 .eq('id', currentUser?.id);
                               
                               if (!error) {
                                 setAvatarLinkInput('');
                                 setShowAvatarSourceModal(false);
                                 setTimeout(() => window.location.reload(), 500); 
                               }
                               setIsUpdatingAvatar(false);
                            }
                         }}
                         className="bg-white text-rose-600 px-5 py-3 rounded-2xl font-black text-[10px] shadow-lg hover:scale-105 active:scale-95 transition-all"
                       >Áp dụng</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default App;
