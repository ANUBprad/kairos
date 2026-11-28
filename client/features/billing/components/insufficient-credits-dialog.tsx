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
import { useUsage } from "../hooks/use-usage";
import {
  DEVELOPER_ENTITLEMENT_LABEL,
  formatInr,
  formatUtcInstant,
  MIN_CREDIT_PACK_AMOUNT_INR,
} from "../lib/plans";

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
  const {
    windowCredits,
    paidCredits,
    windowAllowance,
    nextCreditResetAt,
    bypassCredits,
  } = useUsage();
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
          <div className="kairos-inset mb-3 flex size-12 items-center justify-center border-primary/20 bg-primary/10 text-primary">
            <Coins className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle className="kairos-section-title text-2xl">
            {bypassCredits ? "Developer account" : "Not enough credits"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-center text-sm text-muted-foreground">
            {bypassCredits ? (
              <>
                {DEVELOPER_ENTITLEMENT_LABEL} This credit check does not apply
                to your account.
              </>
            ) : (
              <>
                You don&apos;t have enough credits to complete {actionName}.
                Free-window credits are used first and reset at{" "}
                <time dateTime={nextCreditResetAt} className="font-medium text-foreground">
                  {formatUtcInstant(nextCreditResetAt)}
                </time>
                . Paid credits never expire.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!bypassCredits && (
          <dl className="kairos-inset my-2 space-y-2.5 p-4">
            <div className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">Required credits</dt>
              <dd className="font-semibold text-foreground">
                {requiredCredits} credits
              </dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">Free-window remaining</dt>
              <dd className="font-semibold text-foreground">
                {windowCredits} / {windowAllowance}
              </dd>
            </div>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">Paid remaining</dt>
              <dd className="font-semibold text-foreground">{paidCredits}</dd>
            </div>
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between text-sm">
              <dt className="font-medium text-danger">Credits needed</dt>
              <dd className="font-bold text-danger">+{deficit} credits</dd>
            </div>
          </dl>
        )}

        <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {bypassCredits ? "Close" : "Cancel"}
          </Button>
          {!bypassCredits && (
            <Button
              type="button"
              onClick={handleTopUp}
              className="w-full gap-1.5 sm:w-auto"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>
                Browse credit packs (from {formatInr(MIN_CREDIT_PACK_AMOUNT_INR)})
              </span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
