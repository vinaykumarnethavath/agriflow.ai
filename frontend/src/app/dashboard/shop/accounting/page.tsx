"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    TrendingUp, DollarSign, Wallet, PiggyBank, Plus, Trash2,
    BarChart2, Package, Calendar, ArrowUpRight, X, Receipt
} from "lucide-react";
import api from "@/lib/api";

const PERIOD_OPTIONS = [
    { label: "Today", value: "today" },
    { label: "Week", value: "7d" },
    { label: "Month", value: "30d" },
    { label: "3 Months", value: "90d" },
    { label: "Year", value: "1y" },
    { label: "All", value: "all" },
];

const EXPENSE_CATEGORIES = [
    { value: "rent", label: "🏪 Rent", color: "bg-purple-100 text-purple-700" },
    { value: "labour", label: "👷 Labour", color: "bg-blue-100 text-blue-700" },
    { value: "transportation", label: "🚛 Transportation", color: "bg-cyan-100 text-cyan-700" },
    { value: "utilities", label: "⚡ Utilities", color: "bg-yellow-100 text-yellow-700" },
    { value: "batch_cost", label: "📦 Batch Cost", color: "bg-orange-100 text-orange-700" },
    { value: "other", label: "📋 Other", color: "bg-gray-100 text-gray-700" },
];

interface AccountingSummary {
    period: string;
    total_revenue: number;
    total_cost: number;
    total_order_expenses: number;
    total_business_expenses: number;
    net_profit: number;
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    avg_order_value: number;
    expense_by_category: Record<string, number>;
}

interface BusinessExpense {
    id: number;
    category: string;
    amount: number;
    description: string | null;
    expense_date: string;
    created_at: string;
}

interface BatchAnalysis {
    product_id: number;
    product_name: string;
    qty_sold: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
}

