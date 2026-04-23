"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout, Mail, Phone } from "lucide-react";
import { UserRole } from "@/types";

type AuthMethod = "email" | "phone";

export default function RegisterPage() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>("email");

    // ── Email form state ──────────────────────────────────────────────────────
    const [emailFormData, setEmailFormData] = useState({
        full_name: "", email: "", password: "", confirm_password: "",
        role: UserRole.FARMER as UserRole,
    });

    // ── Phone form state ──────────────────────────────────────────────────────
    const [phone, setPhone] = useState("");
    const [phoneFullName, setPhoneFullName] = useState("");
    const [phonePassword, setPhonePassword] = useState("");
    const [phoneConfirmPassword, setPhoneConfirmPassword] = useState("");
    const [phoneRole, setPhoneRole] = useState<UserRole>(UserRole.FARMER);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [passwordsMatch, setPasswordsMatch] = useState(true);

    const { login } = useAuth();
    const router = useRouter();

    const inputCls = "w-full rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-muted-foreground text-foreground";
    const selectCls = "w-full rounded-lg border border-input bg-background px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-foreground";

    // ── Email Registration (no OTP) ───────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const { full_name, email, password, confirm_password, role } = emailFormData;

        if (!full_name.trim()) { setError("Full name is required"); return; }
        if (!email.trim()) { setError("Email is required"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (password !== confirm_password) { setError("Passwords do not match"); return; }

        setLoading(true);
        try {
            await api.post("/auth/register", {
                email: email.toLowerCase().trim(),
                password,
                full_name,
                role,
            });
            const { data } = await api.post("/auth/login", { email: email.toLowerCase().trim(), password, role });
            const user = { id: data.id, email, role: data.role, full_name };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    // ── Phone Registration ────────────────────────────────────────────────────
    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!phone || phone.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
        if (phonePassword !== phoneConfirmPassword) { setError("Passwords do not match"); return; }
        if (!phoneFullName.trim()) { setError("Full name is required"); return; }

        setLoading(true);
        try {
            await api.post("/auth/register", {
                phone_number: phone,
                password: phonePassword,
                full_name: phoneFullName,
                role: phoneRole,
            });
            const { data } = await api.post("/auth/login", {
                phone_number: phone,
                password: phonePassword,
                role: phoneRole,
            });
            const user = { id: data.id, phone_number: phone, role: data.role, full_name: phoneFullName };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Registration failed");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300">
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
                {/* Header */}
                <div className="p-6 text-center space-y-2 border-b border-border">
                    <div className="flex justify-center mt-2">
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <Sprout className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Join AgriFlow</h1>
                    <p className="text-sm text-muted-foreground">Create an account to get started</p>
                </div>

                <div className="p-8 pb-10 space-y-5">
                    {/* Method Toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        <button type="button"
                            onClick={() => { setAuthMethod("email"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${authMethod === "email" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                            <Mail className="h-4 w-4" /> Email
                        </button>
                        <button type="button"
                            onClick={() => { setAuthMethod("phone"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${authMethod === "phone" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                            <Phone className="h-4 w-4" /> Phone Number
                        </button>
                    </div>

                    {/* ── EMAIL FORM ── */}
                    {authMethod === "email" && (
                        <form onSubmit={handleEmailSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Full Name</label>
                                <input type="text" placeholder="John Doe" required autoComplete="name"
                                    value={emailFormData.full_name}
                                    onChange={e => setEmailFormData(p => ({ ...p, full_name: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Email Address</label>
                                <input type="email" placeholder="user@example.com" required autoComplete="email"
                                    value={emailFormData.email}
                                    onChange={e => setEmailFormData(p => ({ ...p, email: e.target.value }))}
                                    className={inputCls} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground block">Password</label>
                                    <input type="password" required autoComplete="new-password" placeholder="••••••••"
                                        value={emailFormData.password}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setEmailFormData(p => ({ ...p, password: v }));
                                            setPasswordsMatch(!emailFormData.confirm_password || v === emailFormData.confirm_password);
                                        }}
                                        className={inputCls} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground block">Confirm</label>
                                    <input type="password" required autoComplete="new-password" placeholder="••••••••"
                                        value={emailFormData.confirm_password}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setEmailFormData(p => ({ ...p, confirm_password: v }));
                                            setPasswordsMatch(!v || emailFormData.password === v);
                                        }}
                                        className={`w-full rounded-lg border px-4 py-2 text-sm outline-none transition-all focus:ring-2 placeholder:text-muted-foreground text-foreground ${!passwordsMatch ? "border-red-500 bg-red-50 focus:ring-red-500/10" : "border-input bg-background focus:border-green-500 focus:ring-green-500/10"}`} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Your Role</label>
                                <select required
                                    value={emailFormData.role}
                                    onChange={e => setEmailFormData(p => ({ ...p, role: e.target.value as UserRole }))}
                                    className={selectCls}>
                                    <option value={UserRole.FARMER}>Farmer</option>
                                    <option value={UserRole.SHOP}>Shop Owner</option>
                                    <option value={UserRole.MANUFACTURER}>Mill Owner</option>
                                    <option value={UserRole.CUSTOMER}>Customer</option>
                                </select>
                            </div>
                            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-sm font-medium">{error}</div>}
                            <button type="submit" disabled={loading || !passwordsMatch}
                                className="w-full bg-green-600 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none">
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</span>
                                    : <span className="flex items-center justify-center gap-2"><Mail className="h-4 w-4" /> Create Account</span>}
                            </button>
                            <div className="text-center text-sm pt-2">
                                <span className="text-muted-foreground">Already have an account? </span>
                                <Link href="/login" className="text-green-600 font-bold hover:underline">Login Here</Link>
                            </div>
                        </form>
                    )}

                    {/* ── PHONE FORM ── */}
                    {authMethod === "phone" && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Phone Number</label>
                                <div className="flex gap-2">
                                    <span className="flex items-center px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground font-semibold">+91</span>
                                    <input type="tel" placeholder="9876543210" value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                        maxLength={10} required className={`${inputCls} flex-1`} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Full Name</label>
                                <input type="text" placeholder="John Doe" value={phoneFullName}
                                    onChange={e => setPhoneFullName(e.target.value)} required autoComplete="name" className={inputCls} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground block">Password</label>
                                    <input type="password" placeholder="••••••••" value={phonePassword}
                                        onChange={e => { setPhonePassword(e.target.value); setPasswordsMatch(!phoneConfirmPassword || e.target.value === phoneConfirmPassword); }}
                                        required autoComplete="new-password" className={inputCls} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-muted-foreground block">Confirm</label>
                                    <input type="password" placeholder="••••••••" value={phoneConfirmPassword}
                                        onChange={e => { setPhoneConfirmPassword(e.target.value); setPasswordsMatch(!e.target.value || phonePassword === e.target.value); }}
                                        required autoComplete="new-password"
                                        className={`w-full rounded-lg border px-4 py-2 text-sm outline-none transition-all focus:ring-2 placeholder:text-muted-foreground text-foreground ${!passwordsMatch ? "border-red-500 bg-red-50 focus:ring-red-500/10" : "border-input bg-background focus:border-green-500 focus:ring-green-500/10"}`} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-muted-foreground block">Your Role</label>
                                <select value={phoneRole} onChange={e => setPhoneRole(e.target.value as UserRole)} required className={selectCls}>
                                    <option value={UserRole.FARMER}>Farmer</option>
                                    <option value={UserRole.SHOP}>Shop Owner</option>
                                    <option value={UserRole.MANUFACTURER}>Mill Owner</option>
                                    <option value={UserRole.CUSTOMER}>Customer</option>
                                </select>
                            </div>
                            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-sm font-medium">{error}</div>}
                            <button type="submit" disabled={loading}
                                className="w-full bg-green-600 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none">
                                {loading ? <span className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</span> : "Create Account"}
                            </button>
                            <div className="text-center text-sm pt-2">
                                <span className="text-muted-foreground">Already have an account? </span>
                                <Link href="/login" className="text-green-600 font-bold hover:underline">Login Here</Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
