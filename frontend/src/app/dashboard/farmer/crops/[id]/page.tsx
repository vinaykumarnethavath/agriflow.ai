"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    getCropDetails,
    getCropExpenses,
    createCropExpense,
    deleteCropExpense,
    updateCrop,
    CropExpense,
    CropUpdate,
    getCropInsights,
    Insight,
    Prediction,
    Crop,
    CropHarvest,
    getCropHarvests,
    createCropHarvest,
    updateCropExpense,
    updateCropHarvest,
    deleteCropHarvest,
} from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Ensure Label is available or use standard label
import { ArrowLeft, Plus, Trash2, Sprout, TrendingUp, IndianRupee, Tractor, Droplets, Truck, Pickaxe, Package, Pencil, Brain, AlertTriangle, CheckCircle, Info, Lightbulb, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";

const EXPENSE_CATEGORIES = [
    { value: "Input", label: "Input Costs (Seeds, Fertilizers, Pesticides)", icon: Sprout },
    { value: "Labor", label: "Labor Costs (Sowing, Weeding, Harvesting)", icon: Pickaxe },
    { value: "Machinery", label: "Machinery & Operations (Tractor, Fuel)", icon: Tractor },
    { value: "Irrigation", label: "Irrigation (Electricity, Water)", icon: Droplets },
    { value: "Logistics", label: "Logistics (Transport, Storage)", icon: Truck },
    { value: "Miscellaneous", label: "Miscellaneous (Insurance, Testing)", icon: Package },
];

const INPUT_TYPES = [
    "Seeds", "Fertilizers", "Pesticides", "Growth Regulators", "Organic Inputs", "Other"
];

// File Upload Helper
const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
        const response = await fetch("http://127.0.0.1:8000/upload", {
            method: "POST",
            body: formData,
        });
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error("Upload error:", error);
        throw error;
    }
};

