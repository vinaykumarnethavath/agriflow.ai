"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api, {
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
import MockRazorpayPopup from "@/components/payment/MockRazorpayPopup";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Ensure Label is available or use standard label
import { ArrowLeft, Plus, Trash2, Sprout, TrendingUp, IndianRupee, Tractor, Droplets, Truck, Pickaxe, Package, Pencil, AlertTriangle, CheckCircle, Info, Lightbulb, QrCode, Store, ShoppingCart } from "lucide-react";
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

// Normalization helper (matches dashboard)
const normalizeLandArea = (value: number): number => {
    let acres = Math.floor(value);
    let guntas = Math.round((value - acres) * 100);
    if (guntas >= 40) {
        acres += Math.floor(guntas / 40);
        guntas = guntas % 40;
    }
    return acres + (guntas / 100);
};

// Helper: Add land areas in base-40
const addLandArea = (a: number, b: number): number => {
    let aAcres = Math.floor(a);
    let aGuntas = Math.round((a - aAcres) * 100);
    let bAcres = Math.floor(b);
    let bGuntas = Math.round((b - bAcres) * 100);
    let resAcres = aAcres + bAcres;
    let resGuntas = aGuntas + bGuntas;
    if (resGuntas >= 40) {
        resAcres += Math.floor(resGuntas / 40);
        resGuntas = resGuntas % 40;
    }
    return resAcres + (resGuntas / 100);
};

// Helper: Subtract land areas in base-40
const subtractLandArea = (total: number, minus: number): number => {
    let tAcres = Math.floor(total);
    let tGuntas = Math.round((total - tAcres) * 100);
    let mAcres = Math.floor(minus);
    let mGuntas = Math.round((minus - mAcres) * 100);
    let resAcres = tAcres - mAcres;
    let resGuntas = tGuntas - mGuntas;
    if (resGuntas < 0) {
        resAcres -= 1;
        resGuntas += 40;
    }
    return resAcres + (resGuntas / 100);
};

// Helper: Format area for display (Ac.Guntas)
const formatLandArea = (area: number) => {
    let acres = Math.floor(area);
    let guntas = Math.round((area - acres) * 100);
    if (guntas >= 40) {
        acres += Math.floor(guntas / 40);
        guntas = guntas % 40;
    }
    return `${acres}.${guntas.toString().padStart(2, '0')}`;
};

