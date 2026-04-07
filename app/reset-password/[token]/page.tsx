"use client";

import { useState } from "react";
import { postRequest } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ResetPasswordPage() {
    const params = useParams();
    const token = params && typeof params.token === 'string' ? params.token : (params && Array.isArray(params.token) ? params.token[0] : "");
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [tokenValidating, setTokenValidating] = useState(true);
    const [tokenInvalid, setTokenInvalid] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setTokenValidating(false);
            setTokenInvalid(true);
            return;
        }
        
        postRequest("/api/auth/verify-reset-token", { token })
            .then(res => {
                if (!res.success) setTokenInvalid(true);
            })
            .catch(() => setTokenInvalid(true))
            .finally(() => setTokenValidating(false));
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await postRequest("/api/auth/reset-password", { token, password });
            if (res.success) {
                setMessage("Password updated successfully");
                setTimeout(() => router.push("/login"), 3000);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: unknown) {
            setError((err as Error).message || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    if (tokenValidating) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }
    
    if (tokenInvalid) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_500px)]">
                <div className="max-w-md w-full glass-card rounded-[2.5rem] bg-white p-10 shadow-2xl text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-50 mb-2">
                        <AlertCircle className="w-8 h-8 text-rose-500" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invalid or expired reset link</h1>
                    <p className="text-slate-500 text-sm font-medium">
                        This password reset link has expired or was already used. Please request a new link.
                    </p>
                    <Button onClick={() => router.push("/forgot-password")} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all">
                        Back to Forgot Password
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_500px)]">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white shadow-xl mb-4">
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reset Your Password</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Update your security credentials for access</p>
                </div>

                <div className="glass-card rounded-[2.5rem] bg-white p-10 shadow-2xl space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                                <Lock className="w-3.5 h-3.5 mr-2" />
                                New Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="h-14 rounded-2xl bg-white border-2 border-slate-900 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-black pr-12"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                                <Lock className="w-3.5 h-3.5 mr-2" />
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="h-14 rounded-2xl bg-white border-2 border-slate-900 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-black pr-12"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center space-x-3 p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 italic">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-bold">{error}</span>
                            </div>
                        )}

                        {message && (
                            <div className="flex items-center space-x-3 p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 animate-in zoom-in duration-300">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-bold">{message}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !!message}
                            className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-lg font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><span>Update Password</span> <ArrowRight className="w-5 h-5" /></>}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
