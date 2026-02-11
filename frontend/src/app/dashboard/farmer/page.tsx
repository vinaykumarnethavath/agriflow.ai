"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudSun, Sprout, ShoppingBag, ShoppingCart, TrendingUp, User, MapPin, CreditCard, Plus, Trash2, ArrowRight, Brain } from "lucide-react";
import Link from "next/link";
import api, { Crop, getMarketTrends, getRecommendations, MarketTrend, CropRecommendation, getYieldTrend } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import WeatherBoard from "@/components/info/WeatherBoard";
import MarketPriceWidget from "@/components/info/MarketPriceWidget";
import NewsWidget from "@/components/info/NewsWidget";


interface LandRecord {
    serial_number: string;
    area: number;
}

interface FarmerProfile {
    farmer_id: string;
    father_husband_name: string;
    house_no?: string;
    street?: string;
    village?: string;
    mandal?: string;
    district?: string;
    state?: string;
    country: string;
    pincode?: string;
    total_area: number;
    aadhaar_last_4: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    land_records: LandRecord[];
    profile_picture_url?: string;
    full_name?: string;
}

export default function FarmerDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<FarmerProfile | null>(null);
    const [crops, setCrops] = useState<Crop[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Refs for the form
    const fullNameRef = useRef<HTMLInputElement>(null);
    const farmerIdRef = useRef<HTMLInputElement>(null);
    const fatherRef = useRef<HTMLInputElement>(null);
    const houseNoRef = useRef<HTMLInputElement>(null);
    const streetRef = useRef<HTMLInputElement>(null);
    const villageRef = useRef<HTMLInputElement>(null);
    const mandalRef = useRef<HTMLInputElement>(null);
    const districtRef = useRef<HTMLInputElement>(null);
    const stateRef = useRef<HTMLInputElement>(null);
    const countryRef = useRef<HTMLInputElement>(null);
    const pincodeRef = useRef<HTMLInputElement>(null);
    const aadhaarRef = useRef<HTMLInputElement>(null);
    const bankRef = useRef<HTMLInputElement>(null);
    const accRef = useRef<HTMLInputElement>(null);
    const ifscRef = useRef<HTMLInputElement>(null);

    const [landRecords, setLandRecords] = useState<LandRecord[]>([{ serial_number: "", area: 0 }]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // AI/ML Data
    const [marketTrends, setMarketTrends] = useState<MarketTrend[]>([]);
    const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);





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
            // Send null if date is empty string to match Optional[datetime]
            expected_harvest_date: newCrop.expected_harvest_date || null,
            sowing_date: newCrop.sowing_date || new Date().toISOString().split("T")[0]
        };

        try {
            await api.post("/crops", payload);
            setIsAddCropOpen(false);
            setNewCrop({
                name: "",
                area: "",
                sowing_date: new Date().toISOString().split("T")[0],
                expected_harvest_date: "",
                notes: ""
            });
            fetchData(); // Refresh list
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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const profileRes = await api.get("/farmer/profile");
            setProfile(profileRes.data);
            setShowForm(false);

            const cropsRes = await api.get("/crops");
            setCrops(cropsRes.data);

            // Fetch ML Data
            try {
                const trends = await getMarketTrends();
                setMarketTrends(trends);
                const recs = await getRecommendations();
                setRecommendations(recs);


            } catch (e) {
                console.error("Failed to load insights", e);
            }
        } catch (err: any) {
            if (err.response?.status === 404) {
                setShowForm(true); // Profile not found
            } else {
                console.error("Error fetching data", err);
                // setError("Failed to fetch dashboard data"); // Don't block whole UI
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddLand = () => {
        setLandRecords([...landRecords, { serial_number: "", area: 0 }]);
    };

    const handleRemoveLand = (index: number) => {
        const newRecords = landRecords.filter((_, i) => i !== index);
        setLandRecords(newRecords);
    };

    const handleLandChange = (index: number, field: keyof LandRecord, value: string | number) => {
        const newRecords = [...landRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setLandRecords(newRecords);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploadingImage(true);
        try {
            const { data } = await api.post("/upload", formData, {
                headers: { "Content-Type": undefined },
            });
            setUploadedImageUrl(data.url);
        } catch (err: any) {
            alert("Failed to upload image");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmitProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            full_name: fullNameRef.current?.value || user?.full_name || "",
            profile_picture_url: uploadedImageUrl || profile?.profile_picture_url || "",
            farmer_id: farmerIdRef.current?.value || "",
            father_husband_name: fatherRef.current?.value || "",
            house_no: houseNoRef.current?.value || "",
            street: streetRef.current?.value || "",
            village: villageRef.current?.value || "",
            mandal: mandalRef.current?.value || "",
            district: districtRef.current?.value || "",
            state: stateRef.current?.value || "",
            country: countryRef.current?.value || "India",
            pincode: pincodeRef.current?.value || "",
            total_area: landRecords.reduce((acc, curr) => acc + (curr.area || 0), 0),
            aadhaar_last_4: aadhaarRef.current?.value || "",
            bank_name: bankRef.current?.value || "",
            account_number: accRef.current?.value || "",
            ifsc_code: ifscRef.current?.value || "",
        };

        try {
            await api.post("/farmer/profile", data);
            for (const lr of landRecords) {
                if (lr.serial_number && lr.area > 0) {
                    await api.post("/farmer/land-records", lr);
                }
            }
            fetchData();
        } catch (err: any) {
            alert("Failed to save profile");
        }
    };

    const getFullAddress = () => {
        if (!profile) return "";
        return [profile.village, profile.mandal, profile.district, profile.state].filter(Boolean).join(", ");
    };

    if (loading) return <div className="p-8 text-green-600 font-bold animate-pulse">Loading dashboard...</div>;

    if (showForm) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 p-4">
                <div className="bg-white rounded-2xl border-2 border-green-100 shadow-xl overflow-hidden">
                    <div className="bg-green-600 p-6 text-white">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <User className="h-6 w-6" />
                            Complete Your Farmer Profile
                        </h2>
                        <p className="text-green-100 text-sm">Please provide your details to manage your crops and transactions.</p>
                    </div>

                    <form onSubmit={handleSubmitProfile} className="p-8 space-y-8">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-green-900 border-l-4 border-green-500 pl-2">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Full Name</label>
                                    <input ref={fullNameRef} defaultValue={user?.full_name} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="Your Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Profile Picture</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                        />
                                        {uploadingImage && <span className="text-sm text-green-600 animate-pulse">Uploading...</span>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Farmer ID / Registration No.</label>
                                    <input ref={farmerIdRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="AGRI-123456" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Father / Husband Name</label>
                                    <input ref={fatherRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="Father's Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Aadhaar (Last 4 Digits)</label>
                                    <input ref={aadhaarRef} required maxLength={4} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="XXXX" />
                                </div>
                            </div>
                        </div>

                        {/* Address Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-green-900 border-l-4 border-green-500 pl-2">Address Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">House / Flat No.</label>
                                    <input ref={houseNoRef} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="#123" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-bold text-gray-700">Street Name</label>
                                    <input ref={streetRef} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="Main Street" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Village</label>
                                    <input ref={villageRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="Village Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Mandal</label>
                                    <input ref={mandalRef} className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="Mandal" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">District</label>
                                    <input ref={districtRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="District" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">State</label>
                                    <input ref={stateRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="State" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Country</label>
                                    <input ref={countryRef} defaultValue="India" className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Pincode</label>
                                    <input ref={pincodeRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="500001" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-lg font-bold text-green-900 border-l-4 border-green-500 pl-2">Land Records</h3>
                                <Button type="button" onClick={handleAddLand} variant="outline" size="sm" className="text-green-600 border-green-200">
                                    <Plus className="h-4 w-4 mr-1" /> Add Land Piece
                                </Button>
                            </div>
                            {landRecords.map((lr, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="col-span-6 space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Serial No. / Khasra No.</label>
                                        <input
                                            value={lr.serial_number}
                                            onChange={(e) => handleLandChange(index, "serial_number", e.target.value)}
                                            className="w-full border-2 border-white rounded-lg p-2 focus:border-green-500 outline-none text-black text-sm"
                                            placeholder="e.g. 102/4"
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Area (in Acres)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={lr.area}
                                            onChange={(e) => handleLandChange(index, "area", parseFloat(e.target.value))}
                                            className="w-full border-2 border-white rounded-lg p-2 focus:border-green-500 outline-none text-black text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2 pb-1">
                                        <Button type="button" onClick={() => handleRemoveLand(index)} variant="ghost" className="text-red-500 hover:bg-red-50 w-full">
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-green-900 border-l-4 border-green-500 pl-2 border-b pb-2">Bank Account Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Bank Name</label>
                                    <input ref={bankRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="State Bank of India" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Account Number</label>
                                    <input ref={accRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="000000000000" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700">IFSC Code</label>
                                    <input ref={ifscRef} required className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-green-500 outline-none text-black" placeholder="SBIN0001234" />
                                </div>
                            </div>
                        </div>

                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold shadow-lg shadow-green-200">
                            Save Profile & Access Dashboard
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {profile?.profile_picture_url ? (
                        <img src={profile.profile_picture_url} alt="Profile" className="h-16 w-16 rounded-full border-4 border-green-100 object-cover" />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                            <User size={32} />
                        </div>
                    )}
                    <div>
                        <h1 className="text-4xl font-extrabold text-green-900 tracking-tight">Farmer Dashboard</h1>
                        <p className="text-gray-500 font-medium">Welcome back, {profile?.full_name || user?.full_name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="border-green-200 text-green-700 hover:bg-green-50">
                        <User className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                    <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                        <span className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                        Farmer ID: {profile?.farmer_id}
                    </div>
                </div>
            </div>

            {/* Profile Summary & My Crops Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <Card className="lg:col-span-1 border-none shadow-xl bg-gradient-to-br from-green-600 to-green-800 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Sprout size={120} />
                    </div>
                    <CardContent className="p-6 space-y-4">
                        {/* 1. Father/Husband Name */}
                        {profile?.father_husband_name && (
                            <div className="space-y-1">
                                <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Father / Husband Name</p>
                                <p className="text-xl font-bold text-white">{profile.father_husband_name}</p>
                            </div>
                        )}

                        {/* 2. Village/Address Details */}
                        <div className="space-y-1 pt-3 border-t border-white/10">
                            <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Village & Address</p>
                            <p className="text-green-50 text-sm font-medium">{getFullAddress()}</p>
                        </div>

                        {/* 3. Total Land Holding */}
                        <div className="space-y-1 pt-3 border-t border-white/10">
                            <p className="text-green-200 text-xs font-bold uppercase tracking-wider">Total Land Holding</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black">
                                    {(profile?.land_records?.reduce((sum, lr) => sum + (lr.area || 0), 0) || profile?.total_area || 0).toFixed(2)}
                                </span>
                                <span className="text-lg font-bold">Acres</span>
                            </div>
                        </div>

                        {/* 4. Active Land & Remaining Land */}
                        {(() => {
                            const totalLandArea = profile?.land_records?.reduce((sum, lr) => sum + (lr.area || 0), 0) || profile?.total_area || 0;
                            const activeCropArea = crops.filter(c => c.status === 'Growing').reduce((sum, c) => sum + (c.area || 0), 0);
                            const availableLand = totalLandArea - activeCropArea;
                            const isValid = activeCropArea <= totalLandArea;

                            return (
                                <div className={`space-y-2 pt-3 border-t border-white/10 ${!isValid ? 'bg-red-500/20 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
                                    <p className="text-green-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        Land Utilization
                                        {isValid ? (
                                            <span className="text-green-300 text-xs bg-green-500/30 px-2 py-0.5 rounded-full">✓ Valid</span>
                                        ) : (
                                            <span className="text-red-200 text-xs bg-red-500/50 px-2 py-0.5 rounded-full">⚠ Exceeds</span>
                                        )}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/10 rounded-lg p-2">
                                            <p className="text-green-200 text-xs">Active Crops</p>
                                            <p className="font-bold text-lg">{activeCropArea.toFixed(2)} Ac</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-2">
                                            <p className="text-green-200 text-xs">Remaining</p>
                                            <p className={`font-bold text-lg ${availableLand < 0 ? 'text-red-300' : ''}`}>{availableLand.toFixed(2)} Ac</p>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-white/20 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${isValid ? 'bg-green-300' : 'bg-red-400'}`}
                                            style={{ width: `${Math.min((activeCropArea / totalLandArea) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-green-200 text-xs text-center">{((activeCropArea / totalLandArea) * 100).toFixed(0)}% utilized</p>
                                </div>
                            );
                        })()}

                        {/* 5. Registered Land Details */}
                        {profile?.land_records && profile.land_records.length > 0 && (
                            <div className="space-y-2 pt-3 border-t border-white/10">
                                <p className="text-green-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="h-3 w-3" /> Registered Land Plots
                                </p>
                                <div className="bg-white/10 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-green-200 border-b border-white/10">
                                                <th className="text-left p-2">Khasra No.</th>
                                                <th className="text-right p-2">Area</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {profile.land_records.map((lr, idx) => (
                                                <tr key={idx} className="border-b border-white/5 last:border-0">
                                                    <td className="p-2 font-medium">{lr.serial_number}</td>
                                                    <td className="p-2 text-right">{lr.area} Ac</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 6. Bank Details */}
                        <div className="space-y-1 pt-3 border-t border-white/10">
                            <p className="text-green-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <CreditCard className="h-3 w-3" /> Bank Details
                            </p>
                            <p className="text-green-50 text-sm font-bold">{profile?.bank_name}</p>
                            <p className="text-green-200 text-xs">A/C: {profile?.account_number?.replace(/\d(?=\d{4})/g, "*")}</p>
                        </div>
                    </CardContent>
                </Card>




                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Weather Board (Detailed) */}
                    <div className="lg:col-span-2">
                        <WeatherBoard />
                    </div>

                    {/* Market Prices & News Grid */}
                    <div className="space-y-6">
                        <div className="h-[300px]">
                            <MarketPriceWidget />
                        </div>
                        <div className="h-[400px]">
                            <NewsWidget />
                        </div>
                    </div>
                </div>

                {/* My Crops Section */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Quick Actions */}
                    <div className="flex gap-3 mb-4">
                        <Link href="/dashboard/farmer/market">
                            <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg">
                                <ShoppingCart className="h-4 w-4 mr-2" /> Buy Fertilizers
                            </Button>
                        </Link>
                        <Link href="/dashboard/farmer/crops">
                            <Button variant="outline" className="border-green-200 hover:bg-green-50">
                                <Sprout className="h-4 w-4 mr-2" /> Manage Crops
                            </Button>
                        </Link>
                    </div>

                    {/* Market Trends Carousel */}
                    {marketTrends.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                                Market Trends (Live)
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {marketTrends.map((trend, idx) => (
                                    <Card key={idx} className="border-none shadow-md bg-white">
                                        <CardContent className="p-4">
                                            <p className="text-gray-500 text-xs font-bold uppercase">{trend.crop}</p>
                                            <h4 className="text-xl font-bold">₹{trend.price}/{trend.unit}</h4>
                                            <div className={`text-xs font-bold flex items-center gap-1 ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                                                {trend.trend === 'up' ? '▲' : trend.trend === 'down' ? '▼' : '•'}
                                                {Math.abs(trend.change)}%
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Crop Recommendations */}
                    {recommendations.length > 0 && (
                        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                            <h2 className="text-lg font-bold text-green-900 flex items-center gap-2 mb-3">
                                <Brain className="h-5 w-5 text-green-700" />
                                Recommended for this Season
                            </h2>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {recommendations.map((rec, idx) => (
                                    <div key={idx} className="min-w-[200px] bg-white p-3 rounded-lg shadow-sm border border-green-100">
                                        <p className="font-bold text-green-800">{rec.name}</p>
                                        <p className="text-xs text-green-600">{rec.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Sprout className="h-5 w-5 text-green-600" />
                            My Crops
                        </h2>
                        <Button
                            onClick={() => setIsAddCropOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Crop
                        </Button>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {crops.filter(c => c.status === 'Growing').length === 0 ? (
                            <div className="col-span-2 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                                <Sprout className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                                <p className="font-medium">{crops.length === 0 ? 'No crops added yet.' : 'No active crops.'}</p>
                                <p className="text-sm">{crops.length === 0 ? 'Start tracking your farming activities.' : 'Add a new crop or view all crops in My Crops page.'}</p>
                            </div>
                        ) : (
                            crops.filter(c => c.status === 'Growing').map(crop => (
                                <Link key={crop.id} href={`/dashboard/farmer/crops/${crop.id}`} className="block group">
                                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all group-hover:border-green-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-800 group-hover:text-green-700">{crop.name}</h3>
                                                <p className="text-sm text-gray-500">{crop.area} Acres</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${crop.status === 'Harvested' ? 'bg-purple-100 text-purple-700' :
                                                'bg-green-100 text-green-700'
                                                }`}>
                                                {crop.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs text-gray-400">
                                                Sown: {new Date(crop.sowing_date).toLocaleDateString()}
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>

                                        {/* Financial Snapshot */}
                                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs text-gray-400">Total Cost</p>
                                                <p className="font-bold text-gray-700">₹{(crop.total_cost || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">Revenue</p>
                                                <p className="font-bold text-gray-700">₹{(crop.total_revenue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div >
            </div >

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
                            <label className="text-sm font-medium text-gray-700">Harvest (Est.)</label>
                            <input
                                type="date"
                                required
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

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">


                {/* Local Stats */}
                <div className="space-y-6">
                    <Card className="border-none shadow-lg bg-blue-600 text-white">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-xl">
                                    <CloudSun size={28} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-blue-100 text-xs font-bold uppercase">Local Weather</p>
                                    <h4 className="text-2xl font-bold">28°C Sunny</h4>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Removed Static Market Price Card in favor of dynamic section above */}

                    <Link href="/dashboard/farmer/market" className="block">
                        <Button className="w-full py-8 bg-green-900 hover:bg-black text-white rounded-2xl flex flex-col gap-1 shadow-xl">
                            <ShoppingBag className="h-6 w-6" />
                            <span className="text-lg font-bold">Order Fertilizers</span>
                        </Button>
                    </Link>
                </div>
            </div>
        </div >
    );
}
