"use client";

import React, { useRef, useState } from "react";
import { User, Upload, Building2, Store, CreditCard, MapPin, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";

interface ProfileFormProps {
    role: "mill" | "shop" | "customer" | "farmer";
    initialData?: any;
    onSaveSuccess?: () => void;
}

export const ProfileForm = ({ role, initialData, onSaveSuccess }: ProfileFormProps) => {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState(initialData?.profile_picture_url || "");
    const [isHideMode, setIsHideMode] = useState(true);
    const [relationType, setRelationType] = useState(initialData?.relation_type || "S/O");

    // Form refs
    const nameRef = useRef<HTMLInputElement>(null);
    const fatherRef = useRef<HTMLInputElement>(null);
    const licenseRef = useRef<HTMLInputElement>(null);
    const idRef = useRef<HTMLInputElement>(null);
    const houseRef = useRef<HTMLInputElement>(null);
    const streetRef = useRef<HTMLInputElement>(null);
    const villageRef = useRef<HTMLInputElement>(null);
    const mandalRef = useRef<HTMLInputElement>(null);
    const districtRef = useRef<HTMLInputElement>(null);
    const stateRef = useRef<HTMLInputElement>(null);
    const pinRef = useRef<HTMLInputElement>(null);
    const bankRef = useRef<HTMLInputElement>(null);
    const accRef = useRef<HTMLInputElement>(null);
    const ifscRef = useRef<HTMLInputElement>(null);
    const locationRef = useRef<HTMLInputElement>(null);
    const aadhaarRef = useRef<HTMLInputElement>(null);
    const panRef = useRef<HTMLInputElement>(null);

    const permHouseRef = useRef<HTMLInputElement>(null);
    const permStreetRef = useRef<HTMLInputElement>(null);
    const permVillageRef = useRef<HTMLInputElement>(null);
    const permMandalRef = useRef<HTMLInputElement>(null);
    const permDistrictRef = useRef<HTMLInputElement>(null);
    const permStateRef = useRef<HTMLInputElement>(null);
    const permPinRef = useRef<HTMLInputElement>(null);


    const maskValue = (val: string, showLast: number = 4) => {
        if (!val) return "";
        if (!isHideMode) return val;
        if (val.length <= showLast) return val;
        return "*".repeat(val.length - showLast) + val.slice(-showLast);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            const { data } = await api.post("/upload", formData);
            setImageUrl(data.url);
        } catch (err) {
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const profileData: any = {
            profile_picture_url: imageUrl,
            father_name: fatherRef.current?.value,
            relation_type: relationType,
            house_no: houseRef.current?.value,
            street: streetRef.current?.value,
            village: villageRef.current?.value,
            mandal: mandalRef.current?.value,
            district: districtRef.current?.value,
            state: stateRef.current?.value,
            pincode: pinRef.current?.value,
            bank_name: bankRef.current?.value,
            account_number: accRef.current?.value,
            ifsc_code: ifscRef.current?.value,
        };

        if (role === 'mill') {
            profileData.mill_name = nameRef.current?.value;
            profileData.mill_id = idRef.current?.value;
            profileData.license_number = licenseRef.current?.value;
            profileData.location_text = locationRef.current?.value;
            profileData.aadhaar_number = aadhaarRef.current?.value;
            profileData.pan_number = panRef.current?.value;
            profileData.perm_house_no = permHouseRef.current?.value;
            profileData.perm_street = permStreetRef.current?.value;
            profileData.perm_village = permVillageRef.current?.value;
            profileData.perm_mandal = permMandalRef.current?.value;
            profileData.perm_district = permDistrictRef.current?.value;
            profileData.perm_state = permStateRef.current?.value;
            profileData.perm_pincode = permPinRef.current?.value;
        } else if (role === 'shop') {
            profileData.shop_name = nameRef.current?.value;
            profileData.license_number = licenseRef.current?.value;
            profileData.location_text = locationRef.current?.value;
        } else if (role === 'customer') {
            profileData.id_number = idRef.current?.value;
        } else if (role === 'farmer') {
            profileData.farmer_id = idRef.current?.value;
            profileData.full_name = nameRef.current?.value;
            // Farmer backend expects some fields with different names in some places but we standardized in profile_routers
        }

        try {
            const specificEndpoint = role === 'mill' ? '/manufacturer/profile' :
                (role === 'shop' ? '/shop/profile' :
                    (role === 'customer' ? '/customer/profile' : '/farmer/profile'));
            await api.post(specificEndpoint, profileData);
            if (onSaveSuccess) onSaveSuccess();
            alert("Profile saved successfully!");
        } catch (err: any) {
            console.error(err);
            alert("Failed to save profile: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-muted-foreground/10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isHideMode ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {isHideMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-foreground">Hide Mode</h4>
                        <p className="text-xs text-muted-foreground">Mask sensitive ID and Bank details</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsHideMode(!isHideMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isHideMode ? 'bg-amber-500' : 'bg-green-500'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isHideMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-32 w-32 rounded-full border-4 border-muted bg-muted overflow-hidden relative">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-full w-full p-6 text-muted-foreground" />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs">
                                        Uploading...
                                    </div>
                                )}
                            </div>
                            <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                                <Upload className="h-4 w-4" />
                                Upload Photo
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                            </label>
                        </div>

                        <div className="flex-1 space-y-4 w-full">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                {role === 'mill' ? <Building2 className="h-5 w-5" /> : (role === 'shop' ? <Store className="h-5 w-5" /> : <User className="h-5 w-5" />)}
                                {role === 'mill' ? 'Mill' : (role === 'shop' ? 'Shop' : (role === 'farmer' ? 'Farmer' : 'Personal'))} Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(role === 'mill' || role === 'shop' || role === 'farmer') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-muted-foreground">
                                            {role === 'mill' ? 'Mill Name' : (role === 'shop' ? 'Shop Name' : 'Full Name')}
                                        </label>
                                        <input ref={nameRef} defaultValue={role === 'farmer' ? initialData?.full_name : initialData?.[`${role}_name`]} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                                    </div>
                                )}
                                {(role === 'mill' || role === 'shop') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-muted-foreground">License Number</label>
                                        <input
                                            ref={licenseRef}
                                            defaultValue={maskValue(initialData?.license_number)}
                                            onFocus={(e) => isHideMode && (e.target.value = initialData?.license_number || "")}
                                            required
                                            className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none"
                                        />
                                    </div>
                                )}
                                {(role === 'customer' || role === 'farmer') && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-muted-foreground">{role === 'farmer' ? 'Farmer ID' : 'ID Number (Aadhaar/PAN)'}</label>
                                        <input
                                            ref={idRef}
                                            defaultValue={maskValue(role === 'farmer' ? initialData?.farmer_id : initialData?.id_number)}
                                            onFocus={(e) => isHideMode && (e.target.value = (role === 'farmer' ? initialData?.farmer_id : initialData?.id_number) || "")}
                                            required
                                            className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-muted-foreground">Relation & Name</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={relationType} 
                                            onChange={(e) => setRelationType(e.target.value)}
                                            className="border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none text-sm w-24"
                                        >
                                            <option value="S/O">S/O</option>
                                            <option value="W/O">W/O</option>
                                            <option value="D/O">D/O</option>
                                        </select>
                                        <input 
                                            ref={fatherRef} 
                                            defaultValue={initialData?.father_name || initialData?.father_husband_name} 
                                            required 
                                            placeholder="Name of Father/Husband"
                                            className="flex-1 border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" 
                                        />
                                    </div>
                                </div>
                                {(role === 'mill' || role === 'shop') && (
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-semibold text-muted-foreground">Location / Landmark</label>
                                        <input ref={locationRef} defaultValue={initialData?.location_text} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" placeholder="e.g. Near Market Yard, Main Road" />
                                    </div>
                                )}
                                {role === 'mill' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-muted-foreground">Mill ID</label>
                                            <input ref={idRef} defaultValue={initialData?.mill_id} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" placeholder="e.g. MILL-12345" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-muted-foreground">Aadhaar Number</label>
                                            <input ref={aadhaarRef} defaultValue={initialData?.aadhaar_number} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" placeholder="1234 5678 9012" />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6 space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                        <MapPin className="h-5 w-5" />
                        Address Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">House No</label>
                            <input ref={houseRef} defaultValue={initialData?.house_no} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-semibold text-muted-foreground">Street</label>
                            <input ref={streetRef} defaultValue={initialData?.street} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">Village/City</label>
                            <input ref={villageRef} defaultValue={initialData?.village} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">Mandal/Block</label>
                            <input ref={mandalRef} defaultValue={initialData?.mandal} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">District</label>
                            <input ref={districtRef} defaultValue={initialData?.district} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">State</label>
                            <input ref={stateRef} defaultValue={initialData?.state} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">Pincode</label>
                            <input ref={pinRef} defaultValue={initialData?.pincode} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {role === 'mill' && (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                            <MapPin className="h-5 w-5" />
                            Permanent Address
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">House No</label>
                                <input ref={permHouseRef} defaultValue={initialData?.perm_house_no} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-muted-foreground">Street</label>
                                <input ref={permStreetRef} defaultValue={initialData?.perm_street} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">Village/City</label>
                                <input ref={permVillageRef} defaultValue={initialData?.perm_village} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">Mandal/Block</label>
                                <input ref={permMandalRef} defaultValue={initialData?.perm_mandal} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">District</label>
                                <input ref={permDistrictRef} defaultValue={initialData?.perm_district} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">State</label>
                                <input ref={permStateRef} defaultValue={initialData?.perm_state} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">Pincode</label>
                                <input ref={permPinRef} defaultValue={initialData?.perm_pincode} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-6 space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                        <CreditCard className="h-5 w-5" />
                        Bank Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">Bank Name</label>
                            <input ref={bankRef} defaultValue={initialData?.bank_name} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">Account Number</label>
                            <input
                                ref={accRef}
                                defaultValue={maskValue(initialData?.account_number)}
                                onFocus={(e) => isHideMode && (e.target.value = initialData?.account_number || "")}
                                required
                                className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-muted-foreground">IFSC Code</label>
                            <input ref={ifscRef} defaultValue={initialData?.ifsc_code} required className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" />
                        </div>
                        {role === 'mill' && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-muted-foreground">PAN Number</label>
                                <input ref={panRef} defaultValue={initialData?.pan_number} className="w-full border-2 rounded-xl p-2.5 bg-background text-foreground focus:border-primary outline-none" placeholder="ABCDE1234F" />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Button type="submit" disabled={loading} className="w-full py-6 text-lg font-bold">
                {loading ? 'Saving...' : 'Save Profile'}
            </Button>
        </form>
    );
};
