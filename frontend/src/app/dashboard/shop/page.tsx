"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackageSearch, TrendingUp, DollarSign, AlertTriangle, Plus, ClipboardList, Users, BarChart2, Clock, User } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { getShopAnalytics, getSalesTrend, getShopOrders, ShopAnalytics, SalesTrend, ShopOrder } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PERIOD_OPTIONS = [
    { label: "7D", value: "7d" },
    { label: "1M", value: "30d" },
    { label: "3M", value: "90d" },
    { label: "1Y", value: "1y" },
];

const PERIOD_LABELS: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 3 Months",
    "1y": "Last Year",
};

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function ShopDashboard() {
    const { user } = useAuth();
    const relationMap: { [key: string]: string } = { "son_of": "S/o", "wife_of": "W/o", "daughter_of": "D/o", "S/O": "S/o", "W/O": "W/o", "D/O": "D/o" };
    const [analytics, setAnalytics] = useState<ShopAnalytics | null>(null);
    const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
    const [recentOrders, setRecentOrders] = useState<ShopOrder[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("7d");
    const [chartLoading, setChartLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analyticsData, trendData, ordersData, profileRes] = await Promise.all([
                    getShopAnalytics(),
                    getSalesTrend(period),
                    getShopOrders(),
                    api.get("/shop/profile").catch(() => ({ data: null }))
                ]);
                setAnalytics(analyticsData);
                setSalesTrend(trendData);
                setRecentOrders(ordersData.slice(0, 5));
                if (profileRes?.data) setProfile(profileRes.data);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePeriodChange = async (p: string) => {
        setPeriod(p);
        setChartLoading(true);
        try {
            const trendData = await getSalesTrend(p);
            setSalesTrend(trendData);
        } catch (e) {
            console.error(e);
        } finally {
            setChartLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-800">{profile?.shop_name || "Shop Dashboard"}</h1>
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-md font-mono">ID: {profile?.shop_id || profile?.id || "—"}</span>
                    </div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                        <User className="w-4 h-4 text-green-600" />
                        Owner: <span className="font-semibold text-gray-800">{profile?.owner_name || user?.full_name}</span>
                        {profile?.father_name && (
                            <span className="ml-2 bg-white/80 px-2 py-0.5 rounded border border-gray-100 text-gray-500 text-xs font-medium">
                                {relationMap[profile?.relation_type || ""] || profile?.relation_type || "S/o"}: <span className="text-gray-700">{profile.father_name}</span>
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue (Month)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{analytics?.month_revenue.toLocaleString() || 0}</div>
                        <p className="text-xs text-muted-foreground">Today: ₹{analytics?.today_sales.toLocaleString() || 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Inventory</CardTitle>
                        <PackageSearch className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.total_products || 0} Products</div>
                        {/* Change 6: Removed "Total Units" subtitle */}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{analytics?.low_stock_count || 0}</div>
                        <p className="text-xs text-muted-foreground">Items below threshold</p>
                    </CardContent>
                </Card>
                {/* Change 7: Pending Orders instead of Total Orders */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{analytics?.pending_orders ?? 0}</div>
                        <p className="text-xs text-muted-foreground">Awaiting fulfillment</p>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Chart with Period Selector */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-green-600" />
                        Sales Trend — {PERIOD_LABELS[period]}
                    </CardTitle>
                    {/* Change 2/3: Period selector tabs */}
                    <div className="flex items-center border rounded-lg overflow-hidden">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handlePeriodChange(opt.value)}
                                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                                    period === opt.value
                                        ? "bg-green-600 text-white"
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {chartLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">Loading chart...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(val) => {
                                        const d = new Date(val);
                                        return `${d.getDate()}/${d.getMonth() + 1}`;
                                    }}
                                />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                                <Tooltip
                                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Sales"]}
                                    labelFormatter={(label) => formatDate(label)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#16a34a"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Recent Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Order ID</th>
                                    <th className="px-4 py-3">Farmer Name</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Mode of Payment</th>
                                    <th className="px-4 py-3">Transaction ID</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No recent orders found.</td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 border-b">
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-400">#Order-{String(order.id).padStart(4, '0')}</td>
                                            <td className="px-4 py-3 font-medium whitespace-nowrap">{order.farmer_name || "Walk-in"}</td>
                                            <td className="px-4 py-3 text-gray-600 max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {(order.items?.length || 0) > 0 ? (
                                                        order.items?.map((item: any, idx: number) => (
                                                            <span key={idx} className="inline-flex items-center bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-medium border border-gray-200/50">
                                                                {item.product_name} <span className="text-gray-400 ml-1 font-bold">x{item.quantity}</span>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-gray-400 italic text-xs">No items</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="capitalize text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                                                    {order.payment_mode === "razorpay" ? `Razorpay${order.payment_id?.startsWith("pay_mock_") ? ` (${order.payment_id.split("_")[1]})` : ""}` : order.payment_mode || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-400">TXN-{String(order.id).padStart(6, '0')}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">₹{order.final_amount}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
