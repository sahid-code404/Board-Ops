"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Animated mesh gradient background with floating blobs */
export function AnimatedBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className
      )}
    >
      {/* Base mesh */}
      <div className="absolute inset-0 mesh-bg opacity-90" />

      {/* Animated blobs */}
      <motion.div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--mesh-1) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 100, 0],
          y: [0, 80, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--mesh-2) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -120, 0],
          y: [0, 100, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[30rem] w-[30rem] rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--mesh-3) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, 80, 0],
          y: [0, -60, 0],
          scale: [1, 1.25, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--mesh-4) 0%, transparent 70%)",
        }}
        animate={{
          x: [0, -90, 0],
          y: [0, 90, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
