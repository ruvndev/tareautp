const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL ||
  "https://tareautp.vercel.app/menu.jpg";

/**
 * Obtiene una variable obligatoria de Vercel.
 */
function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

/**
 * Envía cualquier payload mediante WhatsApp Cloud API.
 */
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
    console.error(
      "Error enviado por Meta:",
      JSON.stringify(
        {
          status: response.status,
          error: data?.error || data
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
    "Mensaje enviado:",
    JSON.stringify({
      type: payload.type,
      messageId: data?.messages?.[0]?.id || null
    })
  );

  return data;
}

/**
 * Envía la imagen, bienvenida y botón en UN SOLO mensaje.
 */
async function sendWelcomeMenu(to) {
  return sendWhatsApp({
    to,
    type: "interactive",

    interactive: {
      type: "button",

      header: {
        type: "image",
        image: {
          link: MENU_IMAGE_URL
        }
      },

      body: {
        text:
          "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n" +
          "*¿Qué se te antoja hoy?*"
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

/**
 * Respuesta al pulsar Hacer Pedido.
 */
async function sendOrderPrompt(to) {
  return sendWhatsApp({
    to,
    type: "interactive",

    interactive: {
      type: "button",

      body: {
        text:
          "🍔 *¡Perfecto!*\n\n" +
          "Escribe tu pedido en un solo mensaje.\n\n" +
          "*Ejemplo:*\n" +
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

/**
 * Decide qué responder según el mensaje recibido.
 */
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

  /*
   * Cualquier mensaje enviado por el usuario:
   * texto, imagen, audio, sticker, etc.
   */
  return sendWelcomeMenu(to);
}

/**
 * Webhook principal.
 */
export default async function handler(req, res) {
  /*
   * Verificación inicial del webhook por parte de Meta.
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
   * Recepción de mensajes y estados de WhatsApp.
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
                type: message?.type || null,
                messageId: message?.id || null,
                text: message?.text?.body || null,
                buttonId:
                  message?.interactive?.button_reply?.id ||
                  null
              })
            );

            await routeMessage(from, message);
          }
        }
      }

      /*
       * Los eventos de estado no contienen messages.
       * También se responden correctamente con 200.
       */
      return res.status(200).json({
        received: true
      });
    } catch (error) {
      console.error(
        "Error procesando el webhook:",
        error?.stack ||
        error?.message ||
        error
      );

      /*
       * Devolvemos 200 para que Meta no repita
       * indefinidamente el mismo evento.
       */
      return res.status(200).json({
        received: true,
        bot_error: true,
        error: error?.message || "Error desconocido"
      });
    }
  }

  res.setHeader("Allow", "GET, POST");

  return res
    .status(405)
    .send("Método no permitido");
}
