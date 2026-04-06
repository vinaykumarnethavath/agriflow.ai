"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { KeyRound } from "lucide-react";

type ResetMethod = "email" | "phone";

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const newPasswordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);

    const [credentials, setCredentials] = useState({ method: "email" as ResetMethod, email: "", phone_number: "", role: "", otp: "" });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passwordsMatch, setPasswordsMatch] = useState(true);

    useEffect(() => {
        const method = (searchParams.get("method") as ResetMethod | null) || "email";
        const email = searchParams.get("email");
        const phoneNumber = searchParams.get("phone_number");
        const role = searchParams.get("role");
        const otp = searchParams.get("otp");
        if (otp && role && ((method === "email" && email) || (method === "phone" && phoneNumber))) {
            setCredentials({
                method,
                email: email || "",
                phone_number: phoneNumber || "",
                role,
                otp,
            });
        } else {
            router.push("/forgot-password");
        }
    }, [searchParams, router]);

    const handlePasswordChange = () => {
        const pass = newPasswordRef.current?.value || "";
        const confirm = confirmPasswordRef.current?.value || "";
        setPasswordsMatch(!confirm || pass === confirm);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const newPassword = newPasswordRef.current?.value || "";
        const confirmPassword = confirmPasswordRef.current?.value || "";

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const payload = credentials.method === "email"
                ? {
                    email: credentials.email,
                    role: credentials.role,
                    otp_code: credentials.otp,
                    new_password: newPassword,
                }
                : {
                    phone_number: credentials.phone_number,
                    role: credentials.role,
                    otp_code: credentials.otp,
                    new_password: newPassword,
                };

            await api.post("/auth/reset-password", payload);
            setSuccess(true);
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Password reset failed. Please try again.");
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden p-8 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <KeyRound className="h-8 w-8 text-green-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Password Reset!</h1>
                <p className="text-muted-foreground font-medium pb-4">Your password has been reset successfully. We are redirecting you to the login page now...</p>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 animate-[progress_3s_linear]" style={{ width: '100%' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-lg overflow-hidden">
            <div className="p-6 text-center space-y-2 border-b border-border">
                <div className="flex justify-center mt-2">
                    <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <KeyRound className="h-6 w-6 text-green-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">New Password</h1>
                <p className="text-sm text-muted-foreground">Create a secure new password for your {credentials.method === "email" ? "email" : "phone"} account</p>
            </div>

            <div className="p-8 pb-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1.5">
                        <label htmlFor="new_password" title="new password" className="text-sm font-semibold text-muted-foreground block">New Password</label>
                        <input
                            id="new_password"
                            name="new_password"
                            type="password"
                            placeholder="••••••••"
                            ref={newPasswordRef}
                            onChange={handlePasswordChange}
                            required
                            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-muted-foreground text-foreground"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="confirm_password" title="confirm password" className="text-sm font-semibold text-muted-foreground block">Confirm New Password</label>
                        <input
                            id="confirm_password"
                            name="confirm_password"
                            type="password"
                            placeholder="••••••••"
                            ref={confirmPasswordRef}
                            onChange={handlePasswordChange}
                            required
                            className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition-all focus:ring-2 placeholder:text-muted-foreground text-foreground ${!passwordsMatch ? "border-red-500 focus:ring-red-500/10" : "border-input bg-background focus:border-green-500 focus:ring-green-500/10"}`}
                        />
                        {!passwordsMatch && (
                            <p className="text-xs text-red-500 font-bold">Passwords do not match</p>
                        )}
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
                        {loading ? "Updating..." : "Reset Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-300">
            <Suspense fallback={<div className="text-green-600 font-bold animate-pulse">Loading...</div>}>
                <ResetPasswordContent />
            </Suspense>
        </div>
    );
}
