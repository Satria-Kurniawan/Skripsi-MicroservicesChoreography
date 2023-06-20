import { PrismaClient } from "@prisma/client";
import { createAmqpConnection } from "../../order-service/messageBroker/index.js";

const prisma = new PrismaClient();

export async function createShipping() {
  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("CREATE_SHIPPING_DATA");
    channel.consume(
      "CREATE_SHIPPING_DATA",
      async (message) => {
        const content = message.content.toString();
        const orderData = JSON.parse(content);

        const { shippingCarrier, shippingAddress, status, userId } = orderData;

        const shippingData = await prisma.shipping.create({
          data: {
            carrier: shippingCarrier || "",
            currentLocation: "",
            shippingAddress: shippingAddress || "",
            status: status || "",
            trackingNumber: "sje2j9u9u12j1d01",
            userId,
            orderId: orderData.id,
          },
        });

        if (!shippingData) return;

        channel.assertQueue("CREATE_SHIPPING_DATA_SUCCESS");
        channel.sendToQueue(
          "CREATE_SHIPPING_DATA_SUCCESS",
          Buffer.from(JSON.stringify(shippingData))
        );

        channel.ack(message);
      },
      { noAck: false }
    );

    // channel.assertQueue("PAYMENT_ORDER_UPDATED", { durable: true });
    // channel.consume(
    //   "PAYMENT_ORDER_UPDATED",
    //   async (message) => {
    //     const paymentDataString = message.content.toString();
    //     const paymentData = JSON.parse(paymentDataString);

    //     const { orderData, billingData } = paymentData;

    //     if (billingData.paymentStatus === "PAID") {
    //       const shippingData = await prisma.shipping.create({
    //         data: {
    //           carrier: orderData.shippingCarrier,
    //           currentLocation: "",
    //           shippingAddress: orderData.shippingAddress,
    //           status: "Dikemas",
    //           trackingNumber: "sfjksefjksef",
    //           userId: orderData.userId,
    //           orderId: orderData.id,
    //         },
    //       });

    //       channel.assertQueue("PAYMENT_FINISH", { durable: true });
    //       channel.sendToQueue(
    //         "PAYMENT_FINISH",
    //         Buffer.from(
    //           JSON.stringify({ shippingData, orderData, billingData })
    //         ),
    //         { persistent: true }
    //       );
    //     }

    //     channel.ack(message);
    //   },
    //   { noAck: false }
    // );
  } catch (error) {
    console.log(error);
  }
}
