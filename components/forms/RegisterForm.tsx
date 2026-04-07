"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postRequest } from "@/lib/apiClient";
import { useSearchParams, useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building2,
  Heart,
  Globe,
  Navigation,
  Phone,
  CheckCircle2,
  FileText,
  Upload,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { LocationPicker } from "@/components/shared/LocationPicker";

export const RegisterForm = () => {
  const searchParams = useSearchParams();
  
  if (!searchParams) return null;

  const router = useRouter();
  const queryRole = searchParams.get("role");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: queryRole === "ngo" ? "ngo" : "donor",
    address: "",
    city: "",
    state: "",
    pincode: "",
    ngoRegNo: "",
    category: "",
    contactPhone: "",
    latitude: null as number | null,
    longitude: null as number | null,
    certificateUrl: "",
    idProofUrl: ""
  });
  const [docs, setDocs] = useState({
    certificate: null as File | null,
    idProof: null as File | null
  });
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [isSandbox, setIsSandbox] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (queryRole === "ngo" || queryRole === "donor") {
      setFormData(prev => ({ ...prev, role: queryRole }));
    }
  }, [queryRole]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

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

  const handleSendOtp = async () => {
    if (!formData.email) {
      setError("Please enter your email address first.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await postRequest("/api/auth/send-otp", { email: formData.email });
      if (res.success) {
        setIsOtpSent(true);
        setError("");
        setResendTimer(30); // 30s cooldown

        if (res.data?.isSandbox) {
          setIsSandbox(true);
          setDebugOtp(res.data.debugOtp || "123456");
        } else {
          setIsSandbox(false);
          setDebugOtp("");
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send OTP";
      setError(errorMsg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return;
    setOtpLoading(true);
    try {
      const res = await postRequest("/api/auth/verify-otp", { email: formData.email, otp });
      if (res.success) {
        setIsEmailVerified(true);
        setIsOtpSent(false);
        setError("");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Invalid OTP";
      setError(errorMsg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // --- NGO Document Checks ---
    if (formData.role === "ngo") {
      if (!docs.certificate || !docs.idProof) {
        setError("Please upload all required verification documents.");
        setLoading(false);
        return;
      }
    }

    // --- Client Side Validation ---
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!isEmailVerified) {
      setError("Please verify your email address using OTP first.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    if (formData.role === "ngo" && !formData.category) {
      setError("Please select an NGO category.");
      setLoading(false);
      return;
    }

    // Pincode validation (numeric and standard length)
    if (formData.pincode && !/^\d{5,6}$/.test(formData.pincode)) {
      setError("Please enter a valid 5 or 6 digit Pincode / Zip.");
      setLoading(false);
      return;
    }

    try {
      const finalFormData = { ...formData };

      // Handle NGO Document Uploads
      if (formData.role === "ngo") {
        setLoading(true); // Redundant but safe
        try {
          // 1. Upload Certificate
          const certData = new FormData();
          certData.append("document", docs.certificate!);
          certData.append("type", "certificate");
          const certRes = await fetch("/api/auth/upload-doc", { method: "POST", body: certData });
          const certResult = await certRes.json();
          if (!certResult.success) throw new Error("Certificate upload failed");

          // 2. Upload ID Proof
          const idData = new FormData();
          idData.append("document", docs.idProof!);
          idData.append("type", "idproof");
          const idRes = await fetch("/api/auth/upload-doc", { method: "POST", body: idData });
          const idResult = await idRes.json();
          if (!idResult.success) throw new Error("ID Proof upload failed");

          finalFormData.certificateUrl = certResult.data.documentUrl;
          finalFormData.idProofUrl = idResult.data.documentUrl;
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : "Document upload failed");
          setLoading(false);
          return;
        }
      }

      const result = await postRequest("/api/auth/register", finalFormData);
      if (result.success) {
        router.push("/login?registered=true");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={formRef} className="glass-card rounded-[2rem] sm:rounded-[3rem] border-none p-6 sm:p-10 lg:p-16 bg-white shadow-[0_32px_120px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden w-full max-w-4xl mx-auto">
      <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-48 sm:h-48 bg-primary/5 rounded-tr-full -ml-12 -mb-12 sm:-ml-16 sm:-mb-16 pointer-events-none" />

      <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
        {/* Role Selection */}
        <div className="space-y-4 relative z-20">
          <label className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-widest text-center block">Access Tier Selection</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleCard
              active={formData.role === "donor"}
              onClick={() => setFormData(prev => ({ ...prev, role: "donor" }))}
              icon={<Heart className="w-5 h-5 pointer-events-none" />}
              title="Donor"
              desc="Business/Indiv."
            />
            <RoleCard
              active={formData.role === "ngo"}
              onClick={() => setFormData(prev => ({ ...prev, role: "ngo" }))}
              icon={<Building2 className="w-5 h-5 pointer-events-none" />}
              title="Verified NGO"
              desc="Impact Org."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <InputField
            label={formData.role === "ngo" ? "Official NGO Name" : "Full Name / Organization"}
            icon={<User className="w-4 h-4" />}
            placeholder={formData.role === "ngo" ? "Better World Foundation" : "John Doe / Food Bank"}
            value={formData.name}
            onChange={(val) => setFormData({ ...formData, name: val })}
            className="reg-item"
          />
          <InputField
            label="Corporate Email"
            icon={<Mail className="w-4 h-4" />}
            type="email"
            placeholder="name@company.com"
            value={formData.email}
            onChange={(val) => {
              setFormData({ ...formData, email: val });
              if (isEmailVerified) setIsEmailVerified(false);
            }}
            className="reg-item"
            action={
              !isEmailVerified && (
                <div className="flex flex-col items-end space-y-1">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || !formData.email || resendTimer > 0}
                    className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest disabled:opacity-30"
                  >
                    {otpLoading ? "Sending..." : isOtpSent ? (resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP") : "Send OTP"}
                  </button>
                </div>
              )
            }
          />

          {/* Sandbox display for DLT-blocked environments */}
          {isSandbox && debugOtp && !isEmailVerified && (
            <div className="md:col-span-2 space-y-2 p-4 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl animate-in zoom-in duration-300">
              <div className="flex items-center space-x-2 text-amber-700">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Email Testing Mode</span>
              </div>
              <p className="text-xs font-bold text-amber-600">
                Email delivery is in sandbox mode.
                Use this testing code: <span className="text-sm font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded ml-1">{debugOtp}</span>
              </p>
            </div>
          )}

          {isOtpSent && !isEmailVerified && (
            <div className="md:col-span-2 space-y-3 reg-item animate-in slide-in-from-top duration-300">
              <InputField
                label="Enter 6-Digit Email OTP"
                icon={<ShieldCheck className="w-4 h-4" />}
                placeholder="000000"
                value={otp}
                onChange={(val) => setOtp(val)}
                action={
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otp.length < 6}
                    className="text-[10px] font-black text-emerald-600 hover:underline uppercase tracking-widest disabled:opacity-30"
                  >
                    Verify OTP
                  </button>
                }
              />
            </div>
          )}

          {isEmailVerified && (
            <div className="md:col-span-2 flex items-center space-x-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 reg-item">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Email Verified Successfully</span>
            </div>
          )}

          <InputField
            label="Phone Number"
            icon={<Phone className="w-4 h-4" />}
            type="tel"
            placeholder="+1 555-0100"
            value={formData.phone}
            onChange={(val) => setFormData({ ...formData, phone: val })}
            className="reg-item"
          />

          <InputField
            label="Password"
            icon={<Lock className="w-4 h-4" />}
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.password}
            onChange={(val) => setFormData({ ...formData, password: val })}
            className="reg-item"
            togglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
          />
          <InputField
            label="Confirm Password"
            icon={<Lock className="w-4 h-4" />}
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(val) => setFormData({ ...formData, confirmPassword: val })}
            className="reg-item"
            togglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            showPassword={showConfirmPassword}
          />

          {formData.role === "ngo" && (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputField
                label="NGO Registration #"
                icon={<ShieldCheck className="w-4 h-4" />}
                placeholder="REG-2024-XXXX"
                value={formData.ngoRegNo}
                onChange={(val) => setFormData({ ...formData, ngoRegNo: val })}
                className="reg-item"
              />

              <div className="space-y-3 reg-item">
                <label className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center">
                  <span className="opacity-40 mr-2"><Globe className="w-4 h-4" /></span>
                  NGO Category
                </label>
                <select
                  className="w-full h-14 rounded-[1.25rem] bg-white border-2 border-slate-900 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-black px-4 text-slate-900"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  value={formData.category}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Food Bank">Food Bank</option>
                  <option value="Shelter">Shelter</option>
                  <option value="Disaster Relief">Disaster Relief</option>
                  <option value="Community Kitchen">Community Kitchen</option>
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 reg-item">
                <FileField
                  label="NGO Registration Certificate"
                  icon={<FileText className="w-4 h-4" />}
                  value={docs.certificate}
                  onChange={(file) => setDocs({ ...docs, certificate: file })}
                />
                <FileField
                  label="Government ID Proof"
                  icon={<ShieldCheck className="w-4 h-4" />}
                  value={docs.idProof}
                  onChange={(file) => setDocs({ ...docs, idProof: file })}
                />
              </div>
            </div>
          )}

          <div className="md:col-span-2 pt-6">
            <LocationPicker
              label={formData.role === "ngo" ? "NGO Head Office Location" : "Operational Center Location"}
              onLocationSelect={handleLocationSelect}
              initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude, address: formData.address } : undefined}
            />
          </div>
        </div>

        {error && (
          <div className="reg-item flex items-center space-x-3 p-5 bg-red-50 text-red-600 rounded-[1.5rem] border border-red-100">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="reg-item pt-4 space-y-6">
          <Button
            type="submit"
            disabled={loading || !isEmailVerified}
            className="w-full h-16 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white text-xl font-black shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:grayscale"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <span>Create Platform Account</span>
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </Button>

          <div className="flex items-center space-x-4">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">OR</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <Button
            type="button"
            onClick={() => signIn("google", { callbackUrl: `/complete-profile?role=${formData.role}` })}
            className="w-full h-16 rounded-[1.5rem] bg-white border-2 border-slate-900 text-slate-900 text-lg font-black hover:bg-slate-50 transition-all flex items-center justify-center space-x-3 shadow-lg"
          >
            <Image src="https://www.google.com/favicon.ico" width={20} height={20} alt="Google" className="w-5 h-5" />
            <span>Continue with Google</span>
          </Button>
        </div>

        <div className="reg-item text-center text-sm font-bold text-gray-600">
          Already have an account? <a href="/login" className="text-primary hover:underline font-black">Sign in now</a>
        </div>
      </form>
    </div>
  );
};

const RoleCard = ({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string, desc: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center space-y-2 group cursor-pointer relative z-30",
      active ? "bg-blue-50/50 border-blue-600 shadow-xl shadow-blue-500/10" : "bg-gray-50/50 border-gray-100 hover:border-gray-200"
    )}
  >
    <div className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors pointer-events-none",
      active ? "bg-blue-600 text-white" : "bg-white text-gray-500 group-hover:bg-gray-100"
    )}>
      {icon}
    </div>
    <div className="space-y-0.5 pointer-events-none">
      <span className={cn("text-sm font-black tracking-tight", active ? "text-gray-900" : "text-gray-600")}>{title}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">{desc}</span>
    </div>
  </button>
);

const InputField = ({ 
  label, 
  icon, 
  placeholder, 
  value, 
  onChange, 
  type = "text", 
  className, 
  action,
  togglePassword,
  showPassword
}: { 
  label: string; 
  icon: React.ReactNode; 
  placeholder: string; 
  value: string; 
  onChange: (val: string) => void; 
  type?: string; 
  className?: string; 
  action?: React.ReactNode;
  togglePassword?: () => void;
  showPassword?: boolean;
}) => (
  <div className={cn("space-y-3", className)}>
    <div className="flex items-center justify-between">
      <label className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center">
        <span className="opacity-40 mr-2">{icon}</span>
        {label}
      </label>
      {action}
    </div>
    <div className="relative">
      <Input
        type={type}
        placeholder={placeholder}
        className="h-14 rounded-[1.25rem] bg-white border-2 border-slate-900 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-black pr-12 text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      {togglePassword ? (
        <button
          type="button"
          onClick={togglePassword}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      ) : (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
          <Navigation className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
  </div>
);

const FileField = ({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: File | null; onChange: (file: File | null) => void }) => (
  <div className="space-y-3">
    <label className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center">
      <span className="opacity-40 mr-2">{icon}</span>
      {label}
    </label>
    <div className={cn(
      "relative h-14 rounded-[1.25rem] bg-white border-2 border-dashed transition-all flex items-center px-4 cursor-pointer overflow-hidden",
      value ? "border-emerald-500 bg-emerald-50/10" : "border-slate-300 hover:border-primary/50"
    )}>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="absolute inset-0 opacity-0 cursor-pointer z-20"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          onChange(file);
        }}
        required
      />
      <div className="flex items-center justify-between w-full">
        <span className={cn(
          "text-[11px] font-bold truncate max-w-[150px]",
          value ? "text-emerald-700" : "text-slate-400"
        )}>
          {value ? value.name : "Select File (PDF, IMG)"}
        </span>
        {value ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        ) : (
          <Upload className="w-4 h-4 text-slate-300 flex-shrink-0" />
        )}
      </div>
    </div>
  </div>
);
