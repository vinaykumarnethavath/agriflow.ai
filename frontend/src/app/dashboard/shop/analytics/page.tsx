"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    TrendingUp, DollarSign, ShoppingCart, AlertCircle,
    ArrowUpRight, ArrowDownRight, Truck, Users, Award,
    BarChart2, Package, Receipt, PiggyBank
} from "lucide-react";
import {
    getShopRevenue,
    getSalesTrend,
    getShopAnalytics,
    getCategoryRevenue, // This function is imported, its definition is assumed to be in lib/api
    RevenueReport,
    SalesTrend,
    ShopAnalytics,
    CategoryRevenue,
} from "@/lib/api";
import {
    LineChart as ReChartsLine,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart as ReChartsBar,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend,
} from "recharts";

const CATEGORY_COLORS = [
    "#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#64748b"
];

const PERIOD_OPTIONS = [
    { label: "7D", value: "7d" },
    { label: "1M", value: "30d" },
    { label: "3M", value: "90d" },
    { label: "1Y", value: "1y" },
];

export default function ShopAnalyticsPage() {
    const [revenue, setRevenue] = useState<RevenueReport | null>(null);
    const [overview, setOverview] = useState<ShopAnalytics | null>(null);
    const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
    const [categoryData, setCategoryData] = useState<CategoryRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState("7d");
    const [chartLoading, setChartLoading] = useState(false);

    const fetchAll = async (p: string) => {
        setChartLoading(true);
        try {
            const [rev, ov, trend, cats] = await Promise.all([
                getShopRevenue(p).catch(() => null),
                getShopAnalytics().catch(() => null),
                getSalesTrend(p).catch(() => []),
                getCategoryRevenue(p).catch(() => []), // Pass period to getCategoryRevenue
            ]);
            setRevenue(rev);
            setOverview(ov);
            setSalesTrend(trend);
            setCategoryData(cats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setChartLoading(false);
        }
    };

    useEffect(() => {
        fetchAll(period);
    }, []);

    const handlePeriodChange = (p: string) => {
        setPeriod(p);
        fetchAll(p);
    };

    const totalCatRevenue = categoryData.reduce((s, c) => s + c.revenue, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const profitMargin = revenue && revenue.total_revenue > 0
        ? ((revenue.profit / revenue.total_revenue) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                        Sales Analytics
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Real-time insights into your shop's performance and profitability
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

            {/* ── Revenue & Profit Cards ── */}
            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <PiggyBank className="h-4 w-4" /> Financial Overview
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Revenue */}
                    <Card className="hover:shadow-md transition-shadow border-green-100">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                                <div className="bg-green-100 p-2 rounded-lg">
                                    <DollarSign className="h-5 w-5 text-green-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                ₹{(revenue?.total_revenue ?? 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">From completed orders</p>
                        </CardContent>
                    </Card>

                    {/* Total Cost (Product Purchase Cost) */}
                    <Card className="hover:shadow-md transition-shadow border-blue-100">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Product Cost</p>
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <Package className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                ₹{(revenue?.total_cost ?? 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">Amount spent on products</p>
                        </CardContent>
                    </Card>

                    {/* Total Expenses */}
                    <Card className="hover:shadow-md transition-shadow border-amber-100">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Shop Expenses</p>
                                <div className="bg-amber-100 p-2 rounded-lg">
                                    <Truck className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                ₹{(revenue?.total_expenses ?? 0).toLocaleString()}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">Transport, labour & other</p>
                        </CardContent>
                    </Card>

                    {/* Net Profit */}
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
                </div>
            </div>

            {/* ── Order Stats ── */}
            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> Order Summary
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold">{revenue?.total_orders ?? overview?.pending_orders ?? 0}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {revenue?.completed_orders ?? 0} completed
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Pending Orders</p>
                                <div className="bg-amber-100 p-2 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-amber-600">
                                {revenue?.pending_orders ?? overview?.pending_orders ?? 0}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">Awaiting fulfillment</p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                                <div className="bg-purple-100 p-2 rounded-lg">
                                    <Award className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold">₹{(revenue?.avg_ticket ?? 0).toLocaleString()}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Per completed order</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Profit Breakdown ── */}
            {revenue && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <PiggyBank className="h-5 w-5 text-green-600" />
                            Profit Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { label: "Total Revenue", value: revenue.total_revenue, color: "bg-green-500", cls: "text-green-700" },
                                { label: "Product Cost", value: revenue.total_cost, color: "bg-blue-500", cls: "text-blue-700" },
                                { label: "Shop Expenses (Transport + Labour + Other)", value: revenue.total_expenses, color: "bg-amber-500", cls: "text-amber-700" },
                                { label: "Net Profit", value: revenue.profit, color: revenue.profit >= 0 ? "bg-emerald-600" : "bg-red-500", cls: revenue.profit >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold" },
                            ].map((row) => (
                                <div key={row.label} className="flex items-center gap-4">
                                    <div className="w-48 text-sm text-gray-600 flex-shrink-0">{row.label}</div>
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

            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BarChart2 className="h-5 w-5 text-green-600" /> Revenue Trend
                        </CardTitle>
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
                    <CardContent className="h-[250px]">
                        {chartLoading ? (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
                        ) : salesTrend.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data for this period</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ReChartsLine data={salesTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, "Revenue"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-IN")} />
                                    <Line type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                </ReChartsLine>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Category Revenue */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-5 w-5 text-blue-600" /> Revenue by Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {categoryData.length === 0 ? (
                            <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
                                No category data yet
                            </div>
                        ) : (
                            <>
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={categoryData} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                                                {categoryData.map((_, i) => (
                                                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, "Revenue"]} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-2 mt-2">
                                    {categoryData.map((cat, i) => (
                                        <div key={cat.category} className="flex items-center gap-3">
                                            <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                                            />
                                            <span className="text-sm flex-1 capitalize">{cat.category}</span>
                                            <span className="text-xs text-gray-500">{cat.qty_sold} sold</span>
                                            <span className="text-sm font-semibold">₹{cat.revenue.toLocaleString()}</span>
                                            <span className="text-xs text-gray-400 w-12 text-right">
                                                {totalCatRevenue > 0 ? ((cat.revenue / totalCatRevenue) * 100).toFixed(0) : 0}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
