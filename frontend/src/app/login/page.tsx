"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout } from "lucide-react";
import { UserRole } from "@/types";

export default function LoginPage() {
    // Refs are 100% stable and won't cause focus loss
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const roleRef = useRef<HTMLSelectElement>(null);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
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
            console.log("Attempting login for:", email);

            const payload: any = { email, password };
            if (role) payload.role = role;

            const { data } = await api.post("/auth/login", payload);
            console.log("Login successful, data:", data);

            const user = {
                id: data.id,
                email: email,
                role: data.role,
                full_name: "User"
            };
            localStorage.setItem("user", JSON.stringify(user));

            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            console.error("Login error:", err);
            const errorMessage = err.response?.data?.detail || err.message || "Login failed";
            setError(errorMessage);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
            {/* Plain DIV Card to avoid any logic in Shadcn Card component */}
            <div className="w-full max-w-md bg-white rounded-xl border border-green-100 shadow-lg overflow-hidden">
                <div className="p-6 text-center space-y-2 border-b border-gray-50">
                    <div className="flex justify-center mt-2">
                        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Sprout className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-green-900">AgriChain Login</h1>
                    <p className="text-sm text-gray-500">Enter your credentials to access the platform</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-semibold text-gray-700 block">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="farmer@example.com"
                                ref={emailRef}
                                required
                                autoComplete="email"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" title="password" className="text-sm font-semibold text-gray-700">Password</label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-green-600 hover:underline font-bold"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                ref={passwordRef}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="role" className="text-sm font-semibold text-gray-700 block">Role (Optional)</label>
                            <select
                                id="role"
                                name="role"
                                ref={roleRef}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-black"
                            >
                                <option value="">Select a role (if you have multiple)</option>
                                <option value={UserRole.FARMER}>Farmer</option>
                                <option value={UserRole.SHOP}>Shop Owner</option>
                                <option value={UserRole.MANUFACTURER}>Manufacturer</option>
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
                                    Logging in...
                                </span>
                            ) : "Login"}
                        </button>

                        <div className="text-center text-sm pt-2">
                            <span className="text-gray-500">Don't have an account? </span>
                            <Link href="/register" className="text-green-600 font-bold hover:underline">
                                Create Account
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
