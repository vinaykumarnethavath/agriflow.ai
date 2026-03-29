"use client";

import React, { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle, ShoppingCart, ImagePlus, X } from "lucide-react";
import { getMyProducts, updateProduct, deleteProduct, Product, createManualOrder } from "@/lib/api";
import api from "@/lib/api"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["All", "fertilizer", "seeds", "pesticides", "machinery"];

interface ProductFormData extends Product {
    base_cost?: number;
    transport_cost?: number;
    labour_cost?: number;
    other_cost?: number;
}

export default function InventoryPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSellModalOpen, setIsSellModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [sellCart, setSellCart] = useState<{ product: Product; quantity: number }[]>([]);
    const [sellCustomerName, setSellCustomerName] = useState("");
    const [sellDiscount, setSellDiscount] = useState(0);
    const [sellPaymentMode, setSellPaymentMode] = useState("cash");
    const [selling, setSelling] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormData>();

    const watchPrice = watch("price");
    const watchBaseCost = watch("base_cost");
    const watchTransportCost = watch("transport_cost");
    const watchLabourCost = watch("labour_cost");
    const watchOtherCost = watch("other_cost");
    const watchQty = watch("quantity");

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
                headers: { "Content-Type": "multipart/form-type" },
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
            const baseCost = parseFloat(data.base_cost || 0);
            const transport = parseFloat(data.transport_cost || 0);
            const labour = parseFloat(data.labour_cost || 0);
            const other = parseFloat(data.other_cost || 0);
            const qty = parseInt(data.quantity || 1);
            
            const additionalCostPerUnit = (transport + labour + other) / (qty > 0 ? qty : 1);
            const finalCostPrice = baseCost + additionalCostPerUnit;

            const payload = {
                ...data,
                price: parseFloat(data.price),
                quantity: qty,
                cost_price: finalCostPrice,
                quantity_per_unit: data.quantity_per_unit ? parseFloat(data.quantity_per_unit as any) : undefined,
                measure_unit: data.measure_unit || "kg",
                low_stock_threshold: data.low_stock_threshold ? parseInt(data.low_stock_threshold as any) : 10,
                main_composition: data.main_composition || null,
                manufacture_date: (() => {
                    const d = data.manufacture_date ? new Date(data.manufacture_date) : null;
                    return d && !isNaN(d.getTime()) ? d.toISOString() : null;
                })(),
                user_id: user?.id
            };
            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
            } else {
                await api.post("/products/", payload);
            }
            fetchProducts();
            closeAddModal();
        } catch (error: any) {
            console.error("Failed to save product:", error);
            const detailMsg = error.response?.data?.detail ? (Array.isArray(error.response.data.detail) ? JSON.stringify(error.response.data.detail) : error.response.data.detail) : error.message;
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

    const openAddModal = () => {
        setEditingProduct(null);
        setPreviewUrl(null);
        reset({
            name: "", short_name: "", brand: "", manufacturer: "",
            category: "fertilizer", price: 0, cost_price: 0,
            base_cost: 0, transport_cost: 0, labour_cost: 0, other_cost: 0,
            quantity: 0, unit: "kg", quantity_per_unit: undefined,
            batch_number: "", description: "", main_composition: "" as any,
            manufacture_date: "" as any, low_stock_threshold: 10,
        } as any);
        setIsAddModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setPreviewUrl(product.image_url || product.product_image_url || null);
        Object.keys(product).forEach((key) => {
            setValue(key as any, (product as any)[key]);
        });
        setValue("base_cost", product.cost_price || 0);
        setValue("transport_cost", 0);
        setValue("labour_cost", 0);
        setValue("other_cost", 0);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => { setIsAddModalOpen(false); setEditingProduct(null); setPreviewUrl(null); };

    const calculateProfit = () => {
        if (!watchPrice) return null;
        const bCost = Number(watchBaseCost) || 0;
        const tCost = Number(watchTransportCost) || 0;
        const lCost = Number(watchLabourCost) || 0;
        const oCost = Number(watchOtherCost) || 0;
        const q = Number(watchQty) || 1;
        
        const additional = (tCost + lCost + oCost) / (q > 0 ? q : 1);
        const finalCost = bCost + additional;
        
        const profit = Number(watchPrice) - finalCost;
        const margin = Number(watchPrice) > 0 ? (profit / Number(watchPrice)) * 100 : 0;
        return { profit, margin, finalCost };
    };

    const profitStats = calculateProfit();

    const addToSellCart = (product: Product) => {
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
            alert("Sale recorded successfully!");
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
        const matchesCategory = activeCategory === "All" ||
            p.category.toLowerCase() === activeCategory.toLowerCase();
        return matchesSearch && matchesCategory;
    });

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 flex">
            <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
                        <p className="text-gray-500">Manage your products, stock, and pricing</p>
                    </div>
                    <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700">
                        <Plus className="w-4 h-4 mr-2" /> Add Product
                    </Button>
                </div>

                {/* Search & Category Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search by name, category, or brand..."
                            className="pl-10 w-72"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${activeCategory === cat
                                        ? "bg-green-600 text-white border-green-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

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
                                    <th className="px-6 py-3">Batch / Composition</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No products found.{activeCategory !== "All" ? ` Try changing the category filter.` : " Add one to get started!"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const isLowStock = product.quantity < (product.low_stock_threshold ?? 10);
                                        return (
                                            <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {(product.image_url || product.product_image_url) && (
                                                            <img src={product.image_url || product.product_image_url} alt={product.name} className="w-10 h-10 rounded object-cover border" />
                                                        )}
                                                        <div>
                                                            <div className="font-medium text-gray-900">{product.name}</div>
                                                            <div className="text-xs text-gray-500">{product.brand}{product.manufacturer ? ` · ${product.manufacturer}` : ""}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 capitalize">
                                                    <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs border border-border">{product.category}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                                                        {product.quantity} {product.unit}
                                                    </div>
                                                    {isLowStock && (
                                                        <div className="text-xs text-red-500 flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> Low Stock
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>₹{product.price}</div>
                                                    {product.cost_price && <div className="text-xs text-gray-400">Cost: ₹{product.cost_price}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium text-gray-700">
                                                    <div className="mb-1">Batch: <span className="font-bold">{product.batch_number}</span></div>
                                                    {product.main_composition && <div className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block">Comp: {product.main_composition}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => addToSellCart(product)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-100 flex items-center gap-1 text-xs font-bold"
                                                            title="Add to Order"
                                                            disabled={product.quantity <= 0}
                                                        >
                                                            <ShoppingCart className="w-4 h-4" /> SELL
                                                        </button>
                                                        <button onClick={() => openEditModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            {/* QUICK SELL CART SIDE PANEL */}
            {isSellModalOpen && (
                <div className="w-96 bg-white ml-6 border rounded-xl shadow-lg flex flex-col max-h-[calc(100vh-100px)] sticky top-6">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-green-600" /> Current Order
                        </h2>
                        <button onClick={() => setIsSellModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {sellCart.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">Select products to sell</div>
                        ) : (
                            sellCart.map((item, index) => (
                                <div key={`${item.product.id}-${index}`} className="flex justify-between items-center border-b pb-2">
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold truncate pr-2" title={item.product.name}>{item.product.name}</div>
                                        <div className="text-xs text-gray-500">₹{item.product.price} / {item.product.unit}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            className="w-16 h-8 text-center text-sm"
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
                            <div className="space-y-4 border-t pt-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Customer Name (Optional)</Label>
                                    <Input 
                                        placeholder="e.g. Ramesh" 
                                        value={sellCustomerName} 
                                        onChange={(e) => setSellCustomerName(e.target.value)} 
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Discount (₹)</Label>
                                    <Input 
                                        type="number" 
                                        value={sellDiscount} 
                                        onChange={(e) => setSellDiscount(parseFloat(e.target.value) || 0)} 
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Payment Mode</Label>
                                    <select 
                                        className="w-full h-8 px-2 text-sm border rounded-md" 
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
                            <span>Subtotal</span>
                            <span>₹{cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-3 text-sm text-red-500">
                            <span>Discount</span>
                            <span>- ₹{sellDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-4 font-bold text-lg">
                            <span>Final Amount</span>
                            <span className="text-green-600">₹{cartFinal.toFixed(2)}</span>
                        </div>
                        <Button 
                            onClick={handleQuickSell} 
                            disabled={selling || sellCart.length === 0} 
                            className="w-full bg-green-600 hover:bg-green-700 text-lg font-semibold py-6 shadow-md"
                        >
                            {selling ? "Processing..." : "Complete Sale"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Add/Edit Product Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                title={editingProduct ? "Edit Product" : "Add New Product"}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 max-h-[85vh] overflow-y-auto">

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
                            <Input {...register("name", { required: true })} placeholder="e.g. Urea Fertilizer" />
                        </div>
                        <div className="space-y-2">
                            <Label>Short Name (Alias)</Label>
                            <Input {...register("short_name")} placeholder="e.g. Urea" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Brand</Label>
                            <Input {...register("brand")} placeholder="e.g. IFFCO" />
                        </div>
                        <div className="space-y-2">
                            <Label>Manufacturer</Label>
                            <Input {...register("manufacturer")} placeholder="e.g. IFFCO Ltd." />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Category</Label>
                        <select {...register("category")} className="w-full p-2 border rounded-md">
                            <option value="fertilizer">Fertilizer</option>
                            <option value="seeds">Seeds</option>
                            <option value="pesticides">Pesticides</option>
                            <option value="machinery">Machinery</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Batch Number *</Label>
                            <Input {...register("batch_number", { required: true })} placeholder="BATCH-001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Date of Manufacture</Label>
                            <Input type="date" {...register("manufacture_date")} />
                        </div>
                        <div className="space-y-2">
                            <Label>Main Composition</Label>
                            <Input {...register("main_composition")} placeholder="e.g. NPK 19:19:19" />
                        </div>
                    </div>

                    {/* Cost Input: Base + Grouped Expenses */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                        <Label className="text-gray-800 font-bold mb-3 block">Cost Calculation (Per Batch)</Label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Base Cost / Item</Label>
                                <Input type="number" step="0.01" {...register("base_cost", { min: 0 })} placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Batch Transport</Label>
                                <Input type="number" step="0.01" {...register("transport_cost", { min: 0 })} placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Batch Labour</Label>
                                <Input type="number" step="0.01" {...register("labour_cost", { min: 0 })} placeholder="0.00" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Batch Other</Label>
                                <Input type="number" step="0.01" {...register("other_cost", { min: 0 })} placeholder="0.00" />
                            </div>
                        </div>
                        {profitStats && (
                            <div className="flex justify-between items-center text-sm pt-3 border-t">
                                <span className="text-gray-600 font-medium">Final Cost / Item (Calculated): <span className="text-emerald-700 font-bold">₹{profitStats.finalCost.toFixed(2)}</span></span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Selling Price *</Label>
                        <Input type="number" step="0.01" {...register("price", { required: true, min: 0 })} placeholder="0.00" />
                    </div>

                    {profitStats && Number(watchPrice) > 0 && (
                        <div className="p-3 bg-blue-50/50 rounded-lg text-sm border border-blue-100 flex justify-between">
                            <span className="text-blue-800 font-medium">Est. Profit per Item:</span>
                            <span className={profitStats.profit >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                ₹{profitStats.profit.toFixed(2)} ({profitStats.margin.toFixed(1)}% margin)
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Stock (Batch Qty) *</Label>
                            <Input type="number" {...register("quantity", { required: true, min: 0 })} placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <Label>Qty per Unit</Label>
                            <div className="flex gap-2">
                                <Input type="number" step="0.1" {...register("quantity_per_unit")} placeholder="e.g. 50" className="flex-1" />
                                <select {...register("measure_unit")} className="p-2 border rounded-md text-sm bg-white">
                                    <option value="g">g</option>
                                    <option value="L">L</option>
                                    <option value="ml">ml</option>
                                    <option value="kg">kg</option>
                                    <option value="pcs">pcs</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Unit (Display)</Label>
                            <Input {...register("unit", { required: true })} placeholder="e.g. kg, pieces" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Low Stock Alert Threshold</Label>
                        <Input type="number" {...register("low_stock_threshold")} placeholder="10" />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <textarea {...register("description")} className="w-full p-2 border rounded-md" rows={3} placeholder="Product description..."></textarea>
                    </div>

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                        {editingProduct ? "Update Product" : "Save Product"}
                    </Button>
                </form>
            </Modal>
        </div>
    );
}
