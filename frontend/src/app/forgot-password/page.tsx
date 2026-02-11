"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Sprout, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
    const emailRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const email = emailRef.current?.value || "";
        if (!email) return;

        setLoading(true);

        try {
            await api.post("/auth/forgot-password", { email });
            router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Something went wrong. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
            <div className="w-full max-w-md bg-white rounded-xl border border-green-100 shadow-lg overflow-hidden">
                <div className="p-6 text-center space-y-2 border-b border-gray-50">
                    <div className="flex justify-center mt-2">
                        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Sprout className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-green-900">Reset Password</h1>
                    <p className="text-sm text-gray-500">Enter your email and we'll send you an OTP</p>
                </div>

                <div className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-semibold text-gray-700 block">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                ref={emailRef}
                                required
                                autoComplete="email"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
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
