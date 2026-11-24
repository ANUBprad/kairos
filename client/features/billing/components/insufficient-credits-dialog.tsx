"use client";

import { Coins, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpgradeModal } from "../stores/use-upgrade-modal";

interface InsufficientCreditsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requiredCredits: number;
  currentCredits: number;
  actionName?: string;
}

export function InsufficientCreditsDialog({
  isOpen,
  onClose,
  requiredCredits,
  currentCredits,
  actionName = "this action",
}: InsufficientCreditsDialogProps) {
  const { openUpgradeModal } = useUpgradeModal();
  const deficit = Math.max(0, requiredCredits - currentCredits);

  const handleTopUp = () => {
    onClose();
    openUpgradeModal({
      reason: `You need ${requiredCredits} credits to perform ${actionName}.`,
      requiredCredits,
      currentCredits,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="kairos-panel max-w-md bg-surface text-foreground">
        <DialogHeader className="flex flex-col items-center pt-2 text-center">
          <div className="kairos-inset mb-3 flex size-12 items-center justify-center border-danger/20 bg-danger/10 text-danger">
            <Coins className="size-6" />
          </div>
          <DialogTitle className="kairos-section-title text-2xl">
            Not enough credits
          </DialogTitle>
          <DialogDescription className="mt-1 text-center text-sm text-muted-foreground">
            You don&apos;t have enough credits to complete {actionName}.
          </DialogDescription>
        </DialogHeader>

        <div className="kairos-inset my-2 space-y-2.5 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Required credits</span>
            <span className="font-semibold text-foreground">
              {requiredCredits} credits
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-semibold text-foreground">
              {currentCredits} credits
            </span>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-danger">Credits needed</span>
            <span className="font-bold text-danger">+{deficit} credits</span>
          </div>
        </div>

        <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTopUp}
            className="w-full gap-1.5 sm:w-auto"
          >
            <Plus className="size-4" />
            <span>Top up credits (min ₹50)</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

