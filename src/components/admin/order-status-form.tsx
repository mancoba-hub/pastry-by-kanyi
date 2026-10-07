"use client";

import { useActionState } from "react";
import { updateOrderAction } from "@/features/orders/admin-actions";
import { EMPTY_ACTION_STATE } from "@/features/admin/schema";
import { inputClasses, Label } from "@/components/ui";
import { SubmitButton } from "./submit-button";

/**
 * Order status editor.
 *
 * The status list is deliberately narrow — a small bakery's workflow is
 * confirm → bake → ready → collected, and offering twenty states would mean
 * nothing gets updated accurately.
 */
export function OrderStatusForm({
  orderId,
  status,
  paymentStatus,
  paymentMethod,
  internalNotes,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  internalNotes: string | null;
}) {
  const [state, formAction] = useActionState(updateOrderAction, EMPTY_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      {state.message ? (
        <div
          className={
            state.ok
              ? "rounded-xl border border-[var(--color-success)] bg-[#e6f2ea] px-4 py-3 text-sm text-[var(--color-success)]"
              : "rounded-xl border border-[var(--color-danger)] bg-[#fdeceb] px-4 py-3 text-sm text-[var(--color-danger)]"
          }
          role="status"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="status">Order status</Label>
          <select id="status" name="status" defaultValue={status} className={inputClasses}>
            <option value="PENDING">Awaiting confirmation</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="BAKING">In the oven</option>
            <option value="READY">Ready for collection</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <Label htmlFor="paymentStatus">Payment</Label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            defaultValue={paymentStatus}
            className={inputClasses}
          >
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Part-paid</option>
            <option value="PAID">Paid</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>

        <div>
          <Label htmlFor="paymentMethod">Method</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={paymentMethod}
            className={inputClasses}
          >
            <option value="CASH_ON_DELIVERY">Cash on collection/delivery</option>
            <option value="MPESA_MANUAL">M-Pesa</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="GATEWAY">Card / online</option>
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="internalNotes" hint="(never shown to the customer)">
          Internal notes
        </Label>
        <textarea
          id="internalNotes"
          name="internalNotes"
          rows={3}
          defaultValue={internalNotes ?? ""}
          placeholder="Anything the kitchen needs to remember."
          className={inputClasses}
        />
      </div>

      <SubmitButton pendingLabel="Updating…">Update order</SubmitButton>
    </form>
  );
}
