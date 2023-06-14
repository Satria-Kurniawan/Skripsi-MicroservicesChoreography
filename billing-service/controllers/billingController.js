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

        const paymentStatus = "UNPAID";

        let paymentCode = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        for (let i = 0; i < 20; i++) {
          const randomIndex = Math.floor(Math.random() * characters.length);
          paymentCode += characters.charAt(randomIndex);
        }

        const { quantity, price, paymentMethod, user, stock } = orderDataValid;
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
            expiresAt: billing.dueDate,
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

export async function updateBilling() {
  const paymentDate = new Date().toISOString();

  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("UPDATE_BILLING_STATUS");
    await channel.bindQueue("UPDATE_BILLING_STATUS", "PAYMENT_EXCHANGE", "");
    channel.consume(
      "UPDATE_BILLING_STATUS",
      async (message) => {
        const paymentDataString = message.content.toString();
        const paymentData = JSON.parse(paymentDataString);
        const { billingId, paymentStatus } = paymentData;

        const billingData = await prisma.billing.update({
          where: { id: billingId },
          data: { paymentStatus, paymentDate },
        });

        if (!billingData) return;

        await channel.assertExchange("PAYMENT_FINISH_EXCHANGE", "fanout", {
          durable: false,
        });
        channel.publish(
          "PAYMENT_FINISH_EXCHANGE",
          "billing",
          Buffer.from(JSON.stringify(billingData))
        );
      },
      { noAck: true }
    );
  } catch (error) {
    console.log(error);
  }
}

export async function expiredBilling() {
  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("UPDATE_EXPIRED_BILLINGS");
    await channel.bindQueue(
      "UPDATE_EXPIRED_BILLINGS",
      "TRANSACTIONS_CANCEL_EXCHANGE",
      ""
    );
    channel.consume("UPDATE_EXPIRED_BILLINGS", async (message) => {
      const content = message.content.toString();
      const data = JSON.parse(content);

      for (const obj of data) {
        try {
          await prisma.billing.update({
            where: { id: obj.billingId },
            data: { paymentStatus: "EXPIRED" },
          });
        } catch (error) {
          console.log(error);
        }
      }

      await channel.assertExchange(
        "TRANSACTIONS_CANCEL_SUCCESS_EXCHANGE",
        "fanout",
        { durable: false }
      );
      channel.publish(
        "TRANSACTIONS_CANCEL_SUCCESS_EXCHANGE",
        "",
        Buffer.from(JSON.stringify("Cancelation success."))
      );
    });
  } catch (error) {
    console.log(error);
  }
}

export async function test3Microservices() {
  try {
    const { channel } = await createAmqpConnection();

    channel.assertQueue("GET_BILLING", { durable: false });
    channel.consume(
      "GET_BILLING",
      async (message) => {
        const content = message.content.toString();
        const data = JSON.parse(content);

        const billing = await prisma.billing.findFirst({
          where: { id: data.billingId },
        });

        if (!billing) return;

        channel.ack(message);

        channel.assertQueue("GET_USER_&_BILLING_FINISH", { durable: false });
        channel.sendToQueue(
          "GET_USER_&_BILLING_FINISH",
          Buffer.from(JSON.stringify({ user: data.user, billing }))
        );
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}
