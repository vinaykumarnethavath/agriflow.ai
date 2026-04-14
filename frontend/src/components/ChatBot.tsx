"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    MessageSquare, X, Send, Bot, User, Database, Globe, Layers,
    AlertCircle, Plus, RotateCcw, History, Trash2, Edit2, Check, ChevronLeft
} from "lucide-react";
import { sendChatMessage, ChatResponse } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Message = {
    id: string;
    text: string;
    sender: "user" | "bot";
    source?: "db_only" | "external" | "mixed";
    timestamp: Date;
};

type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;   // ISO string for JSON serialisation
    updatedAt: string;
};

// ---------------------------------------------------------------------------
// Role-Specific Config — Each role gets its own isolated chatbot experience
// ---------------------------------------------------------------------------

function getStorageKey(role: string) { return `agri_chat_sessions_${role}`; }
function getActiveSessionKey(role: string) { return `agri_active_session_${role}`; }

const WELCOME_MESSAGES: Record<string, string> = {
    farmer: "Hello! I'm your Farm Assistant. I can help with your crops, expenses, harvests, sales, and provide agricultural advice.",
    shop: "Hello! I'm your Shop Assistant. I can help with your inventory, orders, sales analytics, expenses, and business insights.",
    manufacturer: "Hello! I'm your Mill Assistant. I can help with your purchases, production batches, sales, and manufacturing operations.",
    customer: "Hello! I'm your AgriFlow Assistant. I can help you find products, track orders, and answer questions about agriculture.",
};

const QUICK_QUESTIONS_BY_ROLE: Record<string, string[]> = {
    farmer: [
        "What are my total crop expenses?",
        "Show my harvest summary",
        "Best fertilizer for wheat?",
    ],
    shop: [
        "What is my total revenue?",
        "How many orders are pending?",
        "Show my inventory summary",
    ],
    manufacturer: [
        "Show my production batches",
        "What are my total purchases?",
        "How much have I sold?",
    ],
    customer: [
        "What products are available?",
        "Track my orders",
        "Best organic fertilizers?",
    ],
};

function getWelcomeMessage(role: string): Message {
    return {
        id: "welcome-1",
        text: WELCOME_MESSAGES[role] || WELCOME_MESSAGES.farmer,
        sender: "bot",
        source: "external",
        timestamp: new Date(),
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createNewSession(role: string = "farmer"): ChatSession {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        title: "New Chat",
        messages: [{ ...getWelcomeMessage(role), id: `welcome-${generateId()}`, timestamp: new Date() }],
        createdAt: now,
        updatedAt: now,
    };
}

/** Derive a short title from the first user message */
function deriveTitle(text: string): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= 30) return cleaned;
    return cleaned.slice(0, 28).trim() + "…";
}

/** Save sessions to role-specific localStorage */
function saveSessions(sessions: ChatSession[], activeId: string, role: string) {
    try {
        const serialisable = sessions.map(s => ({
            ...s,
            messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp).toISOString() })),
        }));
        localStorage.setItem(getStorageKey(role), JSON.stringify(serialisable));
        localStorage.setItem(getActiveSessionKey(role), activeId);
    } catch { /* storage full – silent fail */ }
}

