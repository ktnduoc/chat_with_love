import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Smile, MoreVertical, Download, Sparkles, Heart as HeartIcon, Plus, X, Check, Loader2, ArrowDown, ImagePlus, Settings, RefreshCw, Minimize2, Link2, Search, ChevronDown } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { Message, Profile, Sticker } from '../types';
import { useChat } from '../hooks/useChat';
import { FlyingMessage } from './FlyingMessage';
import { StickerExplosion } from './StickerExplosion';
import { SparklingDust } from './SparklingDust';
import { Confetti } from './Confetti';
import { HeartPop } from './HeartPop';
import { HeartExplosion } from './HeartExplosion';
import { ScratchToReveal } from './ScratchToReveal';
import { supabase } from '../lib/supabase';
import twemoji from 'twemoji';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function renderTwemoji(text: string) {
  return twemoji.parse(text, {
    folder: 'svg',
    ext: '.svg'
  });
}

const SmartImage: React.FC<{ src: string; className?: string; alt?: string }> = ({ src, className, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div className={cn("relative transition-all duration-700 flex items-center justify-center", !isLoaded && "bg-pink-50/10 animate-pulse rounded-none min-h-[160px] min-w-[160px]", className)}>
       {!isLoaded && (
         <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-pink-200 animate-spin" />
         </div>
       )}
       <img 
         src={src} 
         alt={alt} 
         onLoad={() => setIsLoaded(true)} 
         className={cn(
           "max-w-full max-h-[160px] object-contain transition-all duration-700 select-none pointer-events-none", 
           isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
         )} 
       />
    </div>
  );
};

