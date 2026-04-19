import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Smile, MoreVertical, Download, Sparkles, Heart as HeartIcon, Plus, X, Check, Loader2, ArrowDown, ImagePlus, Settings, RefreshCw, Minimize2, Link2, Search, ChevronDown, Trash2 } from 'lucide-react';
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
import { useSwipeable } from 'react-swipeable';
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

function getTwemojiSvgCandidates(emoji: string) {
  const rawCodepoint = twemoji.convert.toCodePoint(emoji);
  const normalizedCodepoint = rawCodepoint
    .split('-')
    .filter(part => part !== 'fe0f')
    .join('-');

  const candidates = [
    `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${normalizedCodepoint}.svg`,
    `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${rawCodepoint}.svg`
  ];

  return Array.from(new Set(candidates));
}

const ReactionIcon: React.FC<{ emoji: string; className?: string }> = ({ emoji, className }) => {
  const candidates = getTwemojiSvgCandidates(emoji);
  const [candidateIndex, setCandidateIndex] = useState(0);

  if (candidateIndex >= candidates.length) {
    return <span className={className}>{emoji}</span>;
  }

  return (
    <img
      src={candidates[candidateIndex]}
      alt={emoji}
      className={className}
      onError={() => setCandidateIndex(prev => prev + 1)}
    />
  );
};

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
  setTypingStatus?: (isTyping: boolean) => Promise<void> | void;
}
interface MessageReactionRow {
  message_id: string | number;
  user_id: string;
  emoji: string;
}

