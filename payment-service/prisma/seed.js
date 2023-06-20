import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function generateTemporaryTransactions() {
  const expires = new Date().toISOString();

  for (let index = 0; index < 50; index++) {
    await prisma.temporaryTransaction.create({
      data: {
        productStock: 80,
        orderQuantity: 1,
        orderId: "edd6fecc-bd1a-42b4-b8b2-ce9f3f5773aa",
        productId: "00019d20-813a-42c0-ad1c-d71ae55d745a",
        billingId: "6d5b6a7f-41f1-492c-9565-598fea9aaa9d",
        expiresAt: expires,
      },
    });
  }
}

generateTemporaryTransactions()
  .then(() => console.log("Berhasil generate temporary transactions"))
  .catch((e) => console.log(e))
  .finally(async () => await prisma.$disconnect());
