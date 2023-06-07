import amqp from "amqplib";

const AMQP_URL = process.env.AMQP_URL;

export async function createAmqpConnection() {
  const connection = await amqp.connect(AMQP_URL);
  const channel = await connection.createChannel();
  return { channel, connection };
}
