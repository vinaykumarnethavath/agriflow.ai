"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { Crop, WeatherData } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Sprout, User, Plus, Trash2, ArrowRight, AlertTriangle,
    CloudRain, Sun, Wind, Droplets, Newspaper, Clock,
    PenSquare, Wallet, ShoppingCart, ChevronDown, ChevronUp, ShoppingBag,
    Eye, EyeOff, Calendar, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import MarketPriceWidget from "@/components/info/MarketPriceWidget";
import NewsWidget from "@/components/info/NewsWidget";

interface LandRecord {
    serial_number: string;
    area: number;
}

interface FarmerProfile {
    farmer_id: string;
    father_husband_name: string;
    gender?: string;
    relation_type?: string;
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

// Helper: Normalize area to base-40 (Acres.Guntas)
const normalizeLandArea = (area: number) => {
    let acres = Math.floor(area);
    let guntas = Math.round((area - acres) * 100);
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

// Handle Area Normalization on Blur
const handleAreaBlurEvent = (value: string, setter: (val: string) => void) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const normalized = normalizeLandArea(num);
    setter(normalized.toFixed(2));
};

// Handle Area Change with real-time capping (scroll/type: .39 max, then jumps to next acre)
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

export default function FarmerDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<FarmerProfile | null>(null);
    const [crops, setCrops] = useState<Crop[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [showProfileDetails, setShowProfileDetails] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [showPhotoModal, setShowPhotoModal] = useState(false);

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
    const [gender, setGender] = useState<string>("male");
    const [relationType, setRelationType] = useState<string>("son_of");

    // Add Crop State
    const [isAddCropOpen, setIsAddCropOpen] = useState(false);
    const [newCrop, setNewCrop] = useState({
        name: "",
        area: "",
        season: "Kharif",
        variety: "",
        sowing_date: new Date().toISOString().split("T")[0],
        expected_harvest_date: "",
        notes: ""
    });
    const [addingCrop, setAddingCrop] = useState(false);
    const [isLandEditOpen, setIsLandEditOpen] = useState(false);
    const [customActivities, setCustomActivities] = useState<{ text: string; daysLeft: number; type: string }[]>([]);
    const [showAddActivity, setShowAddActivity] = useState(false);
    const [newActivity, setNewActivity] = useState({ text: '', daysLeft: 7, type: 'custom' });

    const customActivitiesStorageKey = useMemo(() => {
        const userId = (user as any)?.id;
        return userId ? `custom_activities_farmer_${userId}` : "custom_activities_farmer";
    }, [user]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem(customActivitiesStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setCustomActivities(parsed);
                }
            }
        } catch {
            // ignore
        }
    }, [customActivitiesStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(customActivitiesStorageKey, JSON.stringify(customActivities));
        } catch {
            // ignore
        }
    }, [customActivities, customActivitiesStorageKey]);

    const handleCreateCrop = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingCrop(true);

        const areaValue = parseFloat(newCrop.area);
        if (isNaN(areaValue) || areaValue <= 0) {
            alert("Please enter a valid area.");
            setAddingCrop(false);
            return;
        }

        // Land utilization validation
        const currentTotalLand = calculateTotalLand();
        const currentActiveCropArea = calculateActiveArea();
        const availableLand = subtractLandArea(currentTotalLand, currentActiveCropArea);

        if (currentTotalLand > 0 && areaValue > availableLand) {
            alert(`Cannot add crop: Area (${formatLandArea(areaValue)} Ac) exceeds available land (${formatLandArea(availableLand)} Ac).\n\nTotal Land: ${formatLandArea(currentTotalLand)} Ac\nActive Crops: ${formatLandArea(currentActiveCropArea)} Ac\nAvailable: ${formatLandArea(availableLand)} Ac\n\nPlease reduce the crop area or update your land records.`);
            setAddingCrop(false);
            return;
        }

        const formatAsISO = (dateStr: string) => {
            if (!dateStr) return null;
            // If it already has time component, return as is
            if (dateStr.includes('T')) return dateStr.replace('Z', '');
            return `${dateStr}T00:00:00`;
        };

        const payload = {
            name: newCrop.name,
            area: areaValue,
            season: newCrop.season || "Kharif",
            variety: newCrop.variety || null,
            crop_type: "Other",
            sowing_date: formatAsISO(newCrop.sowing_date) || new Date().toISOString(),
            expected_harvest_date: formatAsISO(newCrop.expected_harvest_date),
            notes: newCrop.notes || null
        };

        try {
            console.log("Creating crop with payload:", payload);
            await api.post("/crops/", payload);
            setIsAddCropOpen(false);
            setNewCrop({
                name: "",
                area: "",
                season: "Kharif",
                variety: "",
                sowing_date: new Date().toISOString().split("T")[0],
                expected_harvest_date: "",
                notes: ""
            });
            fetchData();
        } catch (error: any) {
            console.error("Create crop error:", error.response?.data || error);
            const msg = error.response?.data?.detail
                ? (Array.isArray(error.response.data.detail)
                    ? error.response.data.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join("\n")
                    : error.response.data.detail)
                : "Failed to create crop. Please check all fields.";
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

            const cropsRes = await api.get("/crops/");
            setCrops(cropsRes.data);

            // Fetch weather
            try {
                const weatherRes = await api.get('/weather/');
                setWeather(weatherRes.data);
            } catch (e) {
                console.error("Failed to load weather", e);
            }

            setLastUpdated(new Date());
        } catch (err: any) {
            if (err.response?.status === 404) {
                setShowForm(true);
            } else {
                console.error("Error fetching data", err);
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
            gender: gender,
            relation_type: relationType,
            house_no: houseNoRef.current?.value || "",
            street: streetRef.current?.value || "",
            village: villageRef.current?.value || "",
            mandal: mandalRef.current?.value || "",
            district: districtRef.current?.value || "",
            state: stateRef.current?.value || "",
            country: countryRef.current?.value || "India",
            pincode: pincodeRef.current?.value || "",
            total_area: landRecords.reduce((acc, curr) => addLandArea(acc, curr.area || 0), 0),
            aadhaar_last_4: aadhaarRef.current?.value || "",
            bank_name: bankRef.current?.value || "",
            account_number: accRef.current?.value || "",
            ifsc_code: ifscRef.current?.value || "",
        };

        try {
            await api.post("/farmer/profile", data);

            // Sync land records using PUT to prevent duplication
            const validLandRecords = landRecords.filter(lr => lr.serial_number && lr.area > 0);
            if (validLandRecords.length > 0) {
                await api.put("/farmer/land-records", validLandRecords);
            }

            fetchData();
        } catch (err: any) {
            alert("Failed to save profile");
        }
    };

    const handleSubmitLandDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        const newTotalArea = landRecords.reduce((acc, curr) => addLandArea(acc, curr.area || 0), 0);
        const currentActiveCropArea = calculateActiveArea();

        if (newTotalArea > 0 && newTotalArea < currentActiveCropArea) {
            alert(`Total land area (${formatLandArea(newTotalArea)} Ac) cannot be less than your active crop area (${formatLandArea(currentActiveCropArea)} Ac). Please reduce crop area first.`);
            return;
        }

        const data = {
            full_name: profile.full_name || user?.full_name || "",
            profile_picture_url: profile.profile_picture_url || "",
            farmer_id: profile.farmer_id || "",
            father_husband_name: profile.father_husband_name || "",
            gender: profile.gender || "",
            relation_type: profile.relation_type || "",
            house_no: profile.house_no || "",
            street: profile.street || "",
            village: profile.village || "",
            mandal: profile.mandal || "",
            district: profile.district || "",
            state: profile.state || "",
            country: profile.country || "India",
            pincode: profile.pincode || "",
            total_area: landRecords.reduce((acc, curr) => addLandArea(acc, curr.area || 0), 0),
            aadhaar_last_4: profile.aadhaar_last_4 || "",
            bank_name: profile.bank_name || "",
            account_number: profile.account_number || "",
            ifsc_code: profile.ifsc_code || "",
        };

        try {
            await api.post("/farmer/profile", data);

            const validLandRecords = landRecords.filter(lr => lr.serial_number && lr.area > 0);
            if (validLandRecords.length > 0) {
                await api.put("/farmer/land-records", validLandRecords);
            } else {
                // If they cleared all records, pass empty array to delete all
                await api.put("/farmer/land-records", []);
            }

            setIsLandEditOpen(false);
            fetchData();
        } catch (err: any) {
            alert("Failed to update land details");
        }
    };

    // Helper: Get season from sowing date
    const getSeason = (sowingDate: string) => {
        const month = new Date(sowingDate).getMonth() + 1; // 1-12
        const year = new Date(sowingDate).getFullYear();
        if (month >= 6 && month <= 10) return `Kharif ${year}`;
        if (month >= 11 || month <= 2) return `Rabi ${year}`;
        return `Zaid ${year}`;
    };

    // Helper: Simple crop health based on days since sowing
    const getCropHealth = (sowingDate: string) => {
        const daysSinceSowing = Math.floor((Date.now() - new Date(sowingDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceSowing < 30) return { label: 'Healthy', color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' };
        if (daysSinceSowing < 90) return { label: 'Healthy', color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' };
        if (daysSinceSowing < 150) return { label: 'Monitor', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🟡' };
        return { label: 'Monitor', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '🟡' };
    };

    // Helper: Get upcoming activities
    const getUpcomingActivities = () => {
        const activities: { text: string; daysLeft: number; type: string }[] = [];
        activeCrops.forEach(crop => {
            if (crop.expected_harvest_date) {
                const daysLeft = Math.ceil((new Date(crop.expected_harvest_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (daysLeft > 0 && daysLeft <= 30) {
                    activities.push({ text: `Harvest ${crop.name} in ${daysLeft} days`, daysLeft, type: 'harvest' });
                }
            }
            // Simple fertilizer reminder: 45 days after sowing
            const daysSinceSowing = Math.floor((Date.now() - new Date(crop.sowing_date).getTime()) / (1000 * 60 * 60 * 24));
            const nextFertilizerDay = 45 - (daysSinceSowing % 45);
            if (nextFertilizerDay <= 7) {
                activities.push({ text: `Apply fertilizer to ${crop.name} in ${nextFertilizerDay} days`, daysLeft: nextFertilizerDay, type: 'fertilizer' });
            }
        });
        return activities.sort((a, b) => a.daysLeft - b.daysLeft);
    };

    // Computed values
    const farmerDisplayName = profile?.full_name || user?.full_name || "Farmer";
    const relationMap: { [key: string]: string } = { "son_of": "S/o", "wife_of": "W/o", "daughter_of": "D/o", "S/O": "S/o", "W/O": "W/o", "D/O": "D/o" };

    const relationLabel = relationMap[profile?.relation_type || ""] || profile?.relation_type || "S/o";
    const relationName = profile?.father_husband_name || "";
    const activeCrops = crops.filter(c => c.status === 'Growing');
    const activeCropNames = activeCrops.map(c => c.name);

    // Sum land records using base-40 logic
    const calculateTotalLand = () => {
        let total = 0;
        const records = profile?.land_records || [];
        records.forEach(lr => {
            total = addLandArea(total, lr.area || 0);
        });
        return total || profile?.total_area || 0;
    };

    const calculateActiveArea = () => {
        let total = 0;
        activeCrops.forEach(c => {
            total = addLandArea(total, c.area || 0);
        });
        return total;
    };

    const totalLandArea = calculateTotalLand();
    const activeCropArea = calculateActiveArea();
    const remainingLand = subtractLandArea(totalLandArea, activeCropArea);
    const utilizationPercent = totalLandArea > 0 ? Math.min((activeCropArea / totalLandArea) * 100, 100) : 0;
    const upcomingActivities = [...getUpcomingActivities(), ...customActivities].sort((a, b) => a.daysLeft - b.daysLeft);

    if (loading) return <div className="p-8 text-green-600 font-bold animate-pulse">Loading dashboard...</div>;

    // ─── PROFILE CREATION FORM ─────────────────────────────
    if (showForm && !profile) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 p-4">
                <div className="bg-card rounded-2xl border-2 border-green-100 shadow-xl overflow-hidden">
                    <div className="bg-green-600 p-6 text-white">
                        <div className="flex-1">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <User className="h-5 w-5 text-white" />
                                Complete Your Farmer Profile
                                <span className="text-xs font-normal text-green-100 ml-2">(Please provide your details)</span>
                            </h2>
                            <div className="h-0.5 w-16 bg-green-500 mt-1 mb-4"></div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmitProfile} className="p-8 space-y-8">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-green-900 border-l-4 border-green-500 pl-2">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Full Name</label>
                                    <input ref={fullNameRef} defaultValue={user?.full_name} required className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background" placeholder="Your Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Profile Picture</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                        />
                                        {uploadingImage && <span className="text-sm text-green-600 animate-pulse">Uploading...</span>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Farmer ID / Registration No.</label>
                                    <input ref={farmerIdRef} required className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background" placeholder="AGRI-123456" />
                                </div>
                                {/* Gender Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Gender</label>
                                    <div className="flex gap-4 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="gender" value="male" checked={gender === "male"} onChange={() => setGender("male")} className="accent-green-600 w-4 h-4" />
                                            <span className="text-sm font-medium text-muted-foreground">Male</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="gender" value="female" checked={gender === "female"} onChange={() => setGender("female")} className="accent-green-600 w-4 h-4" />
                                            <span className="text-sm font-medium text-muted-foreground">Female</span>
                                        </label>
                                    </div>
                                </div>
                                {/* Relation Type */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Relation Type</label>
                                    <select
                                        value={relationType}
                                        onChange={(e) => setRelationType(e.target.value)}
                                        className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background"
                                    >
                                        <option value="son_of">Son of (S/o)</option>
                                        <option value="wife_of">Wife of (W/o)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">{relationType === "wife_of" ? "Husband Name" : "Father Name"}</label>
                                    <input ref={fatherRef} required className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background" placeholder={relationType === "wife_of" ? "Husband's Name" : "Father's Name"} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Aadhaar Number</label>
                                    <input ref={aadhaarRef} required maxLength={12} className="w-full border-2 border-border rounded-xl p-3 focus:border-green-500 outline-none text-foreground bg-background" placeholder="Enter full 12-digit Aadhaar" />
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

                        {/* Land Records */}
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
                                        <label className="text-xs font-bold text-gray-500">Area (Acres.Guntas)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={lr.area}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (isNaN(val)) { handleLandChange(index, "area", 0); return; }
                                                const acres = Math.floor(val);
                                                const guntas = Math.round((val - acres) * 100);
                                                if (guntas >= 40) {
                                                    const normalized = normalizeLandArea(val);
                                                    handleLandChange(index, "area", normalized);
                                                } else {
                                                    handleLandChange(index, "area", val);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const normalized = normalizeLandArea(parseFloat(e.target.value));
                                                handleLandChange(index, "area", normalized);
                                            }}
                                            className="w-full border-2 border-white rounded-lg p-2 focus:border-green-500 outline-none text-black text-sm"
                                        />
                                        <p className="text-[10px] text-gray-400 italic">Max .39 guntas per acre</p>
                                    </div>
                                    <div className="col-span-2 pb-1">
                                        <Button type="button" onClick={() => handleRemoveLand(index)} variant="ghost" className="text-red-500 hover:bg-red-50 w-full">
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bank Details */}
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

    // ─── MAIN DASHBOARD ────────────────────────────────────
    return (
        <div className="space-y-6 p-2 max-w-5xl mx-auto">

            {/* ═══════════════════════════════════════════════════
                1. HEADER SECTION
               ═══════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Sprout size={100} />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {profile?.profile_picture_url ? (
                            <img
                                src={profile.profile_picture_url}
                                alt="Profile"
                                className="h-16 w-16 rounded-full border-4 border-white/30 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setShowPhotoModal(true)}
                            />
                        ) : (
                            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                                <User size={32} className="text-white" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-1">
                                {farmerDisplayName} 
                                {relationName && <span className="font-normal text-white/80 font-sans text-xl"> {relationLabel} {relationName}</span>}
                            </h1>
                            <div className="flex items-center gap-3">
                                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                                    🆔 {profile?.farmer_id}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                        <Button
                            onClick={() => setShowForm(true)}
                            variant="outline"
                            className="border-white/30 text-white hover:bg-white/20 bg-white/10 backdrop-blur-sm shadow-sm"
                        >
                            <PenSquare className="h-4 w-4 mr-2" />
                            Edit Profile
                        </Button>
                        <button
                            onClick={() => setShowProfileDetails(!showProfileDetails)}
                            className={`flex items-center gap-1.5 ${showProfileDetails ? 'bg-amber-400 text-amber-950' : 'bg-white/10 text-white/80 hover:text-white'} text-sm transition-all duration-300 font-bold px-4 py-2 rounded-md backdrop-blur-sm self-end shadow-lg border border-white/20`}
                            title={showProfileDetails ? 'Hide profile details' : 'Show profile details'}
                        >
                            {showProfileDetails ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                            {showProfileDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>
                </div>

                {showProfileDetails && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm animate-in slide-in-from-top-4 w-full border-t border-white/20 pt-6">
                        {/* Column 1: Land Details */}
                        <div className="bg-white/10 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-green-50 text-xs font-bold uppercase tracking-wider">🌾 Land Plots</p>
                                <button
                                    onClick={() => {
                                        setLandRecords(profile?.land_records && profile.land_records.length > 0 ? profile.land_records.map(lr => ({ serial_number: lr.serial_number || "", area: lr.area || 0 })) : [{ serial_number: "", area: 0 }]);
                                        setIsLandEditOpen(true);
                                    }}
                                    className="text-white/70 hover:text-white underline text-[10px] transition-colors"
                                >
                                    Edit
                                </button>
                            </div>
                            {profile?.land_records && profile.land_records.length > 0 ? (
                                <div className="space-y-1.5">
                                    {profile.land_records.map((lr, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-white bg-white/10 rounded-lg px-2 py-1.5">
                                            <span className="text-white/80">Khasra: {lr.serial_number}</span>
                                            <span className="font-bold">{formatLandArea(lr.area)} Ac</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-white/60 text-xs">No land records added.</p>
                            )}
                        </div>

                        {/* Column 2: Address */}
                        <div className="bg-white/10 rounded-xl p-4">
                            <p className="text-green-50 text-xs font-bold uppercase tracking-wider mb-3">📍 Address</p>
                            <div className="space-y-1 text-xs text-white">
                                {profile?.house_no && <p><span className="text-white/60">House:</span> {profile.house_no}</p>}
                                {profile?.street && <p><span className="text-white/60">Street:</span> {profile.street}</p>}
                                {profile?.village && <p><span className="text-white/60">Village:</span> {profile.village}</p>}
                                {profile?.mandal && <p><span className="text-white/60">Mandal:</span> {profile.mandal}</p>}
                                {profile?.district && <p><span className="text-white/60">District:</span> {profile.district}</p>}
                                {profile?.state && <p><span className="text-white/60">State:</span> {profile.state}</p>}
                                {profile?.pincode && <p><span className="text-white/60">PIN:</span> {profile.pincode}</p>}
                            </div>
                        </div>

                        {/* Column 3: Bank Details */}
                        <div className="bg-white/10 rounded-xl p-4">
                            <p className="text-green-50 text-xs font-bold uppercase tracking-wider mb-3">🏦 Bank Details</p>
                            <div className="space-y-1 text-xs text-white">
                                <p><span className="text-white/60">Bank:</span> <span className="font-bold">{profile?.bank_name || '—'}</span></p>
                                <p><span className="text-white/60">A/C:</span> {profile?.account_number?.replace(/\d(?=\d{4})/g, "*") || '—'}</p>
                                <p><span className="text-white/60">IFSC:</span> {profile?.ifsc_code || '—'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>



            {/* Photo Lightbox Modal */}
            {
                showPhotoModal && profile?.profile_picture_url && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                        onClick={() => setShowPhotoModal(false)}
                    >
                        <div className="relative max-w-lg max-h-[80vh]" onClick={e => e.stopPropagation()}>
                            <img
                                src={profile.profile_picture_url}
                                alt="Profile"
                                className="rounded-2xl shadow-2xl max-h-[80vh] object-contain"
                            />
                            <button
                                onClick={() => setShowPhotoModal(false)}
                                className="absolute -top-3 -right-3 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center shadow-lg font-bold hover:bg-gray-100"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )
            }

            {/* ═══════════════════════════════════════════════════
                 QUICK ACTION BUTTONS (Minimal)
               ═══════════════════════════════════════════════════ */}
            <div className="flex gap-3 overflow-x-auto pb-1">
                <Button
                    onClick={() => setIsAddCropOpen(true)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white rounded-full shadow-sm"
                >
                    <Plus className="h-4 w-4 mr-1" /> Add Crop
                </Button>
                <Link href="/dashboard/farmer/market">
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-md font-bold">
                        <ShoppingBag className="h-4 w-4 mr-1" /> Buy Fertilizer
                    </Button>
                </Link>
                <Link href="/dashboard/farmer/crops">
                    <Button size="sm" variant="outline" className="border-gray-200 text-gray-700 bg-white rounded-full hover:bg-gray-50">
                        <Wallet className="h-4 w-4 mr-1" /> Add Expense
                    </Button>
                </Link>
            </div>


            {/* ═══════════════════════════════════════════════════
                2. IMPORTANT ALERTS (from Weather)
               ═══════════════════════════════════════════════════ */}
            {
                weather && weather.alerts && weather.alerts.length > 0 && (
                    <div className="space-y-3">
                        {weather.alerts.map((alert, idx) => (
                            <div
                                key={idx}
                                className={`flex items-start gap-4 p-4 rounded-xl border-2 shadow-sm ${alert.type === 'warning'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-amber-50 border-amber-200'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${alert.type === 'warning' ? 'bg-red-100' : 'bg-amber-100'}`}>
                                    <AlertTriangle className={`h-6 w-6 ${alert.type === 'warning' ? 'text-red-600' : 'text-amber-600'}`} />
                                </div>
                                <div>
                                    <h4 className={`font-bold text-lg ${alert.type === 'warning' ? 'text-red-800' : 'text-amber-800'}`}>
                                        {alert.title}
                                    </h4>
                                    <p className={`text-sm ${alert.type === 'warning' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {alert.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }


            {/* ═══════════════════════════════════════════════════
                LAND UTILIZATION (Compact Bar)
               ═══════════════════════════════════════════════════ */}
            <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            📊 Land Utilization
                        </h3>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-green-700">{utilizationPercent.toFixed(0)}%</span>
                            <Button
                                onClick={() => {
                                    setLandRecords(profile?.land_records && profile.land_records.length > 0 ? profile.land_records.map(lr => ({ serial_number: lr.serial_number || "", area: lr.area || 0 })) : [{ serial_number: "", area: 0 }]);
                                    setIsLandEditOpen(true);
                                }}
                                variant="outline"
                                size="sm"
                                className="border-green-200 text-green-700 hover:bg-green-50"
                            >
                                <PenSquare className="h-3 w-3 mr-1" /> Edit Land
                            </Button>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
                        <div
                            className={`h-4 rounded-full transition-all duration-700 ${activeCropArea <= totalLandArea ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${utilizationPercent}%` }}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Total Land</p>
                            <p className="font-bold text-foreground">{formatLandArea(totalLandArea)} Ac</p>
                        </div>
                        <div className="bg-green-50/10 rounded-lg p-2 border border-green-500/20">
                            <p className="text-xs text-muted-foreground">Active Crops</p>
                            <p className="font-bold text-green-700 dark:text-green-500">{formatLandArea(activeCropArea)} Ac</p>
                        </div>
                        <div className="bg-amber-50/10 rounded-lg p-2 border border-amber-500/20">
                            <p className="text-xs text-muted-foreground">Available</p>
                            <p className={`font-bold ${remainingLand < 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-500'}`}>{formatLandArea(remainingLand)} Ac</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════
                CALENDAR / UPCOMING ACTIVITIES (Below Land Utilization)
               ═══════════════════════════════════════════════════ */}
            <Card className="border border-amber-200 shadow-sm bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-amber-600" /> Upcoming Activities
                        </h3>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={() => setShowAddActivity(!showAddActivity)}
                        >
                            <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                    </div>

                    {showAddActivity && (
                        <div className="mb-3 p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    placeholder="Activity name (e.g. Apply pesticide)"
                                    className="p-2 border rounded-md text-sm text-foreground bg-background"
                                    value={newActivity.text}
                                    onChange={(e) => setNewActivity({ ...newActivity, text: e.target.value })}
                                />
                                <input
                                    type="number"
                                    placeholder="Days from now"
                                    className="p-2 border rounded-md text-sm text-foreground bg-background"
                                    value={newActivity.daysLeft}
                                    onChange={(e) => setNewActivity({ ...newActivity, daysLeft: Number(e.target.value) })}
                                />
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 p-2 border rounded-md text-sm text-foreground bg-background"
                                        value={newActivity.type}
                                        onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                                    >
                                        <option value="harvest">🌾 Harvest</option>
                                        <option value="fertilizer">💧 Fertilizer</option>
                                        <option value="custom">📋 Custom</option>
                                    </select>
                                    <Button
                                        size="sm"
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                        onClick={() => {
                                            if (newActivity.text.trim()) {
                                                setCustomActivities(prev => [...prev, { ...newActivity }]);
                                                setNewActivity({ text: '', daysLeft: 7, type: 'custom' });
                                                setShowAddActivity(false);
                                            }
                                        }}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {upcomingActivities.length > 0 ? (
                        <div className="space-y-2">
                            {upcomingActivities.slice(0, 5).map((activity, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-lg border border-amber-100 dark:border-amber-800">
                                    <span className="text-lg">{activity.type === 'harvest' ? '🌾' : activity.type === 'fertilizer' ? '💧' : '📋'}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">{activity.text}</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">
                                        {activity.daysLeft}d
                                    </span>
                                    {activity.type === 'custom' && (
                                        <button
                                            onClick={() => {
                                                const idxInCustom = customActivities.findIndex(
                                                    (a) => a.type === 'custom' && a.text === activity.text && a.daysLeft === activity.daysLeft
                                                );
                                                if (idxInCustom >= 0) {
                                                    setCustomActivities((prev) => prev.filter((_, i) => i !== idxInCustom));
                                                }
                                            }}
                                            className="text-red-400 hover:text-red-600 text-xs"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No upcoming activities. Add one above!</p>
                    )}
                </CardContent>
            </Card>


            {/* ═══════════════════════════════════════════════════
                3. ACTIVE CROPS (Top 3)
               ═══════════════════════════════════════════════════ */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Sprout className="h-5 w-5 text-green-600" />
                        Active Crops
                    </h2>
                    <Link href="/dashboard/farmer/crops">
                        <Button variant="ghost" size="sm" className="text-green-700 hover:bg-green-50">
                            View All Crops <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                    </Link>
                </div>

                {activeCrops.length === 0 ? (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
                        <Sprout className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="font-medium">{crops.length === 0 ? 'No crops added yet.' : 'No active crops currently growing.'}</p>
                        <p className="text-sm mt-1">Start tracking your farming by adding a new crop.</p>
                        <Button onClick={() => setIsAddCropOpen(true)} className="mt-4 bg-green-600 hover:bg-green-700 text-white">
                            <Plus className="h-4 w-4 mr-2" /> Add Your First Crop
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {activeCrops.slice(0, 3).map(crop => (
                            <Link key={crop.id} href={`/dashboard/farmer/crops/${crop.id}`} className="block group">
                                <Card className="border border-gray-100 shadow-sm hover:shadow-lg hover:border-green-200 transition-all h-full">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-lg text-foreground group-hover:text-green-700 transition-colors">
                                                    <span className="mr-1.5">{crop.name.toLowerCase().includes('chili') || crop.name.toLowerCase().includes('chilli') ? '🌶️' :
                                                        crop.name.toLowerCase().includes('groundnut') || crop.name.toLowerCase().includes('peanut') ? '🥜' :
                                                            crop.name.toLowerCase().includes('rice') || crop.name.toLowerCase().includes('paddy') ? '🌾' :
                                                                crop.name.toLowerCase().includes('cotton') ? '☁️' :
                                                                    crop.name.toLowerCase().includes('wheat') ? '🌾' :
                                                                        crop.name.toLowerCase().includes('corn') || crop.name.toLowerCase().includes('maize') ? '🌽' :
                                                                            crop.name.toLowerCase().includes('tomato') ? '🍅' :
                                                                                crop.name.toLowerCase().includes('sugar') ? '🎋' :
                                                                                    crop.name.toLowerCase().includes('soybean') || crop.name.toLowerCase().includes('soya') ? '🫘' :
                                                                                        crop.name.toLowerCase().includes('onion') ? '🧅' :
                                                                                            crop.name.toLowerCase().includes('potato') ? '🥔' :
                                                                                                '🌿'}</span>
                                                    {crop.name}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">Sown on: {new Date(crop.sowing_date).toLocaleDateString()} • {crop.area} Acres</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
                                            <div>
                                                <p className="text-xs text-gray-400">Total Cost</p>
                                                <p className="font-bold text-gray-800">₹{(crop.total_cost || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">Revenue</p>
                                                <p className="font-bold text-gray-800">₹{(crop.total_revenue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between gap-2">
                                            {crop.expected_harvest_date ? (
                                                <div className="flex-1 bg-amber-50 text-amber-700 text-[11px] p-2 rounded-lg text-center font-bold border border-amber-100 truncate">
                                                    🌾 Harvest: {new Date(crop.expected_harvest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </div>
                                            ) : <div className="flex-1" />}
                                            <div className="bg-green-600 text-white p-2 rounded-lg group-hover:bg-green-700 transition-colors shadow-sm">
                                                <ArrowRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>




            {/* ═══════════════════════════════════════════════════
                5. MARKET PRICES (Active Crops Only)
               ═══════════════════════════════════════════════════ */}
            <div>
                <MarketPriceWidget filterCrops={activeCropNames} />
            </div>


            {/* ═══════════════════════════════════════════════════
                6. WEATHER (Compact)
               ═══════════════════════════════════════════════════ */}
            {
                weather && (
                    <Card className="bg-gradient-to-r from-blue-500 to-sky-600 text-white border-none shadow-lg overflow-hidden">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        {weather.condition?.toLowerCase().includes('rain') ? (
                                            <CloudRain className="h-8 w-8" />
                                        ) : weather.condition?.toLowerCase().includes('cloud') ? (
                                            <Wind className="h-8 w-8" />
                                        ) : (
                                            <Sun className="h-8 w-8" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black">{Math.round(weather.temperature || 0)}°</span>
                                            <span className="text-lg font-medium text-blue-100">{weather.condition}</span>
                                        </div>
                                        <p className="text-blue-100 text-sm flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {weather.humidity}%</span>
                                            <span className="flex items-center gap-1"><Wind className="h-3 w-3" /> {weather.wind_speed} km/h</span>
                                            {(weather.rainfall_mm || 0) > 0 && <span className="flex items-center gap-1"><CloudRain className="h-3 w-3" /> {weather.rainfall_mm}mm</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* Mini forecast */}
                                <div className="hidden md:flex gap-3">
                                    {weather.forecast && weather.forecast.slice(0, 3).map((day, idx) => (
                                        <div key={idx} className="text-center bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                                            <p className="text-xs text-blue-200">{day.day}</p>
                                            <p className="font-bold text-lg">{Math.round(day.temp || 0)}°</p>
                                            {(day.rain_prob || 0) > 30 && <p className="text-xs text-blue-200">🌧 {day.rain_prob}%</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Farmer Advice inside Weather card */}
                            {weather?.advice && weather.advice.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/20">
                                    <p className="text-xs font-bold text-blue-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <MessageSquare className="h-3.5 w-3.5" /> Today's Farming Tips
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {weather.advice.slice(0, 4).map((tip, idx) => (
                                            <div key={idx} className="flex items-start gap-2 bg-white/10 rounded-lg p-2.5">
                                                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-200 shrink-0" />
                                                <p className="text-xs text-blue-50 leading-relaxed">{tip}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            }
            {/* ═══════════════════════════════════════════════════
                8. AGRICULTURAL NEWS (Live, Past 15 Days)
               ═══════════════════════════════════════════════════ */}
            <div>
                <NewsWidget limit={10} />
            </div>


            {/* ═══════════════════════════════════════════════════
                ADD CROP MODAL
               ═══════════════════════════════════════════════════            {/* Add Crop Modal */}
            <Modal
                isOpen={isAddCropOpen}
                onClose={() => setIsAddCropOpen(false)}
                title="Add New Crop"
            >
                <form onSubmit={handleCreateCrop} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Crop Name</label>
                            <input
                                required
                                placeholder="e.g. Wheat, Rice, Cotton"
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                                value={newCrop.name}
                                onChange={(e) => setNewCrop({ ...newCrop, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Variety (Optional)</label>
                            <input
                                placeholder="e.g. Basmati, HYV, Local"
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                                value={newCrop.variety}
                                onChange={(e) => setNewCrop({ ...newCrop, variety: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Season</label>
                            <select
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800 bg-white"
                                value={newCrop.season}
                                onChange={(e) => setNewCrop({ ...newCrop, season: e.target.value })}
                            >
                                <option value="Kharif">Kharif (Rainy – Jun to Nov)</option>
                                <option value="Rabi">Rabi (Winter – Nov to Apr)</option>
                                <option value="Zaid">Zaid (Summer – Mar to Jun)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Area (Acres.Guntas)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0.00"
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                                value={newCrop.area}
                                onChange={(e) => handleAreaChangeEvent(e.target.value, (val) => setNewCrop({ ...newCrop, area: val }))}
                                onBlur={(e) => handleAreaBlurEvent(e.target.value, (val) => setNewCrop({ ...newCrop, area: val }))}
                            />
                            <p className="text-[10px] text-gray-500 italic">Max .39 guntas per acre (e.g. 1.39 → 2.00)</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Date of Sowing</label>
                            <input
                                type="date"
                                required
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                                value={newCrop.sowing_date}
                                onChange={(e) => setNewCrop({ ...newCrop, sowing_date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-800">Expected Harvest Date</label>
                            <input
                                type="date"
                                className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                                value={newCrop.expected_harvest_date}
                                onChange={(e) => setNewCrop({ ...newCrop, expected_harvest_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800">Notes (Optional)</label>
                        <textarea
                            placeholder="Any specific details..."
                            className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
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

            {/* Edit Land Details Modal */}
            <Modal
                isOpen={isLandEditOpen}
                onClose={() => setIsLandEditOpen(false)}
                title="Edit Land Details"
            >
                <form onSubmit={handleSubmitLandDetails} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
                            <h4 className="font-bold text-green-800">Total Land Area</h4>
                            <span className="font-bold text-green-700">
                                {formatLandArea(landRecords.reduce((acc, curr) => addLandArea(acc, curr.area || 0), 0))} Ac
                            </span>
                        </div>
                        {landRecords.map((record, index) => (
                            <div key={index} className="flex gap-4 items-end bg-gray-50 p-3 rounded-lg border">
                                <div className="flex-1 space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Khasra / Survey No.</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border-2 rounded-xl p-2.5 outline-none focus:border-green-500 text-black"
                                        value={record.serial_number}
                                        onChange={(e) => handleLandChange(index, "serial_number", e.target.value)}
                                        placeholder="e.g. 124/A"
                                    />
                                </div>
                                <div className="w-1/3 space-y-2">
                                    <label className="text-sm font-bold text-gray-700">Acres.Guntas</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full border-2 rounded-xl p-2.5 outline-none focus:border-green-500 text-black"
                                        value={record.area || ""}
                                        onChange={(e) => handleAreaChangeEvent(e.target.value, (val) => handleLandChange(index, "area", parseFloat(val) || 0))}
                                        onBlur={(e) => handleAreaBlurEvent(e.target.value, (val) => handleLandChange(index, "area", parseFloat(val) || 0))}
                                        placeholder="0.00"
                                    />
                                    <p className="text-[10px] text-gray-400 italic">Max .39 per acre</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleRemoveLand(index)}
                                    className="border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 h-[46px]"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddLand}
                            className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600 shadow-none"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Another Plot
                        </Button>
                    </div>

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-bold shadow-lg shadow-green-200 mt-6">
                        Save Land Details
                    </Button>
                </form>
            </Modal>

            {/* Edit Profile Modal */}
            {
                showForm && profile && (
                    <Modal
                        isOpen={showForm}
                        onClose={() => setShowForm(false)}
                        title="Edit Profile"
                    >
                        <form onSubmit={handleSubmitProfile} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                            <div className="grid grid-cols-2 gap-4 border-b pb-4 border-gray-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Full Name</label>
                                    <input ref={fullNameRef} defaultValue={profile.full_name || user?.full_name} required className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Farmer ID</label>
                                    <input ref={farmerIdRef} defaultValue={profile.farmer_id} required className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Relation Type</label>
                                    <select
                                        value={relationType}
                                        onChange={(e) => setRelationType(e.target.value)}
                                        className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    >
                                        <option value="S/O">Son of (S/o)</option>
                                        <option value="W/O">Wife of (W/o)</option>
                                        <option value="D/O">Daughter of (D/o)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">{relationType === "W/O" ? "Husband Name" : "Father Name"}</label>
                                    <input ref={fatherRef} defaultValue={profile.father_husband_name} required className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                            </div>

                            {/* Address Details */}
                            <div className="space-y-3 border-b pb-4 border-gray-100">
                                <h4 className="text-sm font-bold text-green-700 flex items-center gap-1">📍 Address Details</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">House No.</label>
                                        <input ref={houseNoRef} defaultValue={profile.house_no} className="w-full border rounded-lg p-2 text-sm" placeholder="#123" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Street</label>
                                        <input ref={streetRef} defaultValue={profile.street} className="w-full border rounded-lg p-2 text-sm" placeholder="Main Street" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Village</label>
                                        <input ref={villageRef} defaultValue={profile.village} required className="w-full border rounded-lg p-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Mandal</label>
                                        <input ref={mandalRef} defaultValue={profile.mandal} className="w-full border rounded-lg p-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Pincode</label>
                                        <input ref={pincodeRef} defaultValue={profile.pincode} className="w-full border rounded-lg p-2 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">District</label>
                                        <input ref={districtRef} defaultValue={profile.district} required className="w-full border rounded-lg p-2 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">State</label>
                                        <input ref={stateRef} defaultValue={profile.state} required className="w-full border rounded-lg p-2 text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="space-y-3 border-b pb-4 border-gray-100">
                                <h4 className="text-sm font-bold text-green-700 flex items-center gap-1">🏦 Bank Details</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">Bank Name</label>
                                        <input ref={bankRef} defaultValue={profile.bank_name} className="w-full border rounded-lg p-2 text-sm" placeholder="SBI" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500">IFSC Code</label>
                                        <input ref={ifscRef} defaultValue={profile.ifsc_code} className="w-full border rounded-lg p-2 text-sm" placeholder="SBIN0000" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Account Number</label>
                                    <input ref={accRef} defaultValue={profile.account_number} className="w-full border rounded-lg p-2 text-sm" placeholder="Account Number" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Aadhaar</label>
                                    <input ref={aadhaarRef} defaultValue={profile.aadhaar_last_4} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500" placeholder="Aadhaar" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">Profile Picture</label>
                                    <input type="file" accept="image/*" onChange={handleFileUpload}
                                        className="w-full border rounded-lg p-2 text-sm file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700"
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
                                Save Changes
                            </Button>
                        </form>
                    </Modal>
                )
            }
        </div >
    );
}
