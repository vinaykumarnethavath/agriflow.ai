"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Wallet, Package, Plus, Trash2, Receipt, ArrowUpRight, CheckCircle2, X, Info, Banknote, TrendingUp, Building, Activity, Truck, ChevronDown, ChevronUp, Zap
} from "lucide-react";
import api from "@/lib/api";
import { getDraftBatches, DraftBatch, getMyProducts, Product, getTopProducts } from "@/lib/api";
import Link from "next/link";

const EXPENSE_CATEGORIES = [
    { value: "rent", label: "🏪 Rent", color: "bg-purple-100 text-purple-700", isBatch: false },
    { value: "wages", label: "👷 Regular Wages", color: "bg-indigo-100 text-indigo-700", isBatch: false },
    { value: "batch_transport", label: "🚛 Batch Transport", color: "bg-cyan-100 text-cyan-700", isBatch: true },
    { value: "batch_labour", label: "💪 Batch Unloading Labour", color: "bg-orange-100 text-orange-700", isBatch: true },
    { value: "batch_other", label: "📦 Batch Other Cost", color: "bg-pink-100 text-pink-700", isBatch: true },
    { value: "utilities", label: "⚡ Utilities", color: "bg-yellow-100 text-yellow-700", isBatch: false },
    { value: "other", label: "📋 Other", color: "bg-gray-100 text-gray-700", isBatch: false },
];

const PURCHASE_CATEGORY = { value: "batch_purchase", label: "🧾 Purchase Cost", color: "bg-blue-100 text-blue-800", isBatch: false };

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
    linked_product_ids?: string | null;
}