interface MessageReactionView {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

interface MessageDeleteRequestRow {
  id: number;
  message_id: string;
  requester_id: string;
  approver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface SwipeToDeleteWrapperProps {
  enabled: boolean;
  alignRight?: boolean;
  onTriggerDelete: () => void;
  onSwipeStateChange?: (isSwiping: boolean) => void;
  children: React.ReactNode;
}

const SwipeToDeleteWrapper: React.FC<SwipeToDeleteWrapperProps> = ({
  enabled,
  alignRight = false,
  onTriggerDelete,
  onSwipeStateChange,
  children
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const reset = () => {
    setOffsetX(0);
    setIsSwiping(false);
    onSwipeStateChange?.(false);
  };

  const handlers = useSwipeable({
    trackTouch: true,
    trackMouse: false,
    preventScrollOnSwipe: false,
    delta: 10,
    onSwiping: (data) => {
      if (!enabled) return;
      if (data.dir !== 'Left') return;
      if (data.absX <= data.absY * 1.15) return;
      const next = -Math.min(130, Math.max(0, data.absX));
      setOffsetX(next);
      if (!isSwiping) {
        setIsSwiping(true);
        onSwipeStateChange?.(true);
      }
    },
    onSwipedLeft: (data) => {
      if (!enabled) return;
      const shouldDelete = data.absX >= 90;
      reset();
      if (shouldDelete) onTriggerDelete();
    },
    onSwiped: () => {
      reset();
    }
  });

  return (
    <div
      {...(enabled ? handlers : {})}
      className={cn(
        'w-full flex transition-transform',
        alignRight ? 'justify-end' : 'justify-start',
        isSwiping ? 'duration-75' : 'duration-200'
      )}
      style={{ transform: offsetX === 0 ? undefined : `translateX(${offsetX}px)` }}
    >
      {children}
    </div>
  );
};

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
  onToggleFocus,
  setTypingStatus: setTypingStatusGlobal
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
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [bgLinkInput, setBgLinkInput] = useState('');
  const [imageLinkInput, setImageLinkInput] = useState('');
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
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
  const [isOverTrashZone, setIsOverTrashZone] = useState(false);
  const [pendingDeleteSticker, setPendingDeleteSticker] = useState<Sticker | null>(null);
  const [sendButtonCoords, setSendButtonCoords] = useState<{ x: string; y: string }>({ x: '80%', y: '80%' });
  const [renderWindowEnd, setRenderWindowEnd] = useState(0);
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [sideHeartBurstKey, setSideHeartBurstKey] = useState(0);
  const [dailyHeartEnergy, setDailyHeartEnergy] = useState(0);
  const [dailyFireStreak, setDailyFireStreak] = useState(0);
  const [hasMutualToday, setHasMutualToday] = useState(false);
  const [showStreakOverlay, setShowStreakOverlay] = useState(false);
  const [previewFireStreak, setPreviewFireStreak] = useState<number | null>(null);
  const [floatingFlamePos, setFloatingFlamePos] = useState({ x: 0, y: 0 });
  const [isDraggingFlame, setIsDraggingFlame] = useState(false);
  const typingTimeoutRef = useRef<number | undefined>(undefined);
  const partnerTypingTimeoutRef = useRef<number | undefined>(undefined);
  const typingBroadcastChannelRef = useRef<any>(null);
  const lastSideHeartMessageIdRef = useRef<string | number | null>(null);
  const statsRefreshTimerRef = useRef<number | undefined>(undefined);
  const trashZoneRef = useRef<HTMLDivElement>(null);
  const touchDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDragMovedRef = useRef(false);
  const suppressNextStickerClickRef = useRef(false);
  const flamePointerOffsetRef = useRef({ x: 0, y: 0 });
  const flameMovedDuringDragRef = useRef(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReactionView[]>>({});
  const [activeReactionPickerFor, setActiveReactionPickerFor] = useState<string | number | null>(null);
  const [isReactionFeatureEnabled, setIsReactionFeatureEnabled] = useState(true);
  const [incomingDeleteRequests, setIncomingDeleteRequests] = useState<MessageDeleteRequestRow[]>([]);
  const [pendingDeleteRequestMessageIds, setPendingDeleteRequestMessageIds] = useState<Set<string>>(new Set());
  const [isSendSizing, setIsSendSizing] = useState(false);
  const [sendTextScale, setSendTextScale] = useState(1);
  const quickReactionEmojis = ['❤️', '😂', '😮'];
  const sendDragStartYRef = useRef<number | null>(null);
  const SEND_TEXT_SCALE_MIN = 0.35;
  const SEND_TEXT_SCALE_MAX = 3.4;
  const SEND_TEXT_DRAG_RANGE = 150;

  const { messages, setMessages, hasMore, sendMessage, openMessage, uploadImage, saveAsSticker, loadMore } = useChat(currentUser.id, receiver.id, false);

  const toMessageKey = (id: string | number) => String(id);
  const normalizeHeartEmoji = (emoji: string) => (emoji === '🩷' ? '💖' : emoji);
  const incomingDeleteRequestMessageIds = new Set(incomingDeleteRequests.map(r => r.message_id));
  const activeIncomingDeleteRequest = incomingDeleteRequests[0] ?? null;
  const activeIncomingTargetMessage = activeIncomingDeleteRequest
    ? messages.find(m => toMessageKey(m.id) === activeIncomingDeleteRequest.message_id)
    : null;

  const fetchDeleteRequests = async () => {
    const pairFilter = `and(requester_id.eq.${currentUser.id},approver_id.eq.${receiver.id}),and(requester_id.eq.${receiver.id},approver_id.eq.${currentUser.id})`;
    const { data, error } = await supabase
      .from('message_delete_requests')
      .select('id,message_id,requester_id,approver_id,status')
      .or(pairFilter)
      .eq('status', 'pending');

    if (error) {
      console.warn('⚠️ [DeleteRequest] Failed to fetch requests:', error.message);
      return;
    }

    const rows = (data ?? []) as MessageDeleteRequestRow[];
    setIncomingDeleteRequests(rows.filter(r => r.approver_id === currentUser.id));
    setPendingDeleteRequestMessageIds(new Set(rows.filter(r => r.requester_id === currentUser.id).map(r => r.message_id)));
  };

  const requestDeleteMessage = async (messageId: string | number) => {
    const messageKey = toMessageKey(messageId);
    if (messageKey.startsWith('temp-') || pendingDeleteRequestMessageIds.has(messageKey)) return;

    const { error } = await supabase
      .from('message_delete_requests')
      .insert([{ message_id: messageKey, requester_id: currentUser.id, approver_id: receiver.id, status: 'pending' }]);

    if (error) {
      console.warn('⚠️ [DeleteRequest] Failed to create request:', error.message);
      return;
    }

    setPendingDeleteRequestMessageIds(prev => new Set(prev).add(messageKey));
  };

  const respondDeleteRequest = async (request: MessageDeleteRequestRow, accept: boolean) => {
    const { error: updateError } = await supabase
      .from('message_delete_requests')
      .update({
        status: accept ? 'accepted' : 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('id', request.id)
      .eq('approver_id', currentUser.id);

    if (updateError) {
      console.warn('⚠️ [DeleteRequest] Failed to respond:', updateError.message);
      return;
    }

    if (accept) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', request.message_id)
        .select('id');

      if (deleteError) {
        console.warn('⚠️ [DeleteRequest] Failed to delete message after accept:', deleteError.message);
      } else if (!deletedRows || deletedRows.length === 0) {
        console.warn('⚠️ [DeleteRequest] Message was not deleted (likely blocked by RLS policy).');
      } else {
        setMessages(prev => prev.filter(m => toMessageKey(m.id) !== request.message_id));
      }
    }

    fetchDeleteRequests();
  };

  const mapReactions = (rows: MessageReactionRow[]) => {
    const grouped = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();

    for (const row of rows) {
      const messageKey = toMessageKey(row.message_id);
      const normalizedEmoji = normalizeHeartEmoji(row.emoji);
      if (!quickReactionEmojis.includes(normalizedEmoji)) continue;

      const byEmoji = grouped.get(messageKey) ?? new Map<string, { count: number; reactedByMe: boolean }>();
      const item = byEmoji.get(normalizedEmoji) ?? { count: 0, reactedByMe: false };
      item.count += 1;
      if (row.user_id === currentUser.id) item.reactedByMe = true;
      byEmoji.set(normalizedEmoji, item);
      grouped.set(messageKey, byEmoji);
    }

    const next: Record<string, MessageReactionView[]> = {};
    for (const [messageKey, byEmoji] of grouped.entries()) {
      next[messageKey] = Array.from(byEmoji.entries())
        .map(([emoji, val]) => ({ emoji, count: val.count, reactedByMe: val.reactedByMe }))
        .sort((a, b) => b.count - a.count);
    }
    return next;
  };

  const pushTypingStatus = async (isTyping: boolean) => {
    if (!setTypingStatusGlobal) return;
    await setTypingStatusGlobal(isTyping);
  };

  const ensureReactionFeatureEnabled = async () => {
    if (isReactionFeatureEnabled) return true;

    const { error } = await supabase
      .from('message_reactions')
      .select('id')
      .limit(1);

    if (error) {
      return false;
    }

    setIsReactionFeatureEnabled(true);
    return true;
  };

  const refreshMessageReactions = async (messageIds?: Array<string | number>) => {
    if (!isReactionFeatureEnabled) return;

    const targetIds = (messageIds ?? messages.map(m => m.id)).filter(id => !String(id).startsWith('temp-'));
    if (!targetIds.length) {
      if (!messageIds) setMessageReactions({});
      return;
    }

    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id,user_id,emoji')
      .in('message_id', targetIds as any);

    if (error) {
      setIsReactionFeatureEnabled(false);
      console.warn('⚠️ [Reaction] message_reactions table unavailable:', error.message);
      return;
    }

    const mapped = mapReactions((data ?? []) as MessageReactionRow[]);
    if (!messageIds) {
      setMessageReactions(mapped);
      return;
    }

    setMessageReactions(prev => {
      const next = { ...prev };
      for (const id of targetIds) {
        const key = toMessageKey(id);
        if (mapped[key]) next[key] = mapped[key];
        else delete next[key];
      }
      return next;
    });
  };

  const toggleMessageReaction = async (messageId: string | number, emoji: string) => {
    if (String(messageId).startsWith('temp-')) return;
    const normalizedEmoji = normalizeHeartEmoji(emoji);
    if (!quickReactionEmojis.includes(normalizedEmoji)) return;

    if (!isReactionFeatureEnabled) {
      const enabled = await ensureReactionFeatureEnabled();
      if (!enabled) {
        console.warn('⚠️ [Reaction] table not ready yet.');
        return;
      }
    }

    const messageKey = toMessageKey(messageId);
    const current = messageReactions[messageKey] ?? [];
    const existing = current.find(r => r.emoji === normalizedEmoji && r.reactedByMe);

    if (existing) {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId as any)
        .eq('user_id', currentUser.id)
        .in('emoji', [normalizedEmoji, '🩷']);
      if (error) {
        console.warn('⚠️ [Reaction] failed to remove reaction:', error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('message_reactions')
        .insert([{ message_id: messageId as any, user_id: currentUser.id, emoji: normalizedEmoji }]);
      if (error) {
        console.warn('⚠️ [Reaction] failed to add reaction:', error.message);
        return;
      }
    }

    setActiveReactionPickerFor(null);
    await refreshMessageReactions([messageId]);
  };

  useEffect(() => {
    if (!isReactionFeatureEnabled) return;
    refreshMessageReactions();
  }, [messages.length, currentUser.id, receiver.id, isReactionFeatureEnabled]);

  useEffect(() => {
    if (isReactionFeatureEnabled) return;
    ensureReactionFeatureEnabled();
  }, [currentUser.id, receiver.id, isReactionFeatureEnabled]);

  useEffect(() => {
    if (!isReactionFeatureEnabled) return;

    const channel = supabase
      .channel(`message-reactions-${currentUser.id}-${receiver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        refreshMessageReactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, receiver.id, isReactionFeatureEnabled]);

  useEffect(() => {
    if (!isReactionFeatureEnabled) return;

    const timer = window.setInterval(() => {
      refreshMessageReactions();
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentUser.id, receiver.id, isReactionFeatureEnabled]);

  useEffect(() => {
    fetchDeleteRequests();
  }, [currentUser.id, receiver.id, messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`message-delete-requests-${currentUser.id}-${receiver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_delete_requests' }, () => {
        fetchDeleteRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, receiver.id]);

  useEffect(() => {
    const refreshDailyLoveStats = async () => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      const pairFilter = `and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiver.id}),and(sender_id.eq.${receiver.id},receiver_id.eq.${currentUser.id})`;

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .or(pairFilter)
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', startOfTomorrow.toISOString());

      const todayCount = count ?? 0;
      setDailyHeartEnergy(Math.min(100, todayCount));

      const dayWindowStart = new Date(startOfToday);
      dayWindowStart.setDate(dayWindowStart.getDate() - 180);

      const { data: streakRows } = await supabase
        .from('messages')
        .select('sender_id, created_at')
        .or(pairFilter)
        .gte('created_at', dayWindowStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1500);

      const toDayKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const activeDays = new Map<string, { me: boolean; partner: boolean }>();
      for (const row of streakRows ?? []) {
        const key = toDayKey(new Date(row.created_at));
        const state = activeDays.get(key) ?? { me: false, partner: false };
        if (row.sender_id === currentUser.id) state.me = true;
        if (row.sender_id === receiver.id) state.partner = true;
        activeDays.set(key, state);
      }

      let streak = 0;
      const cursor = new Date(startOfToday);
      const todayState = activeDays.get(toDayKey(startOfToday));
      setHasMutualToday(Boolean(todayState?.me && todayState?.partner));
      while (true) {
        const dayState = activeDays.get(toDayKey(cursor));
        if (!dayState?.me || !dayState?.partner) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
        if (streak > 365) break;
      }

      setDailyFireStreak(streak);
    };

    if (statsRefreshTimerRef.current) {
      window.clearTimeout(statsRefreshTimerRef.current);
    }

    statsRefreshTimerRef.current = window.setTimeout(() => {
      refreshDailyLoveStats();
    }, 120);

    return () => {
      if (statsRefreshTimerRef.current) {
        window.clearTimeout(statsRefreshTimerRef.current);
      }
    };
  }, [currentUser.id, receiver.id, messages.length]);

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
  const hasInitialBottomSyncRef = useRef<boolean>(false);

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

  useEffect(() => {
    hasInitialBottomSyncRef.current = false;
  }, [currentUser.id, receiver.id]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const stickerRibbonRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement>(null);
  const prevIsOnline = useRef<boolean>(isOnline);
  const [isPartnerTypingBroadcast, setIsPartnerTypingBroadcast] = useState(false);

  const isOtherTyping = typingUsers[receiver.id] || isPartnerTypingBroadcast;

  const conversationTypingKey = [currentUser.id, receiver.id].sort().join('-');

  const broadcastTypingStatus = async (isTyping: boolean) => {
    const channel = typingBroadcastChannelRef.current;
    if (!channel) return;
    if (channel.state !== 'joined') return;
    try {
      await channel.send({
        type: 'broadcast',
        event: 'TYPING',
        payload: {
          senderId: currentUser.id,
          receiverId: receiver.id,
          isTyping,
          at: Date.now()
        }
      });
    } catch (_e) {
      // silent fail
    }
  };

  useEffect(() => {
    const channel = supabase.channel(`typing-${conversationTypingKey}`)
      .on('broadcast', { event: 'TYPING' }, ({ payload }) => {
        const data = payload as { senderId?: string; receiverId?: string; isTyping?: boolean };
        if (data.senderId !== receiver.id || data.receiverId !== currentUser.id) return;

        const typing = Boolean(data.isTyping);
        setIsPartnerTypingBroadcast(typing);

        if (partnerTypingTimeoutRef.current) {
          window.clearTimeout(partnerTypingTimeoutRef.current);
        }

        if (typing) {
          partnerTypingTimeoutRef.current = window.setTimeout(() => {
            setIsPartnerTypingBroadcast(false);
          }, 2600);
        }
      })
      .subscribe();

    typingBroadcastChannelRef.current = channel;

    return () => {
      if (partnerTypingTimeoutRef.current) {
        window.clearTimeout(partnerTypingTimeoutRef.current);
      }
      typingBroadcastChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationTypingKey, currentUser.id, receiver.id]);

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

  const extractStickerStoragePath = (url: string) => {
    const marker = '/storage/v1/object/public/stickers/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return null;
    const rawPath = url.slice(markerIndex + marker.length).split('?')[0];
    return decodeURIComponent(rawPath);
  };

  const deleteStickerPermanently = async (sticker: Sticker) => {
    setStickers(prev => prev.filter(s => s.id !== sticker.id));

    const storagePath = extractStickerStoragePath(sticker.image_url);
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from('stickers').remove([storagePath]);
      if (storageError) {
        console.warn('⚠️ [Sticker] Failed to remove storage object:', storageError.message);
      }
    }

    const { error } = await supabase
      .from('stickers')
      .delete()
      .eq('id', sticker.id)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('❌ [Sticker] Failed to delete sticker:', error.message);
      fetchStickers();
      return;
    }

    console.log('🗑️ [Sticker] Deleted permanently:', sticker.id);
  };

  const handleStickerDragStart = (stickerId: string, e: React.DragEvent<HTMLDivElement>) => {
    setDraggingStickerId(stickerId);
    setIsOverTrashZone(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stickerId);
  };

  const handleStickerDragEnd = () => {
    setDraggingStickerId(null);
    setIsOverTrashZone(false);
  };

  const handleStickerTouchStart = (stickerId: string, e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setDraggingStickerId(stickerId);
    setIsOverTrashZone(false);
    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });
    touchDragStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchDragMovedRef.current = false;
  };

  const handleStickerTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!draggingStickerId) return;
    const touch = e.touches[0];
    if (!touch) return;

    const start = touchDragStartRef.current;
    if (start) {
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!touchDragMovedRef.current && Math.hypot(dx, dy) > 12) {
        touchDragMovedRef.current = true;
      }
    }

    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });

    const trashRect = trashZoneRef.current?.getBoundingClientRect();
    if (!trashRect) return;

    const isInsideTrash =
      touch.clientX >= trashRect.left &&
      touch.clientX <= trashRect.right &&
      touch.clientY >= trashRect.top &&
      touch.clientY <= trashRect.bottom;

    setIsOverTrashZone(isInsideTrash);
  };

  const handleStickerTouchEnd = () => {
    if (!draggingStickerId) return;

    const target = stickers.find(s => s.id === draggingStickerId);
    if (isOverTrashZone && target) {
      setPendingDeleteSticker(target);
      suppressNextStickerClickRef.current = true;
    } else if (touchDragMovedRef.current) {
      // User dragged but did not drop into trash: do not treat this as a sticker send tap.
      suppressNextStickerClickRef.current = true;
    }

    setDraggingStickerId(null);
    setIsOverTrashZone(false);
    setTouchDragPosition(null);
    touchDragStartRef.current = null;
    touchDragMovedRef.current = false;
  };

  const handleDropToTrash = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverTrashZone(false);

    if (!draggingStickerId) return;
    const target = stickers.find(s => s.id === draggingStickerId);
    if (target) {
      setPendingDeleteSticker(target);
    }
    setDraggingStickerId(null);
  };

  const confirmDeleteSticker = async () => {
    if (!pendingDeleteSticker) return;
    await deleteStickerPermanently(pendingDeleteSticker);
    setPendingDeleteSticker(null);
  };

  const markAsRead = async () => {
    if (document.visibilityState !== 'visible') return;
    // ONLY auto-mark regular text messages as read. 
    // Heart messages (gifts) MUST be opened manually by clicking.
    const unreadReceived = messages.filter(m => 
      m.receiver_id === currentUser.id && 
      !m.is_opened && 
      isNormalChatEffect(m.effect) && 
      !m.id.toString().startsWith('temp-')
    );
    for (const msg of unreadReceived) {
      await openMessage(msg.id);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const msgTime = new Date(lastMessage.created_at).getTime();
    const isRecent = Date.now() - msgTime < 3000;
    if (!isRecent) return;

    notificationAudioRef.current?.play().catch(() => {});

    const isTemp = lastMessage.id.toString().startsWith('temp-');
    if (!isTemp && lastSideHeartMessageIdRef.current !== lastMessage.id) {
      setSideHeartBurstKey(prev => prev + 1);
      lastSideHeartMessageIdRef.current = lastMessage.id;
    }

    if (lastMessage.image_url && !isTemp) {
      setActiveExplosions(prev => ({ ...prev, [lastMessage.id]: lastMessage.image_url! }));
    }
  }, [messages]);

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
       pushTypingStatus(false);
       broadcastTypingStatus(false);
       return;
    }

     pushTypingStatus(true);
     broadcastTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
       pushTypingStatus(false);
       broadcastTypingStatus(false);
    }, 2000);
  };

  const handleComposerBlur = () => {
    setIsComposerFocused(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
    pushTypingStatus(false);
    broadcastTypingStatus(false);
  };

  const handleComposerFocus = () => {
    setIsComposerFocused(true);
    requestAnimationFrame(() => {
      scrollToBottom('auto');
    });
  };

  const handleSend = async (sizeOverride?: number) => {
    if (text.trim() || sizeOverride) {
      pushTypingStatus(false);
      broadcastTypingStatus(false);
      const effectValue = sizeOverride ? `heart:${sizeOverride}` : 'none';
      await sendMessage(text, undefined, effectValue);
      setText('');
      setShowEmoji(false);
      setShowSendActions(false);
    }
  };

  const sendTextWithScale = async (scale: number) => {
    if (!text.trim()) return;
    pushTypingStatus(false);
    broadcastTypingStatus(false);

    const normalizedScale = Math.max(SEND_TEXT_SCALE_MIN, Math.min(SEND_TEXT_SCALE_MAX, scale));
    const effectValue = Math.abs(normalizedScale - 1) < 0.05
      ? 'none'
      : `textsize:${normalizedScale.toFixed(2)}`;

    await sendMessage(text, undefined, effectValue);
    setText('');
    setShowEmoji(false);
    setShowSendActions(false);
  };

  const getSendScaleFromDelta = (deltaY: number) => {
    if (deltaY >= 0) {
      const progress = Math.min(deltaY, SEND_TEXT_DRAG_RANGE) / SEND_TEXT_DRAG_RANGE;
      return 1 + progress * (SEND_TEXT_SCALE_MAX - 1);
    }

    const progress = Math.min(Math.abs(deltaY), SEND_TEXT_DRAG_RANGE) / SEND_TEXT_DRAG_RANGE;
    return 1 - progress * (1 - SEND_TEXT_SCALE_MIN);
  };

  const getSendScaleLabel = (scale: number) => {
    if (scale >= 2.2) return 'XL';
    if (scale >= 1.25) return 'L';
    if (scale >= 0.85) return 'M';
    return 'S';
  };

  const startSendSizeDrag = (startY: number) => {
    if (!text.trim() || isUploading) return;
    sendDragStartYRef.current = startY;
    setSendTextScale(1);
    setIsSendSizing(true);
  };

  const moveSendSizeDrag = (currentY: number) => {
    if (!isSendSizing || sendDragStartYRef.current === null) return;
    const deltaY = sendDragStartYRef.current - currentY;
    setSendTextScale(getSendScaleFromDelta(deltaY));
  };

  const endSendSizeDrag = async (endY: number) => {
    if (!isSendSizing || sendDragStartYRef.current === null) return;
    const deltaY = sendDragStartYRef.current - endY;
    const finalScale = getSendScaleFromDelta(deltaY);
    setIsSendSizing(false);
    sendDragStartYRef.current = null;
    await sendTextWithScale(finalScale);
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
  const isNormalChatEffect = (effect?: string) => getEffectKind(effect) !== 'heart';
  const getTextScaleFromEffect = (effect?: string) => {
    if (getEffectKind(effect) !== 'textsize') return 1;
    const raw = parseFloat((effect || '').split(':')[1] || '1');
    if (!Number.isFinite(raw)) return 1;
    return Math.max(0.75, Math.min(2.2, raw));
  };

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
  
  const normalMessages = messages.filter(m => (m.is_opened || isNormalChatEffect(m.effect)));
  const firstUnreadId = messages.find(m => m.receiver_id === currentUser.id && !m.is_opened && isNormalChatEffect(m.effect))?.id;
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

  useEffect(() => {
    if (hasInitialBottomSyncRef.current) return;
    if (!scrollRef.current) return;
    if (normalMessages.length === 0) return;
    if (renderWindowEnd === 0 || visibleNormalMessages.length === 0) return;

    if (renderWindowEnd < normalMessages.length) {
      setRenderWindowEnd(normalMessages.length);
      return;
    }

    hasInitialBottomSyncRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    });
  }, [normalMessages.length, renderWindowEnd, visibleNormalMessages.length]);

  const toHeartVisualFill = (energy: number) => {
    const clamped = Math.max(0, Math.min(100, energy));
    if (clamped >= 100) return 100;
    // Non-linear mapping so high values (e.g. 88%) still look clearly below full.
    return Math.max(0, Math.min(92, clamped * 0.72 + Math.pow(clamped / 100, 2) * 8));
  };
  const heartMainFill = toHeartVisualFill(dailyHeartEnergy);
  const heartSmallFill = toHeartVisualFill(dailyHeartEnergy);
  const reviewStages = [10, 20, 30, 50, 100] as const;
  const isPreviewFire = previewFireStreak !== null;
  const effectiveFireStreak = previewFireStreak ?? dailyFireStreak;
  const effectiveMutualToday = isPreviewFire ? true : hasMutualToday;
  const fireChain = effectiveFireStreak > 0 ? '🔥'.repeat(Math.min(5, effectiveFireStreak)) : '';
  const flamePower = effectiveMutualToday
    ? Math.min(1, 0.68 + effectiveFireStreak * 0.06)
    : Math.min(0.55, 0.24 + effectiveFireStreak * 0.035);
  const flameSpeed = effectiveMutualToday
    ? Math.max(0.34, 0.92 - effectiveFireStreak * 0.04)
    : Math.max(0.6, 1.24 - effectiveFireStreak * 0.02);
  const flameTier = effectiveFireStreak >= 100 ? 5 : effectiveFireStreak >= 50 ? 4 : effectiveFireStreak >= 30 ? 3 : effectiveFireStreak >= 20 ? 2 : effectiveFireStreak >= 10 ? 1 : 0;
  const flameOuterPath = flameTier >= 5
    ? 'M33 2c5 10 4 17-2 24-4 5-6 9-6 14 0 9 7 16 16 16s16-7 16-16c0-10-6-17-24-38z'
    : flameTier >= 3
      ? 'M34 4c3 9 1 15-4 21-4 5-5 8-5 13 0 8 6 14 14 14s14-6 14-14c0-9-5-15-19-34z'
      : 'M34 5c2 9-1 14-5 19-3 4-4 7-4 11 0 6 5 11 11 11s11-5 11-11c0-7-4-12-13-30z';
  const flameInnerPath = flameTier >= 5
    ? 'M33 18c2 5 1 9-2 13-2 3-3 5-3 8 0 6 4 10 10 10s10-4 10-10c0-6-4-11-15-21z'
    : flameTier >= 3
      ? 'M33 20c1 4 0 8-2 11-2 3-2 4-2 7 0 5 4 8 8 8s8-3 8-8c0-5-3-9-12-18z'
      : 'M33 22c1 4 0 7-2 10-2 2-2 4-2 6 0 4 3 7 7 7s7-3 7-7c0-4-2-8-10-16z';
  const flameSizeBoost = flameTier >= 5 ? 30 : flameTier >= 4 ? 22 : flameTier >= 3 ? 14 : flameTier >= 2 ? 8 : flameTier >= 1 ? 4 : 0;
  const floatingFlameSize = 56 + flameSizeBoost;
  const overlayFlameScale = flameTier >= 5 ? 1.35 : flameTier >= 4 ? 1.24 : flameTier >= 3 ? 1.16 : flameTier >= 2 ? 1.08 : flameTier >= 1 ? 1.03 : 1;
  const flameModeLabel = flameTier >= 5 ? 'DIVINE 100' : flameTier >= 4 ? 'TITAN 50' : flameTier >= 3 ? 'PHOENIX 30' : flameTier >= 2 ? 'BLAZE 20' : flameTier >= 1 ? 'WARM 10' : 'EMBER';
  const floatingFlameStorageKey = `lovechat:floating-flame:${[currentUser.id, receiver.id].sort().join('-')}`;

  const clampFloatingFlame = (nextX: number, nextY: number) => {
    const padding = 8;
    const maxX = Math.max(padding, window.innerWidth - floatingFlameSize - padding);
    const maxY = Math.max(padding, window.innerHeight - floatingFlameSize - padding);
    return {
      x: Math.min(Math.max(nextX, padding), maxX),
      y: Math.min(Math.max(nextY, padding), maxY)
    };
  };

  const handleFloatingFlamePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    flameMovedDuringDragRef.current = false;
    setIsDraggingFlame(true);
    flamePointerOffsetRef.current = {
      x: event.clientX - floatingFlamePos.x,
      y: event.clientY - floatingFlamePos.y
    };
  };

  const handleFloatingFlameClick = () => {
    if (flameMovedDuringDragRef.current) {
      flameMovedDuringDragRef.current = false;
      return;
    }
    setShowStreakOverlay(true);
  };

  useEffect(() => {
    const fallback = clampFloatingFlame(window.innerWidth - 90, 96);

    try {
      const raw = window.localStorage.getItem(floatingFlameStorageKey);
      if (!raw) {
        setFloatingFlamePos(fallback);
        return;
      }

      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setFloatingFlamePos(clampFloatingFlame(parsed.x, parsed.y));
      } else {
        setFloatingFlamePos(fallback);
      }
    } catch {
      setFloatingFlamePos(fallback);
    }
  }, [floatingFlameStorageKey]);

  useEffect(() => {
    if (floatingFlamePos.x === 0 && floatingFlamePos.y === 0) return;
    try {
      window.localStorage.setItem(floatingFlameStorageKey, JSON.stringify(floatingFlamePos));
    } catch {
      // Ignore storage errors (private mode/quota)
    }
  }, [floatingFlamePos, floatingFlameStorageKey]);

  useEffect(() => {
    if (!isDraggingFlame) return;

    const onPointerMove = (event: PointerEvent) => {
      const nextX = event.clientX - flamePointerOffsetRef.current.x;
      const nextY = event.clientY - flamePointerOffsetRef.current.y;
      flameMovedDuringDragRef.current = true;
      setFloatingFlamePos(clampFloatingFlame(nextX, nextY));
    };

    const onPointerUp = () => {
      setIsDraggingFlame(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingFlame]);

  useEffect(() => {
    const onResize = () => {
      setFloatingFlamePos(prev => clampFloatingFlame(prev.x, prev.y));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('visualViewport' in window)) return;

    const vv = window.visualViewport;
    if (!vv) return;

    const updateKeyboardInset = () => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      if (!isMobile || !isComposerFocused) return;

      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      if (inset > 60) {
        requestAnimationFrame(() => {
          scrollToBottom('auto');
        });
      }
    };

    updateKeyboardInset();
    vv.addEventListener('resize', updateKeyboardInset);
    vv.addEventListener('scroll', updateKeyboardInset);

    return () => {
      vv.removeEventListener('resize', updateKeyboardInset);
      vv.removeEventListener('scroll', updateKeyboardInset);
    };
  }, [isComposerFocused]);

  useEffect(() => {
    setFloatingFlamePos(prev => clampFloatingFlame(prev.x, prev.y));
  }, [floatingFlameSize]);

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

  useEffect(() => {
    if (!showEmoji) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmoji(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showEmoji]);

  useEffect(() => {
    if (!showStickerRibbon) return;

    const handleOutsideRibbon = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (stickerRibbonRef.current && !stickerRibbonRef.current.contains(target)) {
        setShowStickerRibbon(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideRibbon);
    document.addEventListener('touchstart', handleOutsideRibbon);

    return () => {
      document.removeEventListener('mousedown', handleOutsideRibbon);
      document.removeEventListener('touchstart', handleOutsideRibbon);
    };
  }, [showStickerRibbon]);

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

      <button
        type="button"
        onPointerDown={handleFloatingFlamePointerDown}
        onClick={handleFloatingFlameClick}
        className={cn(
          "fixed z-[1450] rounded-full touch-none select-none",
          isDraggingFlame ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105"
        )}
        style={{
          left: `${floatingFlamePos.x}px`,
          top: `${floatingFlamePos.y}px`,
          width: `${floatingFlameSize}px`,
          height: `${floatingFlameSize}px`
        }}
        title="Kéo để dời lửa, chạm để xem chuỗi"
      >
        {flameTier >= 2 && <span className={cn("flame-evolution-ring", isPreviewFire && "flame-preview-ring")} />}
        {flameTier >= 4 && <span className={cn("flame-evolution-ring flame-evolution-ring--2", isPreviewFire && "flame-preview-ring")} />}
        {flameTier >= 3 && <span className={cn("flame-evolution-spark flame-evolution-spark--a", isPreviewFire && "flame-preview-spark")} />}
        {flameTier >= 3 && <span className={cn("flame-evolution-spark flame-evolution-spark--b", isPreviewFire && "flame-preview-spark")} />}
        <svg viewBox="0 0 64 64" className={cn(`w-full h-full flame-svg flame-tier-${flameTier}`, isPreviewFire && "flame-preview")} style={{ opacity: 0.62 + flamePower * 0.38, filter: `drop-shadow(0 0 ${8 + flamePower * 16}px ${isPreviewFire ? 'rgba(255,255,255,0.42)' : `rgba(251,113,133,${0.3 + flamePower * 0.55})`})` }}>
          <defs>
            <linearGradient id="flameOuterFloat" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={isPreviewFire ? '#9ca3af' : '#ef4444'} />
              <stop offset="45%" stopColor={isPreviewFire ? '#d1d5db' : flameTier >= 3 ? '#f97316' : '#fb7185'} />
              <stop offset="100%" stopColor={isPreviewFire ? '#f3f4f6' : '#fde68a'} />
            </linearGradient>
            <linearGradient id="flameInnerFloat" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={isPreviewFire ? '#e5e7eb' : '#fb7185'} />
              <stop offset="100%" stopColor={isPreviewFire ? '#ffffff' : flameTier >= 5 ? '#fff7c2' : '#ffffff'} />
            </linearGradient>
          </defs>
          {flameTier >= 5 && (
            <path d="M22 34c-3-5-3-9 0-14 1 4 4 6 7 8-2 2-4 4-7 6z" fill={isPreviewFire ? '#d1d5db' : '#f59e0b'} opacity="0.85" className="flame-outer" style={{ animationDuration: `${Math.max(0.3, flameSpeed - 0.16)}s` }} />
          )}
          {flameTier >= 5 && (
            <path d="M46 34c3-5 3-9 0-14-1 4-4 6-7 8 2 2 4 4 7 6z" fill={isPreviewFire ? '#d1d5db' : '#f59e0b'} opacity="0.85" className="flame-outer" style={{ animationDuration: `${Math.max(0.3, flameSpeed - 0.16)}s` }} />
          )}
          <path
            d={flameOuterPath}
            fill="url(#flameOuterFloat)"
            className="flame-outer"
            style={{ animationDuration: `${flameSpeed}s` }}
          />
          <path
            d={flameInnerPath}
            fill="url(#flameInnerFloat)"
            className="flame-inner"
            style={{ animationDuration: `${Math.max(0.35, flameSpeed - 0.12)}s` }}
          />
        </svg>
      </button>
      
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
        <div className="fixed inset-0 z-[1600] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl relative">
            <button onClick={cancelPreview} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white mb-6 pr-6 text-left">Gửi Sticker? 🌹</h3>
            <div className="aspect-square w-full rounded-none overflow-hidden mb-8 bg-gray-50/50">
              <SmartImage src={previewUrl} className="w-full h-full" />
            </div>
            <div className="flex space-x-3">
              <button onClick={() => confirmUpload('save')} disabled={isUploading} className="flex-1 h-14 flex items-center justify-center bg-pink-100 text-pink-600 font-bold text-sm sm:text-base rounded-none hover:bg-pink-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">{isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Thư viện"}</button>
              <button onClick={() => confirmUpload('send')} disabled={isUploading} className="flex-1 h-14 flex items-center justify-center bg-pink-500 text-white font-bold text-sm sm:text-base rounded-none hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/30 disabled:opacity-70 disabled:cursor-not-allowed">{isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gửi ngay"}</button>
            </div>
          </div>
        </div>
      )}

      {showStreakOverlay && (
        <div className="fixed inset-0 z-[1800] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <button
            type="button"
            onClick={() => {
              setShowStreakOverlay(false);
              setPreviewFireStreak(null);
            }}
            className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative w-[clamp(160px,36vw,320px)] h-[clamp(190px,42vw,360px)] flex items-center justify-center" style={{ transform: `scale(${overlayFlameScale})` }}>
            {flameTier >= 2 && <span className={cn("flame-evolution-ring", isPreviewFire && "flame-preview-ring")} />}
            {flameTier >= 4 && <span className={cn("flame-evolution-ring flame-evolution-ring--2", isPreviewFire && "flame-preview-ring")} />}
            {flameTier >= 3 && <span className={cn("flame-evolution-spark flame-evolution-spark--a", isPreviewFire && "flame-preview-spark")} />}
            {flameTier >= 3 && <span className={cn("flame-evolution-spark flame-evolution-spark--b", isPreviewFire && "flame-preview-spark")} />}
            <svg viewBox="0 0 64 64" className={cn(`w-full h-full flame-svg flame-tier-${flameTier}`, isPreviewFire && "flame-preview")} style={{ opacity: 0.7 + flamePower * 0.3, filter: `drop-shadow(0 0 ${18 + flamePower * 28}px ${isPreviewFire ? 'rgba(255,255,255,0.45)' : `rgba(251,113,133,${0.45 + flamePower * 0.4})`})` }}>
              <defs>
                <linearGradient id="flameOuterFull" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={isPreviewFire ? '#9ca3af' : '#ef4444'} />
                  <stop offset="42%" stopColor={isPreviewFire ? '#d1d5db' : flameTier >= 3 ? '#f97316' : '#fb7185'} />
                  <stop offset="100%" stopColor={isPreviewFire ? '#f3f4f6' : '#fde68a'} />
                </linearGradient>
                <linearGradient id="flameInnerFull" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={isPreviewFire ? '#e5e7eb' : '#fb7185'} />
                  <stop offset="100%" stopColor={isPreviewFire ? '#ffffff' : flameTier >= 5 ? '#fff7c2' : '#fff7ed'} />
                </linearGradient>
              </defs>
              {flameTier >= 5 && (
                <path d="M22 34c-3-5-3-9 0-14 1 4 4 6 7 8-2 2-4 4-7 6z" fill={isPreviewFire ? '#d1d5db' : '#f59e0b'} opacity="0.9" className="flame-outer" style={{ animationDuration: `${Math.max(0.28, flameSpeed - 0.2)}s` }} />
              )}
              {flameTier >= 5 && (
                <path d="M46 34c3-5 3-9 0-14-1 4-4 6-7 8 2 2 4 4 7 6z" fill={isPreviewFire ? '#d1d5db' : '#f59e0b'} opacity="0.9" className="flame-outer" style={{ animationDuration: `${Math.max(0.28, flameSpeed - 0.2)}s` }} />
              )}
              <path
                d={flameOuterPath}
                fill="url(#flameOuterFull)"
                className="flame-outer"
                style={{ animationDuration: `${Math.max(0.34, flameSpeed - 0.1)}s` }}
              />
              <path
                d={flameInnerPath}
                fill="url(#flameInnerFull)"
                className="flame-inner"
                style={{ animationDuration: `${Math.max(0.28, flameSpeed - 0.22)}s` }}
              />
            </svg>
          </div>

          <div className="mt-8 text-center text-white">
            <p className="text-5xl sm:text-6xl font-black">{effectiveFireStreak}</p>
            <p className="mt-2 text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-rose-200">ngày liên tiếp</p>
            <p className="mt-1 text-[10px] sm:text-xs font-black tracking-[0.25em] text-amber-200/90">{isPreviewFire ? `${flameModeLabel} PREVIEW` : flameModeLabel}</p>
            <p className="mt-4 text-xs sm:text-sm text-rose-100/85">Nhắn mỗi ngày để lửa cháy mãnh liệt hơn</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {reviewStages.map(stage => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setPreviewFireStreak(stage)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black tracking-wide border transition-colors",
                    previewFireStreak === stage ? "bg-rose-400 border-rose-200 text-white" : "bg-white/10 border-white/20 text-rose-100 hover:bg-white/20"
                  )}
                >
                  {stage} ngày
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreviewFireStreak(null)}
                className="px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black tracking-wide border bg-rose-500/80 hover:bg-rose-400 border-rose-200 text-white transition-colors"
              >
                Dữ liệu thật
              </button>
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
        "sticky top-0 flex items-center justify-between px-4 sm:px-6 md:px-10 z-[1200] transition-all duration-1000 overflow-visible",
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
            <p className={cn("text-[9px] sm:text-[10px] font-black tracking-wide flex items-center whitespace-nowrap transition-all", isFocusedMode ? "text-white/70" : "text-pink-400")}>
               <span className={cn("inline-block w-2 h-2 rounded-full mr-2", isOnline ? "bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "bg-gray-300")} />
              {fireChain ? `${fireChain} ${effectiveFireStreak} ngày` : 'Chưa có chuỗi'} · Tim {dailyHeartEnergy}%
            </p>
          </div>
        </div>

        {/* Header Actions Dropdown */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={cn(
              "p-3 rounded-2xl backdrop-blur-md border shadow-lg hover:scale-105 active:scale-95 transition-all",
              isFocusedMode ? "bg-white/10 text-white border-white/20" : "bg-white/40 dark:bg-white/5 text-pink-500 border-white/20"
            )}
            title="Làm mới"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

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

        {/* Persistent Theme Signature - Asymmetric 3D hearts (responsive, light/dark aware) */}
        {!customBg && (
          <>
            <div
              key={`rose-heart-main-${sideHeartBurstKey}`}
              className="absolute left-[56%] top-[48%] pointer-events-none z-0 transition-all duration-1000"
              style={{
                width: 'clamp(260px, 62vw, 520px)',
                height: 'clamp(230px, 56vw, 480px)',
                transform: 'translate(-50%, -50%) rotate(-14deg)',
                animation: sideHeartBurstKey > 0 ? 'rose-heart-main-burst 0.9s cubic-bezier(0.2,0.8,0.25,1)' : undefined,
                background: isDarkMode
                  ? `linear-gradient(to top, rgba(244,63,94,0.94) 0%, rgba(244,63,94,0.94) ${heartMainFill}%, rgba(255,228,230,0.1) ${heartMainFill}%, rgba(255,228,230,0.1) 100%)`
                  : `linear-gradient(to top, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.9) ${heartMainFill}%, rgba(251,113,133,0.2) ${heartMainFill}%, rgba(251,113,133,0.2) 100%)`,
                WebkitMaskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                maskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                filter: isDarkMode
                  ? 'drop-shadow(0 30px 56px rgba(244,63,94,0.56))'
                  : 'drop-shadow(0 28px 46px rgba(239,68,68,0.46))'
              }}
            />

            <div
              key={`rose-heart-small-${sideHeartBurstKey}`}
              className="absolute left-[30%] top-[62%] pointer-events-none z-0 transition-all duration-1000"
              style={{
                width: 'clamp(140px, 30vw, 260px)',
                height: 'clamp(120px, 26vw, 220px)',
                transform: 'translate(-50%, -50%) rotate(18deg)',
                animation: sideHeartBurstKey > 0 ? 'rose-heart-small-burst 0.86s cubic-bezier(0.2,0.8,0.25,1)' : undefined,
                background: isDarkMode
                  ? `linear-gradient(to top, rgba(244,63,94,0.9) 0%, rgba(244,63,94,0.9) ${heartSmallFill}%, rgba(255,228,230,0.08) ${heartSmallFill}%, rgba(255,228,230,0.08) 100%)`
                  : `linear-gradient(to top, rgba(239,68,68,0.86) 0%, rgba(239,68,68,0.86) ${heartSmallFill}%, rgba(251,113,133,0.18) ${heartSmallFill}%, rgba(251,113,133,0.18) 100%)`,
                WebkitMaskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                maskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                filter: isDarkMode
                  ? 'drop-shadow(0 18px 30px rgba(244,63,94,0.52))'
                  : 'drop-shadow(0 16px 26px rgba(239,68,68,0.46))'
              }}
            />

            <div
              className="absolute left-[64%] top-[47%] pointer-events-none z-0 transition-all duration-1000"
              style={{
                width: 'clamp(300px, 74vw, 640px)',
                height: 'clamp(260px, 66vw, 560px)',
                transform: 'translate(-50%, -50%) rotate(-12deg)',
                background: isDarkMode ? 'rgba(248,113,113,0.26)' : 'rgba(239,68,68,0.22)',
                WebkitMaskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                maskImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/></svg>\")",
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                filter: 'blur(24px)',
                opacity: isDarkMode ? 0.8 : 0.72
              }}
            />
          </>
        )}

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
            const reactionItems = messageReactions[toMessageKey(msg.id)] ?? [];
            const isReactionPickerOpen = activeReactionPickerFor === msg.id;
            const hasIncomingDeleteRequest = incomingDeleteRequestMessageIds.has(toMessageKey(msg.id));
            const textScale = getTextScaleFromEffect(msg.effect);
            const textFontPx = Math.max(8, Math.min(56, Math.round(15 * textScale)));
            const textLineHeight = textScale >= 2 ? 1.12 : textScale <= 0.7 ? 1.22 : 1.34;
            
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
                  <SwipeToDeleteWrapper
                    enabled={false}
                    alignRight={isMe}
                    onTriggerDelete={() => requestDeleteMessage(msg.id)}
                  >
                    <div className={cn(
                      "max-w-[92%] sm:max-w-[86%] md:max-w-[80%] group relative",
                      hasIncomingDeleteRequest && "ring-2 ring-amber-300/80 rounded-2xl px-1 py-1"
                    )}>
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
                                  "px-8 py-5 font-medium rounded-2xl shadow-2xl",
                                  "px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5",
                                  textScale >= 2 && "font-semibold",
                                  isMe 
                                    ? (isFocusedMode ? `${bubbleTheme.focusMe} rounded-tr-none` : `${bubbleTheme.me} rounded-tr-none`) 
                                    : (isFocusedMode ? `${bubbleTheme.focusPartner} rounded-tl-none` : `${bubbleTheme.partner} rounded-tl-none`)
                                )
                          )}
                          style={isHeartEffect(msg.effect) ? undefined : { fontSize: `${textFontPx}px`, lineHeight: textLineHeight }}
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

                    {!String(msg.id).startsWith('temp-') && (
                      <div className={cn("mt-1.5 flex items-center gap-1.5 flex-wrap", isMe ? "justify-end" : "justify-start")}>
                        {reactionItems.map((item) => (
                          <button
                            key={`${msg.id}-${item.emoji}`}
                            type="button"
                            onClick={() => toggleMessageReaction(msg.id, item.emoji)}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs border transition-all",
                              item.reactedByMe
                                ? "bg-rose-500/20 border-rose-400/50 text-rose-300"
                                : "bg-white/10 border-white/20 text-slate-200"
                            )}
                            title="Bỏ cảm xúc"
                          >
                            <span className="inline-flex items-center gap-1">
                              <ReactionIcon emoji={item.emoji} className="w-3.5 h-3.5" />
                              <span>{item.count}</span>
                            </span>
                          </button>
                        ))}

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveReactionPickerFor(prev => (prev === msg.id ? null : msg.id))}
                            className={cn(
                              "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                              isReactionPickerOpen
                                ? "bg-rose-500/35 border-rose-300/60 text-rose-100"
                                : isMe
                                  ? "bg-rose-500/20 border-rose-300/40 text-rose-200 hover:bg-rose-500/30"
                                  : "bg-cyan-500/20 border-cyan-300/40 text-cyan-100 hover:bg-cyan-500/30"
                            )}
                            title="Bày tỏ cảm xúc"
                          >
                            <HeartIcon className="w-3.5 h-3.5 fill-current" />
                          </button>

                          {isReactionPickerOpen && (
                            <div className={cn(
                              "absolute z-[1450] bottom-full mb-2 px-2 py-1 rounded-full border backdrop-blur-xl flex items-center gap-1",
                              isMe ? "right-0" : "left-0",
                              "bg-black/60 border-white/20"
                            )}>
                              {quickReactionEmojis.map((emoji) => (
                                <button
                                  key={`${msg.id}-${emoji}`}
                                  type="button"
                                  onClick={() => toggleMessageReaction(msg.id, emoji)}
                                  className="w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform"
                                >
                                  <ReactionIcon emoji={emoji} className="w-5 h-5" />
                                </button>
                              ))}
                              <span className="mx-0.5 h-4 w-px bg-white/25" />
                              <button
                                type="button"
                                onClick={async () => {
                                  await requestDeleteMessage(msg.id);
                                  setActiveReactionPickerFor(null);
                                }}
                                disabled={pendingDeleteRequestMessageIds.has(toMessageKey(msg.id))}
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                                  pendingDeleteRequestMessageIds.has(toMessageKey(msg.id))
                                    ? "text-amber-200/70 cursor-not-allowed"
                                    : "text-rose-200 hover:text-rose-100 hover:scale-110"
                                )}
                                title={pendingDeleteRequestMessageIds.has(toMessageKey(msg.id)) ? "Đang chờ chấp nhận xóa" : "Yêu cầu xóa tin nhắn"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                      {pendingDeleteRequestMessageIds.has(toMessageKey(msg.id)) && (
                        <p className={cn("mt-1 text-[10px] font-bold", isMe ? "text-amber-300 text-right" : "text-amber-300")}>Đang chờ đối phương chấp nhận xóa</p>
                      )}
                      {hasIncomingDeleteRequest && (
                        <p className={cn("mt-1 text-[10px] font-bold", isMe ? "text-amber-200 text-right" : "text-amber-200")}>Người ấy đang xin xóa tin nhắn này</p>
                      )}
                    </div>
                  </SwipeToDeleteWrapper>
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
              <div className="flex items-center gap-1.5 bg-[var(--bg-bubble-partner)] backdrop-blur-md dark:bg-slate-800 px-5 py-3.5 rounded-2xl shadow-lg border border-pink-50">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
               </div>
            </div>
          )}
        </div>
      </div>

      {activeIncomingDeleteRequest && (
        <div className="fixed left-1/2 top-[78px] sm:top-[86px] -translate-x-1/2 z-[1600] w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] md:w-[calc(100%-5rem)] max-w-4xl pointer-events-none">
          <div className={cn(
            "w-full rounded-2xl border backdrop-blur-md px-4 py-3 flex flex-col gap-3 shadow-2xl pointer-events-auto",
            isDarkMode
              ? "border-amber-300/35 bg-amber-900/35"
              : "border-amber-300/80 bg-amber-100/95"
          )}>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs sm:text-sm font-semibold",
                isDarkMode ? "text-amber-100" : "text-amber-900"
              )}>
                Người ấy gửi yêu cầu xóa tin nhắn sau. Bạn có chấp nhận không?
              </p>
              <p className={cn(
                "mt-1 text-[11px] sm:text-xs truncate",
                isDarkMode ? "text-amber-50/90" : "text-amber-800"
              )}>
                {activeIncomingTargetMessage
                  ? (activeIncomingTargetMessage.image_url
                    ? '[Ảnh/GIF]'
                    : (activeIncomingTargetMessage.content?.trim() || '(Tin nhắn trống)'))
                  : '(Không tìm thấy nội dung tin nhắn)'}
              </p>
            </div>
            <div className="w-full flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => respondDeleteRequest(activeIncomingDeleteRequest, false)}
                className={cn(
                  "h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-bold",
                  isDarkMode
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-white/80 border-amber-400/60 text-amber-900"
                )}
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => respondDeleteRequest(activeIncomingDeleteRequest, true)}
                className="h-9 px-2.5 sm:px-3 rounded-xl bg-rose-500 text-white text-xs font-bold"
              >
                Oke lun
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={cn(
          "p-3 sm:p-4 md:p-6 z-40 transition-all duration-1000 w-full",
          isFocusedMode ? "immersion-clear-ui py-6 sm:py-14" : cn("border-t-[1.5px] border-pink-400/40 dark:border-rose-500/20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] bg-gradient-to-r backdrop-blur-md", theme?.header || 'from-pink-500/10 to-rose-500/10')
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        <div className={cn("max-w-4xl mx-auto flex flex-col space-y-4", isFocusedMode ? "immersion-clear-ui" : "")}>
          {/* Sticker Ribbon */}
          {showStickerRibbon && stickers.length > 0 && (
            <div ref={stickerRibbonRef} className={cn("flex items-center space-x-3 group/ribbon animate-in slide-in-from-bottom-2 duration-300", isFocusedMode ? "immersion-clear-ui" : "") }>
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
            </div>
          )}

          {/* Input Wrapper - Glassmorphism in Focus Mode */}
          <div className={cn(
            "flex items-center gap-1.5 sm:gap-2 rounded-[2.25rem] sm:rounded-[3rem] p-1.5 sm:p-2 pr-2 sm:pr-4 relative transition-all duration-700",
            isFocusedMode 
              ? "bg-white/5 backdrop-blur-2xl border border-white/20 shadow-[0_0_20px_rgba(236,72,153,0.15)]" 
              : (isDarkMode
                  ? "bg-black/90 border border-white/15 shadow-inner"
                  : "bg-[var(--bg-input)] border border-pink-100 shadow-inner")
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
                      : (isDarkMode
                          ? "bg-white/10 text-white border-white/20 hover:scale-105"
                          : "bg-white/80 text-slate-500 border-pink-100 hover:scale-105")
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
                      setIsBgUpload(false);
                      setShowImageSourceModal(true);
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
                : (isDarkMode
                    ? "bg-black/80 border-white/15 focus-within:ring-2 focus-within:ring-white/25"
                    : "bg-slate-100/50 border-pink-50 focus-within:ring-2 focus-within:ring-pink-500/20")
            )}>
              <input 
                type="text" 
                value={text} 
                onChange={handleInputChange} 
                onFocus={handleComposerFocus}
                onBlur={handleComposerBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                placeholder={sentFlyingMessages.length >= 3 ? "Chờ người thương mở tim nhé... ❤️" : "Nhắn lời thương..."}
                className={cn(
                  "flex-1 min-w-0 bg-transparent border-none outline-none font-medium px-2 sm:px-4 py-2 text-base",
                  isFocusedMode
                    ? (isComposerFocused
                        ? "text-slate-900 placeholder:text-slate-500"
                        : "text-white placeholder:text-white/60")
                    : (isDarkMode
                        ? "text-white placeholder:text-white/70"
                        : "text-slate-800 placeholder:text-slate-400")
                )}
                style={isDarkMode ? { WebkitTextFillColor: '#ffffff' } : undefined}
              />
              {sentFlyingMessages.length >= 3 && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-pink-500 text-white text-[10px] font-black rounded-full shadow-xl animate-bounce">
                   Bầu trời đã đầy bí mật! 🎈
                </div>
              )}
            </div>

            <div className="relative shrink-0">
              {isSendSizing && (
                <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-14 h-36 rounded-2xl bg-black/70 border border-white/20 text-white shadow-2xl flex flex-col items-center py-2.5 pointer-events-none">
                  <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{getSendScaleLabel(sendTextScale)}</span>
                  <div className="relative mt-2 mb-2 w-2 flex-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="absolute left-0 right-0 bottom-0 bg-pink-400/85"
                      style={{ height: `${((sendTextScale - SEND_TEXT_SCALE_MIN) / (SEND_TEXT_SCALE_MAX - SEND_TEXT_SCALE_MIN)) * 100}%` }}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-pink-400 shadow-lg"
                      style={{ bottom: `calc(${((sendTextScale - SEND_TEXT_SCALE_MIN) / (SEND_TEXT_SCALE_MAX - SEND_TEXT_SCALE_MIN)) * 100}% - 8px)` }}
                    />
                  </div>
                  <span className="text-[10px] font-black tabular-nums">x{sendTextScale.toFixed(2)}</span>
                </div>
              )}
              <button 
                ref={sendButtonRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  startSendSizeDrag(e.clientY);
                }}
                onPointerMove={(e) => moveSendSizeDrag(e.clientY)}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  endSendSizeDrag(e.clientY);
                }}
                onPointerCancel={() => {
                  setIsSendSizing(false);
                  sendDragStartYRef.current = null;
                }}
                disabled={!text.trim() || isUploading}
                className={cn(
                  "shrink-0 w-10 h-10 sm:min-w-[48px] sm:w-12 sm:h-12 rounded-full px-0 flex items-center justify-center transition-all bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/50 active:scale-90 touch-none select-none",
                  (!text.trim() || isUploading)
                    ? "grayscale opacity-50 cursor-not-allowed"
                    : (isSendSizing ? "scale-110" : "hover:scale-105")
                )}
                title="Giữ và kéo lên/xuống để chọn cỡ chữ"
              >
                 <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEmoji && (
        <div ref={emojiPickerRef} className="absolute bottom-28 left-8 z-50">
          <EmojiPicker
            theme={isDragging ? Theme.DARK : Theme.LIGHT}
            onEmojiClick={(ed) => setText(p => p + ed.emoji)}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePreviewFile(file);
          e.currentTarget.value = '';
        }}
      />

      {showImageSourceModal && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 w-full max-w-sm rounded-none sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">Gửi ảnh 🖼️</h2>
                <p className="text-[9px] sm:text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Chọn nguồn ảnh muốn gửi</p>
              </div>
              <button onClick={() => setShowImageSourceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-8 space-y-6">
              <button
                onClick={() => {
                  setShowImageSourceModal(false);
                  setIsBgUpload(false);
                  fileInputRef.current?.click();
                }}
                className="w-full h-20 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl flex items-center px-6 space-x-5 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-white font-black text-xs sm:text-sm">Tải lên từ máy</p>
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
                    value={imageLinkInput}
                    onChange={(e) => setImageLinkInput(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 bg-transparent border-none text-white text-xs px-4 outline-none font-medium placeholder:text-white/20"
                  />
                  <button
                    onClick={async () => {
                      if (imageLinkInput.startsWith('http')) {
                        await sendMessage('', imageLinkInput);
                        setImageLinkInput('');
                        setShowImageSourceModal(false);
                      }
                    }}
                    className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-3 rounded-2xl font-bold text-[9px] sm:text-[10px] shadow-lg shadow-pink-500/20 transition-all active:scale-95 whitespace-nowrap"
                  >Gửi</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modern Sticker Library Modal */}
      {showStickers && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-0 sm:p-10 animate-in fade-in zoom-in-95 duration-300">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowStickers(false)}></div>
           
          <div className="relative bg-[var(--bg-header)] w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[85vh] rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100 dark:border-slate-800 flex flex-col">
              <div className="p-8 border-b border-pink-50 dark:border-slate-800 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 flex items-center">Thư viện Nhãn dán <Sparkles className="ml-3 w-6 h-6 animate-pulse" /></h2>
                    <p className="text-[11px] sm:text-xs text-gray-400 font-medium mt-1">Nơi lưu giữ những biểu cảm ngọt ngào của hai bạn 🎀</p>
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
                         draggable
                         onDragStart={(e) => handleStickerDragStart(s.id, e)}
                         onDragEnd={handleStickerDragEnd}
                         onTouchStart={(e) => handleStickerTouchStart(s.id, e)}
                         onTouchMove={handleStickerTouchMove}
                         onTouchEnd={handleStickerTouchEnd}
                         onTouchCancel={handleStickerTouchEnd}
                         onClick={() => { 
                           if (suppressNextStickerClickRef.current) {
                             suppressNextStickerClickRef.current = false;
                             return;
                           }
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

              <div className="px-6 pb-6 pt-3 border-t border-pink-100/70 dark:border-white/10 bg-white/70 dark:bg-black/20 backdrop-blur-sm">
                <div
                  ref={trashZoneRef}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setIsOverTrashZone(true);
                  }}
                  onDragLeave={() => setIsOverTrashZone(false)}
                  onDrop={handleDropToTrash}
                  className={cn(
                    "h-14 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 transition-all",
                    isOverTrashZone
                      ? "border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300 scale-[1.01]"
                      : "border-rose-300/70 dark:border-rose-500/30 text-rose-500/80 dark:text-rose-300/80 bg-rose-50/60 dark:bg-rose-900/10"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide">
                    Kéo nhãn dán vào đây để xóa vĩnh viễn
                  </span>
                </div>
              </div>

              {touchDragPosition && draggingStickerId && (
                <div
                  className="pointer-events-none fixed z-[1750] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/90 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-xl"
                  style={{ left: touchDragPosition.x, top: touchDragPosition.y }}
                >
                  Đang kéo
                </div>
              )}
           </div>
        </div>
      )}

      {pendingDeleteSticker && (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-pink-100 dark:border-white/10 rounded-none sm:rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">Xác nhận xóa nhãn dán</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nhãn dán sẽ bị xóa vĩnh viễn khỏi thư viện và không thể khôi phục.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteSticker(null)}
                className="h-11 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold"
              >Hủy</button>
              <button
                type="button"
                onClick={confirmDeleteSticker}
                className="h-11 rounded-xl bg-rose-500 text-white font-bold"
              >Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Background Source Selection Modal - HIGH END */}
      {showBgSourceModal && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 w-full max-w-sm rounded-none sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                 <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">Đổi hình nền 🖼️</h2>
                    <p className="text-[9px] sm:text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">Chọn nguồn ảnh kỷ niệm</p>
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
                       <p className="text-white font-black text-xs sm:text-sm">Tải lên từ máy</p>
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
                         className="flex-1 bg-transparent border-none text-white text-[11px] sm:text-xs px-4 outline-none font-medium placeholder:text-white/20"
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
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in transition-all">
          <div className="bg-white/10 dark:bg-black/40 backdrop-blur-2xl border border-white/20 w-full h-full sm:h-auto sm:max-w-md rounded-none sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center">Cài đặt nền <Settings className="ml-3 w-6 h-6 text-pink-500" /></h2>
                    <p className="text-[11px] sm:text-xs text-white/50 font-medium mt-1">Tinh chỉnh sắc thái vũ trụ của hai bạn 🌌</p>
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
        <div className="fixed inset-0 z-[1600] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 pointer-events-auto p-4 sm:p-10">
          <button onClick={() => setViewingSticker(null)} className="fixed top-4 right-4 sm:top-8 sm:right-8 z-[1705] p-3 sm:p-4 bg-black/45 hover:bg-black/65 border border-white/30 rounded-full transition-all text-white hover:rotate-90"><X className="w-7 h-7 sm:w-8 sm:h-8" /></button>
           
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
                    <span>Lưu vào thư viện ❤️</span>
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
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="absolute inset-0" onClick={() => setOpeningHeartMessage(null)}></div>
           
          <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-2xl border border-white/20 rounded-none sm:rounded-[3rem] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-pink-500/50 animate-pulse">
                 <HeartIcon className="w-12 h-12 text-white fill-white" />
              </div>
              
              <h3 className="text-pink-300 font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mb-6 tracking-widest">Thông điệp từ trái tim</h3>
              
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
                       <p className="text-white text-xl sm:text-2xl font-black italic leading-tight text-center px-4 drop-shadow-md">
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
