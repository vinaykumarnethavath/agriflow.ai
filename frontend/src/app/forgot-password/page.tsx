"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Sprout, ArrowLeft, Mail, Phone } from "lucide-react";
import { UserRole } from "@/types";

type ResetMethod = "email" | "phone";

function ForgotPasswordContent() {
    const [resetMethod, setResetMethod] = useState<ResetMethod>("email");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [role, setRole] = useState<UserRole>(UserRole.FARMER);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const inputCls = "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-muted-foreground text-foreground";
    const selectCls = "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-foreground";

    useEffect(() => {
        const method = searchParams.get("method");
        if (method === "phone") {
            setResetMethod("phone");
        } else if (method === "email") {
            setResetMethod("email");
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (resetMethod === "email" && !email.trim()) {
            setError("Email is required");
            return;
        }

        if (resetMethod === "phone") {
            if (!phoneNumber.trim()) {
                setError("Phone number is required");
                return;
            }
            if (phoneNumber.trim().length !== 10) {
                setError("Enter a valid 10-digit phone number");
                return;
            }
        }

        setLoading(true);

        try {
            const payload = resetMethod === "email"
                ? { email: email.toLowerCase().trim(), role }
                : { phone_number: phoneNumber.trim(), role };

            await api.post("/auth/forgot-password", payload);

            const params = new URLSearchParams({ method: resetMethod, role });
            if (resetMethod === "email") {
                params.set("email", email.toLowerCase().trim());
            } else {
                params.set("phone_number", phoneNumber.trim());
            }

            router.push(`/verify-otp?${params.toString()}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300">
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
                <div className="p-6 text-center space-y-2 border-b border-border">
                    <div className="flex justify-center mt-2">
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <Sprout className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
                    <p className="text-sm text-muted-foreground">Choose email or phone number and we'll send you an OTP</p>
                </div>

                <div className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <button
                                type="button"
                                onClick={() => { setResetMethod("email"); setError(""); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${resetMethod === "email" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            >
                                <Mail className="h-4 w-4" /> Email
                            </button>
                            <button
                                type="button"
                                onClick={() => { setResetMethod("phone"); setError(""); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${resetMethod === "phone" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            >
                                <Phone className="h-4 w-4" /> Phone Number
                            </button>
                        </div>

                        {resetMethod === "email" ? (
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-sm font-semibold text-muted-foreground block">Email Address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    className={inputCls}
                                />
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <label htmlFor="phone_number" className="text-sm font-semibold text-muted-foreground block">Phone Number</label>
                                <div className="flex gap-2">
                                    <span className="flex items-center px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground font-semibold">+91</span>
                                    <input
                                        id="phone_number"
                                        name="phone_number"
                                        type="tel"
                                        placeholder="9876543210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                        maxLength={10}
                                        required
                                        className={`${inputCls} flex-1`}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="role" className="text-sm font-semibold text-muted-foreground block">Account Role</label>
                            <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={selectCls}>
                                <option value={UserRole.FARMER}>Farmer</option>
                                <option value={UserRole.SHOP}>Shop Owner / Fertilizer Shop</option>
                                <option value={UserRole.MANUFACTURER}>Mill Owner</option>
                                <option value={UserRole.CUSTOMER}>Customer</option>
                            </select>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-center text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </span>
                            ) : "Send OTP"}
                        </button>

                        <div className="text-center">
                            <Link href="/login" className="text-sm text-green-600 font-bold hover:underline flex items-center justify-center gap-1.5">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>}>
            <ForgotPasswordContent />
        </Suspense>
    );
}