export default function CropDetailPage() {
    const params = useParams();
    const router = useRouter();
    const cropId = Number(params?.id);

    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");

    const [crop, setCrop] = useState<Crop | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [allCrops, setAllCrops] = useState<Crop[]>([]);
    const [expenses, setExpenses] = useState<CropExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(tabParam === "expenses" ? "expenses" : "overview");

    const handleAreaBlurEvent = (value: string, setter: (val: string) => void) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;
        const normalized = normalizeLandArea(num);
        setter(normalized.toFixed(2));
    };

    // Real-time scroll capping: .39 max, then jumps to next acre
    const handleAreaChangeEvent = (value: string, setter: (val: string) => void) => {
        if (value === '' || value === '0' || value === '0.') { setter(value); return; }
        const num = parseFloat(value);
        if (isNaN(num)) { setter(value); return; }

        // Explicitly prevent negative areas
        if (num < 0) {
            setter('0.00');
            return;
        }

        const acres = Math.floor(num);
        const guntas = Math.round((num - acres) * 100);

        // Detect browser step-down from X.00, which results in (X-1).99
        if (guntas > 39) {
            if (guntas >= 90) {
                // Downward scroll from X.00 -> (X-1).99
                setter(`${acres}.39`);
            } else {
                // Upward scroll from X.39 -> X.40
                const newAcres = acres + Math.floor(guntas / 40);
                const newGuntas = guntas % 40;
                setter(`${newAcres}.${newGuntas.toString().padStart(2, '0')}`);
            }
        } else {
            setter(value);
        }
    };

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
    const [mockOptions, setMockOptions] = useState<any>(null);

    const [harvests, setHarvests] = useState<CropHarvest[]>([]);
    const [showHarvestModal, setShowHarvestModal] = useState(false);
    const [newHarvest, setNewHarvest] = useState<Partial<CropHarvest>>({
        date: new Date().toISOString().split("T")[0],
        stage: "First Picking",
        quantity: 0,          // No. of bags
        unit: "bags",
        unit_size: 50,        // Bag size in kg (default 50kg bag)
        quality: "Grade A",
        selling_price_per_unit: 0,
        total_revenue: 0,
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

    // Sell Crop State
    const [showSellForm, setShowSellForm] = useState(false);
    const [sellForm, setSellForm] = useState({
        buyer_type: "Mill",
        buyer_name: "",
        buyer_id: "",
        price_per_quintal: 0,
        quantity_quintals: 0,
        total_bags: 0,
        bag_size: 50,
        payment_mode: "Cash",
        notes: "",
    });
    const [sellListings, setSellListings] = useState<any[]>([]);
    const [sellSubmitting, setSellSubmitting] = useState(false);

    useEffect(() => {
        if (crop) {
            setEditForm({
                name: crop.name,
                area: crop.area,
                season: crop.season || "Kharif",
                variety: crop.variety || "",
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
            const [cropData, expenseData, aiData, profileRes, cropsRes] = await Promise.all([
                getCropDetails(cropId),
                getCropExpenses(cropId),
                getCropInsights(cropId).catch(() => ({ insights: [], prediction: null })),
                api.get("/farmer/profile").catch(() => ({ data: null })),
                api.get("/crops/").catch(() => ({ data: [] }))
            ]);

            setCrop(cropData);
            setExpenses(expenseData);
            setInsights(aiData?.insights || []);
            setPrediction(aiData?.prediction || null);
            setProfile(profileRes?.data || null);
            setAllCrops(cropsRes?.data || []);
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
            const size = expense.unit_size || 1;
            if (expense.unit === "bags" || expense.unit === "liters" || expense.unit === "packets") {
                // Number * Size * Unit Cost
                return qty * size * cost;
            }
        }
        return qty * cost;
    };

    const handleAddExpense = async () => {
        try {
            const expenseToSave = {
                ...newExpense,
                total_cost: calculateTotalCost(newExpense)
            };

            let savedExpense: any;
            if (editingExpenseId) {
                savedExpense = await updateCropExpense(editingExpenseId, expenseToSave as any);
                setEditingExpenseId(null);
            } else {
                savedExpense = await createCropExpense(cropId, expenseToSave as any);
            }

            // If Razorpay selected, open payment gateway
            if (newExpense.payment_mode === "Razorpay" && !editingExpenseId) {
                const totalCost = calculateTotalCost(newExpense);
                if (totalCost > 0) {
                    const { createPaymentOrder, verifyPayment, getRazorpayConfig } = await import("@/lib/payment-api");
                    const config = await getRazorpayConfig();

                    const paymentOrder = await createPaymentOrder({
                        amount: totalCost,
                        payment_for: "farmer_expense",
                        reference_id: savedExpense?.id,
                    });

                    if (!(window as any).Razorpay) {
                        await new Promise<void>((resolve, reject) => {
                            const script = document.createElement("script");
                            script.src = "https://checkout.razorpay.com/v1/checkout.js";
                            script.onload = () => resolve();
                            script.onerror = () => reject();
                            document.body.appendChild(script);
                        });
                    }

                    const options = {
                        key: config.key_id,
                        amount: Math.round(totalCost * 100),
                        currency: "INR",
                        name: "AgriChain",
                        description: `Expense: ${newExpense.type || newExpense.category}`,
                        order_id: paymentOrder.razorpay_order_id,
                        theme: { color: "#16a34a" },
                        handler: async (response: any) => {
                            try {
                                await verifyPayment({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature,
                                });
                                alert("Payment successful!");
                            } catch (err) {
                                alert("Payment verification failed.");
                            }
                            fetchData();
                        },
                    };

                    if (config.key_id.startsWith("rzp_test_placeholder")) {
                        setMockOptions(options);
                        return;
                    }

                    const razorpay = new (window as any).Razorpay(options);
                    razorpay.open();
                }
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
            const bags = newHarvest.quantity || 0;
            const bagSizeKg = (newHarvest as any).unit_size || 50;
            const quintals = (bags * bagSizeKg) / 100;

            const harvestData = {
                ...newHarvest,
                quantity: quintals,          // store in quintals
                unit: "Quintals",
                unit_size: bagSizeKg,        // store bag size for reference
                selling_price_per_unit: 0,   // no selling price at harvest stage
                total_revenue: 0,
            };

            if (editingHarvestId) {
                await updateCropHarvest(editingHarvestId, harvestData as any);
                setEditingHarvestId(null);
            } else {
                await createCropHarvest(cropId, harvestData as any);
            }

            setShowHarvestModal(false);
            fetchData();
            setNewHarvest({
                date: new Date().toISOString().split("T")[0],
                stage: "Next Picking",
                quantity: 0,
                unit: "bags",
                unit_size: 50,
                quality: "Grade A",
                selling_price_per_unit: 0,
                total_revenue: 0,
                notes: "",
            });
            alert("Harvest recorded!");
        } catch (error) {
            console.error("Error saving harvest:", error);
            alert("Failed to save harvest");
        }
    };

    const handleEditHarvest = (harvest: CropHarvest) => {
        // If stored as quintals, convert back to bags for editing
        const storedQty = harvest.quantity || 0;
        const bagSize = (harvest as any).unit_size || 50;
        const bags = bagSize > 0 ? Math.round((storedQty * 100) / bagSize) : storedQty;

        setNewHarvest({
            date: new Date(harvest.date).toISOString().split("T")[0],
            stage: harvest.stage,
            quantity: bags,
            unit: "bags",
            unit_size: bagSize,
            quality: harvest.quality,
            selling_price_per_unit: 0,
            total_revenue: 0,
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
        if (!crop || !profile) return;

        const newArea = parseFloat(editForm.area?.toString() || "0");
        if (newArea > 0 && newArea !== crop.area) {
            // Validate against available land
            const calculateTotalLand = () => {
                let total = 0;
                const records = profile.land_records || [];
                records.forEach((lr: any) => {
                    total = addLandArea(total, lr.area || 0);
                });
                return total || profile.total_area || 0;
            };

            const calculateActiveAreaIgnoringCurrent = () => {
                let total = 0;
                const otherActiveCrops = allCrops.filter(c => c.status === 'Growing' && c.id !== crop.id);
                otherActiveCrops.forEach(c => {
                    total = addLandArea(total, c.area || 0);
                });
                return total;
            };

            const totalLandArea = calculateTotalLand();
            const activeAreaExcludingThis = calculateActiveAreaIgnoringCurrent();
            const availableLand = subtractLandArea(totalLandArea, activeAreaExcludingThis);

            if (totalLandArea > 0 && newArea > availableLand) {
                alert(`Cannot update crop: New Area (${formatLandArea(newArea)} Ac) exceeds available land (${formatLandArea(availableLand)} Ac).\n\nTotal Land: ${formatLandArea(totalLandArea)} Ac\nOther Active Crops: ${formatLandArea(activeAreaExcludingThis)} Ac\nAvailable: ${formatLandArea(availableLand)} Ac\n\nPlease reduce the crop area or update your land records.`);
                return;
            }
        }

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
                        {crop.season && <span className="font-semibold text-green-700 mr-2">{crop.season}</span>}
                        {crop.variety && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded mr-2 text-xs border border-green-100">{crop.variety}</span>}
                        {formatLandArea(crop.area)} Acres • Sown on {new Date(crop.sowing_date).toLocaleDateString()}
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
                {["inputs", "sell"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === tab
                            ? "text-green-600"
                            : "text-gray-500 hover:text-gray-900"
                            }`}
                    >
                        {tab === "inputs" ? "Inputs Used" : tab === "sell" ? "Sell Crop" : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                                        <div key={cat.value} className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col items-center text-center gap-2">
                                            <div className="p-2 bg-muted rounded-full text-muted-foreground">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-medium text-muted-foreground">{cat.label.split(' ')[0]}</span>
                                            <span className="font-bold text-foreground">₹{total.toLocaleString()}</span>
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
                            <h2 className="text-xl font-semibold">Expense Log</h2>
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
                                                    newExpense.unit === "bags" ? "No. of Bags" :
                                                        newExpense.unit === "liters" ? "No. of Bottles" :
                                                            newExpense.unit === "packets" ? "No. of Packets" : "Quantity"}
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
                                                            <option value="liters">liters (bottles)</option>
                                                            <option value="packets">packets</option>
                                                            <option value="units">units</option>
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                        </div>

                                        {newExpense.category === "Labor" && (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Round / Activity Name</label>
                                                    <Input
                                                        value={(newExpense as any).round_name || ""}
                                                        onChange={(e) => setNewExpense({ ...newExpense, round_name: e.target.value } as any)}
                                                        placeholder="e.g., Round 1, Picking Round 2"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Duration (Days)</label>
                                                    <Input
                                                        type="number"
                                                        value={newExpense.duration}
                                                        onChange={(e) => setNewExpense({ ...newExpense, duration: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {newExpense.category === "Input" && (newExpense.unit === "bags" || newExpense.unit === "liters" || newExpense.unit === "packets") && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    {newExpense.unit === "bags" ? "Size per Bag (kg)" :
                                                        newExpense.unit === "liters" ? "Volume per Bottle (ml/L)" :
                                                            "Weight per Packet (g/kg)"}
                                                </label>
                                                <Input
                                                    type="number"
                                                    value={newExpense.unit_size}
                                                    onChange={(e) => setNewExpense({ ...newExpense, unit_size: Number(e.target.value) })}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">
                                                {newExpense.category === "Labor" ? "Wage per Person/Day (₹)" :
                                                    newExpense.unit === "bags" ? "Cost per kg (₹)" :
                                                        newExpense.unit === "liters" ? "Cost per Bottle (₹)" :
                                                            newExpense.unit === "packets" ? "Cost per Packet (₹)" : "Unit Cost (₹)"}
                                            </label>
                                            <Input
                                                type="number"
                                                value={newExpense.unit_cost}
                                                onChange={(e) => setNewExpense({ ...newExpense, unit_cost: Number(e.target.value) })}
                                            />
                                        </div>

                                        {newExpense.category === "Input" && (newExpense.unit === "bags" || newExpense.unit === "liters" || newExpense.unit === "packets") && (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Total Quantity</label>
                                                <div className="p-2 bg-muted border rounded-md text-foreground">
                                                    {newExpense.unit === "bags" ? `${(newExpense.quantity || 0) * (newExpense.unit_size || 0)} kg` :
                                                        newExpense.unit === "liters" ? `${(newExpense.quantity || 0)} bottles × ${newExpense.unit_size || 0} ml each` :
                                                            `${(newExpense.quantity || 0)} packets × ${newExpense.unit_size || 0} g each`}
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Total Cost (₹)</label>
                                            <div className="p-2 bg-muted border rounded-md font-bold text-foreground">
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
                                                <option value="Razorpay">Pay Online (Razorpay)</option>
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

                        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Details</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Description</th>
                                        <th className="text-right p-4 font-medium text-muted-foreground">Cost</th>
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
                                            <tr key={expense.id} className="border-b last:border-0 hover:bg-muted/50">
                                                <td className="p-4">{new Date(expense.date).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground">
                                                        {expense.category}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-foreground text-base mb-1">
                                                        {expense.type}
                                                        {expense.category === 'Labor' && (expense as any).round_name && (
                                                            <span className="text-xs font-normal text-muted-foreground ml-1">({(expense as any).round_name})</span>
                                                        )}
                                                    </div>
                                                    {expense.unit === 'bags' ? (
                                                        <div className="text-sm text-teal-700 font-medium">
                                                            {expense.quantity} bags × {expense.unit_size || 1} kg/bag × ₹{expense.unit_cost}/bag
                                                        </div>
                                                    ) : expense.unit === 'liters' ? (
                                                        <div className="text-sm text-blue-700 font-medium">
                                                            {expense.quantity} bottles × {expense.unit_size || 1} L/bottle × ₹{expense.unit_cost}/L
                                                        </div>
                                                    ) : expense.unit === 'packets' ? (
                                                        <div className="text-sm text-purple-700 font-medium">
                                                            {expense.quantity} packets × {expense.unit_size || 1} g/packet × ₹{expense.unit_cost}/g
                                                        </div>
                                                    ) : expense.category === 'Labor' ? (
                                                        <div className="text-sm text-orange-700 font-medium">
                                                            {expense.quantity} workers × {expense.duration || 1} days × ₹{expense.unit_cost}/day
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-muted-foreground">
                                                            {expense.quantity} {expense.unit} × ₹{expense.unit_cost}/{expense.unit}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-muted-foreground">
                                                    {expense.notes || "-"}
                                                </td>
                                                <td className="p-4 text-right font-bold text-foreground">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Yield</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{harvests.reduce((sum, h) => sum + h.quantity, 0)} Quintals</div>
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
                                <thead className="bg-gray-50 text-gray-700 font-medium">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Stage</th>
                                        <th className="p-4">No. of Bags</th>
                                        <th className="p-4">Bag Size</th>
                                        <th className="p-4">Quintals</th>
                                        <th className="p-4">Notes</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {harvests.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-gray-500">No harvest records yet.</td>
                                        </tr>
                                    ) : harvests.map((h) => {
                                        const bagSize = (h as any).unit_size || 50;
                                        const quintals = h.quantity; // already stored in quintals
                                        const bags = bagSize > 0 ? Math.round((quintals * 100) / bagSize) : '-';
                                        return (
                                            <tr key={h.id} className="hover:bg-gray-50">
                                                <td className="p-4 text-gray-800">{new Date(h.date).toLocaleDateString()}</td>
                                                <td className="p-4 font-medium text-gray-800">{h.stage}</td>
                                                <td className="p-4 font-bold text-green-700">{bags} bags</td>
                                                <td className="p-4 text-gray-700">{bagSize} kg/bag</td>
                                                <td className="p-4 font-bold text-gray-800">{quintals.toFixed(2)} Q</td>
                                                <td className="p-4 text-gray-600">{h.notes || '-'}</td>
                                                <td className="p-4 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditHarvest(h)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 mr-2">
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteHarvest(h.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <Modal isOpen={showHarvestModal} onClose={() => setShowHarvestModal(false)} title={editingHarvestId ? "Edit Harvest Record" : "Record Harvest"}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-800">Harvest Stage</label>
                                    <select
                                        className="w-full p-2 border rounded-md text-gray-800 bg-white"
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
                                    <label className="text-sm font-medium text-gray-800">Date of Harvest</label>
                                    <Input type="date" value={newHarvest.date} onChange={(e) => setNewHarvest({ ...newHarvest, date: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-800">No. of Bags</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={newHarvest.quantity}
                                            onChange={(e) => setNewHarvest({ ...newHarvest, quantity: Number(e.target.value) })}
                                            placeholder="e.g. 20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-800">Bag Size (kg each)</label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={(newHarvest as any).unit_size || 50}
                                            onChange={(e) => setNewHarvest({ ...newHarvest, unit_size: Number(e.target.value) } as any)}
                                            placeholder="e.g. 50"
                                        />
                                    </div>
                                </div>
                                {/* Auto-computed yield display */}
                                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                    <p className="text-xs font-bold text-green-700 uppercase mb-2">Calculated Yield</p>
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-gray-600">Total Weight</p>
                                            <p className="text-xl font-black text-green-800">
                                                {((newHarvest.quantity || 0) * ((newHarvest as any).unit_size || 50)).toLocaleString()} kg
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600">In Quintals</p>
                                            <p className="text-xl font-black text-green-800">
                                                {(((newHarvest.quantity || 0) * ((newHarvest as any).unit_size || 50)) / 100).toFixed(2)} Q
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 text-center">
                                        Formula: {newHarvest.quantity || 0} bags × {(newHarvest as any).unit_size || 50} kg = {((newHarvest.quantity || 0) * ((newHarvest as any).unit_size || 50)).toLocaleString()} kg = {(((newHarvest.quantity || 0) * ((newHarvest as any).unit_size || 50)) / 100).toFixed(2)} Quintals
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-800">Notes (Optional)</label>
                                    <Input
                                        value={newHarvest.notes || ""}
                                        onChange={(e) => setNewHarvest({ ...newHarvest, notes: e.target.value })}
                                        placeholder="Quality grade, moisture level, etc."
                                    />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setShowHarvestModal(false)}>Cancel</Button>
                                    <Button onClick={handleAddHarvest} className="bg-green-600 hover:bg-green-700">Save Record</Button>
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
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm mb-6">
                            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                                <Sprout className="w-5 h-5 text-green-600" /> Total Usage Summary
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.values(expenses.filter(e => e.category === 'Input').reduce((acc: any, curr) => {
                                    const key = `${curr.type}_${curr.unit_cost}`;
                                    if (!acc[key]) {
                                        acc[key] = {
                                            type: curr.type,
                                            totalQty: 0,
                                            totalWeight: 0,
                                            cost: 0,
                                            unit: curr.unit || 'kg',
                                            unitSize: curr.unit_size || 0,
                                            unitCost: curr.unit_cost || 0,
                                        };
                                    }
                                    acc[key].totalQty += curr.quantity;
                                    if (curr.unit === 'bags') {
                                        acc[key].totalWeight += (curr.quantity * (curr.unit_size || 0));
                                    }
                                    acc[key].cost += curr.total_cost;
                                    return acc;
                                }, {})).map((item: any) => (
                                    <div key={`${item.type}_${item.unitCost}`} className="p-4 bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 shadow-sm">
                                        <div className="font-bold text-emerald-900 text-lg mb-1">{item.type}</div>
                                        <div className="text-sm text-emerald-800 font-medium">
                                            {item.unit === 'bags' ? (
                                                <span>{item.totalQty} bags × {item.unitSize} kg/bag × ₹{item.unitCost}/kg</span>
                                            ) : item.unit === 'liters' ? (
                                                <span>{item.totalQty} bottles × {item.unitSize} L/bottle × ₹{item.unitCost}/L</span>
                                            ) : item.unit === 'packets' ? (
                                                <span>{item.totalQty} packets × {item.unitSize} g/packet × ₹{item.unitCost}/g</span>
                                            ) : (
                                                <span>{item.totalQty} {item.unit} × ₹{item.unitCost}/{item.unit}</span>
                                            )}
                                        </div>
                                        {item.unit === 'bags' && item.totalWeight > 0 && (
                                            <div className="text-xs text-emerald-600 mt-1">Total Weight: <span className="font-bold">{item.totalWeight} kg</span></div>
                                        )}
                                        <div className="mt-3 pt-2 border-t border-emerald-100/50 flex justify-between items-center">
                                            <span className="text-xs text-emerald-600 uppercase font-bold tracking-wider">Total Cost</span>
                                            <span className="font-black text-emerald-700">₹{item.cost.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}

                {/* Sell Crop Tab */}
                {activeTab === "sell" && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Sell Your Crop</h2>
                                <p className="text-sm text-gray-500">List your harvested crop for sale to mills, markets, or direct buyers</p>
                            </div>
                            <Button
                                onClick={() => setShowSellForm(!showSellForm)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" /> New Listing
                            </Button>
                        </div>

                        {showSellForm && (
                            <Card className="border-green-200 bg-green-50/30">
                                <CardHeader>
                                    <CardTitle className="text-gray-800">Create Sell Listing</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Buyer Type</label>
                                            <select
                                                className="w-full p-2 border rounded-md text-gray-800 bg-white"
                                                value={sellForm.buyer_type}
                                                onChange={(e) => setSellForm({ ...sellForm, buyer_type: e.target.value })}
                                            >
                                                <option value="Mill">Mill Owner</option>
                                                <option value="Market">Market / Mandi</option>
                                                <option value="Direct">Direct Buyer</option>
                                                <option value="Trader">Trader / Dalal</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Buyer Name</label>
                                            <Input
                                                value={sellForm.buyer_name}
                                                onChange={(e) => setSellForm({ ...sellForm, buyer_name: e.target.value })}
                                                placeholder="e.g., Ranga Reddy Rice Mill"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Buyer ID / Registration No.</label>
                                            <Input
                                                value={sellForm.buyer_id}
                                                onChange={(e) => setSellForm({ ...sellForm, buyer_id: e.target.value })}
                                                placeholder="e.g., MILL-001, Aadhaar last 4"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Total Bags</label>
                                            <Input
                                                type="number"
                                                value={sellForm.total_bags || ""}
                                                onChange={(e) => {
                                                    const total = Number(e.target.value);
                                                    setSellForm({
                                                        ...sellForm,
                                                        total_bags: total,
                                                        quantity_quintals: Number(((total * (sellForm.bag_size || 50)) / 100).toFixed(2))
                                                    });
                                                }}
                                                placeholder="e.g., 20"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Bag Size (kg each)</label>
                                            <Input
                                                type="number"
                                                value={sellForm.bag_size || ""}
                                                onChange={(e) => {
                                                    const size = Number(e.target.value);
                                                    setSellForm({
                                                        ...sellForm,
                                                        bag_size: size,
                                                        quantity_quintals: Number(((sellForm.total_bags * size) / 100).toFixed(2))
                                                    });
                                                }}
                                                placeholder="e.g., 50"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Quantity (Quintals)</label>
                                            <Input
                                                type="number"
                                                value={sellForm.quantity_quintals || ""}
                                                onChange={(e) => setSellForm({ ...sellForm, quantity_quintals: Number(e.target.value) })}
                                                placeholder="e.g., 5"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Price per Quintal (₹)</label>
                                            <Input
                                                type="number"
                                                value={sellForm.price_per_quintal || ""}
                                                onChange={(e) => setSellForm({ ...sellForm, price_per_quintal: Number(e.target.value) })}
                                                placeholder="e.g., 2200"
                                                className="text-gray-800"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                                            <select
                                                className="w-full p-2 border rounded-md text-gray-800 bg-white"
                                                value={sellForm.payment_mode}
                                                onChange={(e) => setSellForm({ ...sellForm, payment_mode: e.target.value })}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI">UPI</option>
                                                <option value="Bank Transfer">Bank Transfer</option>
                                                <option value="Credit">Credit (Pay Later)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                                            <Input
                                                value={sellForm.notes}
                                                onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })}
                                                placeholder="Transport details, quality grade..."
                                                className="text-gray-800"
                                            />
                                        </div>
                                    </div>
                                    {sellForm.quantity_quintals > 0 && sellForm.price_per_quintal > 0 && (
                                        <div className="mt-4 p-3 bg-green-100 rounded-lg">
                                            <p className="text-sm text-green-700">Estimated Revenue: <span className="font-bold text-lg">₹{(sellForm.quantity_quintals * sellForm.price_per_quintal).toLocaleString()}</span></p>
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-4 justify-end">
                                        <Button variant="outline" onClick={() => setShowSellForm(false)} className="text-gray-700">Cancel</Button>
                                        <Button
                                            onClick={async () => {
                                                if (!sellForm.buyer_name || sellForm.quantity_quintals <= 0 || sellForm.price_per_quintal <= 0) {
                                                    alert("Please fill in buyer name, quantity, and price.");
                                                    return;
                                                }
                                                setSellSubmitting(true);
                                                try {
                                                    // Add to local listings (could be saved to backend in future)
                                                    const listing = {
                                                        ...sellForm,
                                                        id: Date.now(),
                                                        crop_name: crop?.name || "Unknown",
                                                        total_revenue: sellForm.quantity_quintals * sellForm.price_per_quintal,
                                                        date: new Date().toISOString(),
                                                        status: "listed"
                                                    };
                                                    setSellListings(prev => [listing, ...prev]);
                                                    setShowSellForm(false);
                                                    setSellForm({
                                                        buyer_type: "Mill",
                                                        buyer_name: "",
                                                        buyer_id: "",
                                                        price_per_quintal: 0,
                                                        quantity_quintals: 0,
                                                        total_bags: 0,
                                                        bag_size: 50,
                                                        payment_mode: "Cash",
                                                        notes: "",
                                                    });
                                                } catch (error) {
                                                    console.error("Failed to create listing:", error);
                                                } finally {
                                                    setSellSubmitting(false);
                                                }
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                            disabled={sellSubmitting}
                                        >
                                            {sellSubmitting ? "Creating..." : "Create Listing"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sell Listings */}
                        {sellListings.length === 0 && !showSellForm ? (
                            <div className="text-center py-16">
                                <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-600">No sell listings yet</h3>
                                <p className="text-gray-500 mb-4">Create a listing to sell your harvested crop to mills, markets, or buyers.</p>
                                <Button onClick={() => setShowSellForm(true)} className="bg-green-600 hover:bg-green-700 text-white">
                                    <Plus className="w-4 h-4 mr-2" /> Create First Listing
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sellListings.map((listing) => (
                                    <Card key={listing.id} className="border-gray-200 hover:shadow-md transition-shadow">
                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Store className="w-4 h-4 text-blue-600" />
                                                        <span className="font-bold text-gray-800">{listing.buyer_name}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{listing.buyer_type}</span>
                                                        {listing.buyer_id && (
                                                            <span className="text-xs text-gray-500">ID: {listing.buyer_id}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500">
                                                        {listing.total_bags > 0 && `${listing.total_bags} bags (${listing.bag_size || 50} kg) • `}
                                                        {listing.quantity_quintals} quintals @ ₹{listing.price_per_quintal}/quintal
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {new Date(listing.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        {listing.payment_mode && ` • ${listing.payment_mode}`}
                                                    </p>
                                                    {listing.notes && <p className="text-xs text-gray-500 mt-1">{listing.notes}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-green-700">₹{listing.total_revenue.toLocaleString()}</p>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${listing.status === 'sold' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {listing.status === 'sold' ? 'Sold' : 'Listed'}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Season</Label>
                            <select
                                className="w-full p-2 border rounded-md bg-white text-gray-800"
                                value={editForm.season || "Kharif"}
                                onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                            >
                                <option value="Kharif">Kharif</option>
                                <option value="Rabi">Rabi</option>
                                <option value="Zaid">Zaid</option>
                                <option value="Year-round">Year-round</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Variety</Label>
                            <Input
                                value={editForm.variety || ""}
                                placeholder="e.g. Sona Masuri"
                                onChange={(e) => setEditForm({ ...editForm, variety: e.target.value })}
                                className="text-gray-800"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Area (Acres.Guntas)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={editForm.area || ""}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (isNaN(val)) { setEditForm({ ...editForm, area: 0 }); return; }
                                const acres = Math.floor(val);
                                const guntas = Math.round((val - acres) * 100);
                                if (guntas >= 40) {
                                    const normalized = normalizeLandArea(val);
                                    setEditForm({ ...editForm, area: normalized });
                                } else {
                                    setEditForm({ ...editForm, area: val });
                                }
                            }}
                            onBlur={(e) => handleAreaBlurEvent(e.target.value, (val) => setEditForm({ ...editForm, area: parseFloat(val) }))}
                            className="text-gray-800"
                        />
                        <p className="text-[10px] text-gray-500 italic">Max .39 guntas per acre (e.g. 1.39 → 2.00)</p>
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
            </Modal >

            {/* QR Code Modal */}
            < Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Product Traceability" >
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

            {mockOptions && <MockRazorpayPopup options={mockOptions} onClose={() => setMockOptions(null)} />}
        </div>
    );
}
