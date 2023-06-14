import { PrismaClient } from "@prisma/client";
import { createAmqpConnection } from "../../order-service/messageBroker/index.js";

const prisma = new PrismaClient();

export async function saveTemporaryTransaction() {
  const { channel, connection } = await createAmqpConnection();

  await channel.assertQueue("ORDER_CREATE_TEMPORARY_TRANSACTION");
  await channel.bindQueue(
    "ORDER_CREATE_TEMPORARY_TRANSACTION",
    "ORDER_SUCCESS_EXCHANGE",
    ""
  );

  channel.consume(
    "ORDER_CREATE_TEMPORARY_TRANSACTION",
    async (message) => {
      const temporaryTransactionString = message.content.toString();
      const temporaryTransaction = JSON.parse(temporaryTransactionString);

      const {
        orderId,
        productId,
        billingId,
        productStock,
        orderQuantity,
        expiresAt,
      } = temporaryTransaction;

      const expires = new Date().toISOString();

      await prisma.temporaryTransaction.create({
        data: {
          productStock,
          orderQuantity,
          orderId,
          productId,
          billingId,
          expiresAt: expires,
        },
      });

      channel.ack(message);
    },
    { noAck: false }
  );
}

export async function confirmPayment(req, res) {
  const { billingId } = req.query;
  const { paymentStatus } = req.body;

  try {
    const { connection, channel } = await createAmqpConnection();

    await channel.assertExchange("PAYMENT_EXCHANGE", "fanout", {
      durable: false,
    });
    channel.publish(
      "PAYMENT_EXCHANGE",
      "",
      Buffer.from(JSON.stringify({ billingId, paymentStatus }))
    );

    await channel.assertQueue("PAYMENT_FINISH");
    await channel.bindQueue("PAYMENT_FINISH", "PAYMENT_FINISH_EXCHANGE", "");

    const updateBillingStatus = new Promise(async (resolve, reject) => {
      channel.consume(
        "PAYMENT_FINISH",
        (message) => {
          const content = message.content.toString();
          const billingData = JSON.parse(content);

          if (!billingData) reject("Error updating billing data.");
          if (message.fields.routingKey === "billing") resolve(billingData);
        },
        { noAck: true }
      );
    });

    const updateOrderStatus = new Promise(async (resolve, reject) => {
      channel.consume(
        "PAYMENT_FINISH",
        (message) => {
          const content = message.content.toString();
          const orderData = JSON.parse(content);

          if (!orderData) reject("Error updating order data.");
          if (message.fields.routingKey === "order") resolve(orderData);
        },
        { noAck: true }
      );
    });

    const billingData = await updateBillingStatus;
    const orderData = await updateOrderStatus;

    if (!billingData && !orderData)
      return res.status(500).json({
        ok: false,
        message: "Gagal menyelesaikan pembayaran.",
      });

    channel.assertQueue("CREATE_SHIPPING_DATA");
    channel.sendToQueue(
      "CREATE_SHIPPING_DATA",
      Buffer.from(JSON.stringify(orderData))
    );

    const createShippingData = new Promise((resolve, reject) => {
      channel.assertQueue("CREATE_SHIPPING_DATA_SUCCESS");
      channel.consume(
        "CREATE_SHIPPING_DATA_SUCCESS",
        (message) => {
          const content = message.content.toString();
          const shippingData = JSON.parse(content);

          if (!shippingData) reject("Error creating shipping data.");
          resolve(shippingData);

          channel.close();
          connection.close();
        },
        { noAck: true }
      );
    });

    const shippingData = await createShippingData;

    res.status(200).json({
      ok: true,
      message: "Berhasil menyelesaikan pembayaran.",
      data: { billingData, orderData, shippingData },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      message: "Kesalahan pada server.",
      statusCode: 500,
    });
  }
}

export async function cancelTransactions(req, res) {
  try {
    const currentDate = new Date().toISOString();

    const temporaryTransactions = await prisma.temporaryTransaction.findMany({
      where: { expiresAt: { lt: currentDate } },
    });

    if (!temporaryTransactions.length)
      return res.send("No expired transactions");
    // return console.log("no expired transactions");

    const { connection, channel } = await createAmqpConnection();

    await channel.assertExchange("TRANSACTIONS_CANCEL_EXCHANGE", "fanout", {
      durable: false,
    });
    channel.publish(
      "TRANSACTIONS_CANCEL_EXCHANGE",
      "",
      Buffer.from(JSON.stringify(temporaryTransactions))
    );

    const cancelation = new Promise(async (resolve, reject) => {
      await channel.assertQueue("TRANSACTION_CANCEL_SUCCESS");
      await channel.bindQueue(
        "TRANSACTION_CANCEL_SUCCESS",
        "TRANSACTIONS_CANCEL_SUCCESS_EXCHANGE",
        ""
      );
      channel.consume("TRANSACTION_CANCEL_SUCCESS", async (message) => {
        const content = message.content.toString();
        const data = JSON.parse(content);

        if (!data) reject("Cancelation error.");
        resolve(data);
      });
    });

    cancelation
      .then(async (result) => {
        await prisma.temporaryTransaction.deleteMany({
          where: { expiresAt: { lt: currentDate } },
        });

        res.send({
          result,
          temporaryTransactions,
        });
      })
      .catch((error) => {
        res.send(error);
      });
  } catch (error) {
    console.log(error);
  }
}
