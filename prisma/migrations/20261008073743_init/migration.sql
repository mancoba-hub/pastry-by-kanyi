-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'VIEWER') NOT NULL DEFAULT 'ADMIN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_isActive_role_idx`(`isActive`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cake` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `flavour` VARCHAR(191) NULL,
    `occasion` VARCHAR(191) NULL,
    `servings` INTEGER NULL,
    `priceCents` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `bakedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cake_slug_key`(`slug`),
    INDEX `Cake_status_bakedAt_idx`(`status`, `bakedAt` DESC),
    INDEX `Cake_status_isFeatured_bakedAt_idx`(`status`, `isFeatured`, `bakedAt` DESC),
    INDEX `Cake_status_viewCount_idx`(`status`, `viewCount` DESC),
    INDEX `Cake_occasion_idx`(`occasion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CakeImage` (
    `id` VARCHAR(191) NOT NULL,
    `cakeId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `blurDataUrl` TEXT NULL,
    `alt` VARCHAR(500) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isCover` BOOLEAN NOT NULL DEFAULT false,
    `byteSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CakeImage_cakeId_position_idx`(`cakeId`, `position`),
    INDEX `CakeImage_cakeId_isCover_idx`(`cakeId`, `isCover`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CakeTag` (
    `id` VARCHAR(191) NOT NULL,
    `cakeId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,

    INDEX `CakeTag_slug_idx`(`slug`),
    UNIQUE INDEX `CakeTag_cakeId_slug_key`(`cakeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `unitLabel` VARCHAR(191) NOT NULL DEFAULT 'each',
    `status` ENUM('DRAFT', 'ACTIVE', 'SOLD_OUT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `stockQty` INTEGER NULL,
    `maxPerOrder` INTEGER NOT NULL DEFAULT 20,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_status_isFeatured_idx`(`status`, `isFeatured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `blurDataUrl` TEXT NULL,
    `alt` VARCHAR(500) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `isCover` BOOLEAN NOT NULL DEFAULT false,
    `byteSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductImage_productId_position_idx`(`productId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `publicRef` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NULL,
    `fulfilment` ENUM('PICKUP', 'DELIVERY') NOT NULL DEFAULT 'PICKUP',
    `deliveryAddress` TEXT NULL,
    `requestedFor` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `subtotalCents` INTEGER NOT NULL,
    `deliveryFeeCents` INTEGER NOT NULL DEFAULT 0,
    `totalCents` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentStatus` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `paymentMethod` ENUM('CASH_ON_DELIVERY', 'MPESA_MANUAL', 'BANK_TRANSFER', 'GATEWAY') NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    `channel` ENUM('WEB', 'WHATSAPP', 'INSTAGRAM', 'PHONE', 'WALK_IN') NOT NULL DEFAULT 'WEB',
    `idempotencyKey` VARCHAR(191) NULL,
    `internalNotes` TEXT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_publicRef_key`(`publicRef`),
    UNIQUE INDEX `Order_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Order_status_createdAt_idx`(`status`, `createdAt` DESC),
    INDEX `Order_customerPhone_idx`(`customerPhone`),
    INDEX `Order_createdAt_idx`(`createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `kind` ENUM('CAKE', 'PRODUCT') NOT NULL,
    `cakeId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `nameSnapshot` VARCHAR(191) NOT NULL,
    `unitPriceCents` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotalCents` INTEGER NOT NULL,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutboxEvent` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OutboxEvent_status_availableAt_idx`(`status`, `availableAt`),
    INDEX `OutboxEvent_type_createdAt_idx`(`type`, `createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt` DESC),
    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CakeImage` ADD CONSTRAINT `CakeImage_cakeId_fkey` FOREIGN KEY (`cakeId`) REFERENCES `Cake`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CakeTag` ADD CONSTRAINT `CakeTag_cakeId_fkey` FOREIGN KEY (`cakeId`) REFERENCES `Cake`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductImage` ADD CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_cakeId_fkey` FOREIGN KEY (`cakeId`) REFERENCES `Cake`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
