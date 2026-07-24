const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  "https://tareautp.vercel.app"
).replace(/\/+$/, "");

const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL ||
  `${PUBLIC_BASE_URL}/menu.jpg`;

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

async function sendWhatsApp(payload) {
  const token = requiredEnv("WHATSAPP_TOKEN");
  const phoneNumberId = requiredEnv("PHONE_NUMBER_ID");

  const url =
    `https://graph.facebook.com/` +
    `${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
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
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(
      "Error de Meta:",
      JSON.stringify(
        {
          status: response.status,
          data,
          payloadType: payload.type
        },
        null,
        2
      )
    );

    throw new Error(
      data?.error?.message ||
      `Meta respondió con estado ${response.status}`
    );
  }

  console.log(
    "Mensaje enviado correctamente:",
    JSON.stringify({
      type: payload.type,
      messageId: data?.messages?.[0]?.id
    })
  );

  return data;
}

async function sendText(to, text) {
  return sendWhatsApp({
    to,
    type: "text",
    text: {
      body: text,
      preview_url: false
    }
  });
}

async function sendMenuImage(to) {
  return sendWhatsApp({
    to,
    type: "image",
    image: {
      link: MENU_IMAGE_URL,
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
        text: "Presiona el botón para comenzar tu pedido 👇"
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

async function sendOrderPrompt(to) {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "🍔 Envíanos tu pedido en un solo mensaje.\n\n" +
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

async function sendWelcomeMenu(to) {
  try {
    await sendMenuImage(to);
  } catch (error) {
    console.error(
      "No se pudo enviar la imagen del menú:",
      error.message
    );

    // El bot seguirá respondiendo aunque Meta rechace la imagen.
    await sendText(
      to,
      "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n" +
      "¿Qué se te antoja hoy?\n\n" +
      `Puedes ver el menú aquí:\n${MENU_IMAGE_URL}`
    );
  }

  return sendOrderButton(to);
}

async function routeMessage(to, message) {
  const buttonId =
    message?.interactive?.button_reply?.id;

  const listId =
    message?.interactive?.list_reply?.id;

  const action = buttonId || listId;

  if (action === "HACER_PEDIDO") {
    return sendOrderPrompt(to);
  }

  if (action === "VOLVER_MENU") {
    return sendWelcomeMenu(to);
  }

  // Cualquier texto, imagen, audio, sticker u otro mensaje
  // hace que el bot muestre nuevamente el menú.
  return sendWelcomeMenu(to);
}

export default async function handler(req, res) {
  /*
   * Meta usa GET para verificar el webhook.
   */
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

    return res
      .status(403)
      .send("Token de verificación incorrecto");
  }

  /*
   * Meta usa POST para entregar mensajes y estados.
   */
  if (req.method === "POST") {
    try {
      const entries = req.body?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          const value = change?.value;
          const messages = value?.messages || [];

          for (const message of messages) {
            const from = message?.from;

            if (!from) {
              continue;
            }

            console.log(
              "Mensaje recibido:",
              JSON.stringify({
                from,
                type: message.type,
                messageId: message.id,
                text: message?.text?.body || null,
                button:
                  message?.interactive?.button_reply?.id ||
                  null
              })
            );

            await routeMessage(from, message);
          }
        }
      }

      return res.status(200).json({
        received: true
      });
    } catch (error) {
      console.error(
        "Error procesando webhook:",
        error?.stack || error?.message || error
      );

      // Se devuelve 200 para impedir reintentos continuos de Meta.
      return res.status(200).json({
        received: true,
        bot_error: true,
        error: error.message
      });
    }
  }

  res.setHeader("Allow", "GET, POST");

  return res
    .status(405)
    .send("Método no permitido");
}
