import { db, type Tx } from "@/lib/db";
import type {
  OrderChannel,
  OrderItemKind,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";

/** Order data access. */

export const orderListSelect = {
  id: true,
  publicRef: true,
  customerName: true,
  customerPhone: true,
  fulfilment: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  channel: true,
  totalCents: true,
  requestedFor: true,
  createdAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export type OrderListItem = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;

export const orderDetailSelect = {
  id: true,
  publicRef: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  fulfilment: true,
  deliveryAddress: true,
  requestedFor: true,
  notes: true,
  internalNotes: true,
  subtotalCents: true,
  deliveryFeeCents: true,
  totalCents: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  channel: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      kind: true,
      nameSnapshot: true,
      unitPriceCents: true,
      quantity: true,
      lineTotalCents: true,
      cake: { select: { slug: true } },
      product: { select: { slug: true } },
    },
    orderBy: { nameSnapshot: "asc" },
  },
} satisfies Prisma.OrderSelect;

export type OrderDetail = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

export type NewOrderItem = {
  kind: OrderItemKind;
  cakeId: string | null;
  productId: string | null;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type NewOrder = {
  publicRef: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfilment: "PICKUP" | "DELIVERY";
  deliveryAddress: string | null;
  requestedFor: Date | null;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  channel: OrderChannel;
  idempotencyKey: string | null;
  items: NewOrderItem[];
};

/** Looks up an order by the customer-facing reference. */
export async function findOrderByRef(publicRef: string): Promise<OrderDetail | null> {
  return db.order.findUnique({ where: { publicRef }, select: orderDetailSelect });
}

export async function findOrderById(id: string): Promise<OrderDetail | null> {
  return db.order.findUnique({ where: { id }, select: orderDetailSelect });
}

export async function findOrderByIdempotencyKey(key: string): Promise<OrderDetail | null> {
  return db.order.findUnique({ where: { idempotencyKey: key }, select: orderDetailSelect });
}

export type OrderCursor = { createdAt: Date; id: string };

/**
 * Creates an order, its items and its outbox side effect in one transaction.
 *
 * The outbox row is written here — not after the transaction commits — so that
 * "the customer has an order" and "the baker will be notified" cannot diverge.
 * A crash between the two would otherwise silently lose the notification.
 */
export async function createOrder(input: NewOrder): Promise<OrderDetail> {
  return db.$transaction(async (tx: Tx) => {
    const order = await tx.order.create({
      data: {
        publicRef: input.publicRef,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        fulfilment: input.fulfilment,
        deliveryAddress: input.deliveryAddress,
        requestedFor: input.requestedFor,
        notes: input.notes,
        subtotalCents: input.subtotalCents,
        deliveryFeeCents: input.deliveryFeeCents,
        totalCents: input.totalCents,
        paymentMethod: input.paymentMethod,
        channel: input.channel,
        idempotencyKey: input.idempotencyKey,
        items: { create: input.items },
      },
      select: { id: true, publicRef: true },
    });

    await tx.outboxEvent.create({
      data: {
        type: "order.created",
        payload: {
          orderId: order.id,
          publicRef: order.publicRef,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          totalCents: input.totalCents,
          fulfilment: input.fulfilment,
          itemCount: input.items.length,
        },
      },
    });

    const created = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: orderDetailSelect,
    });

    return created;
  });
}

export async function listOrders(args: {
  limit: number;
  cursor?: OrderCursor | null;
  status?: OrderStatus;
  search?: string;
}): Promise<{ items: OrderListItem[]; nextCursor: OrderCursor | null }> {
  const { limit, cursor, status, search } = args;

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { publicRef: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search } },
              ],
            },
          ],
        }
      : {}),
  };

  const rows = await db.order.findMany({
    where,
    select: orderListSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export type OrderStatusPatch = {
  status?: OrderStatus;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
  paymentMethod?: PaymentMethod;
  internalNotes?: string | null;
};

/**
 * Applies a status change and stamps the matching timestamp.
 * The timestamps are denormalised on purpose: "when was this completed" is a
 * question asked directly of the row, and deriving it from an audit log would
 * make the common report query expensive.
 */
export async function updateOrderStatus(id: string, patch: OrderStatusPatch): Promise<OrderDetail> {
  const now = new Date();

  const timestamps: Prisma.OrderUpdateInput = {};
  if (patch.status === "CONFIRMED") timestamps.confirmedAt = now;
  if (patch.status === "COMPLETED") timestamps.completedAt = now;
  if (patch.status === "CANCELLED") timestamps.cancelledAt = now;

  return db.order.update({
    where: { id },
    data: { ...patch, ...timestamps },
    select: orderDetailSelect,
  });
}

/** Counts per status for the admin dashboard, in one round trip. */
export async function countOrdersByStatus(): Promise<Record<string, number>> {
  const rows = await db.order.groupBy({ by: ["status"], _count: { _all: true } });

  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

/**
 * Orders needing attention: anything not finished and not cancelled.
 * Uses the `(status, createdAt)` index and is bounded, so it stays cheap.
 */
export async function listOpenOrders(limit = 8): Promise<OrderListItem[]> {
  return db.order.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED", "BAKING", "READY", "OUT_FOR_DELIVERY"] } },
    select: orderListSelect,
    orderBy: [{ createdAt: "asc" }],
    take: limit,
  });
}