export default function CropDetailPage() {
    const params = useParams();
    const router = useRouter();
    const cropId = Number(params?.id);

    const [crop, setCrop] = useState<Crop | null>(null);
    const [expenses, setExpenses] = useState<CropExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    // Form States
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<CropExpense>>({
        category: "Input",
        type: "",
        quantity: 0,
        unit: "kg",
        unit_cost: 0,
        payment_mode: "Cash",
        date: new Date().toISOString().split("T")[0],
        bill_url: "",
        notes: "",
        unit_size: 1, // Default to 1 (e.g. 1 kg bag)
        duration: 1, // Default to 1 day
        stage: "General",
    });
    const [uploading, setUploading] = useState(false);

    const [harvests, setHarvests] = useState<CropHarvest[]>([]);
    const [showHarvestModal, setShowHarvestModal] = useState(false);
    const [newHarvest, setNewHarvest] = useState<Partial<CropHarvest>>({
        date: new Date().toISOString().split("T")[0],
        stage: "First Picking",
        quantity: 0,
        unit: "Quintals",
        quality: "Grade A",
        selling_price_per_unit: 0,
        total_revenue: 0,
        buyer_type: "Market",
        sold_to: "",
        notes: "",
    });

    // Edit States
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
    const [editingHarvestId, setEditingHarvestId] = useState<number | null>(null);

    const [insights, setInsights] = useState<Insight[]>([]);
    const [prediction, setPrediction] = useState<Prediction | null>(null);



    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [editForm, setEditForm] = useState<CropUpdate>({});

    useEffect(() => {
        if (crop) {
            setEditForm({
                name: crop.name,
                area: crop.area,
                sowing_date: crop.sowing_date ? new Date(crop.sowing_date).toISOString().split('T')[0] : '',
                expected_harvest_date: crop.expected_harvest_date ? new Date(crop.expected_harvest_date).toISOString().split('T')[0] : '',
                status: crop.status,
                notes: crop.notes
            });

        }
    }, [crop]);

    useEffect(() => {
        if (cropId) {
            fetchData();
        }
    }, [cropId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const cropData = await getCropDetails(cropId);
            setCrop(cropData);
            const expenseData = await getCropExpenses(cropId);
            setExpenses(expenseData);
            const aiData = await getCropInsights(cropId);
            setInsights(aiData.insights);
            setPrediction(aiData.prediction);
        } catch (error) {
            console.error("Error fetching crop details:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotalCost = (expense: Partial<CropExpense>) => {
        const qty = expense.quantity || 0;
        const cost = expense.unit_cost || 0;

        if (expense.category === "Labor") {
            const duration = expense.duration || 1;
            return qty * cost * duration;
        } else if (expense.category === "Input") {
            // If unit is 'bags', we might want to store total qty in kg?
            // But for now, let's keep it simple: Cost is per unit.
            // If user enters 10 bags, price is per bag.
            // Total cost = 10 * 300 = 3000.
            // Unit Size is just metadata for "50kg bag".
            return qty * cost;
        }
        return qty * cost;
    };

    const handleAddExpense = async () => {
        try {
            const expenseToSave = {
                ...newExpense,
                total_cost: calculateTotalCost(newExpense)
            };

            if (editingExpenseId) {
                await updateCropExpense(editingExpenseId, expenseToSave as any);
                setEditingExpenseId(null);
            } else {
                await createCropExpense(cropId, expenseToSave as any);
            }

            setShowExpenseForm(false);
            fetchData(); // Refresh data
            // Reset form
            setNewExpense({
                category: "Input",
                type: "",
                quantity: 0,
                unit: "kg",
                unit_cost: 0,
                payment_mode: "Cash",
                date: new Date().toISOString().split("T")[0],
                unit_size: 1,
                duration: 1,
                stage: "General",
                notes: ""
            });
        } catch (error) {
            console.error("Error saving expense:", error);
            alert("Failed to save expense");
        }
    };

    const handleEditExpense = (expense: CropExpense) => {
        setNewExpense({
            category: expense.category,
            type: expense.type,
            quantity: expense.quantity,
            unit: expense.unit,
            unit_cost: expense.unit_cost,
            payment_mode: expense.payment_mode,
            date: new Date(expense.date).toISOString().split("T")[0],
            bill_url: expense.bill_url,
            notes: expense.notes,
            unit_size: expense.unit_size || 1,
            duration: expense.duration || 1,
            stage: expense.stage || "General",
        });
        setEditingExpenseId(expense.id);
        setShowExpenseForm(true);
    };

    const handleDeleteExpense = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteCropExpense(id);
            fetchData();
        } catch (error) {
            console.error("Error deleting expense:", error);
        }
    };

    const handleAddHarvest = async () => {
        try {
            if (editingHarvestId) {
                await updateCropHarvest(editingHarvestId, newHarvest as any);
                setEditingHarvestId(null);
            } else {
                await createCropHarvest(cropId, newHarvest as any);
            }

            setShowHarvestModal(false);
            fetchData();
            setNewHarvest({
                date: new Date().toISOString().split("T")[0],
                stage: "Next Picking",
                quantity: 0,
                unit: "Quintals",
                quality: "Grade A",
                selling_price_per_unit: 0,
                total_revenue: 0,
                buyer_type: "Market",
                sold_to: "",
                notes: "",
            });
            alert("Harvest recorded!");
        } catch (error) {
            console.error("Error saving harvest:", error);
            alert("Failed to save harvest");
        }
    };

    const handleEditHarvest = (harvest: CropHarvest) => {
        setNewHarvest({
            date: new Date(harvest.date).toISOString().split("T")[0],
            stage: harvest.stage,
            quantity: harvest.quantity,
            unit: harvest.unit,
            quality: harvest.quality,
            selling_price_per_unit: harvest.selling_price_per_unit,
            total_revenue: harvest.total_revenue,
            buyer_type: harvest.buyer_type,
            sold_to: harvest.sold_to,
            notes: harvest.notes,
        });
        setEditingHarvestId(harvest.id);
        setShowHarvestModal(true);
    };

    const handleDeleteHarvest = async (id: number) => {
        if (!confirm("Are you sure you want to delete this harvest record?")) return;
        try {
            await deleteCropHarvest(id);
            fetchData();
        } catch (error) {
            console.error("Error deleting harvest:", error);
            alert("Failed to delete harvest");
        }
    };



    const handleUpdateCrop = async () => {
        try {
            await updateCrop(cropId, editForm);
            setIsEditOpen(false);
            fetchData();
            alert("Crop details updated!");
        } catch (error) {
            console.error("Error updating crop:", error);
            alert("Failed to update crop");
        }
    };

    const calculateCategoryTotal = (category: string) => {
        return expenses
            .filter((e) => e.category === category)
            .reduce((sum, e) => sum + e.total_cost, 0);
    };

    if (loading) return <div className="p-8 text-center">Loading crop details...</div>;
    if (!crop) return <div className="p-8 text-center text-red-500">Crop not found</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5 mr-2" /> Back
                </Button>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {crop.name}
                        </h1>
                        <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="h-8 w-8 text-gray-400 hover:text-green-600">
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowQR(true)}
                            className="bg-white text-green-600 border-green-200 hover:bg-green-50"
                        >
                            <QrCode className="w-4 h-4 mr-2" /> Traceability
                        </Button>
                    </div>
                    <p className="text-muted-foreground">
                        {crop.area} Acres • Sown on {new Date(crop.sowing_date).toLocaleDateString()}
                    </p>
                </div>
                <div className="ml-auto flex gap-3">
                    <div className={`px-4 py-1 rounded-full text-sm font-medium border ${crop.status === 'Harvested' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        'bg-green-100 text-green-700 border-green-200'
                        }`}>
                        {crop.status}
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-2 border-b overflow-x-auto pb-1">
                {["overview", "expenses", "harvest"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === tab
                            ? "text-green-600"
                            : "text-gray-500 hover:text-gray-900"
                            }`}
                    >
                        {tab === "harvest" ? "Yield & Profit" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
                            />
                        )}
                    </button>
                ))}
                {/* Add new tabs */}
                {["inputs", "insights"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === tab
                            ? "text-green-600"
                            : "text-gray-500 hover:text-gray-900"
                            }`}
                    >
                        {tab === "inputs" ? "Inputs Used" : tab === "insights" ? "AI Insights" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
                            <CardHeader>
                                <CardTitle className="text-green-800 flex items-center gap-2">
                                    <IndianRupee className="w-5 h-5" /> Total Cost
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-700">₹{crop.total_cost?.toLocaleString()}</div>
                                <p className="text-sm text-green-600 mt-1">Sum of all expenses</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                            <CardHeader>
                                <CardTitle className="text-blue-800 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" /> Revenue
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-700">₹{crop.total_revenue?.toLocaleString()}</div>
                                <p className="text-sm text-blue-600 mt-1">Yield × Price</p>
                            </CardContent>
                        </Card>

                        <Card className={`border ${crop.net_profit && crop.net_profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <CardHeader>
                                <CardTitle className={`${crop.net_profit && crop.net_profit >= 0 ? 'text-emerald-800' : 'text-red-800'} flex items-center gap-2`}>
                                    <IndianRupee className="w-5 h-5" /> Net Profit
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-bold ${crop.net_profit && crop.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    ₹{crop.net_profit?.toLocaleString()}
                                </div>
                                <p className={`text-sm mt-1 ${crop.net_profit && crop.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    Revenue - Cost
                                </p>
                            </CardContent>
                        </Card>

                        <div className="md:col-span-3">
                            <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                {EXPENSE_CATEGORIES.map(cat => {
                                    const total = calculateCategoryTotal(cat.value);
                                    const Icon = cat.icon;
                                    return (
                                        <div key={cat.value} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center text-center gap-2">
                                            <div className="p-2 bg-gray-50 rounded-full text-gray-600">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-medium text-gray-500">{cat.label.split(' ')[0]}</span>
                                            <span className="font-bold text-gray-900">₹{total.toLocaleString()}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "expenses" && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Expense Log (v3)</h2>
                            <Button onClick={() => {
                                setEditingExpenseId(null);
                                setNewExpense({
                                    category: "Input",
                                    type: "",
                                    quantity: 0,
                                    unit: "kg",
                                    unit_cost: 0,
                                    payment_mode: "Cash",
                                    date: new Date().toISOString().split("T")[0],
                                    bill_url: "",
                                    notes: "",
                                    unit_size: 1,
                                    duration: 1,
                                    stage: "General",
                                });
                                setShowExpenseForm(!showExpenseForm);
                            }} className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-2" /> Add Expense
                            </Button>
                        </div>

                        {showExpenseForm && (
                            <Card className="animate-in slide-in-from-top-4 duration-300">
                                <CardHeader>
                                    <CardTitle>{editingExpenseId ? "Edit Expense Entry" : "New Expense Entry"}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Category</label>
                                            <select
                                                className="w-full p-2 border rounded-md"
                                                value={newExpense.category}
                                                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                            >
                                                {EXPENSE_CATEGORIES.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Type (e.g. Urea, Labor)</label>
                                            <Input
                                                value={newExpense.type}
                                                onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value })}
                                                placeholder="Expense Name"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-medium">Description (Optional)</label>
                                            <Input
                                                value={newExpense.notes || ""}
                                                onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                                                placeholder="Additional details..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Stage</label>
                                            <select
                                                className="w-full p-2 border rounded-md"
                                                value={newExpense.stage}
                                                onChange={(e) => setNewExpense({ ...newExpense, stage: e.target.value })}
                                            >
                                                <option value="General">General</option>
                                                <option value="Sowing">Sowing</option>
                                                <option value="Watering">Watering</option>
                                                <option value="Fertilizing">Fertilizing</option>
                                                <option value="Weeding">Weeding</option>
                                                <option value="Harvesting">Harvesting</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                {newExpense.category === "Labor" ? "No. of Workers" :
                                                    (newExpense.category === "Input" && newExpense.unit === "bags") ? "No. of Bags" : "Quantity"}
                                            </label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    value={newExpense.quantity}
                                                    onChange={(e) => setNewExpense({ ...newExpense, quantity: Number(e.target.value) })}
                                                />
                                                <select
                                                    className="w-24 p-2 border rounded-md"
                                                    value={newExpense.unit}
                                                    onChange={(e) => setNewExpense({ ...newExpense, unit: e.target.value })}
                                                >
                                                    {newExpense.category === "Labor" ? (
                                                        <>
                                                            <option value="workers">workers</option>
                                                            <option value="hours">hours</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="kg">kg</option>
                                                            <option value="bags">bags</option>
                                                            <option value="liters">liters</option>
                                                            <option value="units">units</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </div>

                                        {newExpense.category === "Labor" && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Duration (Days)</label>
                                                <Input
                                                    type="number"
                                                    value={newExpense.duration}
                                                    onChange={(e) => setNewExpense({ ...newExpense, duration: Number(e.target.value) })}
                                                />
                                            </div>
                                        )}

                                        {newExpense.category === "Input" && newExpense.unit === "bags" && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Bag Size (kg)</label>
                                                <Input
                                                    type="number"
                                                    value={newExpense.unit_size}
                                                    onChange={(e) => setNewExpense({ ...newExpense, unit_size: Number(e.target.value) })}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                {newExpense.category === "Labor" ? "Wage per Person (₹)" :
                                                    (newExpense.category === "Input" && newExpense.unit === "bags") ? "Cost per Bag (₹)" : "Unit Cost (₹)"}
                                            </label>
                                            <Input
                                                type="number"
                                                value={newExpense.unit_cost}
                                                onChange={(e) => setNewExpense({ ...newExpense, unit_cost: Number(e.target.value) })}
                                            />
                                        </div>

                                        {newExpense.category === "Input" && newExpense.unit === "bags" && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Total Quantity</label>
                                                <div className="p-2 bg-gray-100 border rounded-md text-gray-700">
                                                    {(newExpense.quantity || 0) * (newExpense.unit_size || 0)} kg
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Total Cost (₹)</label>
                                            <div className="p-2 bg-gray-50 border rounded-md font-bold text-gray-700">
                                                ₹ {calculateTotalCost(newExpense).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Date</label>
                                            <Input
                                                type="date"
                                                value={newExpense.date}
                                                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Payment Mode</label>
                                            <select
                                                className="w-full p-2 border rounded-md"
                                                value={newExpense.payment_mode}
                                                onChange={(e) => setNewExpense({ ...newExpense, payment_mode: e.target.value })}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="Digital">Digital (UPI/Wallet)</option>
                                                <option value="Bank">Bank Transfer</option>
                                                <option value="Credit">Credit (Pay Later)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Bill Upload (Optional)</label>
                                            <Input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setUploading(true);
                                                        try {
                                                            const url = await uploadFile(file);
                                                            setNewExpense({ ...newExpense, bill_url: url });
                                                        } catch (err) {
                                                            alert("Upload failed");
                                                        } finally {
                                                            setUploading(false);
                                                        }
                                                    }
                                                }}
                                            />
                                            {uploading && <p className="text-xs text-blue-500">Uploading...</p>}
                                            {newExpense.bill_url && <p className="text-xs text-green-500">File uploaded!</p>}
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <Button variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                                        <Button onClick={handleAddExpense} disabled={uploading} className="bg-green-600 hover:bg-green-700">
                                            {uploading ? "Uploading..." : (editingExpenseId ? "Update Expense" : "Save Expense")}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-4 font-medium text-gray-600">Date</th>
                                        <th className="text-left p-4 font-medium text-gray-600">Category</th>
                                        <th className="text-left p-4 font-medium text-gray-600">Details</th>
                                        <th className="text-left p-4 font-medium text-gray-600">Description</th>
                                        <th className="text-right p-4 font-medium text-gray-600">Cost</th>
                                        <th className="p-4"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">No expenses recorded yet.</td>
                                        </tr>
                                    ) : (
                                        expenses.map(expense => (
                                            <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="p-4">{new Date(expense.date).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium">
                                                        {expense.category}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-teal-900 text-lg mb-1">{expense.type} {expense.unit === 'bags' && '(Bags)'}</div>
                                                    {expense.unit === 'bags' ? (
                                                        <div className="text-sm">
                                                            <div className="text-teal-700 font-medium text-base">
                                                                {expense.quantity} Bags * {expense.unit_size || '?'} kg/bag * ₹{expense.unit_cost}/bag
                                                            </div>
                                                            <div className="text-emerald-600 mt-1 font-semibold">
                                                                Total Qty: {expense.quantity * (expense.unit_size || 0)} kg
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-500">{expense.quantity} {expense.unit} @ ₹{expense.unit_cost}/{expense.unit}</div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600">
                                                    {expense.notes || "-"}
                                                </td>
                                                <td className="p-4 text-right font-bold text-gray-900">
                                                    ₹{expense.total_cost.toLocaleString()}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditExpense(expense)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-2">
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteExpense(expense.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "harvest" && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold">Yield & Revenue</h2>
                                <p className="text-sm text-gray-500">Track multiple harvest stages.</p>
                            </div>
                            <Button onClick={() => {
                                setEditingHarvestId(null);
                                setNewHarvest({
                                    date: new Date().toISOString().split("T")[0],
                                    stage: "First Picking",
                                    quantity: 0,
                                    unit: "Quintals",
                                    quality: "Grade A",
                                    selling_price_per_unit: 0,
                                    total_revenue: 0,
                                    buyer_type: "Market",
                                    sold_to: "",
                                    notes: "",
                                });
                                setShowHarvestModal(true);
                            }} className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-2" /> Record Harvest
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Yield</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{harvests.reduce((sum, h) => sum + h.quantity, 0)} Quintals</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-600">₹{harvests.reduce((sum, h) => sum + h.total_revenue, 0).toLocaleString()}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Harvest Events</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{harvests.length}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Stage</th>
                                        <th className="p-4">Quantity</th>
                                        <th className="p-4">Price/Unit</th>
                                        <th className="p-4">Revenue</th>
                                        <th className="p-4">Buyer</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {harvests.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-400">No harvest records yet.</td>
                                        </tr>
                                    ) : harvests.map((h) => (
                                        <tr key={h.id} className="hover:bg-gray-50">
                                            <td className="p-4">{new Date(h.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-medium text-gray-800">{h.stage}</td>
                                            <td className="p-4">{h.quantity} {h.unit}</td>
                                            <td className="p-4">₹{h.selling_price_per_unit}</td>
                                            <td className="p-4 font-bold text-green-600">₹{h.total_revenue.toLocaleString()}</td>
                                            <td className="p-4">{h.buyer_type}</td>
                                            <td className="p-4 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleEditHarvest(h)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-2">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteHarvest(h.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Modal isOpen={showHarvestModal} onClose={() => setShowHarvestModal(false)} title={editingHarvestId ? "Edit Harvest Record" : "Record Harvest"}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Harvest Stage</label>
                                    <select
                                        className="w-full p-2 border rounded-md"
                                        value={newHarvest.stage}
                                        onChange={(e) => setNewHarvest({ ...newHarvest, stage: e.target.value })}
                                    >
                                        <option value="First Picking">First Picking</option>
                                        <option value="Second Picking">Second Picking</option>
                                        <option value="Final Harvest">Final Harvest</option>
                                        <option value="Whole Crop">Whole Crop</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Date</label>
                                    <Input type="date" value={newHarvest.date} onChange={(e) => setNewHarvest({ ...newHarvest, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity Harvested</label>
                                    <div className="flex gap-2">
                                        <Input type="number" value={newHarvest.quantity} onChange={(e) => setNewHarvest({ ...newHarvest, quantity: Number(e.target.value) })} />
                                        <select className="p-2 border rounded-md" value={newHarvest.unit} onChange={(e) => setNewHarvest({ ...newHarvest, unit: e.target.value })}>
                                            <option value="Quintals">Quintals</option>
                                            <option value="Kg">Kg</option>
                                            <option value="Tons">Tons</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Selling Price per Unit (₹)</label>
                                    <Input type="number" value={newHarvest.selling_price_per_unit} onChange={(e) => setNewHarvest({ ...newHarvest, selling_price_per_unit: Number(e.target.value) })} />
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex justify-between items-center">
                                    <span className="text-sm font-bold text-green-700">Total Revenue</span>
                                    <span className="text-xl font-black text-green-800">
                                        ₹{((newHarvest.quantity || 0) * (newHarvest.selling_price_per_unit || 0)).toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setShowHarvestModal(false)}>Cancel</Button>
                                    <Button onClick={() => {
                                        // Calculate revenue before saving
                                        const revenue = (newHarvest.quantity || 0) * (newHarvest.selling_price_per_unit || 0);
                                        newHarvest.total_revenue = revenue;
                                        handleAddHarvest();
                                    }} className="bg-green-600 hover:bg-green-700">Save Record</Button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}

                {/* Inputs Used Tab */}
                {activeTab === "inputs" && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold">Inputs Used</h2>

                        {/* Input Summary Section */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-6">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Sprout className="w-5 h-5 text-green-600" /> Total Usage Summary
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.values(expenses.filter(e => e.category === 'Input').reduce((acc: any, curr) => {
                                    const key = curr.type;
                                    if (!acc[key]) {
                                        acc[key] = {
                                            type: key,
                                            totalBags: 0,
                                            totalWeight: 0,
                                            cost: 0,
                                            unitSize: curr.unit_size || 0,
                                            unitCost: curr.unit_cost || 0
                                        };
                                    }
                                    if (curr.unit === 'bags') {
                                        acc[key].totalBags += curr.quantity;
                                        acc[key].totalWeight += (curr.quantity * (curr.unit_size || 0));
                                    }
                                    acc[key].cost += curr.total_cost;
                                    return acc;
                                }, {})).map((item: any) => (
                                    <div key={item.type} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                        <div className="font-bold text-green-900">{item.type}</div>
                                        <div className="text-sm text-green-800 font-medium mt-1">
                                            {item.totalBags > 0 ? (
                                                <span>{item.totalBags} Bags * {item.unitSize} kg * ₹{item.unitCost}</span>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-green-600 mt-1">Total Cost: ₹{item.cost.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {expenses.filter(e => e.category === 'Input').length === 0 ? (
                                <div className="text-gray-500 col-span-2">No inputs recorded yet. Add them in Expenses tab.</div>
                            ) : (
                                expenses.filter(e => e.category === 'Input').map(e => (
                                    <Card key={e.id}>
                                        <CardContent className="flex items-center gap-4 p-4">
                                            <div className="p-3 rounded-full bg-green-100 text-green-700">
                                                <Sprout className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">{e.type}</h4>
                                                {e.unit === 'bags' && e.unit_size ? (
                                                    <div>
                                                        <p className="font-medium text-gray-800">
                                                            {e.unit_size} kg × {e.quantity} bags = <strong>{(e.quantity * e.unit_size).toLocaleString()} kg</strong>
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500">{e.quantity} {e.unit} used</p>
                                                )}
                                            </div>
                                            <div className="ml-auto font-bold">
                                                ₹{e.total_cost.toLocaleString()}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                )}



                {/* AI Insights Tab */}
                {activeTab === "insights" && (
                    <div className="space-y-6">
                        {/* Prediction Card */}
                        {prediction && (
                            <Card className="bg-gradient-to-r from-purple-50 to-white border-purple-100">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-purple-800">
                                        <Brain className="w-5 h-5" /> AI Profit Prediction
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <p className="text-sm text-gray-500">Predicted Profit</p>
                                            <p className="text-3xl font-bold text-purple-700">₹{prediction.predicted_profit.toLocaleString()}</p>
                                            <p className="text-xs text-purple-600 mt-1">{prediction.message}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Estimated Revenue</p>
                                            <p className="font-semibold">₹{prediction.estimated_revenue.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Estimated Cost</p>
                                            <p className="font-semibold">₹{prediction.estimated_cost.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            <h3 className="text-lg font-semibold">Cost Optimization Insights</h3>
                            {insights.length === 0 ? (
                                <p className="text-gray-500">No insights available yet. Add more expenses to get AI-powered analysis.</p>
                            ) : (
                                insights.map((insight, index) => {
                                    const bg = insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                                        insight.type === 'alert' ? 'bg-red-50 border-red-200' :
                                            insight.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
                                    const text = insight.type === 'warning' ? 'text-amber-800' :
                                        insight.type === 'alert' ? 'text-red-800' :
                                            insight.type === 'success' ? 'text-green-800' : 'text-blue-800';
                                    const icon = insight.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                                        insight.type === 'alert' ? <AlertTriangle className="w-5 h-5" /> :
                                            insight.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />;

                                    return (
                                        <div key={index} className={`p-4 rounded-lg border ${bg} flex items-start gap-4`}>
                                            <div className={`${text} mt-1`}>{icon}</div>
                                            <div>
                                                <h4 className={`font-bold ${text}`}>{insight.category}</h4>
                                                <p className="text-gray-700">{insight.message}</p>
                                                <p className="text-sm font-medium mt-2 flex items-center gap-1 opacity-80">
                                                    <Lightbulb className="w-3 h-3" /> Suggestion: {insight.action}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Crop Modal */}
            <Modal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                title="Edit Crop Details"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Crop Name</Label>
                        <Input
                            value={editForm.name || ""}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Area (Acres)</Label>
                        <Input
                            type="number"
                            value={editForm.area || 0}
                            onChange={(e) => setEditForm({ ...editForm, area: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Sowing Date</Label>
                            <Input
                                type="date"
                                value={editForm.sowing_date || ""}
                                onChange={(e) => setEditForm({ ...editForm, sowing_date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Expected Harvest</Label>
                            <Input
                                type="date"
                                value={editForm.expected_harvest_date || ""}
                                onChange={(e) => setEditForm({ ...editForm, expected_harvest_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                            className="w-full p-2 border rounded-md"
                            value={editForm.status || ""}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        >
                            <option value="Growing">Growing</option>
                            <option value="Harvesting">Harvesting</option>
                            <option value="Harvested">Harvested</option>
                            <option value="Sold">Sold</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                            value={editForm.notes || ""}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Optional notes..."
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateCrop} className="bg-green-600 hover:bg-green-700">Save Changes</Button>
                    </div>
                </div>
            </Modal>

            {/* QR Code Modal */}
            <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Product Traceability">
                <div className="flex flex-col items-center gap-6 p-6">
                    <div className="bg-white p-4 rounded-xl shadow-lg border border-green-100">
                        <QRCodeCanvas
                            value={typeof window !== 'undefined' ? `${window.location.origin}/trace/${cropId}` : ''}
                            size={256}
                            level={"H"}
                            includeMargin={true}
                        />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="font-bold text-lg text-gray-800">Scan for Journey</h3>
                        <p className="text-sm text-gray-500 max-w-xs">
                            Consumers can scan this QR code to view the full journey of this crop from farm to table.
                        </p>
                    </div>
                    <div className="flex gap-2 w-full">
                        <Button variant="outline" className="flex-1" onClick={() => setShowQR(false)}>Close</Button>
                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => window.print()}>
                            Print Label
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
