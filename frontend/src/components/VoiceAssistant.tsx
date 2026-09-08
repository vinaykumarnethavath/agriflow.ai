"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mic, MicOff, X, Volume2, VolumeX, Loader2,
    CheckCircle2, AlertCircle, Navigation, ArrowRight,
    Sparkles, Languages, Send, Keyboard
} from "lucide-react";
import { useLanguage, LANGUAGES } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useVoiceCommand, VoiceStatus } from "@/hooks/useVoiceCommand";
import { processVoiceCommand, executeVoiceAction, VoiceExecutionResult, VoiceMessage } from "@/lib/voiceActionHandler";
import { LargeWaveform } from "@/components/voice/VoiceWaveform";
import { VoiceCommandChips } from "@/components/voice/VoiceCommandChip";

// ── Status Labels ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, Record<VoiceStatus, string>> = {
    en: {
        idle: "Tap the microphone or type a command",
        listening: "Listening... Speak now",
        processing: "AI is thinking...",
        speaking: "Speaking...",
        error: "Something went wrong",
        unsupported: "Voice not supported in this browser",
    },
    hi: {
        idle: "माइक्रोफ़ोन दबाएँ या कमांड टाइप करें",
        listening: "सुन रहा हूँ... बोलिए",
        processing: "AI सोच रहा है...",
        speaking: "बोल रहा हूँ...",
        error: "कुछ गलत हो गया",
        unsupported: "इस ब्राउज़र में वॉइस उपलब्ध नहीं है",
    },
    te: {
        idle: "మైక్రోఫోన్ నొక్కండి లేదా కమాండ్ టైప్ చేయండి",
        listening: "వింటున్నాను... చెప్పండి",
        processing: "AI ఆలోచిస్తోంది...",
        speaking: "చెబుతున్నాను...",
        error: "ఏదో తప్పు జరిగింది",
        unsupported: "ఈ బ్రౌజర్‌లో వాయిస్ అందుబాటులో లేదు",
    },
    ta: {
        idle: "மைக்ரோஃபோனை அழுத்தவும் அல்லது கட்டளையை தட்டச்சு செய்யவும்",
        listening: "கேட்கிறது... பேசுங்கள்",
        processing: "AI சிந்திக்கிறது...",
        speaking: "பேசுகிறது...",
        error: "ஏதோ தவறு நடந்தது",
        unsupported: "இந்த உலாவியில் குரல் ஆதரவு இல்லை",
    },
    kn: {
        idle: "ಮೈಕ್ರೋಫೋನ್ ಒತ್ತಿರಿ ಅಥವಾ ಆಜ್ಞೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ",
        listening: "ಕೇಳುತ್ತಿದೆ... ಮಾತನಾಡಿ",
        processing: "AI ಯೋಚಿಸುತ್ತಿದೆ...",
        speaking: "ಮಾತನಾಡುತ್ತಿದೆ...",
        error: "ಏನೋ ತಪ್ಪಾಗಿದೆ",
        unsupported: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ",
    },
    mr: {
        idle: "मायक्रोफोन दाबा किंवा कमांड टाईप करा",
        listening: "ऐकत आहे... बोला",
        processing: "AI विचार करत आहे...",
        speaking: "बोलत आहे...",
        error: "काहीतरी चूक झाली",
        unsupported: "या ब्राउझरमध्ये व्हॉइस उपलब्ध नाही",
    },
    bn: {
        idle: "মাইক্রোফোন টিপুন বা কমান্ড টাইপ করুন",
        listening: "শুনছি... বলুন",
        processing: "AI চিন্তা করছে...",
        speaking: "বলছি...",
        error: "কিছু ভুল হয়েছে",
        unsupported: "এই ব্রাউজারে ভয়েস সমর্থিত নয়",
    },
    gu: {
        idle: "માઇક્રોફોન દબાવો અથવા આદેશ લખો",
        listening: "સાંભળી રહ્યો છું... બોલો",
        processing: "AI વિચારી રહ્યું છે...",
        speaking: "બોલી રહ્યું છે...",
        error: "કંઈક ખોટું થયું",
        unsupported: "આ બ્રાઉઝરમાં અવાજ સપોર્ટેડ નથી",
    },
    pa: {
        idle: "ਮਾਈਕ੍ਰੋਫੋਨ ਦਬਾਓ ਜਾਂ ਕਮਾਂਡ ਟਾਈਪ ਕਰੋ",
        listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ... ਬੋਲੋ",
        processing: "AI ਸੋਚ ਰਿਹਾ ਹੈ...",
        speaking: "ਬੋਲ ਰਿਹਾ ਹਾਂ...",
        error: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ",
        unsupported: "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਵੌਇਸ ਉਪਲਬਧ ਨਹੀਂ ਹੈ",
    },
};

