import { createAmqpConnection } from "../messageBroker/index.js";
import { PrismaClient } from "../prisma/generated/client_order/index.js";

const prisma = new PrismaClient();

export async function createOrder(req, res) {
  const productId = req.query.productId;
  const { paymentMethod, quantity, note, shippingCarrier } = req.body;

  try {
    const { connection, channel } = await createAmqpConnection();

    channel.assertQueue("ORDER_START", { durable: true });
    const orderData = JSON.stringify({
      productId,
      quantity,
      paymentMethod,
      note,
      userId: req.user.id,
    });
    channel.sendToQueue("ORDER_START", Buffer.from(orderData), {
      persistent: true,
    });

    const orderCreate = new Promise((resolve, reject) => {
      channel.assertQueue("ORDER_FINISH", { durable: true });
      channel.consume(
        "ORDER_FINISH",
        async (message) => {
          const orderDataCompleteString = message.content.toString();
          const orderDataComplete = JSON.parse(orderDataCompleteString);

          const { quantity, price, user, billing } = orderDataComplete;

          const order = await prisma.order.create({
            data: {
              status: "UNPAID.",
              quantity: parseInt(quantity),
              price,
              amount: billing.amount,
              shippingAddress: user.shippingAddress,
              shippingCarrier,
              note,
              productId,
              billingId: billing.id,
              userId: user.id,
            },
          });

          const temporaryTransaction = {
            orderId: order.id,
            productId,
            billingId: orderDataComplete.billing.id,
            expiresAt: orderDataComplete.billing.expiresAt,
            productStock: orderDataComplete.stock,
            orderQuantity: parseInt(quantity),
          };

          await channel.assertExchange("ORDER_SUCCESS_EXCHANGE", "fanout", {
            durable: false,
          });
          channel.publish(
            "ORDER_SUCCESS_EXCHANGE",
            "",
            Buffer.from(JSON.stringify(temporaryTransaction))
          );

          if (order)
            resolve({
              success: true,
              message: "Order berhasil.",
              data: { order },
            });
          else
            reject({
              success: false,
              message: "Gagal melakukan order.",
            });

          channel.close();
          connection.close();
          // channel.ack(message);
        },
        { noAck: true }
      );
    });

    orderCreate
      .then((result) => {
        res.status(201).json(result);
        return;
      })
      .catch((error) => {
        res.status(400).json(error);
      });

    const orderInvalid = new Promise((resolve, reject) => {
      channel.assertQueue("ORDER_INVALID", { durable: true });
      channel.consume(
        "ORDER_INVALID",
        async (message) => {
          const orderDataInvalidString = message.content.toString();
          const orderDataInvalid = JSON.parse(orderDataInvalidString);

          resolve(orderDataInvalid);
          reject({
            success: false,
            message: "Gagal melakukan order.",
          });

          channel.close();
          connection.close();
        },
        { noAck: true }
      );
    });

    orderInvalid
      .then((result) => {
        res.status(400).json({ result });
      })
      .catch((error) => {
        res.status(400).json(error);
      });
  } catch (error) {
    res.status(500).json({ error });
  }
}

export async function updateOrderByBillingId() {
  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("UPDATE_ORDER_STATUS");
    await channel.bindQueue("UPDATE_ORDER_STATUS", "PAYMENT_EXCHANGE", "");
    channel.consume(
      "UPDATE_ORDER_STATUS",
      async (message) => {
        const paymentDataString = message.content.toString();
        const paymentData = JSON.parse(paymentDataString);
        const { billingId, paymentStatus } = paymentData;

        const updatedOrder = await prisma.order.updateMany({
          where: { billingId: billingId },
          data: { status: paymentStatus },
        });

        if (updatedOrder.count === 0) return;

        const orderData = await prisma.order.findFirst({
          where: { billingId: billingId },
        });

        if (!orderData) return;

        await channel.assertExchange("PAYMENT_FINISH_EXCHANGE", "fanout", {
          durable: false,
        });
        channel.publish(
          "PAYMENT_FINISH_EXCHANGE",
          "order",
          Buffer.from(JSON.stringify(orderData))
        );
      },
      { noAck: true }
    );
  } catch (error) {
    console.log(error);
  }
}

export async function expiredOrder() {
  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("UPDATE_EXPIRED_ORDERS");
    await channel.bindQueue(
      "UPDATE_EXPIRED_ORDERS",
      "TRANSACTIONS_CANCEL_EXCHANGE",
      ""
    );
    channel.consume("UPDATE_EXPIRED_ORDERS", async (message) => {
      const content = message.content.toString();
      const data = JSON.parse(content);

      for (const obj of data) {
        try {
          await prisma.order.update({
            where: { id: obj.orderId },
            data: { status: "EXPIRED" },
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

export async function test2Microservices(req, res) {
  const { userId } = req.query;
  if (!userId) return res.send("No user id");

  try {
    const { channel, connection } = await createAmqpConnection();

    channel.assertQueue("GET_USER", { durable: false });
    channel.sendToQueue("GET_USER", Buffer.from(userId), {
      replyTo: "GET_USER_FINISH",
    });

    const getUser = new Promise((resolve, reject) => {
      channel.consume(
        "GET_USER_FINISH",
        (message) => {
          const content = message.content.toString();
          const data = JSON.parse(content);

          channel.close();
          connection.close();

          if (!data) reject("Erorr get user");
          resolve(data);
        },
        { noAck: true }
      );
    });

    const user = await getUser;

    res.json({
      ok: true,
      message: "Test order-service dan user-service berhasil.",
      data: { user },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
}

export async function test3Microservices(req, res) {
  const { userId, billingId } = req.query;
  if (!userId || !billingId) return res.send("Invalid query params.");

  try {
    const { channel, connection } = await createAmqpConnection();

    channel.assertQueue("GET_USER_&_BILLING", { durable: false });
    channel.sendToQueue(
      "GET_USER_&_BILLING",
      Buffer.from(JSON.stringify({ userId, billingId }))
    );

    const getUserNBilling = new Promise((resolve, reject) => {
      channel.consume(
        "GET_USER_&_BILLING_FINISH",
        (message) => {
          const content = message.content.toString();
          const data = JSON.parse(content);

          if (!data) reject("Erorr get user dan billing.");
          resolve(data);
        },
        { noAck: true }
      );
    });

    const data = await getUserNBilling;

    if (data) {
      channel.close();
      connection.close();
    }

    res.json({
      ok: true,
      message: "Test order-service dan user-service berhasil.",
      data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
}
