"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Search, Tag, TrendingUp, Sparkles, MapPin } from "lucide-react";
import Link from "next/link";

export default function CustomerDashboard() {
    const { user } = useAuth();

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-4xl font-bold mb-2">Welcome, {user?.full_name}! 🌿</h1>
                    <p className="text-green-100 text-lg mb-6">Fresh from the farm to your doorstep. Discover local produce today.</p>
                    <div className="flex gap-3">
                        <Link href="/dashboard/customer/marketplace">
                            <Button size="lg" className="bg-white text-green-700 hover:bg-green-50">
                                <ShoppingBag className="w-5 h-5 mr-2" /> Shop Now
                            </Button>
                        </Link>
                        <Link href="/dashboard/customer/orders">
                            <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
                                My Orders
                            </Button>
                        </Link>
                    </div>
                </div>
                {/* Decorative Pattern */}
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-12 -translate-y-12">
                    <ShoppingBag className="w-64 h-64" />
                </div>
            </div>

            {/* Featured Categories */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Sparkles className="text-yellow-500" /> Featured Categories
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['Fresh Crops', 'Organic', 'Grains', 'Processed Goods'].map((cat, i) => (
                        <Link href={`/dashboard/customer/marketplace?category=${cat.toLowerCase()}`} key={i}>
                            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-orange-50/50 border-orange-100">
                                <CardContent className="flex flex-col items-center justify-center h-32 space-y-2">
                                    <Tag className="w-8 h-8 text-orange-400" />
                                    <span className="font-semibold text-gray-700">{cat}</span>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Mock Trending Section (Placeholder for AI/ML features) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                            <TrendingUp className="w-5 h-5" /> Trending Near You
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            <li className="flex items-center justify-between text-sm bg-white p-3 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">🌾</div>
                                    <div>
                                        <p className="font-medium">Premium Basmati Rice</p>
                                        <p className="text-xs text-gray-500">From Punjab Farms</p>
                                    </div>
                                </div>
                                <span className="font-bold text-green-600">₹80/kg</span>
                            </li>
                            <li className="flex items-center justify-between text-sm bg-white p-3 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">🍎</div>
                                    <div>
                                        <p className="font-medium">Kashmiri Apples</p>
                                        <p className="text-xs text-gray-500">Fresh Harvest</p>
                                    </div>
                                </div>
                                <span className="font-bold text-green-600">₹120/kg</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-700">
                            <MapPin className="w-5 h-5" /> Buy Local
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 mb-4 text-sm">Support farmers in your region. Reduce carbon footprint by buying local.</p>
                        <Button variant="outline" className="w-full border-purple-200 text-purple-700 hover:bg-purple-50">
                            Explore Nearby Farmers
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
