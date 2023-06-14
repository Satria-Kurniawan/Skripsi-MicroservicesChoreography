/*
  Warnings:

  - Added the required column `orderQuantity` to the `TemporaryTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productStock` to the `TemporaryTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `temporarytransaction` ADD COLUMN `orderQuantity` INTEGER NOT NULL,
    ADD COLUMN `productStock` INTEGER NOT NULL;