/** Load sessions from role-specific localStorage */
function loadSessions(role: string): { sessions: ChatSession[]; activeId: string } {
    try {
        const raw = localStorage.getItem(getStorageKey(role));
        const activeId = localStorage.getItem(getActiveSessionKey(role)) || "";
        if (!raw) return { sessions: [], activeId: "" };
        const parsed: ChatSession[] = JSON.parse(raw).map((s: any) => ({
            ...s,
            messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
        }));
        return { sessions: parsed, activeId };
    } catch {
        return { sessions: [], activeId: "" };
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatBot = () => {
    // ----- Get current user role for isolation -----
    const { user } = useAuth();
    const userRole = (user?.role || "farmer") as string;

    // ----- Core state -----
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string>("");
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ----- Derived -----
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const messages = activeSession?.messages ?? [];
    const quickQuestions = QUICK_QUESTIONS_BY_ROLE[userRole] || QUICK_QUESTIONS_BY_ROLE.farmer;

    // ----- Init: load from ROLE-SPECIFIC localStorage -----
    // Re-runs when userRole changes (e.g., logging out and in as a different role)
    useEffect(() => {
        const { sessions: loaded, activeId } = loadSessions(userRole);
        if (loaded.length > 0) {
            setSessions(loaded);
            const target = loaded.find(s => s.id === activeId) ? activeId : loaded[0].id;
            setActiveSessionId(target);
        } else {
            const first = createNewSession(userRole);
            setSessions([first]);
            setActiveSessionId(first.id);
        }
    }, [userRole]);

    // ----- Persist whenever sessions / activeSessionId change -----
    useEffect(() => {
        if (sessions.length > 0) {
            saveSessions(sessions, activeSessionId, userRole);
        }
    }, [sessions, activeSessionId, userRole]);

    // ----- Auto-scroll -----
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, scrollToBottom]);

    // ----- Session helpers -----
    const updateActiveSession = useCallback((updater: (s: ChatSession) => ChatSession) => {
        setSessions(prev =>
            prev.map(s => s.id === activeSessionId ? updater(s) : s)
        );
    }, [activeSessionId]);

    const handleNewChat = useCallback(() => {
        const newSession = createNewSession(userRole);
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setInput("");
        setShowSidebar(false);
        setEditingMessageId(null);
    }, [userRole]);

    const handleDeleteSession = useCallback((sessionId: string) => {
        setSessions(prev => {
            const updated = prev.filter(s => s.id !== sessionId);
            if (updated.length === 0) {
                const fresh = createNewSession(userRole);
                setActiveSessionId(fresh.id);
                return [fresh];
            }
            if (activeSessionId === sessionId) {
                setActiveSessionId(updated[0].id);
            }
            return updated;
        });
        setDeleteConfirmId(null);
    }, [activeSessionId, userRole]);

    const handleRefreshChat = useCallback(() => {
        updateActiveSession(s => ({
            ...s,
            title: "New Chat",
            messages: [{ ...getWelcomeMessage(userRole), id: `welcome-${generateId()}`, timestamp: new Date() }],
            updatedAt: new Date().toISOString(),
        }));
        setInput("");
        setEditingMessageId(null);
    }, [updateActiveSession, userRole]);

    const handleSwitchSession = useCallback((sessionId: string) => {
        setActiveSessionId(sessionId);
        setShowSidebar(false);
        setInput("");
        setEditingMessageId(null);
    }, []);

    // ----- Send message -----
    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = {
            id: generateId(),
            text: text.trim(),
            sender: "user",
            timestamp: new Date(),
        };

        // Update title from first user message
        updateActiveSession(s => {
            const isFirstUserMsg = !s.messages.some(m => m.sender === "user");
            return {
                ...s,
                title: isFirstUserMsg ? deriveTitle(text.trim()) : s.title,
                messages: [...s.messages, userMsg],
                updatedAt: new Date().toISOString(),
            };
        });

        setInput("");
        setEditingMessageId(null);
        setIsLoading(true);

        try {
            const response = await sendChatMessage(text);
            const botMsg: Message = {
                id: generateId(),
                text: response.answer,
                sender: "bot",
                source: response.source,
                timestamp: new Date(),
            };
            updateActiveSession(s => ({
                ...s,
                messages: [...s.messages, botMsg],
                updatedAt: new Date().toISOString(),
            }));
        } catch (error: any) {
            console.error("Chat error:", error);
            const errorMsg: Message = {
                id: generateId(),
                text: "Sorry, I encountered an error connecting to my knowledge base. Please try again.",
                sender: "bot",
                timestamp: new Date(),
            };
            updateActiveSession(s => ({
                ...s,
                messages: [...s.messages, errorMsg],
                updatedAt: new Date().toISOString(),
            }));
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, updateActiveSession]);

    // ----- Rewrite message -----
    const handleRewriteMessage = useCallback((msgId: string) => {
        if (!activeSession) return;
        const msgIndex = activeSession.messages.findIndex(m => m.id === msgId);
        if (msgIndex === -1) return;
        const msg = activeSession.messages[msgIndex];
        if (msg.sender !== "user") return;

        // Put text back in input
        setInput(msg.text);
        setEditingMessageId(null);

        // Remove this message and everything after it
        updateActiveSession(s => ({
            ...s,
            messages: s.messages.slice(0, msgIndex),
            updatedAt: new Date().toISOString(),
        }));

        // Focus the input
        setTimeout(() => inputRef.current?.focus(), 100);
    }, [activeSession, updateActiveSession]);

    // ----- Key handler -----
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(input);
        }
    };

    // ----- Source helpers -----
    const getSourceIcon = (source?: string) => {
        switch (source) {
            case "db_only": return <Database className="w-3 h-3" />;
            case "external": return <Globe className="w-3 h-3" />;
            case "mixed": return <Layers className="w-3 h-3" />;
            default: return <Bot className="w-3 h-3" />;
        }
    };

    const getSourceLabel = (source?: string) => {
        switch (source) {
            case "db_only": return "Your Data";
            case "external": return "AI Knowledge";
            case "mixed": return "AI + Your Data";
            default: return "Assistant";
        }
    };

    const formatMessageText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part.split('\n').map((line, j) => (
                <React.Fragment key={`${i}-${j}`}>
                    {line}
                    {j < part.split('\n').length - 1 && <br />}
                </React.Fragment>
            ))}</span>;
        });
    };

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // ----- Check if only welcome messages exist -----
    const hasUserMessages = messages.some(m => m.sender === "user");

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50 group animate-bounce-gentle"
                    aria-label="Open Chat Assistant"
                    id="chat-open-btn"
                >
                    <MessageSquare className="w-6 h-6" />
                    <span className="absolute right-16 bg-white dark:bg-slate-800 text-green-900 dark:text-green-100 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Ask Agri Assistant
                    </span>
                </button>
            )}

            {/* Chat Window */}
            <div className={cn(
                "fixed bottom-6 right-6 w-[420px] h-[560px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform z-50 border border-green-100 dark:border-slate-800",
                isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-10 opacity-0 scale-95 pointer-events-none"
            )}>
                {/* ========== HEADER ========== */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-3 flex justify-between items-center text-white shrink-0 shadow-md relative z-20">
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center backdrop-blur-sm transition-all"
                            title="Chat History"
                            id="chat-history-btn"
                        >
                            {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <History className="w-4 h-4" />}
                        </button>
                        <div>
                            <h3 className="font-bold text-sm tracking-wide leading-tight">
                                {activeSession?.title && activeSession.title !== "New Chat"
                                    ? activeSession.title
                                    : "Agri Assistant"}
                            </h3>
                            <p className="text-[10px] text-green-100 font-medium">Smart Farm & Business AI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleNewChat}
                            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-all"
                            title="New Chat"
                            id="chat-new-btn"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRefreshChat}
                            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-all"
                            title="Clear Chat"
                            id="chat-refresh-btn"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { setIsOpen(false); setShowSidebar(false); }}
                            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-all"
                            id="chat-close-btn"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>

                {/* ========== BODY (sidebar + messages) ========== */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* ----- Chat History Sidebar ----- */}
                    <div className={cn(
                        "absolute inset-0 z-10 flex transition-transform duration-300 ease-in-out",
                        showSidebar ? "translate-x-0" : "-translate-x-full"
                    )}>
                        <div className="w-[75%] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-xl">
                            {/* Sidebar Header */}
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <History className="w-4 h-4 text-green-600" />
                                    Chat History
                                </h4>
                            </div>

                            {/* Sidebar List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        className={cn(
                                            "group relative px-3 py-2.5 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50",
                                            session.id === activeSessionId && "bg-green-50 dark:bg-green-900/20 border-l-[3px] border-l-green-500"
                                        )}
                                        onClick={() => handleSwitchSession(session.id)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-xs font-medium truncate",
                                                    session.id === activeSessionId
                                                        ? "text-green-700 dark:text-green-300"
                                                        : "text-slate-700 dark:text-slate-300"
                                                )}>
                                                    {session.title}
                                                </p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                    {formatDate(session.updatedAt)}
                                                    {" · "}
                                                    {session.messages.filter(m => m.sender === "user").length} msgs
                                                </p>
                                            </div>

                                            {/* Delete button */}
                                            {deleteConfirmId === session.id ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                                    className="shrink-0 w-7 h-7 rounded-md bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center transition-all animate-pulse"
                                                    title="Confirm Delete"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(session.id); setTimeout(() => setDeleteConfirmId(null), 3000); }}
                                                    className="shrink-0 w-7 h-7 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 flex items-center justify-center transition-all"
                                                    title="Delete Chat"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* New Chat button at bottom of sidebar */}
                            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={handleNewChat}
                                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 py-2 rounded-lg transition-all"
                                    id="sidebar-new-chat-btn"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New Chat
                                </button>
                            </div>
                        </div>

                        {/* Click-away overlay */}
                        <div
                            className="flex-1 bg-black/20 backdrop-blur-[2px]"
                            onClick={() => setShowSidebar(false)}
                        />
                    </div>

                    {/* ----- Messages Area ----- */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Privacy Legend */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 flex justify-center gap-4 text-[10px] border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500"></span> Your Data</span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Only</span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Mixed</span>
                        </div>

                        {/* Message List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/80 custom-scrollbar">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full group/msg",
                                        msg.sender === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "flex gap-2 max-w-[85%]",
                                        msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                                    )}>
                                        {/* Avatar */}
                                        <div className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm",
                                            msg.sender === "user"
                                                ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                        )}>
                                            {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </div>

                                        {/* Message Bubble */}
                                        <div className="flex flex-col gap-1 w-full">
                                            <div className={cn(
                                                "p-3 rounded-xl shadow-sm text-[13px] leading-relaxed break-words relative",
                                                msg.sender === "user"
                                                    ? "bg-slate-800 text-slate-50 dark:bg-slate-700 rounded-tr-sm"
                                                    : cn(
                                                        "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border-l-4",
                                                        msg.source === "db_only" && "border-green-500",
                                                        msg.source === "external" && "border-purple-500",
                                                        msg.source === "mixed" && "border-blue-500"
                                                    )
                                            )}>
                                                {formatMessageText(msg.text)}

                                                {/* Rewrite button (user messages only) */}
                                                {msg.sender === "user" && !isLoading && (
                                                    <button
                                                        onClick={() => handleRewriteMessage(msg.id)}
                                                        className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md flex items-center justify-center opacity-0 group-hover/msg:opacity-100 hover:bg-green-50 dark:hover:bg-green-900/30 hover:border-green-300 dark:hover:border-green-600 transition-all scale-90 group-hover/msg:scale-100"
                                                        title="Rewrite this message"
                                                    >
                                                        <Edit2 className="w-3 h-3 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Source Label (Bot Only) */}
                                            {msg.sender === "bot" && (
                                                <div className={cn(
                                                    "flex items-center gap-1 text-[10px] font-medium px-1",
                                                    msg.source === "db_only" && "text-green-600 dark:text-green-400",
                                                    msg.source === "external" && "text-purple-600 dark:text-purple-400",
                                                    msg.source === "mixed" && "text-blue-600 dark:text-blue-400"
                                                )}>
                                                    {getSourceIcon(msg.source)}
                                                    {getSourceLabel(msg.source)}
                                                </div>
                                            )}

                                            <span className={cn(
                                                "text-[9px] text-slate-400 mt-0.5",
                                                msg.sender === "user" ? "text-right mr-1" : "ml-1"
                                            )}>
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700 flex gap-1.5 items-center">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Questions (only show if no user messages yet) */}
                        {!hasUserMessages && (
                            <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1.5 justify-center bg-slate-50/50 dark:bg-slate-900 shrink-0">
                                {quickQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSendMessage(q)}
                                        className="text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full hover:bg-green-50 hover:text-green-700 hover:border-green-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 relative z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-slate-200/60 dark:border-slate-700 focus-within:ring-2 focus-within:ring-green-500/30 focus-within:border-green-500/50 transition-all">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask me anything..."
                                    className="flex-1 bg-transparent px-4 py-2 text-sm outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                                    disabled={isLoading}
                                    id="chat-input"
                                />
                                <button
                                    onClick={() => handleSendMessage(input)}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 rounded-full bg-green-600 text-white disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-50 hover:bg-green-700 transition-colors shrink-0 m-0.5"
                                    id="chat-send-btn"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-center mt-1.5 flex items-center justify-center gap-1">
                                <AlertCircle className="w-3 h-3 text-slate-400" />
                                <p className="text-[9px] text-slate-400 font-medium">Personal data is securely protected.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(156, 163, 175, 0.3);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(156, 163, 175, 0.5);
                }
                @keyframes bounce-gentle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-bounce-gentle {
                    animation: bounce-gentle 2s ease-in-out 3;
                }
            `}} />
        </>
    );
};
