"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { ShieldCheck } from "lucide-react";

type ResetMethod = "email" | "phone";

function VerifyOTPContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [method, setMethod] = useState<ResetMethod>("email");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [role, setRole] = useState("");
    const otpRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const methodParam = searchParams.get("method");
        const emailParam = searchParams.get("email");
        const phoneParam = searchParams.get("phone_number");
        const roleParam = searchParams.get("role");

        if (methodParam === "phone" && phoneParam && roleParam) {
            setMethod("phone");
            setPhoneNumber(phoneParam);
            setRole(roleParam);
        } else if (emailParam && roleParam) {
            setMethod("email");
            setEmail(emailParam);
            setRole(roleParam);
        } else {
            router.push("/forgot-password");
        }
    }, [searchParams, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const otp = otpRef.current?.value || "";
        if (otp.length !== 6) return;

        setLoading(true);

        try {
            const payload = method === "email"
                ? { email, role, otp_code: otp }
                : { phone_number: phoneNumber, role, otp_code: otp };

            await api.post("/auth/verify-otp", payload);

            const params = new URLSearchParams({ method, role, otp });
            if (method === "email") {
                params.set("email", email);
            } else {
                params.set("phone_number", phoneNumber);
            }

            router.push(`/reset-password?${params.toString()}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid OTP. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
            <div className="p-6 text-center space-y-2 border-b border-border">
                <div className="flex justify-center mt-2">
                    <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Verify OTP</h1>
                <p className="text-sm text-muted-foreground px-4">Enter the 6-digit code sent to <span className="text-foreground font-bold">{method === "email" ? email : phoneNumber}</span></p>
            </div>

            <div className="p-8 pb-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="otp" className="text-sm font-semibold text-muted-foreground block text-center">Enter 6-digit Code</label>
                        <input
                            id="otp"
                            name="otp"
                            type="text"
                            placeholder="123456"
                            ref={otpRef}
                            required
                            maxLength={6}
                            autoComplete="one-time-code"
                            className="w-full text-center text-3xl font-mono tracking-[0.5em] rounded-lg border border-input bg-muted/30 px-4 py-4 outline-none transition-all focus:border-green-500 focus:bg-background focus:ring-4 focus:ring-green-500/5 text-foreground"
                            onInput={(e) => {
                                e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, "");
                            }}
                        />
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
                        {loading ? "Verifying..." : "Verify OTP"}
                    </button>

                    <div className="text-center pt-2">
                        <Link href="/forgot-password" title="resend" className="text-sm text-green-600 font-bold hover:underline">
                            Resend Code
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function VerifyOTPPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300">
            <Suspense fallback={<div className="text-green-600 font-bold animate-pulse">Loading...</div>}>
                <VerifyOTPContent />
            </Suspense>
        </div>
    );
}
