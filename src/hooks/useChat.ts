import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../types';

export function useChat(currentUserId: string, receiverId?: string, isGlobalPresence: boolean = false) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const dedupeMessagesById = (list: Message[]) => {
    const map = new Map<string | number, Message>();
    for (const item of list) {
      map.set(item.id, item);
    }
    return Array.from(map.values());
  };
  
  // Keep the ref in sync for absolute truth inside async handlers
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  
  const presenceChannelRef = useRef<any>(null);
  const isPresenceSubscribed = useRef(false);
  const heartbeatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentUserId || !receiverId) {
      setMessages([]);
      return;
    }

    fetchMessages();

    const channel = supabase.channel('messages-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const newMessage = payload.new as Message;
        const isFromMe = newMessage.sender_id === currentUserId && newMessage.receiver_id === receiverId;
        const isFromPartner = newMessage.sender_id === receiverId && newMessage.receiver_id === currentUserId;

        if (isFromMe || isFromPartner) {
          console.log('📡 [Realtime] New message:', newMessage.id);
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            
            // Surgical Cleanup: Remove the specific temp message by its embedded ID
            if (isFromMe) {
               const parts = (newMessage.effect || '').split(':');
               const maybeTempId = parts[parts.length - 1];
               const originalTempId = maybeTempId?.startsWith('temp-') ? maybeTempId : undefined;
               
               const filtered = prev.filter(m => {
                 if (originalTempId && m.id === originalTempId) return false;
                 return true;
               });
               return dedupeMessagesById([...filtered, newMessage]);
            }
            return dedupeMessagesById([...prev, newMessage]);
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const updated = payload.new as Message;
        const isRelevant = (updated.sender_id === currentUserId && updated.receiver_id === receiverId) ||
                           (updated.sender_id === receiverId && updated.receiver_id === currentUserId);
        
        if (isRelevant) {
          console.log('📡 [Realtime] Message updated (opened):', updated.id, updated.is_opened);
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, receiverId]);

  useEffect(() => {
    if (!currentUserId || !isGlobalPresence) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: currentUserId } }
    });

    presenceChannelRef.current = channel;

    const rebuildPresenceState = () => {
      const state = channel.presenceState();
      const online: Record<string, boolean> = {};
      const typing: Record<string, boolean> = {};

      Object.entries(state).forEach(([key, userStates]) => {
        online[key] = true;
        const states = Array.isArray(userStates) ? (userStates as any[]) : [];
        // A user can have multiple metas (multi-tab/device). Typing should be true if any meta is typing.
        if (states.some((meta) => Boolean(meta?.isTyping))) {
          typing[key] = true;
        }
      });

      setOnlineUsers(online);
      setTypingUsers(typing);
    };

    channel
      .on('presence', { event: 'sync' }, rebuildPresenceState)
      .on('presence', { event: 'join' }, rebuildPresenceState)
      .on('presence', { event: 'leave' }, rebuildPresenceState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          isPresenceSubscribed.current = true;
          try {
            await channel.track({ online_at: new Date().toISOString(), isTyping: false });
            rebuildPresenceState();

            if (heartbeatTimerRef.current) {
              window.clearInterval(heartbeatTimerRef.current);
            }
            heartbeatTimerRef.current = window.setInterval(() => {
              channel.track({ online_at: new Date().toISOString(), isTyping: false }).catch(() => {
                // silent fail
              });
            }, 20000);
          } catch (e) {
            // silent fail
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isPresenceSubscribed.current = false;
        }
      });

    return () => {
      isPresenceSubscribed.current = false;
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, isGlobalPresence]);

  const setTypingStatus = async (isTyping: boolean) => {
    if (!currentUserId || !presenceChannelRef.current) return;

    try {
      await presenceChannelRef.current.track({
        online_at: new Date().toISOString(),
        isTyping
      });
    } catch (err) {
      // silent fail
    }
  };

  const fetchMessages = async () => {
    if (!currentUserId || !receiverId) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: false })
      .limit(25);

    if (data) {
      setMessages(dedupeMessagesById(data.reverse()));
      setHasMore(data.length === 25);
    }
  };

  const loadMore = async () => {
    if (!messages.length || !hasMore || !currentUserId || !receiverId) return;
    const oldest = messages[0];
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(25);

    if (data && data.length > 0) {
      setMessages(prev => dedupeMessagesById([...data.reverse(), ...prev]));
      setHasMore(data.length === 25);
    } else {
      setHasMore(false);
    }
  };

  const sendMessage = async (content: string, imageUrl?: string, effect: string = 'none') => {
    if (!currentUserId || !receiverId) return;

    let finalEffect = effect;
    if (effect.startsWith('heart')) {
       // GET THE HIGHEST SEQUENCE FROM LATEST MESSAGE TO ENSURE REAL INCREMENT
       const { data: latestHearts } = await supabase
         .from('messages')
         .select('effect')
         .eq('sender_id', currentUserId)
         .eq('is_opened', false)
         .filter('effect', 'ilike', 'heart%')
         .order('created_at', { ascending: false })
         .limit(1);
       
       let lastSeq = 0;
       if (latestHearts && latestHearts.length > 0) {
         const parts = latestHearts[0].effect.split(':');
         lastSeq = parseInt(parts[2]) || 0;
       }
       
       const nextSeq = lastSeq + 1;
       finalEffect = `${effect}:${nextSeq}`;
    }

    const tempId = `temp-${Date.now()}`;
    const finalEffectWithTemp = `${finalEffect}:${tempId}`;
    const effectToPersist = finalEffect;

    const tempMsg: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: receiverId,
      content: content.trim(),
      image_url: imageUrl || null,
      effect: finalEffectWithTemp,
      is_opened: false,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => dedupeMessagesById([...prev, tempMsg]));
    messagesRef.current = [...messagesRef.current, tempMsg];
    console.log('🚀 [Chat] Sending message...', { contentLength: content.length, hasImage: !!imageUrl, effect: finalEffectWithTemp });
    
    const { data: insertedMessage, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: content.trim(),
        image_url: imageUrl || null,
        effect: effectToPersist
      }])
      .select('*')
      .single();
    
    if (error) {
       console.error('❌ [Chat] Error sending message:', error.message);
       setMessages(prev => prev.filter(m => m.id !== tempId));
    } else {
       if (insertedMessage) {
         setMessages(prev => {
           const withoutTemp = prev.filter(m => m.id !== tempId);
           if (withoutTemp.some(m => m.id === insertedMessage.id)) return withoutTemp;
           return dedupeMessagesById([...withoutTemp, insertedMessage as Message]);
         });
       }
       console.log('✅ [Chat] Message sent successfully');
    }
  };

  const openMessage = async (id: string | number) => {
    const normalizedId =
      typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;

    console.log('💎 [Chat] Retiring secret heart permanently...', normalizedId);
    const { data, error } = await supabase
      .from('messages')
      .update({
        is_opened: true,
        effect: 'none' // CRITICAL: Resetting effect to 'none' prevents it from ever flying again
      })
      .eq('id', normalizedId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('❌ [Chat] Failed to retire heart:', error.message);
      return false;
    }

    if (!data) {
      console.error('❌ [Chat] Failed to retire heart: no row was updated');
      return false;
    }

    console.log('✅ [Chat] Heart successfully retired to chat history');
    return true;
  };

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { data } = await supabase.storage.from('stickers').upload(fileName, file);
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('stickers').getPublicUrl(fileName);
      return publicUrl;
    }
    return null;
  };

  const saveAsSticker = async (url: string) => {
    if (!url) return;
    console.log('📸 [Sticker] Attempting to save as sticker...', url.substring(0, 50) + '...');

    // Check if duplicate exists
    const { data: existing } = await supabase
      .from('stickers')
      .select('id')
      .eq('image_url', url)
      .maybeSingle();

    if (existing) {
      console.warn('⚠️ [Sticker] Duplicate found, skipping save.');
      return;
    }

    const { error } = await supabase.from('stickers').insert([{ 
      image_url: url, 
      user_id: currentUserId 
    }]);

    if (error) {
      console.error('❌ [Sticker] Error saving sticker:', error.message);
    } else {
      console.log('✅ [Sticker] Saved successfully to your heart library');
    }
  };

  const updateProfile = async (updates: any) => {
    await supabase.from('profiles').update(updates).eq('id', currentUserId);
  };

  return { 
    messages, 
    setMessages,
    hasMore, 
    onlineUsers, 
    typingUsers,
    sendMessage, 
    openMessage, 
    uploadImage, 
    saveAsSticker, 
    loadMore, 
    updateProfile,
    setTypingStatus
  };
}
