"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
    Plus, Pencil, Trash2, Search, Package, AlertTriangle, ShoppingCart,
    ImagePlus, X, ChevronDown, ChevronRight, CheckCircle, Clock, ArrowRight, Receipt, Layers
} from "lucide-react";
import {
    getMyProducts, updateProduct, deleteProduct, Product, createManualOrder,
    markProductStatus
} from "@/lib/api";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["fertilizer", "seeds", "pesticides", "machinery"];
const UNIT_OPTIONS = ["bags", "bottles", "packets", "kg", "liters", "pieces"];

type LockedFields = {
    name?: string;
    short_name?: string;
    brand?: string;
    manufacturer?: string;
    category?: string;
    main_composition?: string;
    unit?: string;
    description?: string;
};

type ProductGroup = {
    id: string;
    name: string;
    category: string;
    brand: string;
    manufacturer: string;
    image_url: string | null;
    totalQuantity: number;
    unit: string;
    batches: Product[];
    weightedCost: number;
    minPrice: number;
    maxPrice: number;
    lowStockThreshold: number;
    hasDraft: boolean;
    hasActive: boolean;
};

interface ProductFormData extends Omit<Product, 'id'> {}

export default function InventoryPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active">("all");

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    
    // Post-save workflow banner
    const [savedProductName, setSavedProductName] = useState<string | null>(null);

    const [sellCart, setSellCart] = useState<{ product: Product; quantity: number }[]>([]);
    const [sellCustomerName, setSellCustomerName] = useState("");
    const [sellDiscount, setSellDiscount] = useState(0);
    const [sellPaymentMode, setSellPaymentMode] = useState("cash");
    const [selling, setSelling] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [markingStatus, setMarkingStatus] = useState<Record<number, boolean>>({});
    const [submitAction, setSubmitAction] = useState<'draft' | 'active'>("draft");
    const [lockedFields, setLockedFields] = useState<LockedFields | null>(null);

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormData>();

    const watchPrice = watch("price");
    const watchCostPrice = watch("cost_price");

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const data = await getMyProducts();
            setProducts(data);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const { data } = await api.post("/upload/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            const url = data.url || data.file_url || data.filename;
            setValue("image_url", url);
            setPreviewUrl(url);
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (data: any) => {
        try {
            const priceVal = parseFloat(data.price || 0);
            const qtyVal = parseInt(data.quantity || 0);

            if (submitAction === "active") {
                if (priceVal <= 0) {
                    alert("Please set a valid Selling Price before marking as active.");
                    return;
                }
                if (qtyVal <= 0) {
                    alert("Please set a valid Batch Qty before marking as active.");
                    return;
                }
            }

            const payload = {
                ...data,
                price: priceVal,
                quantity: qtyVal,
                cost_price: parseFloat(data.cost_price || 0),
                quantity_per_unit: data.quantity_per_unit ? parseFloat(data.quantity_per_unit as any) : undefined,
                measure_unit: data.measure_unit || "kg",
                low_stock_threshold: data.low_stock_threshold ? parseInt(data.low_stock_threshold as any) : 10,
                main_composition: data.main_composition || null,
                status: submitAction,
                manufacture_date: (() => {
                    const d = data.manufacture_date ? new Date(data.manufacture_date) : null;
                    return d && !isNaN(d.getTime()) ? d.toISOString() : null;
                })(),
                user_id: user?.id
            };
            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
                fetchProducts();
                closeAddModal();
            } else {
                const res = await api.post("/products/", payload);
                fetchProducts();
                closeAddModal();
                if (submitAction === "draft") {
                    setSavedProductName(data.name); // show workflow banner only for draft saves
                }
            }
        } catch (error: any) {
            console.error("Failed to save product:", error);
            const detailMsg = error.response?.data?.detail
                ? (Array.isArray(error.response.data.detail)
                    ? JSON.stringify(error.response.data.detail)
                    : error.response.data.detail)
                : error.message;
            alert("Failed to save product: " + detailMsg);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        try {
            await deleteProduct(id);
            fetchProducts();
        } catch (error) {
            console.error("Failed to delete:", error);
        }
    };

    const handleMarkStatus = async (product: Product, newStatus: 'draft' | 'active') => {
        setMarkingStatus(prev => ({ ...prev, [product.id]: true }));
        try {
            await markProductStatus(product.id, newStatus);
            await fetchProducts();
        } catch (err: any) {
            alert("Failed to update status: " + (err.response?.data?.detail || err.message));
        } finally {
            setMarkingStatus(prev => ({ ...prev, [product.id]: false }));
        }
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setPreviewUrl(null);
        reset({
            name: "", short_name: "", brand: "", manufacturer: "",
            category: "fertilizer", price: "" as any, cost_price: "" as any,
            quantity: "" as any, unit: "bags", quantity_per_unit: undefined,
            batch_number: "", description: "", main_composition: "" as any,
            manufacture_date: "" as any, low_stock_threshold: 10,
        } as any);
        setIsAddModalOpen(true);
        setLockedFields(null);
        setSubmitAction("draft");
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setPreviewUrl(product.image_url || product.product_image_url || null);
        Object.keys(product).forEach((key) => {
            setValue(key as any, (product as any)[key]);
        });
        setIsAddModalOpen(true);
        setLockedFields(null);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingProduct(null);
        setPreviewUrl(null);
        setLockedFields(null);
    };

    const openAddBatchModal = (group: ProductGroup) => {
        const template = group.batches[0];
        const fallbackUnit = template?.unit || group.unit || "bags";
        const fallbackDescription = template?.description || "";

        reset({
            name: group.name,
            short_name: template?.short_name || group.name,
            brand: group.brand,
            manufacturer: group.manufacturer,
            category: group.category,
            main_composition: template?.main_composition || "" as any,
            description: fallbackDescription,
            unit: fallbackUnit,
            batch_number: "",
            manufacture_date: "" as any,
            cost_price: "" as any,
            price: "" as any,
            quantity: "" as any,
            quantity_per_unit: template?.quantity_per_unit as any,
            measure_unit: template?.measure_unit || "kg",
            low_stock_threshold: template?.low_stock_threshold ?? group.lowStockThreshold,
            image_url: template?.image_url || group.image_url || "",
        } as any);

        setLockedFields({
            name: group.name,
            short_name: template?.short_name || group.name,
            brand: group.brand,
            manufacturer: group.manufacturer,
            category: group.category,
            main_composition: template?.main_composition || "",
            unit: fallbackUnit,
            description: fallbackDescription,
        });

        setPreviewUrl(template?.image_url || group.image_url || null);
        setEditingProduct(null);
        setIsAddModalOpen(true);
        setSubmitAction("draft");
    };

    const calculateProfit = () => {
        const baseCost = Number(watchCostPrice) || 0;
        const totalOverhead = editingProduct 
            ? ((editingProduct.apportioned_transport || 0) + (editingProduct.apportioned_labour || 0) + (editingProduct.apportioned_other || 0))
            : 0;
        const qty = Number(watch("quantity")) || editingProduct?.quantity || 1;
        const overheadPerUnit = totalOverhead / Math.max(qty, 1);
        
        const landedCost = baseCost + overheadPerUnit;
        
        if (!watchPrice || !watchCostPrice) {
            return { totalOverhead, overheadPerUnit, landedCost, baseCost, profit: null, margin: null };
        }
        
        const profit = Number(watchPrice) - landedCost;
        const margin = Number(watchPrice) > 0 ? (profit / Number(watchPrice)) * 100 : 0;
        
        return { profit, margin, landedCost, baseCost, overheadPerUnit, totalOverhead };
    };
    const profitStats = calculateProfit();

    const addToSellCart = (product: Product) => {
        if (product.status !== 'active') {
            alert("This product is still in Draft status. Please mark it as Active first.");
            return;
        }
        const existing = sellCart.find(c => c.product.id === product.id);
        if (existing) {
            setSellCart(prev => prev.map(c =>
                c.product.id === product.id
                    ? { ...c, quantity: Math.min(c.quantity + 1, product.quantity) }
                    : c
            ));
        } else {
            setSellCart(prev => [...prev, { product, quantity: 1 }]);
        }
        if (!isSellModalOpen) setIsSellModalOpen(true);
    };

    const updateCartItemQty = (productId: number, qty: number) => {
        if (qty <= 0) {
            setSellCart(prev => prev.filter(c => c.product.id !== productId));
        } else {
            setSellCart(prev => prev.map(c =>
                c.product.id === productId
                    ? { ...c, quantity: Math.min(qty, c.product.quantity) }
                    : c
            ));
        }
    };

    const removeFromCart = (productId: number) => {
        setSellCart(prev => prev.filter(c => c.product.id !== productId));
    };

    const cartSubtotal = sellCart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);
    const cartFinal = Math.max(0, cartSubtotal - sellDiscount);

    const handleQuickSell = async () => {
        if (sellCart.length === 0) return;
        for (const c of sellCart) {
            if (c.quantity > c.product.quantity) {
                alert(`Not enough stock for ${c.product.name}. Only ${c.product.quantity} available.`);
                return;
            }
        }
        setSelling(true);
        try {
            await createManualOrder({
                items: sellCart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
                discount: sellDiscount,
                payment_mode: sellPaymentMode,
                farmer_name: sellCustomerName
            } as any);
            await fetchProducts();
            setIsSellModalOpen(false);
            setSellCart([]);
            setSellCustomerName("");
            setSellDiscount(0);
            setSellPaymentMode("cash");
            // Navigate to orders page after sale
            router.push("/dashboard/shop/orders");
        } catch (error) {
            console.error("Failed to record sale:", error);
            alert("Failed to record sale");
        } finally {
            setSelling(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = activeCategory === "" ||
            p.category.toLowerCase() === activeCategory.toLowerCase();
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const groupedProducts = useMemo<ProductGroup[]>(() => {
        const groups: Record<string, ProductGroup> = {};

        filteredProducts.forEach(p => {
            const key = `${p.name}-${p.category}-${p.brand || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key, name: p.name, category: p.category,
                    brand: p.brand || "", manufacturer: p.manufacturer || "",
                    image_url: p.image_url || p.product_image_url || null,
                    totalQuantity: 0, unit: p.unit, batches: [],
                    weightedCost: 0, minPrice: p.price, maxPrice: p.price,
                    lowStockThreshold: p.low_stock_threshold ?? 10,
                    hasDraft: false, hasActive: false
                };
            }
            const g = groups[key];
            g.batches.push(p);
            g.totalQuantity += (p.quantity || 0);
            if (p.price < g.minPrice) g.minPrice = p.price;
            if (p.price > g.maxPrice) g.maxPrice = p.price;
            if (p.status === 'draft') g.hasDraft = true;
            if (p.status === 'active') g.hasActive = true;
        });

        Object.values(groups).forEach(g => {
            let totalCostVal = 0;
            g.batches.forEach(b => {
                const apportioned = (b.apportioned_transport || 0) + (b.apportioned_labour || 0) + (b.apportioned_other || 0);
                totalCostVal += ((b.cost_price || 0) + apportioned) * (b.quantity || 0);
            });
            g.weightedCost = g.totalQuantity > 0 ? totalCostVal / g.totalQuantity : 0;
        });

        return Object.values(groups);
    }, [filteredProducts]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const draftCount = products.filter(p => p.status === 'draft').length;
    const activeCount = products.filter(p => p.status === 'active').length;

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-4">

            {/* ── Workflow Banner (shows after saving a new product as draft) ── */}
            {savedProductName && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="font-semibold text-amber-800">✅ "{savedProductName}" saved as Draft</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                            Now go to <strong>Accounting</strong> to add delivery/transport costs → they'll be auto-distributed to this batch. Then come back and <strong>Mark as Active</strong>.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap"
                        onClick={() => { setSavedProductName(null); router.push("/dashboard/shop/accounting"); }}
                    >
                        <Receipt className="w-4 h-4 mr-1" /> Add Expenses →
                    </Button>
                    <button className="text-amber-400 hover:text-amber-600" onClick={() => setSavedProductName(null)}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Manage your products, stock, and pricing</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Product
                    </Button>
                </div>
            </div>

            {/* ── Filters & Search ── */}
            <div className="flex flex-wrap items-center gap-2">
                {([
                    { label: `All (${products.length})`, value: "all" },
                    { label: `📝 Draft (${draftCount})`, value: "draft" },
                    { label: `✅ Active (${activeCount})`, value: "active" },
                ] as const).map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            statusFilter === tab.value
                                ? tab.value === 'draft' ? "bg-amber-500 text-white border-amber-500"
                                : tab.value === 'active' ? "bg-green-600 text-white border-green-600"
                                : "bg-gray-800 text-white border-gray-800"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                    >{tab.label}</button>
                ))}
                <span className="mx-1 h-5 w-px bg-gray-200" />
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${
                            activeCategory === cat
                                ? "bg-green-600 text-white border-green-600"
                                : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                        }`}
                    >{cat}</button>
                ))}
                <div className="flex-1 min-w-[180px]" />
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search by name, category, brand..."
                        className="pl-10 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                    {/* Products Table */}
                    <Card>
                        <CardContent className="p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted text-muted-foreground font-medium border-b">
                                    <tr>
                                        <th className="px-6 py-3">Product Info</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3">Stock</th>
                                        <th className="px-6 py-3">Price (Sell / Cost)</th>
                                        <th className="px-6 py-3">Composition</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {groupedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                No products found.{activeCategory !== "" ? " Try changing the category filter." : " Add one to get started!"}
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedProducts.map((group) => {
                                            const isLowStock = group.totalQuantity < group.lowStockThreshold;
                                            const isExpanded = expandedGroups[group.id];
                                            return (
                                                <React.Fragment key={group.id}>
                                                    {/* ── Group Parent Row ── */}
                                                    <tr className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => toggleGroup(group.id)}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-gray-400 group-hover:text-green-600 transition-colors">
                                                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                                </div>
                                                                {group.image_url ? (
                                                                    <img src={group.image_url} alt={group.name} className="w-10 h-10 rounded object-cover border" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center border text-gray-400">
                                                                        <Package className="w-5 h-5" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                                                        {group.name}
                                                                        <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full border font-bold">
                                                                            {group.batches.length} Batch{group.batches.length > 1 ? 'es' : ''}
                                                                        </span>
                                                                        {group.hasDraft && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200 font-bold">📝 Has Drafts</span>}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">{group.brand}{group.manufacturer ? ` · ${group.manufacturer}` : ""}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 capitalize">
                                                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs border border-border">{group.category}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                                                                {group.totalQuantity} {group.unit}
                                                            </div>
                                                            {isLowStock && (
                                                                <div className="text-xs text-red-500 flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" /> Low Stock
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div>₹{group.minPrice === group.maxPrice ? group.minPrice.toLocaleString() : `${group.minPrice.toLocaleString()} - ${group.maxPrice.toLocaleString()}`}</div>
                                                            <div className="text-xs text-gray-400">Avg Cost: ₹{group.weightedCost.toFixed(2)}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {group.batches[0]?.main_composition ? (
                                                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                                                    {group.batches[0].main_composition}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openAddBatchModal(group);
                                                                    }}
                                                                    className="px-3 py-1.5 text-xs font-semibold border border-sky-300 text-sky-700 rounded-full bg-sky-50 hover:bg-sky-100 transition"
                                                                >
                                                                    + Add Batch
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* ── Batch Sub-Rows ── */}
                                                    {isExpanded && group.batches.map((product) => {
                                                        const totalOverhead = (product.apportioned_transport || 0) + (product.apportioned_labour || 0) + (product.apportioned_other || 0);
                                                        const landedCost = (product.cost_price || 0) + totalOverhead;
                                                        const profitPerUnit = Number(product.price || 0) - landedCost;
                                                        const isDraft = product.status === 'draft';
                                                        return (
                                                            <tr key={product.id} className={`hover:bg-emerald-50 transition-colors border-l-4 ${isDraft ? 'bg-amber-50/40 border-l-amber-400' : 'bg-emerald-50/30 border-l-emerald-400'}`}>
                                                                {/* Product Info: Batch + Mfg Date */}
                                                                <td className="px-6 py-3 pl-14">
                                                                    <div className="flex items-center gap-2">
                                                                        {isDraft ? (
                                                                            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">📝 DRAFT</span>
                                                                        ) : (
                                                                            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">✅ ACTIVE</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm font-medium text-gray-800 mt-0.5">Batch: {product.batch_number}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {product.manufacture_date ? `Mfg: ${new Date(product.manufacture_date).toLocaleDateString("en-IN")}` : 'No Mfg Date'}
                                                                    </div>
                                                                </td>
                                                                {/* Category: variety + manufacturer */}
                                                                <td className="px-6 py-3">
                                                                    <div className="text-xs font-medium text-gray-700">{product.brand || product.category}</div>
                                                                    <div className="text-[10px] text-gray-400">{product.manufacturer || '—'}</div>
                                                                </td>
                                                                {/* Stock */}
                                                                <td className="px-6 py-3 font-medium text-gray-700">
                                                                    {product.quantity} {product.unit}
                                                                </td>
                                                                {/* Price / Cost */}
                                                                <td className="px-6 py-3">
                                                                    <div className="font-medium" title="Selling Price">₹{product.price.toFixed(2)}</div>
                                                                    {product.cost_price && (
                                                                        <div className="text-xs text-gray-500" title="Cost Price">Base: ₹{product.cost_price.toFixed(2)}</div>
                                                                    )}
                                                                </td>
                                                                {/* Composition */}
                                                                <td className="px-6 py-3">
                                                                    <div className="flex flex-col items-end text-right">
                                                                        {totalOverhead > 0 ? (
                                                                            <>
                                                                                {product.quantity > 0 && (
                                                                                    <div className="text-[10px] text-orange-400 mb-1">Ovhd: ₹{(totalOverhead / product.quantity).toFixed(2)}/{product.unit || 'unit'}</div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="text-[10px] text-gray-400 mb-0.5">Batch Overhead</div>
                                                                                <div className="font-medium text-gray-400 text-xs mb-1">₹0.00</div>
                                                                            </>
                                                                        )}
                                                                        {Number(product.price) > 0 && (
                                                                            <div className={`font-bold text-sm ${profitPerUnit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                                ₹{profitPerUnit.toFixed(2)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {/* Actions */}
                                                                <td className="px-6 py-3 text-right border-l border-gray-100">
                                                                    <div className="flex justify-end gap-1.5 flex-wrap">
                                                                        {isDraft ? (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleMarkStatus(product, 'active'); }}
                                                                                disabled={markingStatus[product.id]}
                                                                                className="px-2 py-1 text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors flex items-center gap-1 text-xs font-bold border border-green-200"
                                                                                title="Mark as Active (ready for sale)"
                                                                            >
                                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                                {markingStatus[product.id] ? "..." : "Mark Active"}
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); addToSellCart(product); }}
                                                                                className="p-1.5 text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors flex items-center gap-1 text-xs font-bold"
                                                                                title="Add to Order"
                                                                                disabled={product.quantity <= 0}
                                                                            >
                                                                                <ShoppingCart className="w-3.5 h-3.5" /> SELL
                                                                            </button>
                                                                        )}
                                                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(product); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Edit Batch">
                                                                            <Pencil className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Delete Batch">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>

                {/* ── QUICK SELL CART SIDE PANEL ── */}
                {isSellModalOpen && (
                    <div className="w-80 bg-white border rounded-xl shadow-lg flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)', position: 'sticky', top: '80px', alignSelf: 'flex-start' }}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-green-600" /> Current Order
                            </h2>
                            <button onClick={() => setIsSellModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Add More Products link */}
                        <div className="px-4 pt-3 pb-1">
                            <button
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                                onClick={() => setIsSellModalOpen(false)}
                            >
                                <Plus className="w-3 h-3" /> Add more products from inventory
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {sellCart.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">Select products to sell</div>
                            ) : (
                                sellCart.map((item, index) => (
                                    <div key={`${item.product.id}-${index}`} className="flex justify-between items-center border-b pb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold truncate" title={item.product.name}>{item.product.name}</div>
                                            <div className="text-xs text-gray-500">₹{item.product.price} / {item.product.unit}</div>
                                            <div className="text-xs text-gray-400">Batch: {item.product.batch_number}</div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                            <Input
                                                type="number"
                                                className="w-16 h-7 text-center text-sm"
                                                value={item.quantity}
                                                onChange={(e) => updateCartItemQty(item.product.id, parseInt(e.target.value) || 0)}
                                                min="1"
                                                max={item.product.quantity}
                                            />
                                            <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}

                            {sellCart.length > 0 && (
                                <div className="space-y-3 border-t pt-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Customer Name (Optional)</Label>
                                        <Input
                                            placeholder="e.g. Ramesh"
                                            value={sellCustomerName}
                                            onChange={(e) => setSellCustomerName(e.target.value)}
                                            className="h-8 text-sm mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Discount (₹)</Label>
                                        <Input
                                            type="number"
                                            value={sellDiscount}
                                            onChange={(e) => setSellDiscount(parseFloat(e.target.value) || 0)}
                                            className="h-8 text-sm mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Payment Mode</Label>
                                        <select
                                            className="w-full h-8 px-2 text-sm border rounded-md mt-1"
                                            value={sellPaymentMode}
                                            onChange={(e) => setSellPaymentMode(e.target.value)}
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="upi">UPI</option>
                                            <option value="credit">Credit / Udhar</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
                            <div className="flex justify-between items-center mb-1 text-sm text-gray-600">
                                <span>Subtotal</span><span>₹{cartSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-3 text-sm text-red-500">
                                <span>Discount</span><span>- ₹{sellDiscount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-4 font-bold text-lg">
                                <span>Final Amount</span><span className="text-green-600">₹{cartFinal.toFixed(2)}</span>
                            </div>
                            <Button
                                onClick={handleQuickSell}
                                disabled={selling || sellCart.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 text-base font-semibold py-5 shadow-md"
                            >
                                {selling ? "Processing..." : "Complete Sale →"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Add/Edit Product Modal ── */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                title={editingProduct ? "Edit Product Batch" : lockedFields ? "Add Another Batch" : "Add New Product"}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 max-h-[85vh] overflow-y-auto">

                    {/* Photo upload */}
                    <div className="space-y-2">
                        <Label>Product Photo</Label>
                        <div
                            className="relative w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-green-400 transition-colors overflow-hidden bg-gray-50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(null); setValue("image_url", ""); }} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow">
                                        <X className="w-4 h-4 text-red-500" />
                                    </button>
                                </>
                            ) : (
                                <div className="text-center text-gray-400">
                                    <ImagePlus className="w-8 h-8 mx-auto mb-1" />
                                    <p className="text-sm">{uploading ? "Uploading..." : "Click to upload photo"}</p>
                                </div>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <input type="hidden" {...register("image_url")} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Product Name *</Label>
                            <Input
                                {...register("name", { required: true })}
                                placeholder="e.g. Paddy"
                                readOnly={Boolean(lockedFields?.name)}
                                className={lockedFields?.name ? "bg-gray-100 border-gray-200" : undefined}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Variety / Short Name</Label>
                            <Input
                                {...register("short_name")}
                                placeholder="e.g. Pusa Basmati 1"
                                readOnly={Boolean(lockedFields?.short_name)}
                                className={lockedFields?.short_name ? "bg-gray-100 border-gray-200" : undefined}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Brand</Label>
                            <Input
                                {...register("brand")}
                                placeholder="e.g. IFFCO"
                                readOnly={Boolean(lockedFields?.brand)}
                                className={lockedFields?.brand ? "bg-gray-100 border-gray-200" : undefined}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Manufacturer</Label>
                            <Input
                                {...register("manufacturer")}
                                placeholder="e.g. IFFCO Ltd."
                                readOnly={Boolean(lockedFields?.manufacturer)}
                                className={lockedFields?.manufacturer ? "bg-gray-100 border-gray-200" : undefined}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <select
                                {...register("category")}
                                className="w-full p-2 border rounded-md"
                                disabled={Boolean(lockedFields?.category)}
                            >
                                <option value="fertilizer">Fertilizer</option>
                                <option value="seeds">Seeds</option>
                                <option value="pesticides">Pesticides</option>
                                <option value="machinery">Machinery</option>
                                <option value="crop">Crop</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Batch Number *</Label>
                            <Input {...register("batch_number", { required: true })} placeholder="BATCH-001" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date of Manufacture</Label>
                            <Input type="date" {...register("manufacture_date")} />
                        </div>
                        <div className="space-y-2">
                            <Label>Main Composition</Label>
                            <Input
                                {...register("main_composition")}
                                placeholder="e.g. NPK 19:19:19"
                                readOnly={Boolean(lockedFields?.main_composition)}
                                className={lockedFields?.main_composition ? "bg-gray-100 border-gray-200" : undefined}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cost Price (Per Unit) *</Label>
                            <Input type="number" step="0.01" {...register("cost_price", { required: true, min: 0 })} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Batch Overhead (From Accounting)</Label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-medium">
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Transport:</span>
                                    <span className="text-slate-700 font-bold">₹{(editingProduct?.apportioned_transport || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Labour:</span>
                                    <span className="text-slate-700 font-bold">₹{(editingProduct?.apportioned_labour || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Other:</span>
                                    <span className="text-slate-700 font-bold">₹{(editingProduct?.apportioned_other || 0).toFixed(2)}</span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-200 flex justify-between text-xs text-indigo-700 font-bold">
                                    <span>Total Batch Overhead:</span>
                                    <span>₹{(profitStats?.totalOverhead || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-cyan-700 text-[10px] font-bold">
                                    <span>Overhead per Unit:</span>
                                    <span>₹{(profitStats?.overheadPerUnit || 0).toFixed(2)} / {watch("unit") || "unit"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Selling Price <span className="text-gray-400 font-normal text-[11px]">(Req. for Active)</span></Label>
                            <span 
                                className="text-[11px] text-blue-600 cursor-pointer hover:underline font-medium flex items-center gap-1"
                                onClick={() => {
                                    alert("To add delivery/overhead expenses:\n1. Click 'Save as Draft' below.\n2. Go to the Shop Accounting page.\n3. Add expenses to this batch.");
                                }}
                            >
                                + Need to add expenses?
                            </span>
                        </div>
                        <Input type="number" step="0.01" {...register("price", { min: 0 })} placeholder="0.00" />
                    </div>

                    {profitStats?.profit !== null && Number(watchPrice) > 0 && (
                        <div className="p-3 bg-blue-50/50 rounded-lg text-sm border border-blue-100 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-blue-800 font-medium text-xs">Landed Cost (Base + Overhead):</span>
                                <span className="text-slate-700 font-bold text-xs">₹{profitStats?.landedCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-blue-100/50">
                                <span className="text-blue-800 font-bold">Est. Profit per Unit:</span>
                                <span className={(profitStats?.profit ?? 0) >= 0 ? "text-green-600 font-black" : "text-red-600 font-black"}>
                                    ₹{(profitStats?.profit ?? 0).toFixed(2)} ({(profitStats?.margin ?? 0).toFixed(1)}% margin)
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Batch Qty <span className="text-gray-400 font-normal text-[11px]">(Req. for Active)</span></Label>
                            <Input type="number" {...register("quantity", { min: 0 })} placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <Label>Qty per Unit</Label>
                            <div className="flex gap-2">
                                <Input type="number" step="0.1" {...register("quantity_per_unit")} placeholder="e.g. 50" className="flex-1" />
                                <select {...register("measure_unit")} className="p-2 border rounded-md text-sm bg-white">
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                    <option value="pcs">pcs</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Unit (Display)</Label>
                            <select
                                {...register("unit", { required: true })}
                                className="w-full p-2 border rounded-md text-sm bg-white"
                                disabled={Boolean(lockedFields?.unit)}
                            >
                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Low Stock Alert Threshold</Label>
                        <Input type="number" {...register("low_stock_threshold")} placeholder="10" />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <textarea {...register("description")} className="w-full p-2 border rounded-md" rows={2} placeholder="Product description..." />
                    </div>

                    {/* Notes */}
                    {!editingProduct && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1.5 mt-2">
                            <p><strong>Option 1:</strong> Need to add transport/labour expenses? Click <strong className="font-semibold text-amber-900 border-b border-amber-300">Save as Draft</strong>, go to Accounting to add expenses, then Mark Active.</p>
                            <p><strong>Option 2:</strong> No other expenses? Enter Selling Price now and click <strong className="font-semibold text-amber-900 border-b border-amber-300">Save & Mark Active</strong>.</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button 
                            type="submit" 
                            onClick={() => setSubmitAction("draft")} 
                            variant="outline" 
                            className="flex-1 text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                        >
                            {editingProduct?.status === 'active' ? "Change to Draft" : (editingProduct ? "Update Draft" : "Save as Draft")}
                        </Button>
                        <Button 
                            type="submit" 
                            onClick={() => setSubmitAction("active")} 
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            {editingProduct?.status === 'active' ? "Update Product" : "Save & Mark Active"}
                        </Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
}
