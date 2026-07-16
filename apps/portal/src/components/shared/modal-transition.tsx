"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface ModalTransitionProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function ModalTransition({ open, children, className }: ModalTransitionProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
