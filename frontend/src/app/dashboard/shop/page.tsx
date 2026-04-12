"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageSearch, TrendingUp, DollarSign, AlertTriangle, Users, BarChart2, Clock, User } from "lucide-react";
import api from "@/lib/api";
import {
    getShopAnalytics,
    getSalesTrend,
    getShopOrders,
    getShopRevenue,
    getMyProducts,
    ShopAnalytics,
    SalesTrend,
    ShopOrder,
    RevenueReport,
    Product
} from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
    const [revenueSummary, setRevenueSummary] = useState<RevenueReport | null>(null);
    const [productStats, setProductStats] = useState({
        uniqueActiveProducts: 0,
        totalVarieties: 0,
        activeBatches: 0,
        draftBatches: 0
    });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("7d");
    const [chartLoading, setChartLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analyticsData, trendData, ordersData, profileRes, revenueData, productsData] = await Promise.all([
                    getShopAnalytics(),
                    getSalesTrend(period),
                    getShopOrders(),
                    api.get("/shop/profile").catch(() => ({ data: null })),
                    getShopRevenue("30d").catch(() => null),
                    getMyProducts().catch(() => [])
                ]);
                setAnalytics(analyticsData);
                setSalesTrend(trendData);
                setRecentOrders(ordersData.slice(0, 5));
                if (profileRes?.data) setProfile(profileRes.data);
                if (revenueData) setRevenueSummary(revenueData);
                if (Array.isArray(productsData)) {
                    const activeKeys = new Set<string>();
                    const varietyKeys = new Set<string>();
                    let activeBatches = 0;
                    let draftBatches = 0;

                    (productsData as Product[]).forEach((product) => {
                        const key = `${product.name?.toLowerCase() || ""}|${product.short_name?.toLowerCase() || ""}|${product.brand?.toLowerCase() || ""}`;
                        varietyKeys.add(key);
                        if (product.status === "active") {
                            activeKeys.add(key);
                            activeBatches += 1;
                        }
                        if (product.status === "draft") {
                            draftBatches += 1;
                        }
                    });

                    setProductStats({
                        uniqueActiveProducts: activeKeys.size,
                        totalVarieties: varietyKeys.size,
                        activeBatches,
                        draftBatches
                    });
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Poll every 15 seconds for real-time updates
        const interval = setInterval(() => {
            fetchData();
        }, 15000);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

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
            <div className="bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 border border-sky-100 rounded-xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {profile?.profile_picture_url ? (
                        <img 
                            src={profile.profile_picture_url} 
                            alt={profile.shop_name || "Shop Logo"} 
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-2xl border-2 border-white shadow-sm">
                            {(profile?.shop_name || user?.full_name || "S").charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-800">{profile?.shop_name || "Shop Dashboard"}</h1>
                        <span className="text-xs bg-sky-200 text-sky-800 px-2 py-0.5 rounded-md font-mono">ID: {profile?.shop_id || profile?.id || "—"}</span>
                    </div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                        <User className="w-4 h-4 text-sky-600" />
                        Owner: <span className="font-semibold text-gray-800">{profile?.owner_name || user?.full_name}</span>
                        {profile?.father_name && (
                            <span className="ml-2 bg-white/80 px-2 py-0.5 rounded border border-gray-100 text-gray-500 text-xs font-medium">
                                {relationMap[profile?.relation_type || ""] || profile?.relation_type || "S/o"}: <span className="text-gray-700">{profile.father_name}</span>
                            </span>
                        )}
                    </p>
                </div>
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
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Inventory (Unique)</CardTitle>
                        <PackageSearch className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productStats.uniqueActiveProducts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{analytics?.low_stock_count || 0}</div>
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
                    </CardContent>
                </Card>
            </div>



            {/* Hybrid Chart & Metrics Layout - 2/3 and 1/3 Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sales Chart with Period Selector (Taking 2 spans) */}
                <Card className="flex flex-col lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3 pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-green-600" />
                            Order Trend — {PERIOD_LABELS[period]}
                        </CardTitle>
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
                    <CardContent className="h-[280px] pt-4">
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
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(value) => [`${Number(value)} Orders`, "Count"]}
                                        labelFormatter={(label) => formatDate(label as string)}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="order_count"
                                        stroke="#10b981"
                                        strokeWidth={2.5}
                                        dot={{ r: 2, fill: "#10b981" }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Monthly Expenses and Net Profit Cards (Taking 1 span) */}
                <div className="flex flex-col gap-6 lg:col-span-1">
                    <Card className="border-amber-200 bg-amber-50/60 flex-1 flex flex-col justify-center">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-700">Monthly Expenses</CardTitle>
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-amber-800 mb-1">₹{(revenueSummary?.total_expenses || 0).toLocaleString()}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-200 bg-emerald-50/60 flex-1 flex flex-col justify-center">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-700">Net Profit</CardTitle>
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-emerald-800 mb-1">₹{(revenueSummary?.profit || 0).toLocaleString()}</div>
                        </CardContent>
                    </Card>
                </div>
                
            </div>

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
