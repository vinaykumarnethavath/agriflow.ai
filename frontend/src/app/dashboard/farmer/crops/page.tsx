"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api, { Crop } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ArrowLeft, Plus, Sprout, ArrowRight } from "lucide-react";

export default function CropsListPage() {
    const router = useRouter();
    const [crops, setCrops] = useState<Crop[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Crop State
    const [isAddCropOpen, setIsAddCropOpen] = useState(false);
    const [newCrop, setNewCrop] = useState({
        name: "",
        area: "",
        sowing_date: new Date().toISOString().split("T")[0],
        expected_harvest_date: "",
        notes: ""
    });
    const [addingCrop, setAddingCrop] = useState(false);

    // Harvest State
    const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
    const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
    const [harvestData, setHarvestData] = useState({
        actual_yield: "",
        selling_price_per_unit: "",
        date: new Date().toISOString().split("T")[0]
    });
    const [submittingHarvest, setSubmittingHarvest] = useState(false);

    const activeCropsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchCrops();
    }, []);

    // Scroll to active crops section after loading
    useEffect(() => {
        if (!loading && crops.length > 0 && activeCropsRef.current) {
            setTimeout(() => {
                activeCropsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [loading, crops]);

    const fetchCrops = async () => {
        setLoading(true);
        try {
            const response = await api.get("/crops/");
            setCrops(response.data);
        } catch (error) {
            console.error("Error fetching crops:", error);
        } finally {
            setLoading(false);
        }
    };

    // Sort crops: Harvested/Sold first, then Growing
    const sortedCrops = [...crops].sort((a, b) => {
        const statusOrder: Record<string, number> = { 'Harvested': 0, 'Sold': 1, 'Growing': 2 };
        return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    });

    const harvestedCrops = sortedCrops.filter(c => c.status === 'Harvested' || c.status === 'Sold');
    const activeCrops = sortedCrops.filter(c => c.status === 'Growing');

    const handleCreateCrop = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingCrop(true);

        const areaValue = parseFloat(newCrop.area);
        if (isNaN(areaValue) || areaValue <= 0) {
            alert("Please enter a valid area.");
            setAddingCrop(false);
            return;
        }

        const payload = {
            ...newCrop,
            area: areaValue,
            expected_harvest_date: newCrop.expected_harvest_date || null,
            sowing_date: newCrop.sowing_date || new Date().toISOString().split("T")[0]
        };

        try {
            await api.post("/crops/", payload);
            setIsAddCropOpen(false);
            setNewCrop({
                name: "",
                area: "",
                sowing_date: new Date().toISOString().split("T")[0],
                expected_harvest_date: "",
                notes: ""
            });
            fetchCrops();
        } catch (error: any) {
            console.error("Create crop error:", error.response?.data || error);
            const msg = error.response?.data?.detail
                ? (Array.isArray(error.response.data.detail)
                    ? error.response.data.detail.map((e: any) => e.msg).join(", ")
                    : error.response.data.detail)
                : "Failed to create crop";
            alert(msg);
        } finally {
            setAddingCrop(false);
        }
    };

    const handleOpenHarvestModal = (crop: Crop) => {
        setSelectedCrop(crop);
        setHarvestData({
            actual_yield: crop.actual_yield?.toString() || "",
            selling_price_per_unit: crop.selling_price_per_unit?.toString() || "",
            date: crop.actual_harvest_date ? new Date(crop.actual_harvest_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
        });
        setIsHarvestModalOpen(true);
    };

    const handleRecordHarvest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCrop) return;
        setSubmittingHarvest(true);

        try {
            await api.post(`/farmer/crops/${selectedCrop.id}/harvest`, {
                actual_yield: parseFloat(harvestData.actual_yield),
                selling_price: parseFloat(harvestData.selling_price_per_unit),
                date: harvestData.date
            });
            setIsHarvestModalOpen(false);
            fetchCrops();
        } catch (error: any) {
            console.error("Harvest error:", error);
            alert("Failed to record harvest");
        } finally {
            setSubmittingHarvest(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-green-600 font-bold animate-pulse">Loading crops...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push("/dashboard/farmer")}>
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-green-900">My Crops</h1>
                        <p className="text-gray-500">Manage all your crops and track their progress</p>
                    </div>
                </div>
                <Button onClick={() => setIsAddCropOpen(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" /> Add New Crop
                </Button>
            </div>

            {/* Harvested/Sold Crops Section */}
            {harvestedCrops.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                        Harvested / Sold Crops ({harvestedCrops.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {harvestedCrops.map(crop => (
                            <Link key={crop.id} href={`/dashboard/farmer/crops/${crop.id}`} className="block group">
                                <Card className="h-full border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all opacity-80 hover:opacity-100">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-xl text-gray-800 group-hover:text-purple-700 transition-colors">
                                                    {crop.name}
                                                </h3>
                                                <p className="text-sm text-gray-500">{crop.area} Acres</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${crop.status === 'Harvested' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {crop.status}
                                            </span>
                                        </div>
                                        {/* Dates and Yield */}
                                        <div className="space-y-2 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Sowing Date:</span>
                                                <span className="font-medium">{new Date(crop.sowing_date).toLocaleDateString()}</span>
                                            </div>
                                            {crop.expected_harvest_date && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-purple-600 font-medium">Harvest Date:</span>
                                                    <span className="font-bold text-purple-700">{new Date(crop.expected_harvest_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                            {crop.actual_yield && (
                                                <div className="flex justify-between text-sm bg-purple-50 p-2 rounded-lg">
                                                    <span className="text-gray-500">Total Yield:</span>
                                                    <span className="font-bold text-purple-700">{crop.actual_yield} Bags</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-400">Total Cost</p>
                                                <p className="font-bold text-gray-700">₹{(crop.total_cost || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">Revenue</p>
                                                <p className="font-bold text-green-600">₹{(crop.total_revenue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-purple-600 hover:bg-purple-50"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleOpenHarvestModal(crop);
                                                }}
                                            >
                                                Edit Harvest
                                            </Button>
                                            <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Crops Section */}
            <div ref={activeCropsRef}>
                <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    Active Crops ({activeCrops.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {crops.length === 0 ? (
                        <div className="col-span-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                            <Sprout className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                            <h3 className="text-xl font-bold text-gray-700 mb-2">No crops added yet</h3>
                            <p className="text-gray-500 mb-4">Start tracking your farming activities by adding your first crop.</p>
                            <Button onClick={() => setIsAddCropOpen(true)} className="bg-green-600 hover:bg-green-700">
                                <Plus className="h-4 w-4 mr-2" /> Add Your First Crop
                            </Button>
                        </div>
                    ) : activeCrops.length === 0 ? (
                        <div className="col-span-3 bg-green-50 border-2 border-dashed border-green-200 rounded-xl p-8 text-center">
                            <Sprout className="h-12 w-12 mx-auto mb-3 text-green-400" />
                            <p className="font-medium text-green-700">No active crops currently</p>
                            <p className="text-sm text-green-600 mb-4">All your crops have been harvested!</p>
                            <Button onClick={() => setIsAddCropOpen(true)} className="bg-green-600 hover:bg-green-700">
                                <Plus className="h-4 w-4 mr-2" /> Add New Crop
                            </Button>
                        </div>
                    ) : (
                        activeCrops.map(crop => (
                            <Link key={crop.id} href={`/dashboard/farmer/crops/${crop.id}`} className="block group">
                                <Card className="h-full border-green-100 hover:border-green-300 hover:shadow-lg transition-all bg-gradient-to-br from-green-50/50 to-white">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-xl text-gray-800 group-hover:text-green-700 transition-colors">
                                                    {crop.name}
                                                </h3>
                                                <p className="text-sm text-gray-500">{crop.area} Acres</p>
                                            </div>
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                {crop.status}
                                            </span>
                                        </div>
                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Sowing Date:</span>
                                                <span className="font-medium">{new Date(crop.sowing_date).toLocaleDateString()}</span>
                                            </div>
                                            {crop.expected_harvest_date && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-500">Expected Harvest:</span>
                                                    <span className="font-medium">{new Date(crop.expected_harvest_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-400">Total Cost</p>
                                                <p className="font-bold text-gray-700">₹{(crop.total_cost || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">Expected Revenue</p>
                                                <p className="font-bold text-gray-700">₹{(crop.total_revenue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-green-600 border-green-200 hover:bg-green-50"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleOpenHarvestModal(crop);
                                                }}
                                            >
                                                Record Harvest
                                            </Button>
                                            <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Harvest Modal */}
            <Modal
                isOpen={isHarvestModalOpen}
                onClose={() => setIsHarvestModalOpen(false)}
                title={`Record Harvest for ${selectedCrop?.name}`}
            >
                <form onSubmit={handleRecordHarvest} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Actual Yield (Quintals)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                                value={harvestData.actual_yield}
                                onChange={(e) => setHarvestData({ ...harvestData, actual_yield: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Harvest Date</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                                value={harvestData.date}
                                onChange={(e) => setHarvestData({ ...harvestData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Selling Price (Per Quintal)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">₹</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full border rounded-lg p-2 pl-7 outline-none focus:ring-2 focus:ring-green-500"
                                    value={harvestData.selling_price_per_unit}
                                    onChange={(e) => setHarvestData({ ...harvestData, selling_price_per_unit: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Total Revenue:</span>
                            <span className="font-bold text-blue-900">
                                ₹{((parseFloat(harvestData.actual_yield) || 0) * (parseFloat(harvestData.selling_price_per_unit) || 0)).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-red-600">Total Cost:</span>
                            <span className="font-bold text-red-700">
                                - ₹{(selectedCrop?.total_cost || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="pt-2 border-t border-blue-200 flex justify-between font-bold">
                            <span className="text-blue-900">Estimated Profit:</span>
                            <span className={`${((parseFloat(harvestData.actual_yield) || 0) * (parseFloat(harvestData.selling_price_per_unit) || 0) - (selectedCrop?.total_cost || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{(((parseFloat(harvestData.actual_yield) || 0) * (parseFloat(harvestData.selling_price_per_unit) || 0)) - (selectedCrop?.total_cost || 0)).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={submittingHarvest}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                    >
                        {submittingHarvest ? "Recording..." : "Record Harvest & Close Crop"}
                    </Button>
                </form>
            </Modal>

            {/* Add Crop Modal */}
            <Modal
                isOpen={isAddCropOpen}
                onClose={() => setIsAddCropOpen(false)}
                title="Add New Crop"
            >
                <form onSubmit={handleCreateCrop} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Crop Name</label>
                        <input
                            required
                            placeholder="e.g. Wheat, Rice, Cotton"
                            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                            value={newCrop.name}
                            onChange={(e) => setNewCrop({ ...newCrop, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Area (Acres)</label>
                        <input
                            type="number"
                            step="0.1"
                            required
                            placeholder="0.0"
                            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                            value={newCrop.area}
                            onChange={(e) => setNewCrop({ ...newCrop, area: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Sowing Date</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                                value={newCrop.sowing_date}
                                onChange={(e) => setNewCrop({ ...newCrop, sowing_date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Expected Harvest</label>
                            <input
                                type="date"
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                                value={newCrop.expected_harvest_date}
                                onChange={(e) => setNewCrop({ ...newCrop, expected_harvest_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                        <textarea
                            placeholder="Any specific details..."
                            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500"
                            value={newCrop.notes}
                            onChange={(e) => setNewCrop({ ...newCrop, notes: e.target.value })}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={addingCrop}
                        className="w-full bg-green-600 hover:bg-green-700 text-white mt-4"
                    >
                        {addingCrop ? "Adding..." : "Add Crop"}
                    </Button>
                </form>
            </Modal>
        </div>
    );
}
