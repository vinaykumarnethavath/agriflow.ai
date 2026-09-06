"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout, Mail, Phone, Store, Factory, ShoppingCart } from "lucide-react";
import { UserRole } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PasswordInput } from "@/components/ui/password-input";

type AuthMethod = "email" | "phone";

export default function LoginPage() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");

    // Email login state
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const [roleState, setRoleState] = useState<string>("");

    // Phone login state
    const [phone, setPhone] = useState("");
    const [phonePassword, setPhonePassword] = useState("");
    const [phoneRole, setPhoneRole] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    // ── Email Login ───────────────────────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const email = emailRef.current?.value || "";
        const password = passwordRef.current?.value || "";
        const role = roleState;

        if (!email || !password) {
            setError("Please enter both email and password");
            return;
        }

        setLoading(true);
        try {
            const payload: any = { email, password };
            if (role) payload.role = role;

            const { data } = await api.post("/auth/login", payload);
            const user = { id: data.id, email, role: data.role, full_name: data.full_name || "User" };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || "Login failed";
            setError(errorMessage);
            setLoading(false);
        }
    };

    // ── Phone + Password Login ────────────────────────────────────────────────
    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!phone || phone.length !== 10) {
            setError("Enter a valid 10-digit phone number");
            return;
        }
        if (!phonePassword) {
            setError("Password is required");
            return;
        }

        setLoading(true);
        try {
            const payload: any = { phone_number: phone, password: phonePassword };
            if (phoneRole) payload.role = phoneRole;

            const { data } = await api.post("/auth/login", payload);
            const user = { id: data.id, phone_number: phone, role: data.role, full_name: data.full_name || "User" };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || "Login failed";
            setError(errorMessage);
            setLoading(false);
        }
    };

    const inputCls = "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-muted-foreground text-foreground";
    const selectCls = "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-foreground";

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300 relative">
            <div className="absolute top-4 right-4 flex items-center gap-3">
                <LanguageSelector direction="down" />
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
                {/* Header */}
                <div className="p-4 text-center border-b border-border">
                    <div className="flex justify-center mb-1">
                        <div className="w-32 flex items-center justify-center">
                            <img src="/logo.png?v=5" alt="AgriFlow Logo" className="w-full h-auto object-contain drop-shadow-md" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mt-1">{t('auth.login')}</h1>
                    <p className="text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
                </div>

                <div className="p-4 sm:p-5 space-y-2.5">
                    {/* Method Toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden p-0.5 bg-muted/30">
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("email"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${authMethod === "email" ? "bg-green-600 text-white shadow-xs" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <Mail className="h-3.5 w-3.5" /> Email
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("phone"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${authMethod === "phone" ? "bg-green-600 text-white shadow-xs" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <Phone className="h-3.5 w-3.5" /> {t('auth.phone')}
                        </button>
                    </div>

                    {/* ── EMAIL LOGIN ── */}
                    {authMethod === "email" && (
                        <form onSubmit={handleEmailSubmit} className="space-y-2.5">
                            <div className="space-y-0.5">
                                <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">{t('auth.email')}</label>
                                <input type="email" placeholder="farmer@example.com" ref={emailRef} required autoComplete="email" className={inputCls} />
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs sm:text-sm font-semibold text-muted-foreground">{t('auth.password')}</label>
                                    <Link href="/forgot-password?method=email" className="text-xs text-green-600 hover:underline font-bold">{t('auth.forgotPassword')}</Link>
                                </div>
                                <PasswordInput ref={passwordRef} required autoComplete="current-password" placeholder="••••••••" />
                            </div>
                            <div className="space-y-0.5">
                                <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">{t('auth.role')}</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: UserRole.FARMER, label: t('auth.farmer'), icon: Sprout },
                                        { id: UserRole.SHOP, label: t('auth.shopOwner'), icon: Store },
                                        { id: UserRole.MANUFACTURER, label: t('auth.manufacturer'), icon: Factory },
                                        { id: UserRole.CUSTOMER, label: t('auth.customer'), icon: ShoppingCart }
                                    ].map(role => (
                                        <button
                                            key={role.id} type="button"
                                            onClick={() => setRoleState(role.id)}
                                            className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition-colors ${roleState === role.id ? 'bg-green-100 border-green-500 text-green-700 font-bold dark:bg-green-950/60 dark:border-green-500 dark:text-green-300' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
                                        >
                                            <role.icon className="h-4 w-4 mb-0.5" />
                                            <span className="text-[10px] font-bold leading-none">{role.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {error && <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-xs font-medium">{error}</div>}
                            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded-lg py-2 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-0.5">
                                {loading ? <span className="flex items-center justify-center gap-2"><div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.loading')}</span> : t('auth.login')}
                            </button>
                            <div className="text-center text-xs sm:text-sm pt-1">
                                <span className="text-muted-foreground">{t('auth.dontHaveAccount')} </span>
                                <Link href="/register" className="text-green-600 font-bold hover:underline">{t('auth.register')}</Link>
                            </div>
                        </form>
                    )}

                    {/* ── PHONE LOGIN ── */}
                    {authMethod === "phone" && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Phone Number</label>
                                <div className="flex gap-2">
                                    <span className="flex items-center px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground font-semibold">+91</span>
                                    <input
                                        type="tel"
                                        placeholder="9876543210"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                        maxLength={10}
                                        required
                                        className={`${inputCls} flex-1`}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-muted-foreground">Password</label>
                                    <Link href="/forgot-password?method=phone" className="text-xs text-green-600 hover:underline font-bold">Forgot password?</Link>
                                </div>
                                <PasswordInput
                                    placeholder="••••••••"
                                    value={phonePassword}
                                    onChange={e => setPhonePassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-muted-foreground block">Role (Optional)</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: UserRole.FARMER, label: "Farmer", icon: Sprout },
                                        { id: UserRole.SHOP, label: "Shop", icon: Store },
                                        { id: UserRole.MANUFACTURER, label: "Mill", icon: Factory },
                                        { id: UserRole.CUSTOMER, label: "Customer", icon: ShoppingCart }
                                    ].map(role => (
                                        <button
                                            key={role.id} type="button"
                                            onClick={() => setPhoneRole(role.id)}
                                            className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border transition-colors ${phoneRole === role.id ? 'bg-green-100 border-green-500 text-green-700' : 'bg-background border-input text-muted-foreground hover:bg-muted'}`}
                                        >
                                            <role.icon className="h-5 w-5 mb-0.5" />
                                            <span className="text-[10px] font-bold leading-none">{role.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-sm font-medium">{error}</div>}
                            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none">
                                {loading ? <span className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Logging in...</span> : "Login"}
                            </button>
                            <div className="text-center text-sm pt-2">
                                <span className="text-muted-foreground">Don't have an account? </span>
                                <Link href="/register" className="text-green-600 font-bold hover:underline">Create Account</Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
