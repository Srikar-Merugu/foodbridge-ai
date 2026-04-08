"use client";

import { useEffect, useState } from "react";
import { getRequest } from "@/lib/apiClient";
import { getSocket } from "@/lib/socket";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { UserTable } from "@/components/admin/UserTable";
import { DonationTable } from "@/components/admin/DonationTable";
import { Donation, User, NGOProfile, AdminMetrics } from "@/types";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Package,
  ShieldCheck,
  AlertTriangle,
  Activity,
  ChevronRight,
  RefreshCw,
  ArrowUpRight,
  Terminal,
  Zap,
  Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdminReportsPage from "./reports/page";
import AdminVerificationsPage from "./verifications/page";
import AdminSupportPage from "./support/page";

type Tab = "overview" | "users" | "donations" | "reports" | "verifications" | "support";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [ngos, setNgos] = useState<NGOProfile[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [metricsRes, usersRes, ngosRes, donationsRes] = await Promise.all([
        getRequest("/api/admin/metrics"),
        getRequest("/api/admin/users"),
        getRequest("/api/admin/approve-ngo"),
        getRequest("/api/admin/donations"),
      ]);
      if (metricsRes.success) setMetrics(metricsRes.data);
      if (usersRes.success) setUsers(usersRes.data);
      if (ngosRes.success) setNgos(ngosRes.data);
      if (donationsRes.success) setDonations(donationsRes.data);
    } catch (err) {
      console.error("Admin data fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    // ── Real-time Operational Sync ──
    const socket = getSocket();
    
    const handleSync = () => {
      console.log("[ADMIN-SYNC] Operational pulse vertical. Refreshing Ledger...");
      fetchAll();
    };

    if (socket.connected) {
      socket.emit("join-public-feed");
    }

    socket.on("connect", () => {
      socket.emit("join-public-feed");
    });

    socket.on("new-activity", handleSync);

    return () => {
      socket.off("connect");
      socket.off("new-activity", handleSync);
    };
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Operations", icon: Activity },
    { key: "users", label: "Entities", icon: Users },
    { key: "donations", label: "Ledger", icon: Package },
    { key: "verifications", label: "Verification", icon: ShieldCheck },
    { key: "reports", label: "Trust & Safety", icon: AlertTriangle },
    { key: "support", label: "Support", icon: Headphones },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedDonations = donations as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedUsers = users as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedNGOs = ngos as any;

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-slate-50/30 saas-gradient">
        {/* Global Admin Shell */}
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">

          {/* Unified Breadcrumb System */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              <Link href="/" className="flex items-center space-x-2 hover:text-primary transition-colors">
                <div className="relative w-6 h-6">
                  <Image
                    src="/logo.png"
                    alt="FoodBridge Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span>Platform</span>
              </Link>
              <ChevronRight className="w-3 h-3 opacity-50" />
              <span className="text-slate-900">Admin Command Center</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={fetchAll} variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-slate-400 hover:text-primary border border-transparent hover:border-primary/20">
                <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                <span className="text-[10px] font-black uppercase tracking-widest">Refresh Nodes</span>
              </Button>
            </div>
          </div>

          {/* SaaS Hero - Operational Header */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
              <ShieldCheck className="w-64 h-64 text-slate-900" />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="px-2.5 py-1 bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-md flex items-center border border-rose-500/10">
                    <ShieldCheck className="w-3 h-3 mr-1.5" /> Secure Session
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Zap className="w-3 h-3 mr-1.5 text-rose-500 animate-pulse" /> Real-time Sync
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[1.1]">
                  System <span className="text-primary italic font-serif opacity-80 pl-2">Goverance</span>
                </h1>
                <p className="text-slate-500 font-medium text-lg max-w-lg leading-relaxed">
                  Platform-wide orchestration of food redistribution nodes. Monitoring entity verification and asset logistics.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl min-w-[140px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Users</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">{metrics ? String(metrics.totalUsers ?? users.length) : users.length}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl min-w-[140px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Deliveries Done</p>
                  <p className="text-2xl font-black text-emerald-600 leading-none">{metrics ? String(metrics.successfulDeliveries ?? "0") : "0"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Command Navigation */}
          <div className="flex items-center space-x-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200/40 w-fit">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center space-x-2.5 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    tab === t.key
                      ? "bg-white shadow-sm text-slate-900 border border-slate-200/30"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* View Mesh */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {tab === "overview" && (
              <div className="space-y-10">
                <MetricsCards metrics={metrics} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Latest Ledger Activity */}
                  <div className="lg:col-span-12 bg-white border border-slate-200/60 rounded-2xl p-8 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
                        <Terminal className="w-5 h-5 mr-3 text-slate-400" /> Operational Log
                      </h3>
                      <button onClick={() => setTab("donations")} className="text-[10px] font-black text-primary uppercase tracking-widest hover:translate-x-1 transition-transform flex items-center">
                        Full Ledger <ArrowRight className="w-3.5 h-3.5 ml-2" />
                      </button>
                    </div>
                    <DonationTable donations={typedDonations.slice(0, 10)} />
                  </div>
                </div>
              </div>
            )}

            {tab === "users" && (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
                <UserTable users={typedUsers} ngos={typedNGOs} onNGOAction={fetchAll} />
              </div>
            )}

            {tab === "donations" && (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
                <DonationTable donations={typedDonations} />
              </div>
            )}

            {tab === "reports" && (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
                <AdminReportsPage />
              </div>
            )}

            {tab === "verifications" && (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
                <AdminVerificationsPage />
              </div>
            )}

            {tab === "support" && (
              <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-sm">
                <AdminSupportPage />
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MetricsCards = ({ metrics }: { metrics: AdminMetrics | null }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    <MetricsBlock label="Total Donations (All Time)" value={metrics ? `${metrics.totalDonations}` : "--"} trend="Ledger Total" />
    <MetricsBlock label="Verified Food Hubs (NGO)" value={metrics ? `${metrics.totalNGOs}` : "--"} trend="Active NGOs" />
    <MetricsBlock label="Actionable Alerts" value={metrics ? `${metrics.totalReports ?? 0}` : "--"} trend="Pending Review" isWarning={metrics ? (metrics.totalReports as number) > 0 : false} />
    <MetricsBlock label="Successful Deliveries" value={metrics ? `${metrics.successfulDeliveries}` : "--"} trend="Completed" />
  </div>
);

const MetricsBlock = ({ label, value, trend, isWarning }: { label: string, value: string, trend: string, isWarning?: boolean }) => (
  <div className={cn(
    "premium-card p-6 rounded-xl flex flex-col justify-between group transition-all",
    isWarning && "border-rose-200 bg-rose-50/30"
  )}>
    <div className="flex items-center justify-between mb-4">
      <div className={cn(
        "text-[9px] font-black uppercase tracking-[0.2em]",
        isWarning ? "text-rose-500" : "text-slate-300 group-hover:text-slate-500"
      )}>{trend}</div>
      <ArrowUpRight className={cn(
        "w-4 h-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
        isWarning ? "text-rose-400" : "text-slate-200 group-hover:text-primary"
      )} />
    </div>
    <div className="space-y-1">
      <p className={cn(
        "text-3xl font-black tracking-tighter leading-none tabular-nums",
        isWarning ? "text-rose-600" : "text-slate-900"
      )}>{value}</p>
      <p className="text-[10px] font-bold text-slate-400 leading-tight pr-4 uppercase tracking-wider">{label}</p>
    </div>
  </div>
);

// Inline temporary components to replace missing ones until fixed
const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
);
