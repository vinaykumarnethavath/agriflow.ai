"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Sprout } from "lucide-react";
import { UserRole } from "@/types";

export default function RegisterPage() {
    // Refs for safe typing
    const fullNameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);
    const roleRef = useRef<HTMLSelectElement>(null);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [passwordsMatch, setPasswordsMatch] = useState(true);

    const { login } = useAuth();
    const router = useRouter();

    const handlePasswordChange = () => {
        const pass = passwordRef.current?.value || "";
        const confirm = confirmPasswordRef.current?.value || "";
        setPasswordsMatch(!confirm || pass === confirm);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const email = emailRef.current?.value || "";
        const password = passwordRef.current?.value || "";
        const confirm_password = confirmPasswordRef.current?.value || "";
        const full_name = fullNameRef.current?.value || "";
        const role = (roleRef.current?.value as UserRole) || UserRole.FARMER;

        if (password !== confirm_password) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const formData = {
                email,
                password,
                confirm_password,
                full_name,
                role
            };

            console.log("Registering user:", formData);
            await api.post("/auth/register", formData);

            const { data } = await api.post("/auth/login", { email, password });

            const user = {
                id: data.id,
                email,
                role: data.role,
                full_name
            };
            localStorage.setItem("user", JSON.stringify(user));
            login(data.access_token, data.role);
            router.push(`/dashboard/${data.role}`);
        } catch (err: any) {
            console.error("Registration error:", err);
            setError(err.response?.data?.detail || "Registration failed");
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
                    <h1 className="text-2xl font-bold text-green-900">Join AgriChain</h1>
                    <p className="text-sm text-gray-500">Create an account to get started</p>
                </div>

                <div className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="full_name" className="text-sm font-semibold text-gray-700 block">Full Name</label>
                            <input
                                id="full_name"
                                name="full_name"
                                type="text"
                                placeholder="John Doe"
                                ref={fullNameRef}
                                required
                                autoComplete="name"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-semibold text-gray-700 block">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="user@example.com"
                                ref={emailRef}
                                required
                                autoComplete="email"
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="password" title="password" className="text-sm font-semibold text-gray-700 block">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    ref={passwordRef}
                                    onChange={handlePasswordChange}
                                    required
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 text-black"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="confirm_password" title="confirm password" className="text-sm font-semibold text-gray-700 block">Confirm</label>
                                <input
                                    id="confirm_password"
                                    name="confirm_password"
                                    type="password"
                                    ref={confirmPasswordRef}
                                    onChange={handlePasswordChange}
                                    required
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    className={`w-full rounded-lg border px-4 py-2 text-sm outline-none transition-all focus:ring-2 placeholder:text-gray-400 text-black ${!passwordsMatch ? "border-red-500 focus:ring-red-500/10" : "border-gray-200 focus:border-green-500 focus:ring-green-500/10"}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="role" className="text-sm font-semibold text-gray-700 block">Your Role</label>
                            <select
                                id="role"
                                name="role"
                                ref={roleRef}
                                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-black"
                                required
                            >
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
                            className="w-full bg-green-600 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating...
                                </span>
                            ) : "Create Account"}
                        </button>

                        <div className="text-center text-sm pt-2">
                            <span className="text-gray-500">Already have an account? </span>
                            <Link href="/login" className="text-green-600 font-bold hover:underline">
                                Login Here
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