function getStatusLabel(locale: string, status: VoiceStatus): string {
    const labels = STATUS_LABELS[locale] || STATUS_LABELS.en;
    return labels[status] || STATUS_LABELS.en[status];
}

// ── Main Component ───────────────────────────────────────────────────────────

export function VoiceAssistant() {
    const router = useRouter();
    const pathname = usePathname();
    const { locale, setLocale } = useLanguage();
    const { user } = useAuth();
    const voice = useVoiceCommand(locale);

    const [isOpen, setIsOpen] = useState(false);
    const [result, setResult] = useState<VoiceExecutionResult | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [history, setHistory] = useState<VoiceMessage[]>([]);
    const [textInput, setTextInput] = useState("");
    const [showTextInput, setShowTextInput] = useState(false);
    const processedRef = useRef(false);
    const textInputRef = useRef<HTMLInputElement>(null);

    // Process transcript when speech recognition ends
    useEffect(() => {
        if (voice.status === "processing" && !processedRef.current) {
            processedRef.current = true;
            const finalCommand = voice.transcript.trim() || voice.interimTranscript.trim();
            if (finalCommand) {
                handleCommand(finalCommand);
            } else {
                voice.setStatus("idle");
            }
        }
        if (voice.status === "idle" || voice.status === "listening") {
            processedRef.current = false;
        }
    }, [voice.status, voice.transcript, voice.interimTranscript]);

    // ── Core: Send command to AI backend ──────────────────────────────────────

    const handleCommand = async (text: string) => {
        setIsExecuting(true);
        setResult(null);

        try {
            // 1. Send to backend AI for parsing
            const action = await processVoiceCommand(text, pathname, locale, history);

            // 2. Execute the parsed action
            const execResult = await executeVoiceAction(action, {
                router,
                setLocale,
            });

            setResult(execResult);

            // Update conversation history
            setHistory(prev => [
                ...prev,
                { role: "user", content: text },
                { role: "assistant", content: execResult.message || action.response_text }
            ]);

            // 3. Speak the response
            if (execResult.message) {
                voice.speak(execResult.message);
            } else {
                voice.setStatus("idle");
            }

            // 4. Navigate if needed (delay for TTS to start)
            if (execResult.navigateTo) {
                setTimeout(() => {
                    router.push(execResult.navigateTo!);
                }, 1500);
            }
        } catch (err: any) {
            console.error("[Voice] Processing failed:", err);
            const errorMsg = "Sorry, something went wrong. Please try again.";
            setResult({ success: false, message: errorMsg });
            voice.speak(errorMsg);
        } finally {
            setIsExecuting(false);
        }
    };

    // ── UI Handlers ──────────────────────────────────────────────────────────

    const handleOpen = () => {
        setIsOpen(true);
        setResult(null);
        setTextInput("");
        setShowTextInput(false);
        setHistory([]);
        processedRef.current = false;
    };

    const handleClose = () => {
        voice.cancelListening();
        voice.stopSpeaking();
        setIsOpen(false);
        setResult(null);
        setTextInput("");
        setShowTextInput(false);
        setHistory([]);
        voice.setStatus("idle");
        processedRef.current = false;
    };

    const handleMicClick = () => {
        if (voice.status === "listening") {
            voice.stopListening();
        } else {
            setResult(null);
            setTextInput("");
            processedRef.current = false;
            voice.resetTranscript();
            voice.startListening();
        }
    };

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!textInput.trim() || isExecuting) return;
        setResult(null);
        processedRef.current = true;
        voice.setStatus("processing");
        handleCommand(textInput.trim());
        setTextInput("");
    };

    const handleChipCommand = (command: string) => {
        setResult(null);
        processedRef.current = true;
        voice.setStatus("processing");
        handleCommand(command);
    };

    const handleRetry = () => {
        setResult(null);
        setTextInput("");
        processedRef.current = false;
        voice.resetTranscript();
        voice.setStatus("idle");
    };

    const currentLang = LANGUAGES.find((l) => l.code === locale);

    // Show for all roles (not just farmer)
    if (!user) return null;

    return (
        <>
            {/* ── Floating Action Button ─────────────────────────────── */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpen}
                        id="voice-assistant-fab"
                        className="
                            fixed bottom-6 right-24 z-50
                            h-14 w-14 rounded-full
                            bg-gradient-to-br from-emerald-500 to-green-600
                            text-white shadow-lg shadow-green-500/30
                            flex items-center justify-center
                            hover:shadow-xl hover:shadow-green-500/40
                            transition-shadow duration-300
                            border-2 border-white/20
                        "
                        aria-label="Open Voice Assistant"
                    >
                        <Mic className="h-6 w-6" />
                        <span className="absolute inset-0 rounded-full animate-ping bg-green-400/30" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Voice Assistant Modal ───────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
                    >
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={handleClose}
                        />

                        {/* Modal Panel */}
                        <motion.div
                            initial={{ y: 100, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 100, opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="
                                relative w-full max-w-md mx-4 mb-4 sm:mb-0
                                rounded-3xl overflow-hidden
                                bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
                                border border-white/10
                                shadow-2xl shadow-black/50
                            "
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pt-5 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                                        <Sparkles className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold text-sm">
                                            AI Voice Assistant
                                        </h3>
                                        <div className="flex items-center gap-1 text-[10px] text-white/50">
                                            <Languages className="h-3 w-3" />
                                            <span>{currentLang?.nativeName || "English"}</span>
                                            <span className="mx-1">•</span>
                                            <span className="text-emerald-400">Powered by Groq AI</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setShowTextInput(!showTextInput);
                                            setTimeout(() => textInputRef.current?.focus(), 100);
                                        }}
                                        className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                        title="Type a command"
                                    >
                                        <Keyboard className="h-4 w-4 text-white/70" />
                                    </button>
                                    <button
                                        onClick={handleClose}
                                        className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        <X className="h-4 w-4 text-white/70" />
                                    </button>
                                </div>
                            </div>

                            {/* Status Label */}
                            <div className="px-5 py-2">
                                <p className="text-center text-white/60 text-xs font-medium">
                                    {isExecuting
                                        ? (locale === "te" ? "AI ఆలోచిస్తోంది..." : locale === "hi" ? "AI सोच रहा है..." : "AI is thinking...")
                                        : getStatusLabel(locale, voice.status)}
                                </p>
                            </div>

                            {/* Waveform */}
                            <div className="px-5">
                                <LargeWaveform status={isExecuting ? "processing" : voice.status} />
                            </div>

                            {/* Live Transcript */}
                            <div className="px-5 min-h-[48px] flex items-center justify-center">
                                {(voice.transcript || voice.interimTranscript) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 max-w-full"
                                    >
                                        <p className="text-white/90 text-sm text-center leading-relaxed">
                                            {voice.transcript}
                                            {voice.interimTranscript && (
                                                <span className="text-white/50 italic ml-1">
                                                    {voice.interimTranscript}
                                                </span>
                                            )}
                                        </p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Result Display */}
                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        className="mx-5 mt-2 mb-1"
                                    >
                                        <div className={`
                                            rounded-2xl p-4 border
                                            ${result.success
                                                ? "bg-emerald-500/10 border-emerald-500/20"
                                                : "bg-red-500/10 border-red-500/20"
                                            }
                                        `}>
                                            <div className="flex items-start gap-2.5">
                                                {result.success ? (
                                                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                                                ) : (
                                                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                                                )}
                                                <p className="text-white/80 text-sm leading-relaxed">
                                                    {result.message}
                                                </p>
                                            </div>
                                            {result.navigateTo && (
                                                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-300/70">
                                                    <Navigation className="h-3 w-3" />
                                                    <span>Navigating to {result.navigateTo}...</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Text Input (toggled via keyboard button) */}
                            <AnimatePresence>
                                {showTextInput && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="px-5 mt-2"
                                    >
                                        <form onSubmit={handleTextSubmit} className="flex gap-2">
                                            <input
                                                ref={textInputRef}
                                                type="text"
                                                value={textInput}
                                                onChange={(e) => setTextInput(e.target.value)}
                                                placeholder={
                                                    locale === "te" ? "మీ కమాండ్ టైప్ చేయండి..."
                                                    : locale === "hi" ? "अपना कमांड टाइप करें..."
                                                    : "Type your command..."
                                                }
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                                disabled={isExecuting}
                                            />
                                            <button
                                                type="submit"
                                                disabled={!textInput.trim() || isExecuting}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2.5 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                                            >
                                                {isExecuting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Send className="h-4 w-4" />
                                                )}
                                            </button>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Error + Fallback Input */}
                            {voice.error && !showTextInput && (
                                <div className="mx-5 mt-2 mb-1 space-y-3">
                                    <div className="rounded-2xl p-3 bg-red-500/10 border border-red-500/20">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                            <p className="text-red-300/80 text-xs">{voice.error}</p>
                                        </div>
                                    </div>
                                    {!result && (
                                        <form onSubmit={handleTextSubmit} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={textInput}
                                                onChange={(e) => setTextInput(e.target.value)}
                                                placeholder="Type your command instead..."
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!textInput.trim() || isExecuting}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center"
                                            >
                                                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* Quick Command Chips */}
                            {(voice.status === "idle" || voice.status === "error") && !result && !isExecuting && (
                                <div className="px-5 pb-1">
                                    <VoiceCommandChips onCommand={handleChipCommand} />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-center gap-4 px-5 py-5">
                                {/* Speaker toggle */}
                                {voice.status === "speaking" && (
                                    <motion.button
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        onClick={voice.stopSpeaking}
                                        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        <VolumeX className="h-5 w-5 text-white/70" />
                                    </motion.button>
                                )}

                                {/* Main Mic Button */}
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleMicClick}
                                    disabled={isExecuting || voice.status === "unsupported"}
                                    className={`
                                        h-16 w-16 rounded-full
                                        flex items-center justify-center
                                        transition-all duration-300 relative
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        ${voice.status === "listening"
                                            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/40"
                                            : "bg-gradient-to-br from-emerald-400 to-green-600 hover:from-emerald-500 hover:to-green-700 shadow-lg shadow-green-500/30"
                                        }
                                    `}
                                >
                                    {isExecuting ? (
                                        <Loader2 className="h-7 w-7 text-white animate-spin" />
                                    ) : voice.status === "listening" ? (
                                        <MicOff className="h-7 w-7 text-white" />
                                    ) : (
                                        <Mic className="h-7 w-7 text-white" />
                                    )}

                                    {voice.status === "listening" && (
                                        <span className="absolute inset-0 rounded-full animate-ping bg-red-400/30" />
                                    )}
                                </motion.button>

                                {/* Retry button */}
                                {(result || voice.status === "error") && (
                                    <motion.button
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        onClick={handleRetry}
                                        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        <ArrowRight className="h-5 w-5 text-white/70 rotate-[-90deg]" />
                                    </motion.button>
                                )}

                                {/* Replay audio */}
                                {result?.message && voice.status === "idle" && (
                                    <motion.button
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        onClick={() => voice.speak(result.message)}
                                        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        <Volume2 className="h-5 w-5 text-white/70" />
                                    </motion.button>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="pb-4 px-5">
                                <p className="text-center text-white/30 text-[10px]">
                                    {voice.isSupported
                                        ? "Powered by Groq AI • Speak in any Indian language"
                                        : "⚠️ Please use Chrome or Edge for voice features"}
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
