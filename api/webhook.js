const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v25.0";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://tareautp.vercel.app";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
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
    console.error("Error de Meta:", response.status, data);
    throw new Error(data?.error?.message || `Meta respondió ${response.status}`);
  }

  return data;
}

async function sendText(to, text) {
  return sendWhatsApp({
    to,
    type: "text",
    text: { body: text, preview_url: false }
  });
}

async function sendWelcomeMenu(to) {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "image",
        image: {
          link: `${BASE_URL}/menu.jpg`
        }
      },
      body: {
        text: "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n¿Qué se te antoja hoy?"
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
        text: "🍔 *Perfecto.* Envíanos tu pedido en un solo mensaje.\n\nEjemplo:\n2 hamburguesas clásicas\n1 salchipapa\n1 Inca Kola"
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
  const interactiveId =
    message?.interactive?.button_reply?.id ||
    message?.interactive?.list_reply?.id;

  const text = message?.text?.body?.trim().toLowerCase() || "";
  const action = interactiveId || text;

  switch (action) {
    case "HACER_PEDIDO":
      return sendOrderPrompt(to);

    case "VOLVER_MENU":
      return sendWelcomeMenu(to);

    default:
      return sendWelcomeMenu(to);
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Token de verificación incorrecto");
  }

  if (req.method === "POST") {
    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return res.status(200).json({ received: true, type: "status_or_other_event" });
      }

      const from = message.from;
      await routeMessage(from, message);

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error procesando webhook:", error);
      return res.status(200).json({ received: true, bot_error: true });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Método no permitido");
}
