"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout, Mail, Phone, Store, Factory, ShoppingCart, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { UserRole } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";
import { PasswordInput } from "@/components/ui/password-input";

type AuthMethod = "email" | "phone";
type EmailStep = "form" | "otp";

export default function RegisterPage() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");

    // ── Email form state ──────────────────────────────────────────────────────
    const [emailStep, setEmailStep] = useState<EmailStep>("form");
    const [emailFormData, setEmailFormData] = useState({
        full_name: "", email: "", password: "", confirm_password: "",
        role: UserRole.FARMER as UserRole,
    });
    const [otpCode, setOtpCode] = useState("");
    const otpInputRef = useRef<HTMLInputElement>(null);
    const [otpSending, setOtpSending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

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
    const { t } = useLanguage();

    const inputCls = "w-full rounded-lg border border-input bg-background px-3.5 py-1.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-muted-foreground text-foreground";

    // ── Resend cooldown timer ─────────────────────────────────────────────────
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // ── Auto-focus OTP input when switching to OTP step ───────────────────────
    useEffect(() => {
        if (emailStep === "otp") {
            setTimeout(() => otpInputRef.current?.focus(), 100);
        }
    }, [emailStep]);

    // ── EMAIL STEP 1: Submit Form -> Send OTP ─────────────────────────────────
    const handleEmailFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const { full_name, email, password, confirm_password, role } = emailFormData;

        if (!full_name.trim()) { setError("Full name is required"); return; }
        if (!email.trim()) { setError("Email is required"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (password !== confirm_password) { setError("Passwords do not match"); return; }

        setOtpSending(true);
        try {
            await api.post("/auth/send-registration-otp", {
                email: email.toLowerCase().trim(),
                role,
            });
            setEmailStep("otp");
            setResendCooldown(60);
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || "Failed to send verification code";
            setError(msg);
        } finally {
            setOtpSending(false);
        }
    };

    // ── EMAIL STEP 2: Verify OTP -> Complete Registration ─────────────────────
    const handleOtpVerifyAndRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (otpCode.length !== 6) {
            setError("Please enter the 6-digit verification code");
            return;
        }

        setLoading(true);
        try {
            const verifyRes = await api.post("/auth/verify-registration-otp", {
                email: emailFormData.email.toLowerCase().trim(),
                otp: otpCode,
                role: emailFormData.role,
            });

            if (!verifyRes.data?.verified) {
                setError("Invalid verification code");
                setLoading(false);
                return;
            }

            const { full_name, email, password, role } = emailFormData;
            const regRes = await api.post("/auth/register", {
                full_name,
                email: email.toLowerCase().trim(),
                password,
                role,
                email_otp_code: otpCode,
            });

            const user = { id: regRes.data.id, email, role: regRes.data.role, full_name };
            localStorage.setItem("user", JSON.stringify(user));
            login(regRes.data.access_token, regRes.data.role);
            router.push(`/dashboard/${regRes.data.role}`);
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || "Registration failed";
            setError(msg);
            setLoading(false);
        }
    };

    // ── RESEND OTP ────────────────────────────────────────────────────────────
    const handleResendOtp = async () => {
        if (resendCooldown > 0 || otpSending) return;
        setError("");
        setOtpSending(true);
        try {
            await api.post("/auth/send-registration-otp", {
                email: emailFormData.email.toLowerCase().trim(),
                role: emailFormData.role,
            });
            setResendCooldown(60);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to resend code");
        } finally {
            setOtpSending(false);
        }
    };

    // ── PHONE REGISTRATION ───────────────────────────────────────────────────
    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!phone || phone.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
        if (!phoneFullName.trim()) { setError("Full name is required"); return; }
        if (phonePassword.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (phonePassword !== phoneConfirmPassword) { setError("Passwords do not match"); return; }

        setLoading(true);
        try {
            const payload: any = {
                phone_number: phone,
                full_name: phoneFullName,
                password: phonePassword,
                role: phoneRole,
            };

            const { data } = await api.post("/auth/register", payload);
            const user = { id: data.id, phone_number: phone, role: data.role, full_name: phoneFullName };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || "Registration failed";
            setError(errorMessage);
            setLoading(false);
        }
    };

    const roleButtons = (currentRole: UserRole, onSelect: (r: UserRole) => void) => (
        <div className="flex gap-1.5">
            {[
                { id: UserRole.FARMER, label: "Farmer", icon: Sprout },
                { id: UserRole.SHOP, label: "Shop", icon: Store },
                { id: UserRole.MANUFACTURER, label: "Mill", icon: Factory },
                { id: UserRole.CUSTOMER, label: "Customer", icon: ShoppingCart }
            ].map(r => (
                <button
                    key={r.id} type="button"
                    onClick={() => onSelect(r.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition-colors ${
                        currentRole === r.id
                            ? 'bg-green-100 border-green-500 text-green-700 font-bold dark:bg-green-950/60 dark:border-green-500 dark:text-green-300'
                            : 'bg-background border-input text-muted-foreground hover:bg-muted'
                    }`}
                >
                    <r.icon className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px] font-bold leading-none">{r.label}</span>
                </button>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4 transition-colors duration-300 relative">
            {/* Top Bar Quick Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
                <LanguageSelector direction="down" />
                <ThemeToggle />
            </div>

            {/* Registration Card — matching length and size of login box */}
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 text-center border-b border-border">
                    <div className="flex justify-center mb-1">
                        <div className="w-28 flex items-center justify-center">
                            <img src="/logo.png?v=5" alt="AgriFlow Logo" className="w-full h-auto object-contain drop-shadow-md" />
                        </div>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-0.5">Create Account</h1>
                    <p className="text-xs text-muted-foreground">Join AgriFlow supply chain platform</p>
                </div>

                <div className="p-4 sm:p-5 space-y-2.5">
                    {/* Method Toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden p-0.5 bg-muted/30">
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("email"); setError(""); setEmailStep("form"); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${authMethod === "email" ? "bg-green-600 text-white shadow-xs" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <Mail className="h-3.5 w-3.5" /> Email Verification
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMethod("phone"); setError(""); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${authMethod === "phone" ? "bg-green-600 text-white shadow-xs" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
                        >
                            <Phone className="h-3.5 w-3.5" /> Phone
                        </button>
                    </div>

                    {/* ── EMAIL FORM ── */}
                    {authMethod === "email" && (
                        <form onSubmit={emailStep === "form" ? handleEmailFormSubmit : handleOtpVerifyAndRegister} className="space-y-2">
                            {emailStep === "form" ? (
                                <>
                                    <div className="space-y-0.5">
                                        <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Full Name</label>
                                        <input
                                            type="text"
                                            placeholder="John Doe"
                                            required
                                            autoComplete="name"
                                            value={emailFormData.full_name}
                                            onChange={e => setEmailFormData(p => ({ ...p, full_name: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="space-y-0.5">
                                        <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Email Address</label>
                                        <input
                                            type="email"
                                            placeholder="user@example.com"
                                            required
                                            autoComplete="email"
                                            value={emailFormData.email}
                                            onChange={e => setEmailFormData(p => ({ ...p, email: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-0.5">
                                            <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Password</label>
                                            <PasswordInput
                                                required
                                                autoComplete="new-password"
                                                placeholder="••••••••"
                                                value={emailFormData.password}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    setEmailFormData(p => ({ ...p, password: v }));
                                                    setPasswordsMatch(!emailFormData.confirm_password || v === emailFormData.confirm_password);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Confirm</label>
                                            <PasswordInput
                                                required
                                                autoComplete="new-password"
                                                placeholder="••••••••"
                                                value={emailFormData.confirm_password}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    setEmailFormData(p => ({ ...p, confirm_password: v }));
                                                    setPasswordsMatch(!v || emailFormData.password === v);
                                                }}
                                                className={!passwordsMatch ? "border-red-500 bg-red-50 focus:ring-red-500/10" : ""}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Your Role</label>
                                        {roleButtons(emailFormData.role, (role) => setEmailFormData(p => ({ ...p, role })))}
                                    </div>

                                    {error && <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-xs font-medium">{error}</div>}

                                    <button
                                        type="submit"
                                        disabled={otpSending || !passwordsMatch}
                                        className="w-full bg-green-600 text-white rounded-lg py-2 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-0.5"
                                    >
                                        {otpSending ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Sending Code...
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-1.5">
                                                <Mail className="h-4 w-4" /> Verify Email & Create Account
                                            </span>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* OTP Verification Step */}
                                    <div className="text-center space-y-1.5 py-1">
                                        <div className="flex justify-center">
                                            <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                <ShieldCheck className="h-5 w-5 text-green-600" />
                                            </div>
                                        </div>
                                        <h2 className="text-lg font-bold text-foreground">Verify Your Email</h2>
                                        <p className="text-xs text-muted-foreground px-2">
                                            We sent a 6-digit code to <span className="text-foreground font-bold">{emailFormData.email}</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs sm:text-sm font-semibold text-muted-foreground block text-center">Enter Verification Code</label>
                                        <input
                                            ref={otpInputRef}
                                            type="text"
                                            placeholder="123456"
                                            value={otpCode}
                                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                                            maxLength={6}
                                            required
                                            autoComplete="one-time-code"
                                            className="w-full text-center text-xl font-mono tracking-[0.4em] rounded-lg border border-input bg-muted/30 px-3 py-2 outline-none transition-all focus:border-green-500 focus:bg-background focus:ring-4 focus:ring-green-500/5 text-foreground"
                                        />
                                    </div>
                                    {error && <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-xs font-medium">{error}</div>}
                                    <button
                                        type="submit"
                                        disabled={loading || otpCode.length !== 6}
                                        className="w-full bg-green-600 text-white rounded-lg py-2 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Creating Account...
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-1.5">
                                                <ShieldCheck className="h-4 w-4" /> Verify & Create Account
                                            </span>
                                        )}
                                    </button>
                                    <div className="flex items-center justify-between text-xs pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => { setEmailStep("form"); setError(""); setOtpCode(""); }}
                                            className="text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 transition-colors"
                                        >
                                            <ArrowLeft className="h-3 w-3" /> Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={resendCooldown > 0 || otpSending}
                                            className="text-green-600 hover:text-green-700 font-bold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <RefreshCw className={`h-3 w-3 ${otpSending ? 'animate-spin' : ''}`} />
                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                                        </button>
                                    </div>
                                </>
                            )}
                            <div className="text-center text-xs sm:text-sm pt-1">
                                <span className="text-muted-foreground">Already have an account? </span>
                                <Link href="/login" className="text-green-600 font-bold hover:underline">Login Here</Link>
                            </div>
                        </form>
                    )}

                    {/* ── PHONE FORM ── */}
                    {authMethod === "phone" && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-2">
                            <div className="space-y-0.5">
                                <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Phone Number</label>
                                <div className="flex gap-1.5">
                                    <span className="flex items-center px-2.5 rounded-lg border border-input bg-muted text-xs sm:text-sm text-muted-foreground font-semibold">+91</span>
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

                            <div className="space-y-0.5">
                                <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Full Name</label>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={phoneFullName}
                                    onChange={e => setPhoneFullName(e.target.value)}
                                    required
                                    autoComplete="name"
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-0.5">
                                    <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Password</label>
                                    <PasswordInput
                                        placeholder="••••••••"
                                        value={phonePassword}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setPhonePassword(v);
                                            setPasswordsMatch(!phoneConfirmPassword || v === phoneConfirmPassword);
                                        }}
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Confirm</label>
                                    <PasswordInput
                                        placeholder="••••••••"
                                        value={phoneConfirmPassword}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setPhoneConfirmPassword(v);
                                            setPasswordsMatch(!v || phonePassword === v);
                                        }}
                                        required
                                        autoComplete="new-password"
                                        className={!passwordsMatch ? "border-red-500 bg-red-50 focus:ring-red-500/10" : ""}
                                    />
                                </div>
                            </div>

                            <div className="space-y-0.5">
                                <label className="text-xs sm:text-sm font-semibold text-muted-foreground block">Your Role</label>
                                {roleButtons(phoneRole, setPhoneRole)}
                            </div>

                            {error && <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-xs font-medium">{error}</div>}

                            <button
                                type="submit"
                                disabled={loading || !passwordsMatch}
                                className="w-full bg-green-600 text-white rounded-lg py-2 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-0.5"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creating Account...
                                    </span>
                                ) : (
                                    "Create Account"
                                )}
                            </button>

                            <div className="text-center text-xs sm:text-sm pt-1">
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