export default function ShopAccountingPage() {
    const [period, setPeriod] = useState("all");
    const [summary, setSummary] = useState<AccountingSummary | null>(null);
    const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
    const [loading, setLoading] = useState(true);

    // Expense form state
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [newExpense, setNewExpense] = useState({
        category: "rent",
        amount: 0,
        description: "",
        expense_date: new Date().toISOString().split("T")[0],
    });
    const [saving, setSaving] = useState(false);
    const [lastSaveResult, setLastSaveResult] = useState<{ distributed_to: number; amount: number; category: string } | null>(null);

    // Batch selector state (for batch expense categories)
    const [draftBatches, setDraftBatches] = useState<DraftBatch[]>([]);
    const [activeBatches, setActiveBatches] = useState<DraftBatch[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [showActivatedBatches, setShowActivatedBatches] = useState(false);
    const [expandedExpenses, setExpandedExpenses] = useState<Record<number, boolean>>({});

    const isBatchCategory = EXPENSE_CATEGORIES.find(c => c.value === newExpense.category)?.isBatch ?? false;

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, expRes, prodRes, topRes] = await Promise.all([
                api.get(`/shop-accounting/summary?period=${period}`).catch(() => ({ data: null })),
                api.get(`/shop-accounting/expenses?period=${period}`).catch(() => ({ data: [] })),
                getMyProducts().catch(() => []),
                getTopProducts("all").catch(() => [])
            ]);
            setSummary(sumRes.data);
            setExpenses(expRes.data || []);
            
            const products = prodRes as Product[];
            const expensesList = expRes.data || [];
            const topProducts = (topRes as any[]) || [];
            const unitsSoldMap: Record<number, number> = {};
            topProducts.forEach(tp => { unitsSoldMap[tp.product_id] = tp.units_sold; });

            if (Array.isArray(products)) {
                const mapToBatch = (p: Product): DraftBatch => {
                    let initialQuantity = p.quantity;
                    const soldAmt = unitsSoldMap[p.id] || 0;
                    
                    // 1. Try extracting from traceability_json (Primary source)
                    if (p.traceability_json) {
                        try {
                            const parsed = JSON.parse(p.traceability_json);
                            if (parsed && typeof parsed.initial_quantity === "number") {
                                initialQuantity = parsed.initial_quantity;
                            }
                        } catch(e) {}
                    }
                    
                    // 2. Fallback: If it's old and doesn't have an initial_quantity stored securely,
                    // but it has been sold, add the sold amount.
                    if (initialQuantity === p.quantity && soldAmt > 0) {
                        initialQuantity = p.quantity + soldAmt;
                    }
                    
                    // 3. Fallback to extracting from expense log (Old batches without traceability_json and no sales)
                    if (initialQuantity === p.quantity) {
                        const log = expensesList.find((e: any) => 
                            (e.category === 'batch_purchase' || e.category === 'batch_activation') && 
                            e.linked_product_ids && e.linked_product_ids.includes(`[${p.id}]`)
                        );
                        if (log && log.description) {
                            const match = log.description.match(/Qty:\s*(\d+(\.\d+)?)/i);
                            if (match) initialQuantity = parseFloat(match[1]);
                        }
                    }

                    return ({
                        ...p,
                        quantity: initialQuantity,
                        category: p.category || 'General',
                        created_at: p.created_at || new Date().toISOString(),
                        total_value: (p.cost_price || 0) * initialQuantity
                    } as DraftBatch);
                };
                setDraftBatches(products.filter(p => p.status === 'draft').map(mapToBatch));
                setActiveBatches(products.filter(p => p.status !== 'draft').map(mapToBatch));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Fetches draft and active batches on load via fetchAll.

    const handleAddExpense = async () => {
        if (newExpense.amount <= 0) return;
        setSaving(true);
        setLastSaveResult(null);
        try {
            const payload: any = { ...newExpense };
            if (isBatchCategory && selectedBatchIds.length > 0) {
                payload.product_ids = selectedBatchIds;
            }
            const res = await api.post("/shop-accounting/expenses", payload);
            setShowAddExpense(false);
            setNewExpense({ category: "rent", amount: 0, description: "", expense_date: new Date().toISOString().split("T")[0] });
            setSelectedBatchIds([]);
            setLastSaveResult({
                distributed_to: res.data.distributed_to || 0,
                amount: newExpense.amount,
                category: newExpense.category,
            });
            await fetchAll();
        } catch (e) {
            console.error(e);
            alert("Failed to add expense");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExpense = async (id: number, category: string) => {
        if (category === "batch_purchase") {
            alert("Purchase cost entries are created automatically from Inventory. Delete the product batch instead.");
            return;
        }
        if (!confirm("Delete this expense?")) return;
        try {
            await api.delete(`/shop-accounting/expenses/${id}`);
            await fetchAll();
        } catch (e) {
            console.error(e);
        }
    };

    const toggleBatchSelection = (id: number) => {
        setSelectedBatchIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const getCategoryInfo = (cat: string) => {
        if (cat === "batch_purchase") return PURCHASE_CATEGORY;
        if (cat === "batch_activation") return { value: "batch_activation", label: "✅ Batch Activated", color: "bg-emerald-100 text-emerald-800", isBatch: false };
        return EXPENSE_CATEGORIES.find(c => c.value === cat) || { value: cat, label: cat, color: "bg-gray-100 text-gray-700" };
    };

    // Helper: find batch names linked to a given expense
    const getLinkedBatchNames = (exp: BusinessExpense): { name: string; batch_number: string }[] => {
        if (!exp.linked_product_ids) return [];
        try {
            const ids: number[] = JSON.parse(exp.linked_product_ids).map(Number);
            const allProducts = [...activeBatches, ...draftBatches];
            return ids
                .map(id => allProducts.find(b => b.id === id))
                .filter(Boolean)
                .map(b => ({ name: b!.name, batch_number: b!.batch_number }));
        } catch { return []; }
    };

    // Helper: get all batch names linked to a specific overhead category
    const getBatchNamesForCategory = (category: string): { name: string; batch_number: string; amount: number }[] => {
        const relevantExpenses = expenses.filter(e => e.category === category && e.linked_product_ids);
        const allProducts = [...activeBatches, ...draftBatches];
        const batchMap: Record<number, { name: string; batch_number: string; amount: number }> = {};

        for (const exp of relevantExpenses) {
            try {
                const ids: number[] = JSON.parse(exp.linked_product_ids!).map(Number);
                for (const id of ids) {
                    const batch = allProducts.find(b => b.id === id);
                    if (batch) {
                        if (!batchMap[id]) {
                            batchMap[id] = { name: batch.name, batch_number: batch.batch_number, amount: 0 };
                        }
                        // Distribute the expense proportionally across linked batches
                        batchMap[id].amount += exp.amount / ids.length;
                    }
                }
            } catch { /* ignore parse errors */ }
        }
        return Object.values(batchMap);
    };

    // Compute expense split
    const batchExpenseTotal = ['batch_transport', 'batch_labour', 'batch_other']
        .reduce((sum, cat) => sum + (summary?.expense_by_category[cat] || 0), 0);
    const purchaseTotal = summary?.expense_by_category['batch_purchase'] || 0;
    const activationTotal = summary?.expense_by_category['batch_activation'] || 0;
    // Gen. Overheads = total - batch overheads - purchase - activation (these are all tracked separately)
    const generalExpenseTotal = (summary?.total_business_expenses || 0) - batchExpenseTotal - purchaseTotal - activationTotal;
    const rentTotal = summary?.expense_by_category['rent'] || 0;
    const wagesTotal = summary?.expense_by_category['wages'] || 0;
    const transportTotal = summary?.expense_by_category['batch_transport'] || 0;
    const labourTotal = summary?.expense_by_category['batch_labour'] || 0;
    const otherBatchTotal = summary?.expense_by_category['batch_other'] || 0;
    const utilitiesTotal = summary?.expense_by_category['utilities'] || 0;
    const otherTotal = summary?.expense_by_category['other'] || 0;

    // Batch names for each overhead category
    const transportBatches = getBatchNamesForCategory('batch_transport');
    const labourBatches = getBatchNamesForCategory('batch_labour');
    const otherBatchBatches = getBatchNamesForCategory('batch_other');

    // Estimate overhead per unit for selected batches (preview)
    const selectedBatches = draftBatches.filter(b => selectedBatchIds.includes(b.id));
    const totalWeight = selectedBatches.reduce((s, b) => s + b.total_value, 0);

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                            Shop Accounting & Expenses
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Allocate costs, track overhead, and understand profitability across batches.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchAll}
                            className="flex items-center gap-1 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 font-medium"
                        >
                            <ArrowUpRight className="h-3.5 w-3.5" /> Refresh
                        </button>
                        <button
                            onClick={() => setShowActivatedBatches(true)}
                            className="flex items-center gap-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 font-medium ml-1"
                        >
                            <Zap className="h-3.5 w-3.5" /> Batches Overview
                        </button>
                    </div>
                </div>


            </div>

            {/* Post-save confirmation banner */}
            {lastSaveResult && (
                <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="font-semibold text-green-800">
                            ✅ ₹{lastSaveResult.amount.toLocaleString()} expense saved
                            {lastSaveResult.distributed_to > 0
                                ? ` and distributed across ${lastSaveResult.distributed_to} product batch${lastSaveResult.distributed_to > 1 ? 'es' : ''}`
                                : ''}
                        </p>
                        {lastSaveResult.distributed_to > 0 && (
                            <p className="text-sm text-green-700 mt-0.5">
                                Go back to Inventory → expand the batch → you'll see the landed cost updated with overhead.
                            </p>
                        )}
                    </div>
                    <button onClick={() => setLastSaveResult(null)} className="text-green-400 hover:text-green-600"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* 1. Business Expense Breakdown */}
            {summary && (
                <div className="space-y-6">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3 border-b bg-slate-50/50 rounded-t-lg">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-700">
                                <Banknote className="w-5 h-5 text-emerald-600" /> Business Expense Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><Wallet className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Expenses</p>
                                        <p className="text-3xl font-black text-emerald-700 leading-tight">₹{(summary.total_business_expenses || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:border-l border-gray-100 md:pl-6">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100"><Package className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Purchase Cost</p>
                                        <p className="text-3xl font-black text-blue-700 leading-tight">₹{(purchaseTotal || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                                {/* Rent */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-emerald-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Rent</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-purple-100 text-purple-800 border-purple-200">₹{(rentTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Staff Wages */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-emerald-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Staff Wages</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-indigo-100 text-indigo-800 border-indigo-200">₹{(wagesTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Transport (Batch) */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-cyan-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Transport (Batch)</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-cyan-100 text-cyan-800 border-cyan-200">₹{(transportTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Batch Labour */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-orange-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Batch Labour</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-orange-100 text-orange-800 border-orange-200">₹{(labourTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Other Batch Costs */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-pink-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Other Batch Costs</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-pink-100 text-pink-800 border-pink-200">₹{(otherBatchTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                {/* Utilities */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-emerald-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Utilities</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-yellow-100 text-yellow-800 border-yellow-200">₹{(utilitiesTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Misc. Other */}
                                <div className="flex flex-col border border-slate-200 bg-white shadow-sm rounded-xl p-3 hover:border-emerald-300 transition-colors">
                                    <span className="font-semibold text-slate-600 mb-2 truncate">Misc. Other</span>
                                    <div className="mt-auto">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border bg-gray-100 text-gray-800 border-gray-200">₹{(otherTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 2. Activated Batches Section (SlideOver Panel) */}
            {showActivatedBatches && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setShowActivatedBatches(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[700px] bg-white shadow-2xl border-l z-50 flex flex-col animate-in slide-in-from-right-8 duration-300">
                        <div className="flex items-center justify-between p-4 border-b bg-emerald-50">
                            <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-600" /> 
                                Batches Overview
                                <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">{activeBatches.length}</span>
                            </h2>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowActivatedBatches(false)} 
                                className="h-8 w-8 rounded-full hover:bg-emerald-100 p-0 text-emerald-700"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                            {activeBatches.length > 0 ? (
                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-emerald-50/40 text-gray-600 font-medium text-[11px] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-emerald-100">Product & Batch</th>
                                            <th className="px-4 py-3 border-b border-emerald-100">Qty</th>
                                            <th className="px-4 py-3 border-b border-emerald-100">Transport</th>
                                            <th className="px-4 py-3 border-b border-emerald-100">Labour</th>
                                            <th className="px-4 py-3 border-b border-emerald-100">Other</th>
                                            <th className="px-4 py-3 border-b border-emerald-100 text-right">Added Overheads</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {activeBatches.map(batch => {
                                            const transport = batch.apportioned_transport || 0;
                                            const labour = batch.apportioned_labour || 0;
                                            const other = batch.apportioned_other || 0;
                                            const totalOverheads = transport + labour + other;
                                            return (
                                                <tr key={batch.id} className="hover:bg-emerald-50/20 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{batch.name}</span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100">{batch.batch_number}</span>
                                                                <span className="text-[10px] text-emerald-600 font-bold uppercase">{batch.category}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{batch.quantity} <span className="text-[10px]">{batch.unit}</span></td>
                                                    <td className="px-4 py-3">
                                                        {transport > 0 ? <span className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">₹{transport.toFixed(0)}</span> : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {labour > 0 ? <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">₹{labour.toFixed(0)}</span> : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {other > 0 ? <span className="text-xs font-semibold text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded">₹{other.toFixed(0)}</span> : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-blue-700 text-right">₹{totalOverheads.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400 text-sm">No batches to show.</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Business Expenses Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-amber-600" /> Business Expenses
                    </CardTitle>
                    <Button
                        size="sm"
                        onClick={() => { setShowAddExpense(!showAddExpense); setLastSaveResult(null); }}
                        className="bg-amber-600 hover:bg-amber-700 h-8 text-xs"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Expense
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* Add Expense Form */}
                    {showAddExpense && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Category</Label>
                                    <select
                                        className="w-full h-9 px-2 border rounded-md text-sm bg-white"
                                        value={newExpense.category}
                                        onChange={e => {
                                            setNewExpense({ ...newExpense, category: e.target.value });
                                            setSelectedBatchIds([]);
                                        }}
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

                            {/* Batch Linker — appears only for batch expense categories */}
                            {isBatchCategory && (
                                <div className="space-y-2 border-t pt-3">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-4 w-4 text-cyan-600" />
                                        <p className="text-xs font-semibold text-cyan-800">Link to Draft Batches (Optional)</p>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Select which product batches this expense belongs to. The ₹{newExpense.amount || 0} will be distributed proportionally by each batch's purchase weight (cost × qty).
                                    </p>

                                    {loadingBatches ? (
                                        <p className="text-xs text-gray-400 py-2">Loading draft batches...</p>
                                    ) : draftBatches.length === 0 ? (
                                        <p className="text-xs text-gray-400 py-2 italic">No draft batches found. Add products first, then they'll appear here.</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {draftBatches.map(batch => {
                                                const isSelected = selectedBatchIds.includes(batch.id);
                                                const myShare = totalWeight > 0 && isSelected
                                                    ? (batch.total_value / selectedBatches.reduce((s, b) => s + b.total_value, 0)) * newExpense.amount
                                                    : null;
                                                return (
                                                    <label
                                                        key={batch.id}
                                                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                                            isSelected
                                                                ? "bg-cyan-50 border-cyan-300"
                                                                : "bg-white border-gray-200 hover:border-cyan-200"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleBatchSelection(batch.id)}
                                                            className="accent-cyan-600"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-gray-800">{batch.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                Batch: {batch.batch_number} · {batch.quantity} {batch.unit} · ₹{batch.cost_price}/unit
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                Purchase value: ₹{batch.total_value.toLocaleString()}
                                                            </div>
                                                        </div>
                                                        {isSelected && myShare !== null && (
                                                            <div className="text-xs font-bold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded">
                                                                ≈ ₹{myShare.toFixed(2)}
                                                            </div>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end pt-1">
                                <Button size="sm" variant="outline" onClick={() => setShowAddExpense(false)} className="h-8 text-xs">Cancel</Button>
                                <Button
                                    size="sm"
                                    onClick={handleAddExpense}
                                    disabled={saving || newExpense.amount <= 0}
                                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700"
                                >
                                    {saving ? "Saving..." : "Save Expense"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Draft Batches Summary Table */}
                    <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
                        <table className="w-full text-sm text-left">
                                <thead className="bg-amber-50/40 text-gray-600 font-medium text-[11px] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 border-b border-amber-50">Draft Category</th>
                                        <th className="px-6 py-3 border-b border-amber-50">Date</th>
                                        <th className="px-6 py-3 border-b border-amber-50">Batches</th>
                                        <th className="px-6 py-3 border-b border-amber-50 text-right">Total Money</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {draftBatches.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm italic">No pending draft batches for allocation.</td></tr>
                                    ) : (
                                        draftBatches.map(batch => (
                                            <tr key={batch.id} className="hover:bg-amber-50/10 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900">{batch.name}</span>
                                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{batch.category}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">
                                                    {new Date(batch.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                        {batch.batch_number}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 font-bold text-amber-700 text-right">
                                                    ₹{batch.total_value?.toLocaleString() || 0}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    {/* Draft Section End */}
                </CardContent>
            </Card>

            {/* Separate Card for Recorded Business Expenses */}
            <Card className="border-slate-200 shadow-sm bg-white mt-6">
                <CardHeader className="pb-3 border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                        <Receipt className="w-5 h-5 text-slate-600" /> Recorded Business Expenses
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium text-[11px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-200">Date</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Type</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Amount</th>
                                    <th className="px-6 py-3 border-b border-gray-200">Batch Details</th>
                                    <th className="px-6 py-3 border-b border-gray-200 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {expenses.filter(e => e.category !== "batch_activation").length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No expenses recorded yet.</td>
                                    </tr>
                                ) : (
                                    expenses.filter(e => e.category !== "batch_activation").map((exp) => {
                                        const info = getCategoryInfo(exp.category);
                                        const isAutoEntry = exp.category === "batch_purchase" || exp.category === "batch_activation";
                                        const linkedIds: number[] = exp.linked_product_ids ? JSON.parse(exp.linked_product_ids).map(Number) : [];
                                        const allProducts = [...activeBatches, ...draftBatches];

                                        // For batch_activation: find the single linked active product
                                        const activationProduct = exp.category === "batch_activation"
                                            ? allProducts.find(b => linkedIds.includes(Number(b.id)))
                                            : null;

                                        // For batch_purchase: find the linked active product
                                        const purchaseProduct = exp.category === "batch_purchase"
                                            ? allProducts.find(b => linkedIds.includes(Number(b.id)))
                                            : null;

                                        // For batch overhead (transport/labour/other): find ALL linked products
                                        const linkedBatchProducts = ["batch_transport", "batch_labour", "batch_other"].includes(exp.category)
                                            ? allProducts.filter(b => linkedIds.includes(Number(b.id)))
                                            : [];

                                        return (
                                            <tr key={exp.id} className={`hover:bg-gray-50/50 transition-colors ${isAutoEntry ? 'bg-blue-50/20' : ''}`}>
                                                <td className="px-6 py-3 text-slate-600 whitespace-nowrap text-[11px] font-medium">{new Date(exp.expense_date).toLocaleDateString("en-IN")}</td>

                                                {/* TYPE column — badge only */}
                                                <td className="px-6 py-3">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${info.color}`}>
                                                        {info.label?.split(" ").slice(1).join(" ") || exp.category}
                                                    </span>
                                                    {/* Only show general description for non-auto non-batch entries */}
                                                    {!isAutoEntry && !["batch_transport","batch_labour","batch_other"].includes(exp.category) && exp.description && (
                                                        <div className="text-[11px] text-slate-400 mt-1 max-w-[200px] truncate italic">{exp.description}</div>
                                                    )}
                                                </td>

                                                <td className="px-6 py-3 font-semibold text-slate-800 whitespace-nowrap">₹{exp.amount.toLocaleString()}</td>

                                                {/* BATCH DETAILS column */}
                                                <td className="px-6 py-3">
                                                    {/* batch_activation: show details including Product Cost */}
                                                    {activationProduct && (
                                                        <Link href="/dashboard/shop/inventory" className="flex flex-col gap-0.5 py-1 px-2 border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-lg transition-colors block w-max mt-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-800">{activationProduct.name}</span>
                                                                <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100">
                                                                    {activationProduct.batch_number}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">ACTIVATED</span>
                                                            </div>
                                                            <div className="flex gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                                                                <span>Qty: <span className="text-slate-700 font-bold">{activationProduct.quantity} {activationProduct.unit}</span></span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>Cost/unit: <span className="text-slate-700 font-bold">₹{activationProduct.cost_price}</span></span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>Product Cost: <span className="text-blue-700 font-bold">₹{((activationProduct.cost_price || 0) * (activationProduct.quantity || 0)).toFixed(2)}</span></span>
                                                            </div>
                                                            {/* Show overhead breakdown */}
                                                            {((activationProduct.apportioned_transport || 0) + (activationProduct.apportioned_labour || 0) + (activationProduct.apportioned_other || 0)) > 0 && (
                                                                <div className="flex gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                                                                    <span className="italic">Overheads (separate):</span>
                                                                    {(activationProduct.apportioned_transport || 0) > 0 && <span className="text-cyan-600">T: ₹{activationProduct.apportioned_transport?.toFixed(2)}</span>}
                                                                    {(activationProduct.apportioned_labour || 0) > 0 && <span className="text-orange-600">L: ₹{activationProduct.apportioned_labour?.toFixed(2)}</span>}
                                                                    {(activationProduct.apportioned_other || 0) > 0 && <span className="text-pink-600">O: ₹{activationProduct.apportioned_other?.toFixed(2)}</span>}
                                                                </div>
                                                            )}
                                                        </Link>
                                                    )}
                                                    
                                                    {/* batch_purchase: show details including Product Cost */}
                                                    {purchaseProduct && !activationProduct && (
                                                        <Link href="/dashboard/shop/inventory" className="flex flex-col gap-0.5 py-1 px-2 border border-slate-200 bg-slate-50/30 hover:bg-slate-50/80 rounded-lg transition-colors block w-max mt-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-800">{purchaseProduct.name}</span>
                                                                <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-50 px-1 rounded border border-slate-200">
                                                                    {purchaseProduct.batch_number}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                                                                <span>Qty: <span className="text-slate-700 font-bold">{purchaseProduct.quantity} {purchaseProduct.unit}</span></span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>Cost/unit: <span className="text-slate-700 font-bold">₹{purchaseProduct.cost_price}</span></span>
                                                                <span className="text-slate-300">|</span>
                                                                <span>Product Cost: <span className="text-slate-700 font-bold">₹{((purchaseProduct.cost_price || 0) * (purchaseProduct.quantity || 0)).toFixed(2)}</span></span>
                                                            </div>
                                                        </Link>
                                                    )}

                                                    {/* batch_transport/labour/other: natively display ALL linked batches safely without hiding */}
                                                    {linkedBatchProducts.length > 0 && !activationProduct && !purchaseProduct && (
                                                        <div className="flex flex-col gap-1 py-1 mt-1">
                                                            {(() => {
                                                                const totalWeight = linkedBatchProducts.reduce((s, b) => s + ((b.cost_price || 0) * (b.quantity || 0)), 0);
                                                                return linkedBatchProducts.map(bp => {
                                                                    const bpValue = (bp.cost_price || 0) * (bp.quantity || 0);
                                                                    const allocatedCost = totalWeight > 0 ? (bpValue / totalWeight) * exp.amount : 0;
                                                                    const allocatedCostPerUnit = bp.quantity > 0 ? allocatedCost / bp.quantity : 0;
                                                                    return (
                                                                        <Link href="/dashboard/shop/inventory" key={bp.id} className="flex flex-col gap-0.5 py-1 px-2 border border-blue-100 bg-blue-50/20 hover:bg-blue-50/60 rounded-lg transition-colors block w-max min-w-[200px]">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-semibold text-slate-800">{bp.name}</span>
                                                                                <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1 rounded border border-blue-100">
                                                                                    {bp.batch_number}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                                                                                <span>Qty: <span className="text-slate-700 font-bold">{bp.quantity} {bp.unit}</span></span>
                                                                                <span className="text-slate-300">|</span>
                                                                                <span>Allocated Cost: <span className="text-blue-700 font-bold">₹{allocatedCostPerUnit.toFixed(2)}/unit</span></span>
                                                                            </div>
                                                                        </Link>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    )}

                                                    {/* General expenses or unmatched ids */}
                                                    {!activationProduct && !purchaseProduct && linkedBatchProducts.length === 0 && (
                                                        <span className="text-slate-500 text-[11px]">
                                                            {(isAutoEntry || ["batch_transport","batch_labour","batch_other"].includes(exp.category)) && exp.description ? (
                                                                <span className="italic whitespace-normal max-w-[250px] block border-l-2 border-slate-200 pl-2">{exp.description}</span>
                                                            ) : (
                                                                <span className="text-slate-300 px-2">—</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-3 text-right">
                                                    {isAutoEntry ? (
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight italic">Auto</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDeleteExpense(exp.id, exp.category)}
                                                            className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors inline-block"
                                                            title="Delete expense"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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
