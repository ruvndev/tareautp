const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v25.0";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

function getMenuImageUrl() {
  const baseUrl = requiredEnv("PUBLIC_BASE_URL").replace(/\/+$/, "");
  return `${baseUrl}/menu.jpg`;
}

async function sendWhatsApp(payload) {
  const token = requiredEnv("WHATSAPP_TOKEN");
  const phoneNumberId = requiredEnv("PHONE_NUMBER_ID");

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...payload
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Meta rechazó el mensaje:", {
      status: response.status,
      error: data?.error || data
    });

    throw new Error(
      data?.error?.error_user_msg ||
      data?.error?.message ||
      `Meta respondió con HTTP ${response.status}`
    );
  }

  console.log("Mensaje enviado correctamente:", data);
  return data;
}

async function sendMenuImage(to) {
  return sendWhatsApp({
    to,
    type: "image",
    image: {
      link: getMenuImageUrl(),
      caption:
        "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n" +
        "¿Qué se te antoja hoy?"
    }
  });
}

async function sendOrderButton(to) {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "Pulsa el botón para comenzar tu pedido 👇"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "HACER_PEDIDO",
              title: "Hacer Pedido"
            }
          }
        ]
      }
    }
  });
}

async function sendWelcomeFlow(to) {
  // Primero envía la imagen y después el botón.
  await sendMenuImage(to);
  await sendOrderButton(to);
}

async function sendOrderPrompt(to) {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "🍔 *¡Perfecto!*\n\n" +
          "Escríbenos tu pedido en un solo mensaje.\n\n" +
          "Ejemplo:\n" +
          "2 hamburguesas clásicas\n" +
          "1 salchipapa\n" +
          "1 Inca Kola"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "VOLVER_MENU",
              title: "Volver al menú"
            }
          }
        ]
      }
    }
  });
}

async function routeMessage(to, message) {
  const action =
    message?.interactive?.button_reply?.id ||
    message?.interactive?.list_reply?.id ||
    null;

  if (action === "HACER_PEDIDO") {
    await sendOrderPrompt(to);
    return;
  }

  if (action === "VOLVER_MENU") {
    await sendWelcomeFlow(to);
    return;
  }

  // Cualquier mensaje normal, imagen, audio, sticker, etc.
  await sendWelcomeFlow(to);
}

function extractMessages(body) {
  const messages = [];

  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;

      for (const message of value?.messages || []) {
        if (message?.from) {
          messages.push(message);
        }
      }
    }
  }

  return messages;
}

export default async function handler(req, res) {
  // Meta usa GET para verificar el webhook.
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
      mode === "subscribe" &&
      token === process.env.VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Token de verificación incorrecto");
  }

  // Meta usa POST para enviar mensajes y estados.
  if (req.method === "POST") {
    try {
      const messages = extractMessages(req.body);

      // Los eventos de entrega y lectura no traen mensajes.
      if (messages.length === 0) {
        return res.status(200).json({
          received: true,
          type: "status_or_other_event"
        });
      }

      for (const message of messages) {
        await routeMessage(message.from, message);
      }

      return res.status(200).json({
        received: true,
        processed: messages.length
      });
    } catch (error) {
      console.error("Error procesando webhook:", error);

      return res.status(200).json({
        received: true,
        bot_error: true,
        message: error.message
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Método no permitido");
}
