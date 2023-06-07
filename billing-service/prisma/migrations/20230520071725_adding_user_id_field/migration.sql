/*
  Warnings:

  - You are about to drop the column `billingAddress` on the `billing` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Billing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `billing` DROP COLUMN `billingAddress`,
    ADD COLUMN `userId` VARCHAR(191) NOT NULL;
