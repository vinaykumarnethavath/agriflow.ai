"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Factory, Truck, ShoppingCart, IndianRupee, Package, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { getManufacturerStats, ManufacturerStats } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ManufacturerDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<ManufacturerStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await getManufacturerStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch manufacturer stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Manufacturer Dashboard</h1>
            <p className="text-gray-500">Welcome back, {user?.full_name}</p>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Raw Material Stock</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.raw_stock || 0} kg</div>
                        <p className="text-xs text-muted-foreground">Available for processing</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Finished Goods</CardTitle>
                        <Factory className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.finished_stock || 0} kg</div>
                        <p className="text-xs text-muted-foreground">Ready for sale</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Purchases</CardTitle>
                        <Truck className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats?.today_purchases.toLocaleString() || 0}</div>
                        <div className="flex items-center text-xs text-red-500 mt-1">
                            <ArrowDownRight className="w-3 h-3 mr-1" /> Cost
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
                        <IndianRupee className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{stats?.today_sales.toLocaleString() || 0}</div>
                        <div className="flex items-center text-xs text-green-500 mt-1">
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Revenue
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/dashboard/manufacturer/purchases" className="group">
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                                <Truck className="w-6 h-6 text-blue-600" />
                            </div>
                            <span className="font-semibold text-gray-700">Record Purchase</span>
                            <span className="text-xs text-gray-500 text-center">Buy crops from farmers</span>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/dashboard/manufacturer/production" className="group">
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                                <Factory className="w-6 h-6 text-green-600" />
                            </div>
                            <span className="font-semibold text-gray-700">Start Production</span>
                            <span className="text-xs text-gray-500 text-center">Process raw materials</span>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/dashboard/manufacturer/sales" className="group">
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="p-3 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                                <ShoppingCart className="w-6 h-6 text-purple-600" />
                            </div>
                            <span className="font-semibold text-gray-700">New Sale</span>
                            <span className="text-xs text-gray-500 text-center">Sell finished goods</span>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/dashboard/manufacturer/inventory" className="group">
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-dashed border-2">
                        <CardContent className="flex flex-col items-center justify-center h-40 space-y-3">
                            <div className="p-3 bg-yellow-100 rounded-full group-hover:bg-yellow-200 transition-colors">
                                <Package className="w-6 h-6 text-yellow-600" />
                            </div>
                            <span className="font-semibold text-gray-700">View Inventory</span>
                            <span className="text-xs text-gray-500 text-center">Check stock levels</span>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
