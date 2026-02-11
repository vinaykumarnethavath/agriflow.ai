"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Search, Package, AlertTriangle } from "lucide-react";
import { getMyProducts, updateProduct, deleteProduct, Product } from "@/lib/api";
import api from "@/lib/api"; // For create product
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export default function InventoryPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<Product>();

    // Watch for profit calculation
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

    const onSubmit = async (data: any) => {
        try {
            // Ensure numbers are numbers
            const payload = {
                ...data,
                price: parseFloat(data.price),
                quantity: parseInt(data.quantity),
                cost_price: data.cost_price ? parseFloat(data.cost_price) : undefined,
                user_id: user?.id
            };

            if (editingProduct) {
                await updateProduct(editingProduct.id, payload);
            } else {
                await api.post("/products/", payload);
            }
            fetchProducts();
            closeModal();
        } catch (error) {
            console.error("Failed to save product:", error);
            alert("Failed to save product. Check console.");
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
        reset({
            name: "",
            short_name: "",
            brand: "",
            category: "fertilizer",
            price: 0,
            cost_price: 0,
            quantity: 0,
            unit: "kg",
            batch_number: "",
            description: "",
            expiry_date: ""
        } as any);
        setIsModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        // Set form values
        Object.keys(product).forEach((key) => {
            setValue(key as any, (product as any)[key]);
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const calculateProfit = () => {
        if (!watchPrice || !watchCostPrice) return null;
        const profit = Number(watchPrice) - Number(watchCostPrice);
        const margin = (profit / Number(watchPrice)) * 100;
        return { profit, margin };
    };

    const profitStats = calculateProfit();

    if (loading) return <div className="p-8 text-center">Loading inventory...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
                    <p className="text-gray-500">Manage your products, stock, and pricing</p>
                </div>
                <Button onClick={openAddModal} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search by name, category, or brand..."
                    className="pl-10 max-w-md"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Products Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                            <tr>
                                <th className="px-6 py-3">Product Info</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Stock</th>
                                <th className="px-6 py-3">Price (Sell / Cost)</th>
                                <th className="px-6 py-3">Batch / Expiry</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No products found. Add one to get started!
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{product.name}</div>
                                            <div className="text-xs text-gray-500">{product.brand}</div>
                                        </td>
                                        <td className="px-6 py-4 capitalize">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`font-medium ${product.quantity < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                                {product.quantity} {product.unit}
                                            </div>
                                            {product.quantity < 10 && <div className="text-xs text-red-500 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> Low Stock</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>₹{product.price}</div>
                                            {product.cost_price && <div className="text-xs text-gray-400">Cost: ₹{product.cost_price}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <div>{product.batch_number}</div>
                                            {product.expiry_date && <div className="text-gray-500">Exp: {new Date(product.expiry_date).toLocaleDateString()}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(product)}>
                                                <Pencil className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingProduct ? "Edit Product" : "Add New Product"}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Product Name</Label>
                            <Input {...register("name", { required: true })} placeholder="e.g. Urea Fertilizer" />
                        </div>
                        <div className="space-y-2">
                            <Label>Brand / Manufacturer</Label>
                            <Input {...register("brand")} placeholder="e.g. IFFCO" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <select {...register("category")} className="w-full p-2 border rounded-md">
                                <option value="fertilizer">Fertilizer</option>
                                <option value="seeds">Seeds</option>
                                <option value="pesticides">Pesticides</option>
                                <option value="machinery">Machinery</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>Short Name (Alias)</Label>
                            <Input {...register("short_name")} placeholder="e.g. Urea" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Batch Number</Label>
                            <Input {...register("batch_number", { required: true })} placeholder="BATCH-001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date</Label>
                            <Input type="date" {...register("expiry_date")} />
                        </div>
                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <select {...register("unit")} className="w-full p-2 border rounded-md">
                                <option value="kg">kg</option>
                                <option value="liter">liter</option>
                                <option value="packet">packet</option>
                                <option value="bag">bag</option>
                                <option value="unit">unit</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                        <div className="space-y-2">
                            <Label>Cost Price (Your Buy Price)</Label>
                            <Input type="number" step="0.01" {...register("cost_price", { min: 0 })} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <Label>Selling Price</Label>
                            <Input type="number" step="0.01" {...register("price", { required: true, min: 0 })} placeholder="0.00" />
                        </div>
                        {profitStats && (
                            <div className="col-span-2 text-sm">
                                <span className={profitStats.profit > 0 ? "text-green-600" : "text-red-600"}>
                                    Est. Profit: ₹{profitStats.profit.toFixed(2)} ({profitStats.margin.toFixed(1)}%)
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Quantity (Stock)</Label>
                        <Input type="number" {...register("quantity", { required: true, min: 0 })} />
                    </div>

                    <div className="space-y-2">
                        <Label>Traceability Info (JSON/Text)</Label>
                        <Input {...register("traceability_json")} placeholder='{"origin": "Gujarat", "supplier": "AgroCorp"}' />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                        <Button type="submit" className="bg-green-600 hover:bg-green-700">
                            {editingProduct ? "Save Changes" : "Create Product"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