export default function ShopAccountingPage() {
    const [period, setPeriod] = useState("30d");
    const [summary, setSummary] = useState<AccountingSummary | null>(null);
    const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
    const [batchData, setBatchData] = useState<BatchAnalysis[]>([]);
    const [loading, setLoading] = useState(true);

    // Add expense form
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [newExpense, setNewExpense] = useState({
        category: "rent",
        amount: 0,
        description: "",
        expense_date: new Date().toISOString().split("T")[0],
    });
    const [saving, setSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [sumRes, expRes, batchRes] = await Promise.all([
                api.get(`/shop-accounting/summary?period=${period}`).catch(() => ({ data: null })),
                api.get(`/shop-accounting/expenses?period=${period}`).catch(() => ({ data: [] })),
                api.get(`/shop-accounting/batch-analysis?period=${period}`).catch(() => ({ data: [] })),
            ]);
            setSummary(sumRes.data);
            setExpenses(expRes.data || []);
            setBatchData(batchRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, [period]);

    const handleAddExpense = async () => {
        if (newExpense.amount <= 0) return;
        setSaving(true);
        try {
            await api.post("/shop-accounting/expenses", newExpense);
            setShowAddExpense(false);
            setNewExpense({ category: "rent", amount: 0, description: "", expense_date: new Date().toISOString().split("T")[0] });
            await fetchAll();
        } catch (e) {
            console.error(e);
            alert("Failed to add expense");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExpense = async (id: number) => {
        if (!confirm("Delete this expense?")) return;
        try {
            await api.delete(`/shop-accounting/expenses/${id}`);
            await fetchAll();
        } catch (e) {
            console.error(e);
        }
    };

    const getCategoryInfo = (cat: string) => EXPENSE_CATEGORIES.find(c => c.value === cat) || EXPENSE_CATEGORIES[5];

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                        Shop Accounting
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Track your expenses, batch costs, and overall profitability
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex border rounded-lg overflow-hidden">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setPeriod(opt.value)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === opt.value ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchAll}
                        className="flex items-center gap-1 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 font-medium"
                    >
                        <ArrowUpRight className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                        { label: "Revenue", value: summary.total_revenue, icon: DollarSign, color: "text-green-600", bg: "bg-green-100", border: "border-green-200" },
                        { label: "Product Cost", value: summary.total_cost, icon: Package, color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-200" },
                        { label: "Business Expenses", value: summary.total_business_expenses, icon: Wallet, color: "text-amber-600", bg: "bg-amber-100", border: "border-amber-200" },
                        { label: "Orders", value: summary.completed_orders, icon: Receipt, color: "text-indigo-600", bg: "bg-indigo-100", border: "border-indigo-200", isCount: true },
                        {
                            label: "Net Profit",
                            value: summary.net_profit,
                            icon: PiggyBank,
                            color: summary.net_profit >= 0 ? "text-emerald-600" : "text-red-600",
                            bg: summary.net_profit >= 0 ? "bg-emerald-100" : "bg-red-100",
                            border: summary.net_profit >= 0 ? "border-emerald-200" : "border-red-200",
                        },
                    ].map((card: any) => (
                        <Card key={card.label} className={`hover:shadow-md transition-shadow ${card.border}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                                    <div className={`${card.bg} p-1.5 rounded-lg`}>
                                        <card.icon className={`h-4 w-4 ${card.color}`} />
                                    </div>
                                </div>
                                <h3 className={`text-xl font-bold ${card.color}`}>
                                    {card.isCount ? card.value : `₹${card.value.toLocaleString()}`}
                                </h3>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Business Expenses */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-amber-600" /> Business Expenses
                        </CardTitle>
                        <Button
                            size="sm"
                            onClick={() => setShowAddExpense(!showAddExpense)}
                            className="bg-amber-600 hover:bg-amber-700 h-8 text-xs"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Expense
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add Expense Form */}
                        {showAddExpense && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Category</Label>
                                        <select
                                            className="w-full h-9 px-2 border rounded-md text-sm bg-white"
                                            value={newExpense.category}
                                            onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                        >
                                            {EXPENSE_CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Amount (₹)</Label>
                                        <Input
                                            type="number"
                                            className="h-9"
                                            value={newExpense.amount || ""}
                                            onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Date</Label>
                                        <Input
                                            type="date"
                                            className="h-9"
                                            value={newExpense.expense_date}
                                            onChange={e => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Description</Label>
                                        <Input
                                            className="h-9"
                                            placeholder="Optional note..."
                                            value={newExpense.description}
                                            onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => setShowAddExpense(false)} className="h-8 text-xs">Cancel</Button>
                                    <Button size="sm" onClick={handleAddExpense} disabled={saving || newExpense.amount <= 0} className="h-8 text-xs bg-amber-600 hover:bg-amber-700">
                                        {saving ? "Saving..." : "Save"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Expense Breakdown by Category */}
                        {summary && Object.keys(summary.expense_by_category).length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(summary.expense_by_category).map(([cat, amount]) => {
                                    const info = getCategoryInfo(cat);
                                    return (
                                        <div key={cat} className={`text-center p-2.5 rounded-lg border ${info.color} bg-opacity-50`}>
                                            <div className="text-[10px] font-bold uppercase tracking-wider">{info.label.split(" ")[1] || cat}</div>
                                            <div className="text-sm font-bold mt-0.5">₹{(amount as number).toLocaleString()}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Expense List */}
                        <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                            {expenses.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-sm">No expenses recorded for this period</div>
                            ) : (
                                expenses.map((exp) => {
                                    const info = getCategoryInfo(exp.category);
                                    return (
                                        <div key={exp.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border hover:border-gray-300 transition-colors">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                                                {info.label.split(" ")[1] || exp.category}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                {exp.description && <div className="text-xs text-gray-600 truncate">{exp.description}</div>}
                                                <div className="text-[10px] text-gray-400">{new Date(exp.expense_date).toLocaleDateString("en-IN")}</div>
                                            </div>
                                            <span className="font-bold text-sm text-gray-800">₹{exp.amount.toLocaleString()}</span>
                                            <button onClick={() => handleDeleteExpense(exp.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Batch / Product Profitability */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-green-600" /> Product Profitability
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {batchData.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">No sales data for this period</div>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {batchData.map((item) => (
                                    <div key={item.product_id} className="p-3 bg-gray-50 rounded-xl border hover:border-green-200 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-semibold text-sm text-gray-800">{item.product_name}</div>
                                                <div className="text-xs text-gray-500">{item.qty_sold} units sold</div>
                                            </div>
                                            <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${item.margin >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {item.margin.toFixed(1)}% margin
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="bg-white rounded-lg p-2 border">
                                                <div className="text-[10px] text-gray-400 uppercase">Revenue</div>
                                                <div className="text-sm font-bold text-green-700">₹{item.revenue.toLocaleString()}</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 border">
                                                <div className="text-[10px] text-gray-400 uppercase">Cost</div>
                                                <div className="text-sm font-bold text-blue-700">₹{item.cost.toLocaleString()}</div>
                                            </div>
                                            <div className={`rounded-lg p-2 border ${item.profit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                                                <div className="text-[10px] text-gray-400 uppercase">Profit</div>
                                                <div className={`text-sm font-bold ${item.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                    ₹{item.profit.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Profit Breakdown Bar */}
            {summary && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <PiggyBank className="h-5 w-5 text-green-600" /> Profit Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { label: "Total Revenue", value: summary.total_revenue, color: "bg-green-500", cls: "text-green-700" },
                                { label: "Product Cost", value: summary.total_cost, color: "bg-blue-500", cls: "text-blue-700" },
                                { label: "Business Expenses", value: summary.total_business_expenses, color: "bg-amber-500", cls: "text-amber-700" },
                                {
                                    label: "Net Profit",
                                    value: summary.net_profit,
                                    color: summary.net_profit >= 0 ? "bg-emerald-600" : "bg-red-500",
                                    cls: summary.net_profit >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold"
                                },
                            ].map((row) => (
                                <div key={row.label} className="flex items-center gap-4">
                                    <div className="w-44 text-sm text-gray-600 flex-shrink-0">{row.label}</div>
                                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                        <div
                                            className={`${row.color} h-3 rounded-full transition-all duration-700`}
                                            style={{ width: summary.total_revenue > 0 ? `${Math.min(Math.abs(row.value / summary.total_revenue) * 100, 100)}%` : "0%" }}
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
    );
}
