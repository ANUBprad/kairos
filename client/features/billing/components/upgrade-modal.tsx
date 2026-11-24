"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpgradeModal } from "../stores/use-upgrade-modal";
import { PricingPlans } from "./pricing-plans";

export function UpgradeModal() {
  const { isOpen, reason, closeUpgradeModal } = useUpgradeModal();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent
        className="kairos-panel flex max-h-[92dvh] flex-col gap-0 overflow-hidden bg-surface p-0 text-foreground sm:max-w-6xl"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Choose a credit top-up</DialogTitle>
        <div className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8">
          <PricingPlans
            variant="embedded"
            alertMessage={reason}
            onCheckoutSuccess={closeUpgradeModal}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
