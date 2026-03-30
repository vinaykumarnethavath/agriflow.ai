"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout, Mail, Phone } from "lucide-react";
import { UserRole } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthMethod = "email" | "phone";

export default function LoginPage() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>("email");

    // Email login refs
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const roleRef = useRef<HTMLSelectElement>(null);

    // Phone login state
    const [phone, setPhone] = useState("");
    const [phonePassword, setPhonePassword] = useState("");
    const [phoneRole, setPhoneRole] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();

    // ── Email Login ───────────────────────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const email = emailRef.current?.value || "";
        const password = passwordRef.current?.value || "";
        const role = roleRef.current?.value || "";

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
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
                {/* Header */}
                <div className="p-6 text-center space-y-2 border-b border-border">
                    <div className="flex justify-center mt-2">
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <Sprout className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">AgriChain Login</h1>
                    <p className="text-sm text-muted-foreground">Enter your credentials to access the platform</p>
                </div>

                <div className="p-8 space-y-6">
                    {/* Method Toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("email"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${authMethod === "email" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                            <Mail className="h-4 w-4" /> Email
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("phone"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${authMethod === "phone" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                            <Phone className="h-4 w-4" /> Phone Number
                        </button>
                    </div>

                    {/* ── EMAIL LOGIN ── */}
                    {authMethod === "email" && (
                        <form onSubmit={handleEmailSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Email Address</label>
                                <input type="email" placeholder="farmer@example.com" ref={emailRef} required autoComplete="email" className={inputCls} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-muted-foreground">Password</label>
                                    <Link href="/forgot-password" className="text-xs text-green-600 hover:underline font-bold">Forgot password?</Link>
                                </div>
                                <input type="password" ref={passwordRef} required autoComplete="current-password" placeholder="••••••••" className={inputCls} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Role (Optional)</label>
                                <select ref={roleRef} className={selectCls}>
                                    <option value="">Select a role (if you have multiple)</option>
                                    <option value={UserRole.FARMER}>Farmer</option>
                                    <option value={UserRole.SHOP}>Shop Owner / Fertilizer Shop</option>
                                    <option value={UserRole.MANUFACTURER}>Mill Owner</option>
                                    <option value={UserRole.CUSTOMER}>Customer</option>
                                </select>
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

                    {/* ── PHONE LOGIN ── */}
                    {authMethod === "phone" && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-5">
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
                                    <Link href="/forgot-password" className="text-xs text-green-600 hover:underline font-bold">Forgot password?</Link>
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={phonePassword}
                                    onChange={e => setPhonePassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className={inputCls}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Role (Optional)</label>
                                <select value={phoneRole} onChange={e => setPhoneRole(e.target.value)} className={selectCls}>
                                    <option value="">Select a role (if you have multiple)</option>
                                    <option value={UserRole.FARMER}>Farmer</option>
                                    <option value={UserRole.SHOP}>Shop Owner / Fertilizer Shop</option>
                                    <option value={UserRole.MANUFACTURER}>Mill Owner</option>
                                    <option value={UserRole.CUSTOMER}>Customer</option>
                                </select>
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
