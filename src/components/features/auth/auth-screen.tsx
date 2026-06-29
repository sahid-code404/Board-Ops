"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Phone, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, Zap, Layers } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput } from "@/components/glass/glass-input";
import { AnimatedBackground } from "@/components/glass/animated-background";
import { useAuthStore } from "@/stores/use-auth-store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { z } from "zod";
import { GlassNav } from "@/components/glass/glass-nav";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name too short"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(8, "Enter a valid phone"),
  password: z.string().min(8, "At least 8 characters"),
  room: z.string().optional(),
});

type Mode = "login" | "register";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    email: "admin@boardops.io",
    password: "Admin@123",
    name: "",
    phone: "",
    room: "",
  });
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      setLoading(true);
      if (mode === "login") {
        const data = loginSchema.parse({ email: form.email, password: form.password });
        const res = await api.post<{ success: boolean; data: { token: string; user: any } }>("/auth/login", data);
        // Clear all cached queries from any previous session before setting new user
        qc.clear();
        setToken(res.data.token);
        setUser(res.data.user);
        toast.success(`Welcome back, ${res.data.user.name.split(" ")[0]}!`);
      } else {
        const data = registerSchema.parse(form);
        await api.post("/auth/register", data);
        toast.success("Account created! Awaiting admin approval.");
        setMode("login");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.issues.forEach((i) => {
          if (i.path[0]) fieldErrors[i.path[0] as string] = i.message;
        });
        setErrors(fieldErrors);
      } else {
        toast.error(err.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 safe-top safe-bottom">
      <AnimatedBackground />

      <div className="w-full max-w-md mx-auto flex flex-col gap-6 items-center">
        {/* Hero side */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden flex-col gap-6 p-8"
        >
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-12 w-12 rounded-3xl bg-gradient-to-br from-primary to-chart-4 shadow-xl shadow-primary/40">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold">BoardOps</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Configurable Operations Suite
              </p>
            </div>
          </div>

          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
            Run your institution
            <br />
            like a{" "}
            <span className="gradient-text">premium product.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Configure meals, billing, variables, and reports — nothing hardcoded.
            Built for hostels, PGs, colleges, and residential institutions.
          </p>

          <div className="grid gap-3 mt-2">
            {[
              { icon: Layers, title: "Dynamic Meal Engine", desc: "Unlimited meals, cutoffs, and service dates — all DB-driven." },
              { icon: Zap, title: "Formula & Variable Engine", desc: "Recalculate bills automatically on any change." },
              { icon: ShieldCheck, title: "Permission-controlled", desc: "RBAC, audit logs, soft-delete — enterprise-grade." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <GlassCard className="p-4 flex items-start gap-3" hover={false}>
                  <div className="grid place-items-center h-10 w-10 rounded-2xl bg-primary/15 shrink-0">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Auth form side */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard strong className="p-6" hover={false}>
            {/* Mobile brand */}
            <div className="flex items-center gap-3 mb-6">
              <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-chart-4 shadow-lg shadow-primary/40">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold">BoardOps</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Operations Suite
                </p>
              </div>
            </div>

            <GlassNav
              items={[
                { value: "login", label: "Sign in" },
                { value: "register", label: "Register" },
              ]}
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              className="w-full mb-6"
            />

            <form onSubmit={submit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <GlassInput
                      label="Full Name"
                      placeholder="Aarav Mehta"
                      icon={<User />}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      error={errors.name}
                    />
                    <GlassInput
                      label="Phone Number"
                      placeholder="+91 98765 43210"
                      icon={<Phone />}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      error={errors.phone}
                    />
                    <GlassInput
                      label="Room Number (optional)"
                      placeholder="A-101"
                      value={form.room}
                      onChange={(e) => setForm({ ...form, room: e.target.value })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <GlassInput
                label="Email"
                placeholder="you@boardops.io"
                type="email"
                icon={<Mail />}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
              />

              <GlassInput
                label="Password"
                placeholder="••••••••"
                type={showPwd ? "text" : "password"}
                icon={<Lock />}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password visibility"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <GlassButton type="submit" size="lg" className="w-full" loading={loading}>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </GlassButton>

              {mode === "login" && (
                <div className="glass-soft rounded-2xl p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Demo credentials</p>
                  <p>Admin → admin@boardops.io / Admin@123</p>
                  <p>Resident → priya@boardops.io / Resident@123</p>
                </div>
              )}
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