interface ChatBoxProps {
  currentUser: Profile;
  receiver: Profile;
  isOnline: boolean;
  isDarkMode?: boolean;
  onOpenInfoPanel?: () => void;
  typingUsers: Record<string, boolean>;
  onMessageSent?: () => void;
  effectType?: 'none' | 'hearts' | 'bubbles' | 'kiss';
  theme?: any;
  onThemeCycle?: () => void;
  customBg?: string | null;
  onCustomBgChange?: (url: string | null) => void;
  bgOpacity?: number;
  bgBlur?: number;
  onBgStyleChange?: (opacity: number, blur: number) => void;
  onForceSync?: () => void;
  isFocusedMode?: boolean;
  onToggleFocus?: () => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ 
  currentUser, 
  receiver, 
  isOnline, 
  isDarkMode = false,
  onOpenInfoPanel,
  typingUsers, 
  theme,
  onThemeCycle,
  customBg,
  onCustomBgChange,
  bgOpacity = 0.4,
  bgBlur = 12,
  onBgStyleChange,
  onForceSync,
  isFocusedMode = false,
  onToggleFocus
}) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [delayedLastReadId, setDelayedLastReadId] = useState<string | number | undefined>(undefined);
  const [activeExplosions, setActiveExplosions] = useState<Record<string, string>>({});
  const [showWelcomeFireworks, setShowWelcomeFireworks] = useState(false);
  const [pops, setPops] = useState<{id: number, x: number; y: number}[]>([]);
  const [heartExplosions, setHeartExplosions] = useState<{id: number, x: number; y: number}[]>([]);
  const [viewingSticker, setViewingSticker] = useState<string | null>(null);
  const [showStickerRibbon, setShowStickerRibbon] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isBgUpload, setIsBgUpload] = useState(false);
  const [showSpaceSettings, setShowSpaceSettings] = useState(false);
  const [showBgSourceModal, setShowBgSourceModal] = useState(false);
  const [bgLinkInput, setBgLinkInput] = useState('');
  const [showMemorySidebar, setShowMemorySidebar] = useState(false);
  const [memoryTab, setMemoryTab] = useState<'media' | 'links' | 'search'>('media');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [showSendActions, setShowSendActions] = useState(false);
  const [showHeaderActions, setShowHeaderActions] = useState(false);
  const [openingHeartMessage, setOpeningHeartMessage] = useState<Message | null>(null);
  const [openedHeartIds, setOpenedHeartIds] = useState<Set<string | number>>(new Set());
  const [isScratchComplete, setIsScratchComplete] = useState(false);
  const [isRetiringHeart, setIsRetiringHeart] = useState(false);
  const [sendButtonCoords, setSendButtonCoords] = useState<{ x: string; y: string }>({ x: '80%', y: '80%' });
  const [renderWindowEnd, setRenderWindowEnd] = useState(0);
  const typingTimeoutRef = useRef<number | undefined>(undefined);

  const { messages, setMessages, hasMore, sendMessage, openMessage, uploadImage, saveAsSticker, loadMore, setTypingStatus } = useChat(currentUser.id, receiver.id, false);

  // Sync openedHeartIds with coming updates from the other person (MANDATORY: MUST BE AFTER messages IS DEFINED)
  useEffect(() => {
    const newlyOpened = messages.filter(m => m.is_opened && !openedHeartIds.has(m.id));
    if (newlyOpened.length > 0) {
      setOpenedHeartIds(prev => {
        const next = new Set(prev);
        newlyOpened.forEach(m => next.add(m.id));
        return next;
      });
    }
  }, [messages]);


  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Handle layout preservation when loading older messages (Scroll Anchoring)
  const prevScrollHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const isLoadingEarlierRef = useRef<boolean>(false);
  const canTriggerTopLoadRef = useRef<boolean>(true);
  const lastLoadMoreAtRef = useRef<number>(0);
  const prevNormalMessagesLengthRef = useRef<number>(0);
  const isNearBottomRef = useRef<boolean>(true);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    canTriggerTopLoadRef.current = false;
    lastLoadMoreAtRef.current = Date.now();
    setRenderWindowEnd(prev => (prev > 0 ? prev : normalMessages.length));
    
    // 1. Capture current scroll state
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
      prevScrollTopRef.current = scrollRef.current.scrollTop;
      isLoadingEarlierRef.current = true;
    }

    await loadMore();
    setIsLoadingMore(false);
  };

  // 2. After messages update, adjust scroll position to prevent jumping
  useEffect(() => {
    if (isLoadingEarlierRef.current && scrollRef.current) {
      const newHeight = scrollRef.current.scrollHeight;
      const heightDifference = newHeight - prevScrollHeightRef.current;
      
      // Instantly jump to compensate for new content height
      scrollRef.current.scrollTop = prevScrollTopRef.current + heightDifference;
      
      isLoadingEarlierRef.current = false;
      return;
    }
    
    // Auto-scroll-to-bottom logic if NOT loading earlier
    if (!isLoadingEarlierRef.current && scrollRef.current) {
       const scrollContainer = scrollRef.current;
       const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 250;
       const lastMessage = messages[messages.length - 1];
       const isMe = lastMessage?.sender_id === currentUser.id;
       
       if (isNearBottom || isMe) {
         scrollToBottom('smooth');
       }
    }
  }, [messages, currentUser.id]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement>(null);
  const prevIsOnline = useRef<boolean>(isOnline);

  const isOtherTyping = typingUsers[receiver.id];

  const handleBubbleClick = (e: React.MouseEvent) => {
    console.log('✨ [Interaction] Bubble clicked, triggering HeartPop at:', e.clientX, e.clientY);
    const newPop = { id: Date.now(), x: e.clientX, y: e.clientY };
    setPops(prev => [...prev, newPop]);
  };

  const handleDoubleClick = () => {
    console.log('💋 [Interaction] Double tap detected! Sending Kiss effect...');
    sendMessage('', undefined, 'kiss');
  };

  useEffect(() => {
    if (isOnline && !prevIsOnline.current) {
      setShowWelcomeFireworks(true);
      const timer = setTimeout(() => setShowWelcomeFireworks(false), 5000);
      return () => clearTimeout(timer);
    }
    prevIsOnline.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    fetchStickers();
    const channel = supabase.channel('shared-stickers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stickers' }, () => {
        fetchStickers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser.id]);

  const fetchStickers = async () => {
    const { data } = await supabase.from('stickers').select('*').order('created_at', { ascending: false });
    if (data) setStickers(data);
  };

  const markAsRead = async () => {
    if (document.visibilityState !== 'visible') return;
    // ONLY auto-mark regular text messages as read. 
    // Heart messages (gifts) MUST be opened manually by clicking.
    const unreadReceived = messages.filter(m => 
      m.receiver_id === currentUser.id && 
      !m.is_opened && 
      isNoneEffect(m.effect) && 
      !m.id.toString().startsWith('temp-')
    );
    for (const msg of unreadReceived) {
      await openMessage(msg.id);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
       const msgTime = new Date(lastMessage.created_at).getTime();
       const isRecent = Date.now() - msgTime < 3000;
       if (isRecent) {
         notificationAudioRef.current?.play().catch(() => {});
         if (lastMessage.image_url && !lastMessage.id.toString().startsWith('temp-')) {
            setActiveExplosions(prev => ({ ...prev, [lastMessage.id]: lastMessage.image_url! }));
         }
       }
    }
  }, [messages.length]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    
    // CRITICAL: If we are currently anchoring for older messages, 
    // DO NOT allow the "auto-scroll to bottom" logic to run here as it conflicts.
    if (isLoadingEarlierRef.current) {
        return;
    }

    markAsRead();
    
    const realLastReadId = [...messages].reverse().find(m => 
      m.sender_id === currentUser.id && m.is_opened && !m.id.toString().startsWith('temp-')
    )?.id;
    
    if (realLastReadId !== delayedLastReadId) {
      const timer = setTimeout(() => { setDelayedLastReadId(realLastReadId); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [messages, currentUser.id]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 120;
    isNearBottomRef.current = isNearBottom;

    if (isNearBottom && renderWindowEnd !== normalMessages.length) {
      setRenderWindowEnd(normalMessages.length);
    }

    const isFarFromBottom = scrollHeight - scrollTop > clientHeight + 800;
    setShowScrollToBottom(isFarFromBottom);

    // Unlock top-load only after user scrolls away from top a bit.
    if (scrollTop > 120) {
      canTriggerTopLoadRef.current = true;
    }

    const isNearTop = scrollTop <= 20;
    const cooledDown = Date.now() - lastLoadMoreAtRef.current > 400;

    if (isNearTop && hasMore && !isLoadingMore && canTriggerTopLoadRef.current && cooledDown) {
       handleLoadMore();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    
    // Slash Commands Magic
    if (val.toLowerCase() === '/s') {
       console.log('⌨️ [Command] Slash command /s detected! Revealing sticker ribbon...');
       setShowStickerRibbon(true);
       setText(''); // Clear input
       setTypingStatus(false);
       return;
    }

    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
       setTypingStatus(false);
    }, 2000);
  };

  const handleSend = async (sizeOverride?: number) => {
    if (text.trim() || sizeOverride) {
      setTypingStatus(false);
      const effectValue = sizeOverride ? `heart:${sizeOverride}` : 'none';
      await sendMessage(text, undefined, effectValue);
      setText('');
      setShowEmoji(false);
      setShowSendActions(false);
    }
  };

  const handlePreviewFile = (file: File) => {
    if (!file.type.includes('image')) return;
    setPreviewFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowStickers(false);
  };

  const cancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
  };

  const confirmUpload = async (mode: 'send' | 'save') => {
    if (!previewFile) return;
    setIsUploading(true);
    const url = await uploadImage(previewFile);
    if (url) {
      if (isBgUpload && onCustomBgChange) {
         onCustomBgChange(url);
         console.log('🎨 [Universe] New background uploaded and applied directly via broadcast!');
      }
      if (mode === 'send') await sendMessage('', url);
      else await saveAsSticker(url);
    }
    cancelPreview();
    setIsUploading(false);
    setIsBgUpload(false);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePreviewFile(file);
  };

  const getEffectKind = (effect?: string) => (effect || 'none').split(':')[0];
  const isHeartEffect = (effect?: string) => getEffectKind(effect) === 'heart';
  const isNoneEffect = (effect?: string) => getEffectKind(effect) === 'none';

  const seasonalBubbleTheme: Record<string, { me: string; partner: string; focusMe: string; focusPartner: string }> = {
    Rose: {
      me: 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-pink-200/50',
      partner: 'bg-rose-50 text-rose-900 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-pink-500/85 to-rose-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-rose-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Lavender: {
      me: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-200/50',
      partner: 'bg-violet-50 text-violet-900 border border-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-purple-500/85 to-indigo-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-violet-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Aurora: {
      me: 'bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-emerald-200/50',
      partner: 'bg-emerald-50 text-emerald-900 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-emerald-500/85 to-cyan-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-emerald-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Sunset: {
      me: 'bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-orange-200/50',
      partner: 'bg-orange-50 text-orange-900 border border-orange-100 dark:bg-orange-950/40 dark:text-orange-100 dark:border-orange-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-orange-500/85 to-rose-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-orange-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Ocean: {
      me: 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-blue-200/50',
      partner: 'bg-sky-50 text-sky-900 border border-sky-100 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-blue-500/85 to-cyan-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-sky-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Cherry: {
      me: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-fuchsia-200/50',
      partner: 'bg-pink-50 text-pink-900 border border-pink-100 dark:bg-pink-950/40 dark:text-pink-100 dark:border-pink-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-fuchsia-500/85 to-pink-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-pink-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Forest: {
      me: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-200/50',
      partner: 'bg-green-50 text-green-900 border border-green-100 dark:bg-green-950/40 dark:text-green-100 dark:border-green-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-green-500/85 to-emerald-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-green-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Gold: {
      me: 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-amber-200/50',
      partner: 'bg-amber-50 text-amber-900 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900/40 shadow-sm',
      focusMe: 'bg-gradient-to-br from-amber-500/85 to-yellow-600/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-amber-200/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Space: {
      me: 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-indigo-300/40',
      partner: 'bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700 shadow-sm',
      focusMe: 'bg-gradient-to-br from-indigo-600/85 to-purple-700/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-slate-300/20 text-white backdrop-blur-3xl border border-white/15'
    },
    Midnight: {
      me: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-300/30',
      partner: 'bg-slate-100 text-slate-900 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700 shadow-sm',
      focusMe: 'bg-gradient-to-br from-slate-700/85 to-slate-900/85 text-white backdrop-blur-md border border-white/20 shadow-xl',
      focusPartner: 'bg-slate-300/20 text-white backdrop-blur-3xl border border-white/15'
    }
  };

  const bubbleTheme = seasonalBubbleTheme[theme?.name || 'Rose'] || seasonalBubbleTheme.Rose;

  const receivedFlyingMessages = messages
    .filter(m => isHeartEffect(m.effect) && !m.is_opened && !openedHeartIds.has(m.id) && m.receiver_id === currentUser.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((m, index) => {
       const parts = m.effect.split(':');
       return { 
         ...m, 
         font_size: parseFloat(parts[1]) || 1.0, 
         sequence: index + 1 // DYNAMIC: Always re-index based on current unopened list
       };
    });

  const sentFlyingMessages = messages
    .filter(m => isHeartEffect(m.effect) && !m.is_opened && !openedHeartIds.has(m.id) && m.sender_id === currentUser.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((m, index) => {
       const parts = m.effect.split(':');
       return { 
         ...m, 
         font_size: parseFloat(parts[1]) || 1.0, 
         sequence: index + 1 // DYNAMIC: Always re-index based on current unopened list
       };
    });

  const flyingMessages = [...receivedFlyingMessages, ...sentFlyingMessages];

  // SKY STATUS REPORT: Log current flying hearts for debugging (MANDATORY: MUST BE AFTER flyingMessages IS DEFINED)
  useEffect(() => {
    if (flyingMessages.length > 0) {
      console.log('%c🌌 [Sky Status] Update detected!', 'color: #ec4899; font-weight: bold; font-size: 12px;');
      console.log(`- Total: ${flyingMessages.length} hearts flying`);
      
      if (sentFlyingMessages.length > 0) {
        console.log(`- Sent by ME: ${sentFlyingMessages.map(m => `#${m.sequence}`).join(', ')}`);
      }
      
      if (receivedFlyingMessages.length > 0) {
        console.log(`- Received from ${receiver.username}: ${receivedFlyingMessages.map(m => `#${m.sequence}`).join(', ')}`);
      }
      console.log('%c-------------------------', 'color: #f472b6;');
    } else {
      console.log('%c🌌 [Sky Status] All clear! No hearts flying.', 'color: #10b981;');
    }
  }, [flyingMessages.length, receiver.username]);
  
  const normalMessages = messages.filter(m => (m.is_opened || isNoneEffect(m.effect)));
  const firstUnreadId = messages.find(m => m.receiver_id === currentUser.id && !m.is_opened && isNoneEffect(m.effect))?.id;
  const MAX_RENDERED_MESSAGES = 140;

  useEffect(() => {
    const currentLen = normalMessages.length;
    const prevLen = prevNormalMessagesLengthRef.current;

    if (renderWindowEnd === 0) {
      setRenderWindowEnd(currentLen);
      prevNormalMessagesLengthRef.current = currentLen;
      return;
    }

    if (currentLen < renderWindowEnd) {
      setRenderWindowEnd(currentLen);
    }

    // Auto-follow latest only when user is near bottom and not browsing old history.
    if (currentLen > prevLen && isNearBottomRef.current && !isLoadingEarlierRef.current && !isLoadingMore) {
      setRenderWindowEnd(currentLen);
    }

    prevNormalMessagesLengthRef.current = currentLen;
  }, [normalMessages.length, renderWindowEnd, isLoadingMore]);

  const renderStartIndex = Math.max(0, renderWindowEnd - MAX_RENDERED_MESSAGES);
  const visibleNormalMessages = normalMessages.slice(renderStartIndex, Math.min(renderWindowEnd, normalMessages.length));

  const updateSendButtonCoords = () => {
    if (!sendButtonRef.current || !viewportRef.current) {
      setSendButtonCoords({ x: '80%', y: '80%' });
      return;
    }

    const btnRect = sendButtonRef.current.getBoundingClientRect();
    const viewRect = viewportRef.current.getBoundingClientRect();
    const x = ((btnRect.left - viewRect.left + btnRect.width / 2) / viewRect.width) * 100;
    const y = ((btnRect.top - viewRect.top) / viewRect.height) * 100;
    setSendButtonCoords({ x: `${x}%`, y: `${y}%` });
  };

  useEffect(() => {
    const rafId = requestAnimationFrame(() => updateSendButtonCoords());
    const handleResize = () => updateSendButtonCoords();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isFocusedMode]);

  return (
    <div 
      className={cn(
        "flex flex-col h-full overflow-hidden relative transition-all duration-1000",
        isFocusedMode ? "immersion-clear-ui" : "bg-[var(--bg-main)] dark:bg-slate-950"
      )} 
      onDragOver={onDragOver} 
      onDragLeave={onDragLeave} 
      onDrop={onDrop}
    >
      <audio ref={notificationAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" />
      
      {showWelcomeFireworks && <Confetti />}
      
      {pops.map(pop => (
        <HeartPop key={pop.id} x={pop.x} y={pop.y} onComplete={() => setPops(prev => prev.filter(p => p.id !== pop.id))} />
      ))}

      {heartExplosions.map(exp => (
        <HeartExplosion 
          key={exp.id} 
          x={exp.x} 
          y={exp.y} 
          onComplete={() => setHeartExplosions(prev => prev.filter(e => e.id !== exp.id))} 
        />
      ))}

      {isDragging && (
        <div className="absolute inset-0 z-50 bg-pink-500/20 backdrop-blur-sm border-4 border-dashed border-pink-500 flex items-center justify-center animate-in fade-in">
          <div className="bg-white p-8 rounded-none shadow-2xl text-center">
            <h2 className="text-2xl font-black text-pink-600">Thả vào đây! 🎀</h2>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="absolute inset-0 z-[300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-none p-8 max-w-sm w-full text-center shadow-2xl relative">
            <button onClick={cancelPreview} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-6 pr-6 text-left">Gửi Sticker? 🌹</h3>
            <div className="aspect-square w-full rounded-none overflow-hidden mb-8 bg-gray-50/50">
              <SmartImage src={previewUrl} className="w-full h-full" />
            </div>
            <div className="flex space-x-3">
               <button onClick={() => confirmUpload('save')} disabled={isUploading} className="flex-1 py-4 bg-pink-100 text-pink-600 font-bold rounded-none hover:bg-pink-200 transition-colors">{isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Thư viện"}</button>
               <button onClick={() => confirmUpload('send')} disabled={isUploading} className="flex-1 py-4 bg-pink-500 text-white font-bold rounded-none hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/30">{isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gửi ngay"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button during Focused Mode */}
      {isFocusedMode && (
        <button 
          onClick={onToggleFocus}
          className="fixed top-8 left-8 z-[100] p-4 bg-white/10 text-white backdrop-blur-3xl border border-white/20 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all group"
          title="Mở rộng giao diện"
        >
          <Minimize2 className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
        </button>
      )}

      {/* Header with Dynamic Theme Gradient - Hidden in Focus Mode */}
      <div className={cn(
        "flex items-center justify-between px-4 sm:px-6 md:px-10 z-[1200] transition-all duration-1000 overflow-visible",
        isFocusedMode ? "h-0 opacity-0 pointer-events-none" : cn("py-5 border-b border-pink-100 dark:border-slate-800 shadow-md bg-gradient-to-r", theme?.header || 'from-pink-500/10 to-rose-500/10')
      )}>
        <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6">
          <div 
            className="w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white font-black overflow-hidden shadow-xl ring-2 sm:ring-4 ring-pink-50/30 cursor-pointer active:scale-90 transition-transform"
            onClick={onOpenInfoPanel}
            onDoubleClick={handleDoubleClick}
            title="Nhấn để mở thông tin người ấy"
          >
            {receiver.avatar_url ? <img src={receiver.avatar_url} className="w-full h-full object-cover rounded-full" /> : receiver.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className={cn("font-black text-base sm:text-lg md:text-xl flex items-center transition-colors", isFocusedMode ? "text-white drop-shadow-lg" : "text-[var(--text-main)]")}>
               <span className="max-w-[120px] sm:max-w-[180px] md:max-w-[280px] truncate inline-block align-bottom">{receiver.username}</span>
               <span className="ml-2 text-pink-500">❤️</span>
            </h3>
            <p className={cn("text-[10px] font-black uppercase tracking-widest flex items-center transition-all", isFocusedMode ? "text-white/70" : "text-pink-400")}>
               <span className={cn("w-2 h-2 rounded-full mr-2", isOnline ? "bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "bg-gray-300")} />
               {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Header Actions Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHeaderActions(prev => !prev)}
            className={cn(
              "p-3 rounded-2xl backdrop-blur-md border shadow-lg hover:scale-105 active:scale-95 transition-all",
              isFocusedMode ? "bg-white/10 text-white border-white/20" : "bg-white/40 dark:bg-white/5 text-pink-500 border-white/20"
            )}
            title="Tùy chọn"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {showHeaderActions && (
            <div className="absolute top-14 right-0 z-[1300] w-[260px] rounded-2xl border border-pink-100 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl p-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderActions(false);
                    onToggleFocus?.();
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-slate-700 dark:text-slate-200 bg-pink-50/70 dark:bg-white/5 hover:bg-pink-100 dark:hover:bg-white/10 transition-all"
                  title={isFocusedMode ? 'Thoát chế độ đắm chìm' : 'Bật chế độ đắm chìm'}
                >
                  <Minimize2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold leading-tight text-center">Đắm chìm</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderActions(false);
                    setShowSpaceSettings(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-slate-700 dark:text-slate-200 bg-pink-50/70 dark:bg-white/5 hover:bg-pink-100 dark:hover:bg-white/10 transition-all"
                  title="Cài đặt không gian"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-[10px] font-bold leading-tight text-center">Không gian</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderActions(false);
                    setShowBgSourceModal(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-slate-700 dark:text-slate-200 bg-pink-50/70 dark:bg-white/5 hover:bg-pink-100 dark:hover:bg-white/10 transition-all"
                  title="Đổi hình nền"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-bold leading-tight text-center">Hình nền</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    onThemeCycle?.();
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-slate-700 dark:text-slate-200 bg-pink-50/70 dark:bg-white/5 hover:bg-pink-100 dark:hover:bg-white/10 transition-all"
                  title="Đổi chủ đề màu"
                >
                  <Sparkles className={cn("w-4 h-4", theme?.accent || "text-pink-500")} />
                  <span className="text-[10px] font-bold leading-tight text-center">Chủ đề</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderActions(false);
                    setShowMemorySidebar(prev => !prev);
                  }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-slate-700 dark:text-slate-200 bg-pink-50/70 dark:bg-white/5 hover:bg-pink-100 dark:hover:bg-white/10 transition-all"
                  title={showMemorySidebar ? 'Ẩn Bảo tàng Kỷ niệm' : 'Mở Bảo tàng Kỷ niệm'}
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="text-[10px] font-bold leading-tight text-center">Bảo tàng</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div 
        ref={viewportRef} 
        onScroll={handleScroll}
        className={cn(
           "flex-1 relative overflow-hidden transition-all duration-1000",
           isFocusedMode ? "bg-transparent" : (theme?.chat || "bg-[var(--bg-chat)] dark:bg-slate-950")
        )}
        style={{ overflowAnchor: 'auto' }}
      >
        {/* Local Background Layer - Only visible in DEFAULT mode for the 'boxed' look */}
        {customBg && !isFocusedMode && (
          <div className="absolute inset-0 z-0 transition-opacity duration-1000 animate-in fade-in">
             <img src={customBg} className="w-full h-full object-cover" style={{ opacity: Math.max(0, 1 - (bgOpacity ?? 0.4)) }} alt="Local BG" />
             <div 
               className="absolute inset-0 transition-all duration-1000" 
               style={{ 
                 backdropFilter: `blur(${bgBlur}px)`, 
                 backgroundColor: `rgba(0,0,0, ${bgOpacity})` 
               }} 
             />
          </div>
        )}
        
        {/* Full screen background is handled globally in App.tsx as fixed layer for IMMERSION mode */}

        {/* Subtle Dynamic Pattern Overlay - TRANSFORMED BY THEME (Only if no custom bg) */}
        {!customBg && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06] z-0 transition-all duration-1000" 
            style={{ 
              backgroundImage: theme?.pattern === 'stars' 
                ? `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='50' cy='50' r='1' fill='%23ffffff'/%3E%3Ccircle cx='10' cy='20' r='0.5' fill='%23ffffff'/%3E%3Ccircle cx='80' cy='30' r='0.7' fill='%23ffffff'/%3E%3C/svg%3E")`
                : theme?.pattern === 'clouds'
                ? `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 50c0-10 10-10 10-10s2-10 15-10 15 10 15 10 10 0 10 10-10 10-10 10H30c-10 0-10-10-10-10z' fill='%23ffffff'/%3E%3C/svg%3E")`
                : theme?.pattern === 'bubbles'
                ? `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='40' cy='40' r='10' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`
                : theme?.pattern === 'waves'
                ? `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q 25 20 50 10 T 100 10' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E")`
                : theme?.pattern === 'sakura'
                ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c2-5 8-5 10 0s-2 10-10 10-12-5-10-10z' fill='%23ffb7c5' opacity='0.5'/%3E%3C/svg%3E")`
                : theme?.pattern === 'leaves'
                ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c5 0 10 5 10 10s-5 10-10 10-10-5-10-10 5-10 10-10z' fill='%234ade80' opacity='0.3'/%3E%3C/svg%3E")`
                : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 50.15c-.4 0-.8-.13-1.12-.4L8.14 31.75c-3.23-2.65-5.14-6.62-5.14-10.88 0-7.3 5.92-13.25 13.24-13.25 4.3 0 8.27 2.05 10.76 5.5l3 4.14 3-4.14c2.5-3.45 6.46-5.5 10.76-5.5 7.32 0 13.24 5.95 13.24 13.25 0 4.26-1.9 8.23-5.14 10.88L31.12 49.75c-.32.27-.72.4-1.12.4z' fill='%23ed4956' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              backgroundSize: theme?.pattern === 'waves' ? '200px 40px' : '100px 100px'
            }}
          />
        )}
        
        {/* Breathing Glow Effects - DYNAMICALLY THEMED */}
        <div className={cn("absolute top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[120px] rounded-full animate-pulse pointer-events-none transition-all duration-1000", theme?.glow || "bg-rose-200/30")} style={{ animationDuration: '8s' }} />
        <div className={cn("absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] blur-[100px] rounded-full animate-pulse pointer-events-none transition-all duration-1000", theme?.glow || "bg-pink-200/30")} style={{ animationDuration: '10s', animationDelay: '2s' }} />
        
        <SparklingDust />
        
        {showScrollToBottom && (
          <button 
            onClick={() => {
              setRenderWindowEnd(normalMessages.length);
              scrollToBottom('smooth');
            }}
            className="absolute bottom-10 right-10 z-30 w-14 h-14 bg-white/90 backdrop-blur-md border border-pink-200 rounded-full flex items-center justify-center text-pink-500 shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce"
          >
            <ArrowDown className="w-6 h-6" />
          </button>
        )}

        <div className="absolute inset-0 z-[999] overflow-hidden pointer-events-none">
          {flyingMessages.map(msg => (
            <div key={msg.id} className="pointer-events-auto inline-block">
              <FlyingMessage 
                message={msg} 
                onOpen={async (id) => {
                  const targetMsg = receivedFlyingMessages.find(m => m.id === id);
                  if (!targetMsg) {
                    console.log('🛡️ [Security] You cannot open your own secret heart gifts!');
                    return;
                  }

                  console.log('💌 [Interaction] Opening Secret Heart Modal for:', id);
                  setOpeningHeartMessage(targetMsg);
                  setIsScratchComplete(false); // Reset for new message
                }} 
                isMe={msg.sender_id === currentUser.id} 
                isLocked={msg.sequence !== 1 && msg.receiver_id === currentUser.id}
                initialPos={msg.sender_id === currentUser.id ? sendButtonCoords : undefined} 
              />
            </div>
          ))}
        </div>

        <div 
          ref={scrollRef} 
          onScroll={handleScroll} 
          className={cn(
              "absolute inset-0 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 md:space-y-6 custom-scrollbar z-10 scroll-smooth transition-all duration-1000",
            isFocusedMode ? "immersion-clear-ui" : ""
          )}
        >
          {isLoadingMore && (
            <div className="flex items-center justify-center py-6 animate-in fade-in">
               <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
            </div>
          )}
          
          {visibleNormalMessages.map((msg, index) => {
            const isMe = msg.sender_id === currentUser.id;
            const isSending = msg.id.toString().startsWith('temp-');
            const isLastRead = msg.id === delayedLastReadId;
            const isUnreadDivider = msg.id === firstUnreadId;
            const hasExplosion = activeExplosions[msg.id];
            
            // Check if this is an "Old" message being loaded historically
            // We give historical messages instant presence (no fade-in) for stability
            const isHistorical = index < 25 && isLoadingMore;

            return (
              <React.Fragment key={msg.id}>
                {isUnreadDivider && (
                  <div className="flex items-center justify-center py-10 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-pink-200 to-pink-200"></div>
                    <div className="flex items-center px-6 space-x-3 text-pink-400 font-black text-[10px] uppercase tracking-widest italic text-center">
                      <Sparkles className="w-4 h-4 animate-pulse" /> <span>Tin nhắn mới</span> <HeartIcon className="w-3 h-3 fill-pink-300 animate-ping" />
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-pink-200 to-pink-200"></div>
                  </div>
                )}
                
                <div className={cn(
                  "flex w-full flex-col relative", 
                  isMe ? "items-end" : "items-start",
                  !isHistorical && "animate-in fade-in slide-in-from-bottom-2 duration-500"
                )}>
                  <div className={cn("max-w-[82%] sm:max-w-[75%] md:max-w-[70%] group relative")}>
                    {hasExplosion && <StickerExplosion imageUrl={hasExplosion} onComplete={() => setActiveExplosions(prev => { const n = {...prev}; delete n[msg.id]; return n; })} />}
                    
                    {msg.image_url ? (
                      <div className="relative mb-2">
                        <div className="flex flex-col items-center group relative">
                          <div 
                            className="relative cursor-pointer transition-transform hover:scale-105 active:scale-95" 
                            onClick={() => {
                              if (msg.image_url) {
                                console.log('🔍 [Media] Opening sticker viewer for URL:', msg.image_url.substring(0, 50) + '...');
                                setViewingSticker(msg.image_url);
                              }
                            }}
                            onDoubleClick={handleDoubleClick}
                          >
                            <SmartImage src={msg.image_url} />
                          </div>
                          
                          {/* Subtle Image Timestamp */}
                          <div className={cn(
                            "mt-1.5 px-3 text-[9px] font-bold uppercase tracking-widest transition-all w-full flex items-center gap-1.5",
                            isMe ? "justify-end text-rose-400/50" : "justify-start text-blue-400/70 dark:text-pink-400/60"
                          )}>
                            {isMe && (
                              isSending
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Check className="w-3 h-3 text-green-500" />
                            )}
                            {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          onClick={handleBubbleClick}
                          onDoubleClick={handleDoubleClick}
                          className={cn(
                            "relative transition-all hover:scale-[1.05] cursor-pointer shadow-2xl group/msg overflow-visible break-words", 
                            isHeartEffect(msg.effect)
                              ? "heart-bubble animate-floating-heart flex items-center justify-center italic font-black text-center" 
                              : cn(
                                  "px-8 py-5 text-[15px] font-medium rounded-2xl shadow-2xl",
                                  "px-4 py-3 text-sm sm:px-6 sm:py-4 sm:text-[15px] md:px-8 md:py-5",
                                  isMe 
                                    ? (isFocusedMode ? `${bubbleTheme.focusMe} rounded-tr-none` : `${bubbleTheme.me} rounded-tr-none`) 
                                    : (isFocusedMode ? `${bubbleTheme.focusPartner} rounded-tl-none` : `${bubbleTheme.partner} rounded-tl-none`)
                                )
                          )}
                        >
                          {/* UNIVERSAL LINK DETECTION LOGIC */}
                          {msg.content.split(/((?:https?:\/\/|www\.)[^\s]+)/g).map((part, i) => {
                            const isUrl = /^(https?:\/\/|www\.)[^\s]+$/.test(part);
                            if (isUrl) {
                              const href = part.startsWith('http') ? part : `https://${part}`;
                              return (
                                <a 
                                  key={i} 
                                  href={href} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "underline underline-offset-4 decoration-2 transition-all hover:text-white/80",
                                    isMe ? "text-pink-100 hover:decoration-white" : "text-blue-400 dark:text-pink-300"
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {part}
                                </a>
                              );
                            }
                            return (
                              <span
                                key={i}
                                className={cn(isHeartEffect(msg.effect) && "relative z-10", "twemoji-wrap")}
                                dangerouslySetInnerHTML={{ __html: renderTwemoji(part) }}
                              />
                            );
                          })}
                        </div>

                        {/* Subtle Message Timestamp */}
                        <div className={cn(
                          "mt-1.5 px-3 text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5",
                          isMe ? "justify-end text-rose-400/50" : "justify-start text-blue-400/70 dark:text-pink-400/60"
                        )}>
                          {isMe && (
                            isSending
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Check className="w-3 h-3 text-green-500" />
                          )}
                          {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                      </>
                    )}
                  </div>
                  {isLastRead && (
                    <div className="mt-3 flex items-center justify-end w-full pr-2 animate-in fade-in slide-in-from-top-1 duration-1000">
                       <span className="text-[9px] font-black text-gray-300 mr-3 uppercase tracking-widest italic">Đã xem</span>
                       <div 
                         className="w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-xl ring-4 ring-pink-100/30 transition-transform hover:scale-125 cursor-pointer active:scale-75"
                         onDoubleClick={handleDoubleClick}
                         title="Nhấn đúp để gởi nụ hôn 💋"
                       >
                          <img src={receiver.avatar_url || `https://i.pravatar.cc/50?u=${receiver.id}`} className="w-full h-full object-cover" />
                       </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          
          {/* Typing Indicator */}
          {isOtherTyping && (
            <div className="flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-2 duration-300 py-2">
               <div className="flex space-x-1.5 bg-[var(--bg-bubble-partner)] backdrop-blur-md dark:bg-slate-800 px-5 py-3.5 rounded-2xl shadow-lg border border-pink-50">
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest italic">{receiver.username} đang soạn tin... 🎀</span>
               </div>
            </div>
          )}
        </div>
      </div>

      <div 
        className={cn(
          "p-3 sm:p-4 md:p-6 z-40 transition-all duration-1000 w-full",
          isFocusedMode ? "immersion-clear-ui py-14" : cn("border-t-[1.5px] border-pink-400/40 dark:border-rose-500/20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] bg-gradient-to-r backdrop-blur-md", theme?.header || 'from-pink-500/10 to-rose-500/10')
        )}
      >
        <div className={cn("max-w-4xl mx-auto flex flex-col space-y-4", isFocusedMode ? "immersion-clear-ui" : "")}>
          {/* Sticker Ribbon */}
          {showStickerRibbon && stickers.length > 0 && (
            <div className={cn("flex items-center space-x-3 group/ribbon animate-in slide-in-from-bottom-2 duration-300", isFocusedMode ? "immersion-clear-ui" : "")}>
              <div className={cn("flex items-center space-x-5 overflow-x-auto custom-scrollbar-hide pointer-events-auto py-1 flex-1", isFocusedMode ? "immersion-clear-ui" : "")}>
                {stickers.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => { sendMessage('', s.image_url); fetchStickers(); }} 
                    className="flex-shrink-0 w-14 h-14 p-1.5 bg-transparent rounded-2xl hover:bg-pink-50 dark:hover:bg-pink-500/20 cursor-pointer transition-all hover:scale-110 active:scale-90 border-2 border-transparent hover:border-pink-300 shadow-sm group"
                  >
                    <div className="relative w-full h-full flex items-center justify-center">
                      <SmartImage src={s.image_url} className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-pink-400/0 group-hover:bg-pink-400/5 rounded-xl transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setShowStickerRibbon(false)}
                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-slate-800 rounded-xl transition-all opacity-0 group-hover/ribbon:opacity-100"
                title="Ẩn dải băng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Input Wrapper - Glassmorphism in Focus Mode */}
          <div className={cn(
            "flex items-center gap-1.5 sm:gap-2 rounded-[2.25rem] sm:rounded-[3rem] p-1.5 sm:p-2 pr-2 sm:pr-4 relative transition-all duration-700",
            isFocusedMode 
              ? "bg-white/5 backdrop-blur-2xl border border-white/20 shadow-[0_0_20px_rgba(236,72,153,0.15)]" 
              : "bg-[var(--bg-input)] border border-pink-100 dark:border-slate-800 shadow-inner"
          )}>
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowSendActions(prev => !prev)}
                disabled={isUploading}
                className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all border shrink-0",
                  isUploading
                    ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                    : isFocusedMode
                      ? (isComposerFocused
                          ? "bg-white/75 text-slate-800 border-white/80 hover:scale-105"
                          : "bg-white/5 text-white/80 border-white/15 hover:scale-105")
                      : "bg-white/80 dark:bg-white/10 text-slate-500 border-pink-100 dark:border-white/10 hover:scale-105"
                )}
                title="Tùy chọn gửi"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showSendActions && (
                <div className="absolute bottom-14 left-0 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-pink-100 dark:border-white/10 shadow-2xl z-30 min-w-[136px]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendActions(false);
                      setShowEmoji(prev => !prev);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-white/10 transition-all"
                    title="Emoji"
                  >
                    <Smile className="w-4 h-4 text-pink-500" />
                    <span className="text-xs font-semibold">Emoji</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSendActions(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-white/10 transition-all"
                    title="Gửi ảnh"
                  >
                    <ImageIcon className="w-4 h-4 text-pink-500" />
                    <span className="text-xs font-semibold">Gửi ảnh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSendActions(false);
                      setShowStickers(true);
                      setShowStickerRibbon(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-white/10 transition-all"
                    title="Nhãn dán"
                  >
                    <Sparkles className="w-4 h-4 text-pink-500" />
                    <span className="text-xs font-semibold">Nhãn dán</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSend(1.2);
                      setShowSendActions(false);
                    }}
                    disabled={!text.trim() || isUploading || sentFlyingMessages.length >= 3}
                    className={cn(
                      "mt-1 w-full h-10 rounded-xl flex items-center justify-center transition-all gap-2",
                      (!text.trim() || isUploading || sentFlyingMessages.length >= 3)
                        ? "bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-white/20 cursor-not-allowed"
                        : "bg-pink-500 text-white hover:scale-105 active:scale-95"
                    )}
                    title={!text.trim() ? "Nhập chữ để gửi tim" : "Gửi trái tim"}
                  >
                    <HeartIcon className="w-4 h-4 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wide">Tim</span>
                  </button>
                </div>
              )}
            </div>

            <div className={cn(
              "flex-1 min-w-0 relative flex items-center px-1.5 sm:px-2 py-1.5 rounded-[1.6rem] sm:rounded-[2rem] border group transition-all",
              isFocusedMode
                ? (isComposerFocused
                    ? "bg-white/85 border-white/80 focus-within:ring-2 focus-within:ring-white/70"
                    : "bg-white/5 border-white/15 focus-within:ring-2 focus-within:ring-white/40")
                : "bg-slate-100/50 dark:bg-white/5 border-pink-50 dark:border-white/5 focus-within:ring-2 focus-within:ring-pink-500/20"
            )}>
              <input 
                type="text" 
                value={text} 
                onChange={handleInputChange} 
                onFocus={() => setIsComposerFocused(true)}
                onBlur={() => setIsComposerFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder={sentFlyingMessages.length >= 3 ? "Chờ người thương mở tim nhé... ❤️" : "Nhắn lời thương..."}
                className={cn(
                  "flex-1 min-w-0 bg-transparent border-none outline-none font-medium px-2 sm:px-4 py-2 text-sm sm:text-base",
                  isFocusedMode
                    ? (isComposerFocused
                        ? "text-slate-900 placeholder:text-slate-500"
                        : "text-white placeholder:text-white/60")
                    : "text-slate-800 dark:text-white placeholder:text-slate-400"
                )}
              />
              {sentFlyingMessages.length >= 3 && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-pink-500 text-white text-[10px] font-black rounded-full shadow-xl animate-bounce">
                   Bầu trời đã đầy bí mật! 🎈
                </div>
              )}
            </div>

            <button 
              ref={sendButtonRef}
              onClick={() => handleSend()}
              disabled={!text.trim() || isUploading}
              className={cn(
                "shrink-0 w-10 h-10 sm:min-w-[48px] sm:w-12 sm:h-12 rounded-full px-0 flex items-center justify-center transition-all bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/50 active:scale-90",
                (!text.trim() || isUploading) ? "grayscale opacity-50 cursor-not-allowed" : "hover:scale-105"
              )}
            >
               <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
      {showEmoji && <div className="absolute bottom-28 left-8 z-50"><EmojiPicker theme={isDragging ? Theme.DARK : Theme.LIGHT} onEmojiClick={(ed) => setText(p => p + ed.emoji)} /></div>}
      
      {/* Modern Sticker Library Modal */}
      {showStickers && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10 animate-in fade-in zoom-in-95 duration-300">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowStickers(false)}></div>
           
           <div className="relative bg-[var(--bg-header)] w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100 dark:border-slate-800 flex flex-col">
              <div className="p-8 border-b border-pink-50 dark:border-slate-800 flex items-center justify-between">
                 <div>
                    <h2 className="text-2xl font-black text-pink-600 dark:text-pink-400 flex items-center">Thư viện Nhãn dán <Sparkles className="ml-3 w-6 h-6 animate-pulse" /></h2>
                    <p className="text-xs text-gray-400 font-medium mt-1">Nơi lưu giữ những biểu cảm ngọt ngào của hai bạn 🎀</p>
                 </div>
                 <button onClick={() => setShowStickers(false)} className="p-3 hover:bg-pink-50 dark:hover:bg-slate-800 rounded-full transition-all text-gray-400 hover:text-pink-500"><X className="w-7 h-7" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 {/* Add Sticker from Link Section - LIGHTWEIGHT & FAST */}
                 <div className="mb-10 p-6 bg-pink-50/50 dark:bg-white/5 backdrop-blur-md rounded-3xl border border-pink-100 dark:border-white/10 flex flex-col sm:flex-row items-center gap-4 group transition-all hover:bg-white/10">
                    <div className="flex-1 w-full">
                       <input 
                         type="text" 
                         id="sticker-link-input"
                         placeholder="Dán link ảnh nhãn dán vào đây... (Pinterest, Google, etc.)" 
                         className="w-full bg-white dark:bg-slate-900 border border-pink-100 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-sm outline-none focus:ring-2 focus:ring-pink-400 transition-all font-medium"
                       />
                    </div>
                    <button 
                      onClick={async () => {
                        const input = document.getElementById('sticker-link-input') as HTMLInputElement;
                        const url = input?.value;
                        if (url && url.startsWith('http')) {
                          console.log('🚀 [Sticker] Adding from link:', url);
                          const { error } = await supabase.from('stickers').insert([{ user_id: currentUser.id, image_url: url }]);
                          if (!error) {
                            input.value = '';
                            fetchStickers();
                          }
                        }
                      }}
                      className="whitespace-nowrap bg-gradient-to-tr from-pink-500 to-rose-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-pink-200 dark:shadow-rose-900/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                       <Link2 className="w-4 h-4" /> Thêm nhanh
                    </button>
                 </div>

                 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6">
                    {/* Upload New Sticker Action - NOW DARK MODE FRIENDLY */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square bg-transparent border-2 border-dashed border-pink-200 dark:border-pink-500/20 rounded-3xl flex flex-col items-center justify-center space-y-3 hover:border-pink-500 hover:bg-pink-50/5 transition-all group"
                    >
                       <div className="w-12 h-12 rounded-full bg-pink-100/50 dark:bg-white/10 backdrop-blur-md flex items-center justify-center text-pink-500 shadow-lg group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6" />
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 dark:text-pink-300">Thêm mới</span>
                    </button>

                    {stickers.map(s => (
                       <div 
                         key={s.id} 
                         onClick={() => { 
                           sendMessage('', s.image_url); 
                           setShowStickers(false); 
                           fetchStickers(); 
                           console.log('🎀 [Sticker] Selected from library:', s.image_url.substring(0, 50) + '...');
                         }}
                         className="aspect-square bg-transparent rounded-3xl p-3 hover:scale-110 active:scale-95 transition-all cursor-pointer hover:bg-pink-50/10 group relative flex items-center justify-center"
                       >
                          <SmartImage src={s.image_url} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-pink-500/0 group-hover:bg-pink-500/5 rounded-3xl transition-colors" />
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Background Source Selection Modal - HIGH END */}
      {showBgSourceModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
           <div className="bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-white">Đổi hình nền 🖼️</h2>
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Chọn nguồn ảnh kỷ niệm</p>
                 </div>
                 <button onClick={() => setShowBgSourceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 space-y-6">
                 <button 
                   onClick={() => {
                     setShowBgSourceModal(false);
                     setIsBgUpload(true);
                     fileInputRef.current?.click();
                   }}
                   className="w-full h-20 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl flex items-center px-6 space-x-5 transition-all group"
                 >
                    <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                       <ImagePlus className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                       <p className="text-white font-black text-sm">Tải lên từ máy</p>
                       <p className="text-white/40 text-[10px] font-medium">PNG, JPG, JPEG...</p>
                    </div>
                 </button>

                 <div className="space-y-4">
                    <div className="flex items-center space-x-3 px-2">
                       <div className="h-px flex-1 bg-white/10"></div>
                       <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Hoặc dán link</span>
                       <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-3xl group-within:border-pink-500/50 transition-colors">
                       <input 
                         type="text" 
                         value={bgLinkInput}
                         onChange={(e) => setBgLinkInput(e.target.value)}
                         placeholder="https://example.com/image.jpg" 
                         className="flex-1 bg-transparent border-none text-white text-xs px-4 outline-none font-medium placeholder:text-white/20"
                       />
                       <button 
                         onClick={() => {
                            if (bgLinkInput.startsWith('http')) {
                               if (onCustomBgChange) onCustomBgChange(bgLinkInput);
                               setBgLinkInput('');
                               setShowBgSourceModal(false);
                            }
                         }}
                         className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-3 rounded-2xl font-bold text-[10px] shadow-lg shadow-pink-500/20 transition-all active:scale-95 whitespace-nowrap"
                       >Áp dụng</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Space Management Modal - NEW HIGH-END CENTER */}
      {showSpaceSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
           <div className="bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                 <div>
                    <h2 className="text-2xl font-black text-white flex items-center">Cài đặt nền <Settings className="ml-3 w-6 h-6 text-pink-500" /></h2>
                    <p className="text-xs text-white/50 font-medium mt-1">Tinh chỉnh sắc thái vũ trụ của hai bạn 🌌</p>
                 </div>
                 <button onClick={() => setShowSpaceSettings(false)} className="p-3 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"><X className="w-7 h-7" /></button>
              </div>

              <div className="p-8 space-y-8">
                 {/* Preview of Current Background */}
                 {customBg ? (
                    <div className="relative group aspect-video rounded-3xl overflow-hidden border-2 border-white/20 shadow-inner">
                       <img src={customBg} className="w-full h-full object-cover" alt="Preview" />
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                               if (onCustomBgChange) onCustomBgChange(null);
                               console.log('🧼 [Universe] Space cleared!');
                            }}
                            className="bg-rose-500 px-6 py-2 rounded-full text-white font-bold text-xs shadow-lg"
                          >Gỡ hình nền hiện tại</button>
                       </div>
                    </div>
                 ) : (
                    <div className="aspect-video rounded-3xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/30 space-y-3">
                       <ImageIcon className="w-10 h-10" />
                       <span className="text-xs font-bold uppercase tracking-tighter">Bạn đang dùng Theme mặc định</span>
                    </div>
                 )}

                 {/* Change Background from Link Section - FAST & LIGHTWEIGHT */}
                 <div className="space-y-3 pt-2">
                    <label className="text-[10px] font-black text-pink-300 uppercase tracking-widest px-1">Đổi nền từ Link ảnh 🖼️</label>
                    <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl">
                       <input 
                         type="text" 
                         id="bg-link-input"
                         placeholder="Dán link ảnh nền vào đây..." 
                         className="flex-1 bg-transparent border-none text-white text-xs px-4 outline-none font-medium placeholder:text-white/20"
                       />
                       <button 
                         onClick={() => {
                            const input = document.getElementById('bg-link-input') as HTMLInputElement;
                            const url = input?.value;
                            if (url && url.startsWith('http')) {
                               console.log('🖼️ [Universe] Background changed via link:', url);
                               if (onCustomBgChange) onCustomBgChange(url);
                               input.value = '';
                            }
                         }}
                         className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-2xl font-bold text-[10px] shadow-lg shadow-pink-500/20 transition-all active:scale-95"
                       >Áp dụng</button>
                    </div>
                 </div>

                 {/* Stylings Only if customBg */}
                 {customBg && (
                    <div className="space-y-6">
                        <div className="flex flex-col space-y-3">
                            <label className="text-[10px] font-black text-pink-300 uppercase tracking-widest flex justify-between">
                                <span>Độ phủ mờ (Opacity)</span>
                                <span>{Math.round((bgOpacity ?? 0.4) * 100)}%</span>
                            </label>
                            <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={bgOpacity} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  console.log('🎚️ [Local] Changing opacity to:', val);
                                  onBgStyleChange?.(val, bgBlur ?? 12);
                                }}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500" 
                            />
                        </div>
                        <div className="flex flex-col space-y-3">
                            <label className="text-[10px] font-black text-pink-300 uppercase tracking-widest flex justify-between">
                                <span>Độ nhòe kính (Blur)</span>
                                <span>{bgBlur}px</span>
                            </label>
                            <input 
                                type="range" min="0" max="100" step="1" 
                                value={bgBlur} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  console.log('🎚️ [Local] Changing blur to:', val);
                                  onBgStyleChange?.(bgOpacity ?? 0.4, val);
                                }}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500" 
                            />
                        </div>
                    </div>
                 )}

                 <div className="flex flex-col space-y-4 pt-4 border-t border-white/10">
                    <button 
                      onClick={() => {
                        onForceSync?.();
                        console.log('🔄 [Universe] Manual sync triggered!');
                      }}
                      className="w-full h-14 flex items-center justify-center space-x-3 bg-pink-500/10 border border-pink-500/30 rounded-[2rem] text-pink-300 font-black text-sm hover:bg-pink-500/20 active:scale-95 transition-all group"
                    >
                      <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                      <span>Cân bằng Vũ trụ (Đồng bộ) 🔄</span>
                    </button>
                    
                    <button 
                      onClick={() => setShowSpaceSettings(false)}
                      className="w-full bg-white text-pink-600 font-black py-5 rounded-[2rem] shadow-xl hover:scale-105 active:scale-95 transition-all text-xl"
                    >Hoàn tất thiết lập ✨</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {viewingSticker && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 pointer-events-auto p-10">
           <button onClick={() => setViewingSticker(null)} className="absolute top-10 right-10 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white hover:rotate-90"><X className="w-8 h-8" /></button>
           
           <div className="relative max-w-2xl w-full flex flex-col items-center animate-in zoom-in-95 duration-500">
              <div className="bg-white/5 p-4 rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-10 w-full flex items-center justify-center">
                 <img src={viewingSticker} className="max-w-full max-h-[60vh] object-contain rounded-2xl" alt="Sticker" />
              </div>

            <div className="flex flex-col space-y-3 w-full">
               <button 
                onClick={() => {
                  if (onCustomBgChange) onCustomBgChange(viewingSticker);
                  setViewingSticker(null);
                  console.log('🎨 [Universe] Chat background updated and broadcasted!');
                }}
                className="flex items-center justify-center space-x-3 bg-white/20 backdrop-blur-xl border border-white/30 py-4 rounded-[2rem] text-white font-black text-xl hover:bg-white/30 transition-all shadow-xl"
               >
                 <ImageIcon className="w-6 h-6" />
                 <span>Đặt làm Hình nền 🖼️</span>
               </button>

               {customBg === viewingSticker && (
                 <div className="flex flex-col space-y-3 w-full">
                    <button 
                      onClick={() => {
                        if (onCustomBgChange) onCustomBgChange(null);
                        setViewingSticker(null);
                      }}
                      className="w-full flex items-center justify-center space-x-3 bg-rose-500/20 py-3 rounded-2xl text-rose-200 font-bold text-sm hover:bg-rose-500/40 transition-all border border-rose-500/30"
                    >
                      <X className="w-4 h-4" />
                      <span>Gỡ hình nền</span>
                    </button>
                    <p className="text-[10px] text-pink-300/50 text-center italic">Để chỉnh độ mờ, hãy dùng nút Cài đặt ⚙️ ở Header</p>
                 </div>
               )}

               {!stickers.some(s => s.image_url === viewingSticker) ? (
                  <button 
                    onClick={async () => {
                      if (!viewingSticker) return;
                      await saveAsSticker(viewingSticker);
                      await fetchStickers();
                      setViewingSticker(null);
                    }}
                    className="flex items-center justify-center space-x-3 bg-gradient-to-r from-pink-500 to-rose-600 px-10 py-5 rounded-[2rem] text-white font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-pink-500/40 group"
                  >
                    <Download className="w-7 h-7 group-hover:animate-bounce" />
                    <span>Cất giữ vào thư viện ❤️</span>
                  </button>
                ) : (
                  <div className="bg-white/10 text-white/50 px-8 py-3 rounded-full font-bold flex items-center justify-center italic">
                    <Check className="w-5 h-5 mr-3 text-green-400" /> Sticker đã có trong thư viện
                  </div>
                )}
            </div>
           </div>
        </div>
      )}
      {/* Memory Vault Sidebar - REFINED DESIGN */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-full lg:w-96 lg:max-w-[420px] backdrop-blur-3xl z-[1400] transition-all duration-700 ease-in-out flex flex-col",
        isDarkMode
         ? "bg-slate-950/95 border-l border-slate-700/70 shadow-[-20px_0_60px_rgba(0,0,0,0.55)]"
         : "bg-white/95 border-l border-pink-100 shadow-[-20px_0_50px_rgba(0,0,0,0.1)]",
        showMemorySidebar ? "translate-x-0" : "translate-x-full"
      )}>
        <div className={cn(
          "p-8 border-b flex items-center justify-between",
          isDarkMode ? "border-slate-700/70 bg-slate-900/35" : "border-pink-100 bg-transparent"
        )}>
            <div>
            <h2 className={cn("text-xl font-black flex items-center", isDarkMode ? "text-slate-100" : "text-slate-900")}>Bảo tàng Kỷ niệm <Sparkles className={cn("ml-2 w-4 h-4", isDarkMode ? "text-pink-300" : "text-pink-500")} /></h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Nơi thời gian ngưng đọng 🎞️</p>
            </div>
          <button onClick={() => setShowMemorySidebar(false)} className={cn("p-2 rounded-full text-slate-400 transition-all", isDarkMode ? "hover:bg-slate-800 hover:text-slate-100" : "hover:bg-black/5 hover:text-slate-900")}><X className="w-7 h-7" /></button>
         </div>

         {/* Tabs Navigation - LESS ROUNDED */}
         <div className={cn("flex p-2 gap-1 mx-6 mt-6 rounded-xl border", isDarkMode ? "bg-slate-900/80 border-slate-700/70" : "bg-slate-100 border-pink-50")}>
            {[
              { id: 'media', icon: ImageIcon, label: 'Ảnh' },
              { id: 'links', icon: Link2, label: 'Links' },
              { id: 'search', icon: Search, label: 'Tìm' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setMemoryTab(tab.id as any)}
                className={cn(
                  "flex-1 flex flex-col items-center py-3 rounded-lg transition-all relative overflow-hidden",
                  memoryTab === tab.id ? "bg-pink-500 text-white shadow-md scale-100" : (isDarkMode ? "text-slate-400 hover:text-slate-100" : "text-slate-400 hover:text-slate-900")
                )}
              >
                 <tab.icon className="w-4 h-4 mb-1" />
                 <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
              </button>
            ))}
         </div>

         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {memoryTab === 'search' && (
              <div className="mb-6 group">
                 <div className="relative">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm lời yêu thương..."
                      className={cn("w-full border rounded-xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 transition-all", isDarkMode ? "bg-slate-900/90 border-slate-700/70 text-slate-100 placeholder:text-slate-500" : "bg-slate-50 border-pink-100 text-slate-900 placeholder:text-slate-300")}
                    />
                    <Search className={cn("absolute right-5 top-4 w-5 h-5", isDarkMode ? "text-slate-500" : "text-slate-300")} />
                 </div>
              </div>
            )}

            <div className="space-y-4">
               {memoryTab === 'media' && (
                 <div className="grid grid-cols-2 gap-3">
                    {messages.filter(m => m.image_url).map((m, idx) => (
                   <div key={idx} className={cn("group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer shadow-md border", isDarkMode ? "border-slate-700/70 bg-slate-900/60" : "border-pink-50 bg-white")} onClick={() => setViewingSticker(m.image_url!)}>
                         <img src={m.image_url!} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <span className="text-[9px] text-white font-bold">{new Date(m.created_at).toLocaleDateString()}</span>
                         </div>
                      </div>
                    ))}
                 </div>
               )}

               {memoryTab === 'links' && (
                 <div className="space-y-3">
                    {messages.filter(m => /(https?:\/\/|www\.)[^\s]+/.test(m.content)).map((m, idx) => {
                       const links = m.content.match(/(https?:\/\/|www\.)[^\s]+/g);
                       return links?.map((link, lIdx) => (
                     <a key={`${idx}-${lIdx}`} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className={cn("block p-4 border rounded-xl transition-all group overflow-hidden relative", isDarkMode ? "bg-slate-900/85 border-slate-700/70 hover:bg-slate-800" : "bg-slate-50 border-pink-100 hover:bg-pink-100/50")}>
                           <div className="flex items-center space-x-3 text-pink-600 dark:text-pink-300 relative z-10">
                         <div className={cn("p-2 rounded-lg", isDarkMode ? "bg-pink-500/15" : "bg-pink-500/10")}><Link2 className="w-4 h-4" /></div>
                               <span className="text-xs font-bold truncate flex-1">{link}</span>
                            </div>
                       <div className={cn("flex justify-between items-center mt-3 pt-3 border-t relative z-10", isDarkMode ? "border-slate-700/70" : "border-slate-200")}>
                         <span className={cn("text-[8px] font-black uppercase", isDarkMode ? "text-slate-400" : "text-slate-400")}>{m.sender_id === currentUser.id ? 'Bạn' : 'Người thương'}</span>
                         <span className={cn("text-[8px]", isDarkMode ? "text-slate-500" : "text-slate-400")}>{new Date(m.created_at).toLocaleDateString()}</span>
                            </div>
                         </a>
                       ));
                    })}
                 </div>
               )}

               {memoryTab === 'search' && searchQuery && (
                 <div className="space-y-3">
                    {messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) && !m.image_url).map((m, idx) => (
                   <div key={idx} className={cn("p-5 border rounded-xl relative group overflow-hidden", isDarkMode ? "bg-slate-900/85 border-slate-700/70" : "bg-slate-50 border-pink-100")}>
                     <p className={cn("text-sm leading-relaxed relative z-10 font-medium", isDarkMode ? "text-slate-100" : "text-slate-800")}>{m.content}</p>
                     <div className={cn("flex justify-between items-center mt-4 pt-4 border-t relative z-10", isDarkMode ? "border-slate-700/70" : "border-slate-200")}>
                             <div className="flex items-center space-x-2">
                              <span className={cn("text-[10px] font-black uppercase tracking-widest", m.sender_id === currentUser.id ? "text-pink-600 dark:text-pink-300" : "text-blue-600 dark:text-blue-300")}>{m.sender_id === currentUser.id ? 'Bạn' : receiver.username}</span>
                             </div>
                        <span className={cn("text-[9px] font-bold", isDarkMode ? "text-slate-500" : "text-slate-400")}>{new Date(m.created_at).toLocaleDateString()}</span>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
         </div>

         {/* Stats Section - REFINED */}
        <div className={cn("p-6 border-t", isDarkMode ? "bg-slate-900/70 border-slate-700/70" : "bg-slate-50 border-pink-100")}>
            <div className="grid grid-cols-2 gap-3">
            <div className={cn("p-4 rounded-xl border flex flex-col items-center", isDarkMode ? "bg-slate-900 border-slate-700/70" : "bg-white border-pink-100")}>
              <p className={cn("text-2xl font-black", isDarkMode ? "text-slate-100" : "text-slate-900")}>{messages.length}</p>
              <p className={cn("text-[8px] font-bold uppercase tracking-widest", isDarkMode ? "text-slate-500" : "text-slate-400")}>Lời ngỏ</p>
               </div>
            <div className={cn("p-4 rounded-xl border flex flex-col items-center", isDarkMode ? "bg-slate-900 border-slate-700/70" : "bg-white border-pink-100")}>
              <p className={cn("text-2xl font-black", isDarkMode ? "text-slate-100" : "text-slate-900")}>{messages.filter(m => m.image_url).length}</p>
              <p className={cn("text-[8px] font-bold uppercase tracking-widest", isDarkMode ? "text-slate-500" : "text-slate-400")}>Ảnh</p>
               </div>
            </div>
         </div>
      </div>
      {/* Secret Heart Reveal Modal - REPLACES LAGGY EXPLOSION */}
      {openingHeartMessage && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="absolute inset-0" onClick={() => setOpeningHeartMessage(null)}></div>
           
           <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-pink-500/50 animate-pulse">
                 <HeartIcon className="w-12 h-12 text-white fill-white" />
              </div>
              
              <h3 className="text-pink-300 font-black text-[10px] uppercase tracking-[0.3em] mb-6 tracking-widest">Thông điệp từ trái tim</h3>
              
              <div className="w-full min-h-[160px] flex items-center justify-center mb-10 overflow-hidden relative">
                 <ScratchToReveal width={280} height={160} onComplete={() => {
                    console.log('🎊 [Scratch] Content revealed!');
                    setIsScratchComplete(true);
                 }}>
                    {openingHeartMessage.image_url ? (
                      <div className="w-full h-full bg-white/5 p-2 flex items-center justify-center">
                        <SmartImage src={openingHeartMessage.image_url} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <p className="text-white text-2xl font-black italic leading-tight text-center px-4 drop-shadow-md">
                         "{openingHeartMessage.content}"
                      </p>
                    )}
                 </ScratchToReveal>
              </div>
              
              <button 
                onClick={async () => {
                   if (openingHeartMessage) {
                      const id = openingHeartMessage.id;
                      setIsRetiringHeart(true);

                      const persisted = await openMessage(id);
                      if (!persisted) {
                        setIsRetiringHeart(false);
                        return;
                      }

                      setOpenedHeartIds(prev => new Set(prev).add(id));
                      if (setMessages) {
                        setMessages(prev => prev.map(m => m.id === id ? { ...m, is_opened: true, effect: 'none' } : m));
                      }

                      setOpeningHeartMessage(null);
                      setIsScratchComplete(false);
                      setIsRetiringHeart(false);
                   }
                }}
                disabled={!isScratchComplete || isRetiringHeart}
                className={cn(
                  "w-full font-black py-4 rounded-2xl shadow-xl transition-all text-sm uppercase tracking-widest",
                  isScratchComplete && !isRetiringHeart
                    ? "bg-pink-500 text-white hover:scale-105 active:scale-95 shadow-pink-500/30" 
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                {isRetiringHeart ? "Đang đồng bộ..." : (isScratchComplete ? "Cất vào tim ❤️" : "Hãy cào hết bí mật 🔍")}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
