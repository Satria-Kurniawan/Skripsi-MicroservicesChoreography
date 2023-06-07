import { PrismaClient } from "@prisma/client";
import { createAmqpConnection } from "../../order-service/messageBroker/index.js";

const prisma = new PrismaClient();

export async function createBilling() {
  try {
    const { channel, connection } = await createAmqpConnection();

    channel.assertQueue("ORDER_USER_VALID", { durable: true });
    channel.consume(
      "ORDER_USER_VALID",
      async (message) => {
        const orderDataValidString = message.content.toString();
        const orderDataValid = JSON.parse(orderDataValidString);

        const currentDate = new Date();
        const dueDate = new Date(
          currentDate.setDate(currentDate.getDate() + 1)
        );

        const paymentStatus = "Menunggu pembayaran.";

        let paymentCode = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        for (let i = 0; i < 20; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          paymentCode += characters.charAt(randomIndex);
        }

        const { quantity, price, paymentMethod, user } = orderDataValid;
        const amount = quantity * price;

        const billing = await prisma.billing.create({
          data: {
            amount,
            paymentMethod,
            dueDate,
            paymentStatus,
            userId: user.id,
            paymentCode,
          },
        });

        const orderDataComplete = {
          ...orderDataValid,
          billing: {
            id: billing.id,
            amount: billing.amount,
          },
        };

        channel.assertQueue("ORDER_FINISH", { durable: true });
        channel.sendToQueue(
          "ORDER_FINISH",
          Buffer.from(JSON.stringify(orderDataComplete)),
          { persistent: true }
        );

        channel.ack(message);
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}
