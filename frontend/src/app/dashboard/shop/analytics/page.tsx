"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    TrendingUp, DollarSign, ShoppingCart,
    ArrowUpRight, Package, Receipt,
    PiggyBank, Sprout, Leaf, FlaskConical, Wrench
} from "lucide-react";
import {
    getShopRevenue,
    getSalesTrend,
    getShopAnalytics,
    getCategoryRevenue,
    getTopProducts,
    getMyProducts,
    getChannelBreakdown,
    getOrderHealth,
    RevenueReport,
    ShopAnalytics,
    CategoryRevenue,
    TopProduct,
    Product,
    ChannelBreakdown,
    OrderHealthMetric,
} from "@/lib/api";
import {
    LineChart as ReChartsLine,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

const PERIOD_OPTIONS = [
    { label: "7D", value: "7d" },
    { label: "1M", value: "30d" },
    { label: "3M", value: "90d" },
    { label: "1Y", value: "1y" },
];

const CATEGORIES = [
    { key: "seeds", label: "Seeds", icon: Sprout, color: "border-green-200 bg-green-50/40", iconColor: "text-green-600", badgeColor: "bg-green-100 text-green-700" },
    { key: "fertilizer", label: "Fertilizer", icon: Leaf, color: "border-lime-200 bg-lime-50/40", iconColor: "text-lime-600", badgeColor: "bg-lime-100 text-lime-700" },
    { key: "pesticides", label: "Pesticides", icon: FlaskConical, color: "border-orange-200 bg-orange-50/40", iconColor: "text-orange-600", badgeColor: "bg-orange-100 text-orange-700" },
    { key: "machinery", label: "Machinery", icon: Wrench, color: "border-slate-200 bg-slate-50/40", iconColor: "text-slate-600", badgeColor: "bg-slate-100 text-slate-700" },
];

export default function ShopAnalyticsPage() {
    const [revenue, setRevenue] = useState<RevenueReport | null>(null);
    const [overview, setOverview] = useState<ShopAnalytics | null>(null);
    const [salesTrend, setSalesTrend] = useState<{ date: string; sales: number }[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryRevenue[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [myProducts, setMyProducts] = useState<Product[]>([]);
    const [channelData, setChannelData] = useState<ChannelBreakdown[]>([]);
    const [orderHealthData, setOrderHealthData] = useState<OrderHealthMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("7d");
    const [chartLoading, setChartLoading] = useState(false);

    const fetchAll = async (p: string) => {
        setChartLoading(true);
        try {
            const [rev, ov, trend, cats, top, prods, channels, health] = await Promise.all([
                getShopRevenue(p).catch(() => null),
                getShopAnalytics().catch(() => null),
                getSalesTrend(p).catch(() => []),
                getCategoryRevenue(p).catch(() => []),
                getTopProducts(p).catch(() => []),
                getMyProducts().catch(() => []),
                getChannelBreakdown(p).catch(() => []),
                getOrderHealth(p).catch(() => []),
            ]);
            setRevenue(rev);
            setOverview(ov);
            setSalesTrend(trend);
            setCategoryData(cats);
            setTopProducts(top);
            setMyProducts(prods as Product[]);
            setChannelData(channels);
            setOrderHealthData(health);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setChartLoading(false);
        }
    };

    useEffect(() => {
        fetchAll(period);
        
        // Add polling for real-time updates (every 10 seconds)
        const interval = setInterval(() => {
            console.log("Polling for fresh analytics data...");
            fetchAll(period);
        }, 10000);

        return () => clearInterval(interval);
    }, [period]);

    const handlePeriodChange = (p: string) => {
        setPeriod(p);
    };

    // Build product map for overhead lookup by product_id
    const productMap = useMemo(() => {
        const map: Record<number, Product> = {};
        myProducts.forEach(p => { map[p.id] = p; });
        return map;
    }, [myProducts]);

    // Category revenue totals
    const catMap = useMemo(() => {
        const m: Record<string, { revenue: number; qty: number; profit: number }> = {};
        categoryData.forEach(c => { m[c.category] = { revenue: c.revenue, qty: c.qty_sold, profit: c.profit }; });
        return m;
    }, [categoryData]);

    const totalUnitsSold = useMemo(() => topProducts.reduce((sum, item) => sum + item.units_sold, 0), [topProducts]);
    const profitMargin = revenue && revenue.total_revenue > 0
        ? ((revenue.profit / revenue.total_revenue) * 100).toFixed(1)
        : "0.0";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                        Sales Analytics
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Category performance, product profitability, and business trends.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex border rounded-lg overflow-hidden bg-white shadow-sm">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handlePeriodChange(opt.value)}
                                className={`px-4 py-2 text-xs font-bold transition-colors ${period === opt.value ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchAll(period)}
                        className="flex items-center gap-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-lg border border-green-200 transition-colors font-medium shadow-sm"
                    >
                        <ArrowUpRight className="h-4 w-4" /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Financial Overview Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:shadow-md transition-shadow border-green-100">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                            <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">₹{(revenue?.total_revenue ?? 0).toLocaleString()}</h3>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow border-blue-100">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground">Product Cost</p>
                            <div className="bg-blue-100 p-2 rounded-lg"><Package className="h-5 w-5 text-blue-600" /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">₹{(revenue?.total_cost ?? 0).toLocaleString()}</h3>
                    </CardContent>
                </Card>
                <Card className={`hover:shadow-md transition-shadow ${(revenue?.profit ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30"}`}>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                            <div className={`p-2 rounded-lg ${(revenue?.profit ?? 0) >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                                <TrendingUp className={`h-5 w-5 ${(revenue?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                            </div>
                        </div>
                        <h3 className={`text-2xl font-bold ${(revenue?.profit ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            ₹{(revenue?.profit ?? 0).toLocaleString()}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Margin: <span className={`font-semibold ${(revenue?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{profitMargin}%</span>
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow border-purple-100">
                    <CardContent className="p-5">
                         <div className="flex items-center justify-between mb-3">
                             <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                             <div className="bg-purple-100 p-2 rounded-lg"><ShoppingCart className="h-5 w-5 text-purple-600" /></div>
                         </div>
                         <h3 className="text-2xl font-bold text-gray-900">{revenue?.total_orders ?? 0}</h3>
                         <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                             <span className="text-emerald-600">✓ {revenue?.completed_orders ?? 0} done</span>
                             <span className="text-amber-500">⏳ {revenue?.pending_orders ?? 0} pending</span>
                         </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Category Boxes (replaces Revenue by Category pie) ── */}
            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Sales by Category</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {CATEGORIES.map(({ key, label, icon: Icon, color, iconColor, badgeColor }) => {
                        const cat = catMap[key] || { revenue: 0, qty: 0, profit: 0 };
                        return (
                            <Card key={key} className={`hover:shadow-md transition-shadow ${color}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <Icon className={`h-5 w-5 ${iconColor}`} />
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>{label}</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">₹{cat.revenue.toLocaleString()}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[11px] text-gray-500">{cat.qty} sold</p>
                                        <p className={`text-[11px] font-bold ${cat.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                            Profit: ₹{cat.profit.toLocaleString()}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* ── Revenue Trend (half width) + Profit Breakdown (half width) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Order Trend</CardTitle>
                        <div className="flex border rounded-lg overflow-hidden">
                            {PERIOD_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handlePeriodChange(opt.value)}
                                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${period === opt.value ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="h-[200px]">
                        {chartLoading ? (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
                        ) : salesTrend.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data for this period</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ReChartsLine data={salesTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v) => [`${Number(v)} Orders`, "Count"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-IN")} />
                                    <Line type="monotone" dataKey="order_count" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2, fill: "#10b981" }} activeDot={{ r: 5 }} />
                                </ReChartsLine>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {revenue && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <PiggyBank className="h-5 w-5 text-green-600" /> Profit Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { label: "Total Revenue", value: revenue.total_revenue, color: "bg-green-500", cls: "text-green-700" },
                                    { label: "Product Cost", value: revenue.total_cost, color: "bg-blue-500", cls: "text-blue-700" },
                                    { label: "Net Profit", value: revenue.profit, color: revenue.profit >= 0 ? "bg-emerald-600" : "bg-red-500", cls: revenue.profit >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold" },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center gap-4">
                                        <div className="w-32 text-sm text-gray-600 flex-shrink-0">{row.label}</div>
                                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                            <div
                                                className={`${row.color} h-3 rounded-full transition-all duration-700`}
                                                style={{ width: revenue.total_revenue > 0 ? `${Math.min(Math.abs(row.value / revenue.total_revenue) * 100, 100)}%` : "0%" }}
                                            />
                                        </div>
                                        <div className={`w-28 text-right text-sm font-semibold ${row.cls}`}>
                                            ₹{row.value.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Channel and Health Cards ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Breakdown */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Channel Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {channelData.length === 0 ? (
                            <p className="text-sm text-gray-500">No channel data available.</p>
                        ) : (
                            <div className="space-y-4">
                                {channelData.map(ch => (
                                    <div key={ch.channel} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                                        <div>
                                            <p className="text-sm font-semibold capitalize bg-opacity-10 text-slate-700">{ch.channel || 'Cash'}</p>
                                            <p className="text-xs text-gray-500">{ch.orders} orders</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-gray-900">₹{ch.revenue.toLocaleString()}</p>
                                            <p className="text-[10px] text-gray-400">Avg: ₹{ch.average_order_value.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Order Health */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Order Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {orderHealthData.length === 0 ? (
                            <p className="text-sm text-gray-500">No order health data available.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {orderHealthData.map(h => {
                                    const colors: Record<string, string> = {
                                        "completed": "text-emerald-700 bg-emerald-50",
                                        "dispatched": "text-blue-700 bg-blue-50",
                                        "pending": "text-amber-700 bg-amber-50",
                                        "cancelled": "text-red-700 bg-red-50"
                                    };
                                    const colorCls = colors[h.status.toLowerCase()] || "text-slate-700 bg-slate-50";
                                    return (
                                        <div key={h.status} className={`p-4 rounded-xl flex flex-col justify-between ${colorCls} border border-opacity-50`}>
                                            <p className="text-xs uppercase font-semibold opacity-70 mb-2">{h.status}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-bold">{h.count}</span>
                                                <span className="text-xs font-semibold opacity-80">{h.percentage}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Sold Products Detail Table ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Receipt className="h-5 w-5 text-slate-500" /> Sold Products — Batch-wise Ledger
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pt-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium text-[11px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-200">Product & Batch</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Category</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Sold</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Cost / Unit</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Revenue</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {topProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">No product sales recorded for this period.</td>
                                    </tr>
                                ) : (
                                    topProducts.map((product, idx) => {
                                        const costPrice = product.cost_price || 0;
                                        const totalCost = product.total_cost || 0;
                                        const overhead = product.overhead || 0;
                                        return (
                                            <tr key={product.product_id} className="hover:bg-gray-50/50 transition-colors">
                                                {/* Product & Batch combined */}
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center text-xs flex-shrink-0">{idx + 1}</div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{product.product_name}</p>
                                                            {product.batch_number ? (
                                                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-0.5">
                                                                    Batch: {product.batch_number}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">No batch</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Category */}
                                                <td className="px-6 py-3">
                                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                        {product.category}
                                                    </span>
                                                </td>
                                                {/* Sold qty */}
                                                <td className="px-6 py-3">
                                                    <span className="font-bold text-slate-800 text-lg">{product.units_sold}</span>
                                                    <span className="text-xs text-slate-400 ml-1">units</span>
                                                </td>
                                                {/* Cost per unit */}
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-700">₹{costPrice.toFixed(2)}</span>
                                                        {overhead > 0 && (
                                                            <span className="text-[10px] text-orange-600 font-medium">+₹{(overhead / Math.max(product.units_sold, 1)).toFixed(2)} overhead</span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 mt-0.5">Total: ₹{(totalCost + overhead).toLocaleString()}</span>
                                                    </div>
                                                </td>
                                                {/* Revenue */}
                                                <td className="px-6 py-3 font-semibold text-slate-800">
                                                    ₹{product.revenue.toLocaleString()}
                                                </td>
                                                {/* Profit */}
                                                <td className="px-6 py-3">
                                                    <span className={`font-bold ${product.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                                        ₹{product.profit.toLocaleString()}
                                                    </span>
                                                    {product.revenue > 0 && (
                                                        <div className={`text-[10px] font-medium ${product.profit >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                                            {((product.profit / product.revenue) * 100).toFixed(1)}% margin
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
