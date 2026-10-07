"use client";

import { useActionState } from "react";
import { EMPTY_ACTION_STATE, type ActionState } from "@/features/admin/schema";
import { FieldError, inputClasses, Label } from "@/components/ui";
import { SubmitButton } from "./submit-button";

/** Product create/edit form — shop items such as scones. */

export type ProductFormValues = {
  id?: string;
  name?: string;
  description?: string;
  priceCents?: number;
  unitLabel?: string;
  status?: string;
  isFeatured?: boolean;
  stockQty?: number | null;
  maxPerOrder?: number;
};

export function ProductForm({
  mode,
  action,
  values,
}: {
  mode: "create" | "edit";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: ProductFormValues;
}) {
  const [state, formAction] = useActionState(action, EMPTY_ACTION_STATE);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {values?.id ? <input type="hidden" name="productId" value={values.id} /> : null}

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
        <div className="sm:col-span-2">
          <Label htmlFor={`name-${values?.id ?? "new"}`}>Name</Label>
          <input
            id={`name-${values?.id ?? "new"}`}
            name="name"
            required
            defaultValue={values?.name ?? ""}
            placeholder="Classic Butter Scones"
            className={inputClasses}
            aria-invalid={Boolean(fields.name)}
          />
          <FieldError messages={fields.name} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`description-${values?.id ?? "new"}`}>Description</Label>
          <textarea
            id={`description-${values?.id ?? "new"}`}
            name="description"
            required
            rows={3}
            defaultValue={values?.description ?? ""}
            className={inputClasses}
            aria-invalid={Boolean(fields.description)}
          />
          <FieldError messages={fields.description} />
        </div>

        <div>
          <Label htmlFor={`price-${values?.id ?? "new"}`} hint="(ZAR)">
            Price
          </Label>
          <input
            id={`price-${values?.id ?? "new"}`}
            name="price"
            required
            inputMode="decimal"
            defaultValue={values?.priceCents != null ? String(values.priceCents / 100) : ""}
            placeholder="450"
            className={inputClasses}
            aria-invalid={Boolean(fields.priceCents)}
          />
          <FieldError messages={fields.priceCents} />
        </div>

        <div>
          <Label htmlFor={`unit-${values?.id ?? "new"}`}>Unit</Label>
          <input
            id={`unit-${values?.id ?? "new"}`}
            name="unitLabel"
            required
            defaultValue={values?.unitLabel ?? "each"}
            placeholder="pack of 6"
            className={inputClasses}
            aria-invalid={Boolean(fields.unitLabel)}
          />
          <FieldError messages={fields.unitLabel} />
        </div>

        <div>
          <Label htmlFor={`stock-${values?.id ?? "new"}`} hint="(blank = unlimited)">
            Stock today
          </Label>
          <input
            id={`stock-${values?.id ?? "new"}`}
            name="stockQty"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={values?.stockQty ?? ""}
            className={inputClasses}
            aria-invalid={Boolean(fields.stockQty)}
          />
          <FieldError messages={fields.stockQty} />
        </div>

        <div>
          <Label htmlFor={`max-${values?.id ?? "new"}`}>Max per order</Label>
          <input
            id={`max-${values?.id ?? "new"}`}
            name="maxPerOrder"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            defaultValue={values?.maxPerOrder ?? 10}
            className={inputClasses}
            aria-invalid={Boolean(fields.maxPerOrder)}
          />
          <FieldError messages={fields.maxPerOrder} />
        </div>

        <div>
          <Label htmlFor={`status-${values?.id ?? "new"}`}>Status</Label>
          <select
            id={`status-${values?.id ?? "new"}`}
            name="status"
            defaultValue={values?.status ?? "DRAFT"}
            className={inputClasses}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">On sale</option>
            <option value="SOLD_OUT">Sold out today</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <label className="flex items-end gap-3 pb-2 text-sm">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={values?.isFeatured ?? false}
            className="h-5 w-5 accent-[var(--color-primary)]"
          />
          <span>Feature on the home page</span>
        </label>
      </div>

      <div>
        <Label htmlFor={`images-${values?.id ?? "new"}`} hint="(up to 15 MB each)">
          {mode === "create" ? "Photos" : "Add photos"}
        </Label>
        <input
          id={`images-${values?.id ?? "new"}`}
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple
          className="block w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>

      <SubmitButton>{mode === "create" ? "Add product" : "Save changes"}</SubmitButton>
    </form>
  );
}
