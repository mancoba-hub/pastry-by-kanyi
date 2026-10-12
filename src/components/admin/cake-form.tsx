"use client";

import { useActionState } from "react";
import { EMPTY_ACTION_STATE, type ActionState } from "@/features/admin/schema";
import { FieldError, inputClasses, Label } from "@/components/ui";
import { SubmitButton } from "./submit-button";

/**
 * Cake create/edit form.
 *
 * Client-side so it can use `useActionState` for inline field errors and pending
 * state. The Server Action re-validates everything, so this is only about
 * feedback, not enforcement.
 *
 * `mode` changes little more than labels — a create form and an edit form for the
 * same entity should never diverge, or one of them quietly loses a field.
 */

export type CakeFormValues = {
  id?: string;
  title?: string;
  description?: string;
  flavour?: string | null;
  occasion?: string | null;
  servings?: number | null;
  priceCents?: number | null;
  status?: string;
  isFeatured?: boolean;
  bakedAt?: Date | null;
  tags?: string[];
};

function toDateInput(date?: Date | null): string {
  if (!date) return "";

  // `datetime-local` wants local wall-clock time, not UTC.
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CakeForm({
  mode,
  action,
  values,
  children,
}: {
  mode: "create" | "edit";
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: CakeFormValues;
  /** Slot for the image manager on the edit screen. */
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, EMPTY_ACTION_STATE);
  const fields = state.fields ?? {};

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {values?.id ? <input type="hidden" name="cakeId" value={values.id} /> : null}

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

      <div>
        <Label htmlFor="title">Title</Label>
        <input
          id="title"
          name="title"
          required
          defaultValue={values?.title ?? ""}
          placeholder="Raspberry & Rose Celebration Cake"
          className={inputClasses}
          aria-invalid={Boolean(fields.title)}
        />
        <FieldError messages={fields.title} />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          defaultValue={values?.description ?? ""}
          placeholder="What it is, who it was for, what makes it special."
          className={inputClasses}
          aria-invalid={Boolean(fields.description)}
        />
        <FieldError messages={fields.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="flavour" hint="(optional)">
            Flavour
          </Label>
          <input
            id="flavour"
            name="flavour"
            defaultValue={values?.flavour ?? ""}
            placeholder="Dark chocolate, salted caramel"
            className={inputClasses}
            aria-invalid={Boolean(fields.flavour)}
          />
          <FieldError messages={fields.flavour} />
        </div>

        <div>
          <Label htmlFor="occasion" hint="(optional)">
            Occasion
          </Label>
          <input
            id="occasion"
            name="occasion"
            list="occasion-options"
            defaultValue={values?.occasion ?? ""}
            placeholder="Birthday"
            className={inputClasses}
            aria-invalid={Boolean(fields.occasion)}
          />
          <datalist id="occasion-options">
            <option value="Birthday" />
            <option value="Wedding" />
            <option value="Anniversary" />
            <option value="Baby shower" />
            <option value="Graduation" />
            <option value="Corporate" />
          </datalist>
          <FieldError messages={fields.occasion} />
        </div>

        <div>
          <Label htmlFor="servings" hint="(optional)">
            Servings
          </Label>
          <input
            id="servings"
            name="servings"
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            defaultValue={values?.servings ?? ""}
            className={inputClasses}
            aria-invalid={Boolean(fields.servings)}
          />
          <FieldError messages={fields.servings} />
        </div>

        <div>
          <Label htmlFor="price" hint="(ZAR, optional)">
            Guide price
          </Label>
          <input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={values?.priceCents != null ? String(values.priceCents / 100) : ""}
            placeholder="8500"
            className={inputClasses}
            aria-invalid={Boolean(fields.priceCents)}
          />
          <FieldError messages={fields.priceCents} />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Leave blank for &ldquo;priced on request&rdquo;. A blank price blocks basket checkout and
            routes the customer to WhatsApp instead.
          </p>
        </div>

        <div>
          <Label htmlFor="bakedAt">Baked on</Label>
          <input
            id="bakedAt"
            name="bakedAt"
            type="datetime-local"
            defaultValue={toDateInput(values?.bakedAt)}
            className={inputClasses}
            aria-invalid={Boolean(fields.bakedAt)}
          />
          <FieldError messages={fields.bakedAt} />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Orders the gallery. Leave blank to use now.
          </p>
        </div>

        <div>
          <Label htmlFor="tags" hint="(comma separated)">
            Tags
          </Label>
          <input
            id="tags"
            name="tags"
            defaultValue={values?.tags?.join(", ") ?? ""}
            placeholder="Chocolate, Birthday, Buttercream"
            className={inputClasses}
            aria-invalid={Boolean(fields.tags)}
          />
          <FieldError messages={fields.tags} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={values?.status ?? "DRAFT"}
            className={inputClasses}
          >
            <option value="DRAFT">Draft (hidden from the gallery)</option>
            <option value="PUBLISHED">Published (visible to customers)</option>
            <option value="ARCHIVED">Archived (retired, link kept alive)</option>
          </select>
          <FieldError messages={fields.status} />
        </div>

        <label className="flex items-end gap-3 pb-2 text-sm">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={values?.isFeatured ?? false}
            className="h-5 w-5 accent-[var(--color-primary)]"
          />
          <span>
            Signature bake
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              Appears in the home page rail
            </span>
          </span>
        </label>
      </div>

      <div>
        <Label htmlFor="images" hint="(JPEG, PNG or WebP, up to 15 MB each)">
          {mode === "create" ? "Photos" : "Add photos"}
        </Label>
        <input
          id="images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple
          className="block w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Photos are resized and converted to WebP automatically. The first one becomes the cover.
        </p>
      </div>

      {children}

      <div className="flex gap-3">
        <SubmitButton size="lg">
          {mode === "create" ? "Create cake" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
