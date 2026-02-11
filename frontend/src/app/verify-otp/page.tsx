"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { ShieldCheck } from "lucide-react";

function VerifyOTPContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const otpRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const emailParam = searchParams.get("email");
        if (emailParam) {
            setEmail(emailParam);
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
            await api.post("/auth/verify-otp", { email, otp_code: otp });
            router.push(`/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid OTP. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-xl border border-green-100 shadow-lg overflow-hidden">
            <div className="p-6 text-center space-y-2 border-b border-gray-50">
                <div className="flex justify-center mt-2">
                    <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-green-900">Verify OTP</h1>
                <p className="text-sm text-gray-500 px-4">Enter the 6-digit code sent to <span className="text-gray-900 font-bold">{email}</span></p>
            </div>

            <div className="p-8 pb-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="otp" className="text-sm font-semibold text-gray-700 block text-center">Enter 6-digit Code</label>
                        <input
                            id="otp"
                            name="otp"
                            type="text"
                            placeholder="123456"
                            ref={otpRef}
                            required
                            maxLength={6}
                            autoComplete="one-time-code"
                            className="w-full text-center text-3xl font-mono tracking-[0.5em] rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 outline-none transition-all focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/5 text-black"
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
        <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
            <Suspense fallback={<div className="text-green-600 font-bold animate-pulse">Loading...</div>}>
                <VerifyOTPContent />
            </Suspense>
        </div>
    );
}
