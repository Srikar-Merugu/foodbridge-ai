"use client";

import * as React from "react";
import { postRequest } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Phone,
    Building2,
    Heart,
    Loader2,
    ShieldCheck,
    CheckCircle2,
    ArrowRight,
    AlertCircle,
    User as UserIcon,
    Mail,
    FileText,
    UploadCloud
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { saveToken } from "@/lib/auth";
import { LocationPicker } from "@/components/shared/LocationPicker";



export default function CompleteProfilePage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
        }>
            <CompleteProfileContent />
        </React.Suspense>
    );
}

function CompleteProfileContent() {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryRole = searchParams ? searchParams.get("role") : null;



    const [formData, setFormData] = React.useState({
        name: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        address: "",
        pincode: "",
        role: queryRole === "ngo" ? "ngo" : "donor",
        ngoRegNo: "",
        description: "",
        donationPreferences: "",
        latitude: null as number | null,
        longitude: null as number | null,
        certificateUrl: "",
        idProofUrl: "",
    });
    const [uploadingDoc, setUploadingDoc] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [isActivated, setIsActivated] = React.useState(false);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        if (session === undefined) return;

        if (session?.user) {
            if (session.user.isProfileComplete) {
                if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
                    saveToken(`social-${session.user.id}`);
                }
                router.replace(`/dashboard/${session.user.role || 'donor'}`);
                return;
            }

            setFormData(prev => ({
                ...prev,
                name: session.user.name || prev.name,
                email: session.user.email || prev.email,
                role: queryRole === "ngo" ? "ngo" : (session.user.role || prev.role)
            }));
        }
    }, [session, router, queryRole]);


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingDoc(true);
        const uploadData = new FormData();
        uploadData.append('document', file);
        uploadData.append('type', type);

        try {
            const res = await fetch('/api/auth/upload-doc', { method: 'POST', body: uploadData });
            const data = await res.json();
            if (data.success) {
                if (type === 'certificate') setFormData(prev => ({ ...prev, certificateUrl: data.data.documentUrl }));
                if (type === 'id') setFormData(prev => ({ ...prev, idProofUrl: data.data.documentUrl }));
            } else {
                setError(data.message || 'Verification Document Upload failed');
            }
        } catch (err) {
            setError("Document upload failed due to network error.");
        } finally {
            setUploadingDoc(false);
        }
    };

    const handleLocationSelect = (loc: { lat: number; lng: number; address: string; city?: string; state?: string; pincode?: string }) => {
        setFormData(prev => ({
            ...prev,
            address: loc.address,
            city: loc.city || prev.city,
            state: loc.state || prev.state,
            pincode: loc.pincode || prev.pincode,
            latitude: loc.lat,
            longitude: loc.lng
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.role === 'ngo') {
            if (!formData.certificateUrl || !formData.idProofUrl) {
                setError("NGO verification documents (Registration Certificate & ID Proof) are completely mandatory for approval.");
                return;
            }
            if (!formData.latitude || !formData.longitude) {
                setError("Valid Google Maps Location address is strictly required to locate your NGO.");
                return;
            }
        }

        const emailToUse = formData.email || session?.user?.email;
        if (!emailToUse) {
            setError("Unable to identify your account email. Please try signing in again.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const res = await postRequest("/api/auth/complete-profile", {
                ...formData,
                email: emailToUse
            });
            if (res.success) {
                if (typeof window !== 'undefined') {
                    saveToken(`social-${session?.user?.id || 'new-oauth'}`);
                    localStorage.setItem('role', formData.role);
                }

                setIsActivated(true);
                setTimeout(() => {
                    window.location.href = `/dashboard/${formData.role}`;
                }, 1000);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-2xl mx-auto space-y-10">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-white shadow-xl mb-2">
                        {isActivated ? (
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
                        ) : (
                            <ShieldCheck className="w-10 h-10 text-blue-600" />
                        )}
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        {isActivated ? "Account Activated!" : "Complete Your Identity"}
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                        {isActivated ? "Synchronizing your secure connection..." : "Unlock access by providing your operational details"}
                    </p>
                </div>

                <div className="glass-card rounded-[3rem] bg-white p-12 shadow-2xl space-y-10">
                    <form onSubmit={handleSubmit} className="space-y-10">
                        {/* Role Selection */}
                        <div className="grid grid-cols-2 gap-6">
                            <RoleChoice
                                active={formData.role === "donor"}
                                onClick={() => setFormData({ ...formData, role: "donor" })}
                                icon={<Heart className="w-5 h-5" />}
                                title="Donor"
                            />
                            <RoleChoice
                                active={formData.role === "ngo"}
                                onClick={() => setFormData({ ...formData, role: "ngo" })}
                                icon={<Building2 className="w-5 h-5" />}
                                title="NGO Partner"
                            />
                        </div>

                        {formData.role === 'ngo' && (
                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl animate-in slide-in-from-top duration-300">
                                <h4 className="text-sm font-black text-indigo-900 flex items-center mb-1">
                                    <ShieldCheck className="w-4 h-4 mr-2" />
                                    NGO Verification Pending
                                </h4>
                                <p className="text-xs text-indigo-600 font-bold leading-relaxed">
                                    Your NGO account will be placed under Admin review securely. You cannot accept donations until our team approves your uploaded documents.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <InputField
                                label="Full Name"
                                icon={<UserIcon className="w-4 h-4" />}
                                placeholder="Your Name"
                                value={formData.name}
                                onChange={(val: string) => setFormData({ ...formData, name: val })}
                            />
                            <InputField
                                label="Email Address"
                                icon={<Mail className="w-4 h-4" />}
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={(val: string) => setFormData({ ...formData, email: val })}
                                disabled={true}
                            />

                            <InputField
                                label="Phone Number"
                                icon={<Phone className="w-4 h-4" />}
                                value={formData.phone}
                                onChange={(v: string) => setFormData({ ...formData, phone: v })}
                                placeholder="+91 98765 43210"
                            />

                            {formData.role === 'ngo' && (
                                <div className="md:col-span-2 animate-in slide-in-from-top duration-300 space-y-8">
                                    <hr className="border-slate-100" />

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-[0.2em] flex items-center">
                                            <UploadCloud className="w-4 h-4 text-slate-400 mr-2" />
                                            Verification Documents Phase 2
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border-2 border-slate-200 border-dashed rounded-xl p-6 bg-slate-50 relative focus-within:border-blue-500 focus-within:bg-blue-50 transition-all">
                                                <label className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 block">NGO Registration Certificate</label>
                                                <input type="file" onChange={(e) => handleFileUpload(e, 'certificate')} disabled={uploadingDoc} className="text-xs w-full mt-2 font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-all" accept="image/*,.pdf" />
                                                {formData.certificateUrl && <span className="text-emerald-500 font-black tracking-widest block mt-4 text-[10px] uppercase flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Certificate Safely Uploaded</span>}
                                            </div>
                                            <div className="border-2 border-slate-200 border-dashed rounded-xl p-6 bg-slate-50 relative focus-within:border-blue-500 focus-within:bg-blue-50 transition-all">
                                                <label className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2 block">Government Authorized ID</label>
                                                <input type="file" onChange={(e) => handleFileUpload(e, 'id')} disabled={uploadingDoc} className="text-xs w-full mt-2 font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-all" accept="image/*,.pdf" />
                                                {formData.idProofUrl && <span className="text-emerald-500 font-black tracking-widest block mt-4 text-[10px] uppercase flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Geo ID Authenticated</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <InputField
                                        label="NGO Registration Number"
                                        icon={<FileText className="w-4 h-4" />}
                                        placeholder="Reg No. (e.g. 12345/2024)"
                                        value={formData.ngoRegNo}
                                        onChange={(val: string) => setFormData({ ...formData, ngoRegNo: val })}
                                    />
                                    <InputField
                                        label="Organization Description"
                                        icon={<Heart className="w-4 h-4" />}
                                        placeholder="Our mission is to..."
                                        value={formData.description}
                                        onChange={(val: string) => setFormData({ ...formData, description: val })}
                                    />
                                </div>
                            )}

                            {formData.role === 'donor' && (
                                <div className="md:col-span-2 animate-in slide-in-from-top duration-300">
                                    <InputField
                                        label="Donation Preferences"
                                        icon={<Heart className="w-4 h-4" />}
                                        placeholder="e.g. Surplus food, fresh produce, bulk items..."
                                        value={formData.donationPreferences}
                                        onChange={(val: string) => setFormData({ ...formData, donationPreferences: val })}
                                    />
                                </div>
                            )}

                            <div className="md:col-span-2 pt-6">
                                <LocationPicker
                                    label="Operational Address"
                                    onLocationSelect={handleLocationSelect}
                                    initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude, address: formData.address } : undefined}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center space-x-3 italic">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-bold">{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || uploadingDoc}
                            className="w-full h-16 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white text-xl font-black shadow-2xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 disabled:grayscale disabled:opacity-50"
                        >
                            {loading || uploadingDoc ? <Loader2 className="w-6 h-6 animate-spin" /> : <><span>Activate Account</span> <ArrowRight className="w-6 h-6" /></>}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RoleChoice = ({ active, onClick, icon, title }: any) => (
    <button type="button" onClick={onClick} className={cn("p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center space-y-2", active ? "bg-blue-50 border-blue-600 shadow-xl" : "bg-slate-50 border-slate-100 hover:border-slate-200")}>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", active ? "bg-blue-600 text-white" : "bg-white text-slate-400")}>{icon}</div>
        <span className={cn("text-xs font-black uppercase tracking-widest", active ? "text-slate-900" : "text-slate-500")}>{title}</span>
    </button>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InputField = ({ label, icon, value, onChange, placeholder, action, type = "text", disabled = false }: any) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
                <span className="opacity-40 mr-2">{icon}</span>
                {label}
            </label>
            {action}
        </div>
        <Input
            type={type}
            className="h-14 rounded-2xl bg-white border-2 border-slate-900 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-black text-slate-900 disabled:opacity-50"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            required
        />
    </div>
);
