import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Translation {
    text: string;
    lang: string;
}

export interface Message {
    id: string;
    text: string;
    translations: Translation[];
    speaker: number;
    lang: string;
    tone?: string; // Phase 6.1: bubble-specific tone
}

interface ConversationContextProps {
    messages: Message[];
    viewMode: 'two_way' | 'three_way' | 'face_to_face';
    lastStandardMode: 'two_way' | 'three_way';
    langs: { 0: string; 1: string; 2: string };
    activeSpeaker: number;
    conversationId: string | null;
    activeTone: string | null; // Phase 6.3: session-wide tone
    setViewMode: (mode: 'two_way' | 'three_way' | 'face_to_face') => void;
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    setLangs: (speaker: number, code: string) => void;
    setActiveSpeaker: (speaker: number) => void;
    setConversationId: (id: string | null) => void;
    clearMessages: () => void;
    setActiveTone: (tone: string | null) => void;
}

const ConversationContext = createContext<ConversationContextProps | undefined>(undefined);

export const ConversationProvider = ({ children }: { children: ReactNode }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [viewMode, setInternalViewMode] = useState<'two_way' | 'three_way' | 'face_to_face'>('two_way');
    const [lastStandardMode, setLastStandardMode] = useState<'two_way' | 'three_way'>('two_way');
    const [langs, setInternalLangs] = useState<{ 0: string; 1: string; 2: string }>({
        0: 'tl',
        1: 'ceb',
        2: 'hil',
    });
    const [activeSpeaker, setActiveSpeaker] = useState(0);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [activeTone, setActiveTone] = useState<string | null>(null);

    const setViewMode = useCallback((mode: 'two_way' | 'three_way' | 'face_to_face') => {
        if (mode !== 'face_to_face') {
            setLastStandardMode(mode);
        }
        setInternalViewMode(mode);
    }, []);

    const setLangs = useCallback((speaker: number, code: string) => {
        setInternalLangs(prev => ({ ...prev, [speaker]: code }));
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setConversationId(null);
    }, []);

    return (
        <ConversationContext.Provider
            value={{
                messages,
                viewMode,
                lastStandardMode,
                langs,
                activeSpeaker,
                conversationId,
                activeTone,
                setViewMode,
                setMessages,
                setLangs,
                setActiveSpeaker,
                setConversationId,
                clearMessages,
                setActiveTone,
            }}
        >
            {children}
        </ConversationContext.Provider>
    );
};

export const useConversation = () => {
    const context = useContext(ConversationContext);
    if (!context) {
        throw new Error('useConversation must be used within a ConversationProvider');
    }
    return context;
};
