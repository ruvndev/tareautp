const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v25.0";

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

async function sendButtons(to, bodyText, buttons, footerText = "Bot de demostración") {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      footer: { text: footerText },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: {
            id: button.id,
            title: button.title
          }
        }))
      }
    }
  });
}

async function sendMainMenu(to) {
  return sendButtons(
    to,
    "👋 Bienvenido. ¿Qué deseas consultar?",
    [
      { id: "MENU_VER", title: "Ver menú" },
      { id: "HORARIOS", title: "Horarios" },
      { id: "CONTACTO", title: "Contacto" }
    ]
  );
}

async function sendFoodMenu(to) {
  return sendButtons(
    to,
    "🍽️ *MENÚ*\n\n1. Pollo a la brasa — S/ 18\n2. Lomo saltado — S/ 22\n3. Arroz chaufa — S/ 16\n\nSelecciona una opción:",
    [
      { id: "PEDIR", title: "Hacer pedido" },
      { id: "VOLVER", title: "Volver atrás" }
    ],
    "Precios de demostración"
  );
}

async function routeMessage(to, message) {
  const interactiveId =
    message?.interactive?.button_reply?.id ||
    message?.interactive?.list_reply?.id;

  const text = message?.text?.body?.trim().toLowerCase() || "";
  const action = interactiveId || text;

  switch (action) {
    case "MENU_VER":
    case "menu":
    case "ver menu":
    case "ver menú":
      return sendFoodMenu(to);

    case "HORARIOS":
    case "horario":
    case "horarios":
      return sendButtons(
        to,
        "🕒 Atendemos de lunes a domingo, de 11:00 a. m. a 10:00 p. m.",
        [{ id: "VOLVER", title: "Volver atrás" }]
      );

    case "CONTACTO":
    case "contacto":
      return sendButtons(
        to,
        "📞 Teléfono: 999 999 999\n📍 Dirección: Av. Ejemplo 123, Lima",
        [{ id: "VOLVER", title: "Volver atrás" }]
      );

    case "PEDIR":
      return sendButtons(
        to,
        "✍️ Escribe tu pedido en un solo mensaje.\nEjemplo: 1 pollo a la brasa y una gaseosa.",
        [{ id: "VOLVER", title: "Volver atrás" }]
      );

    case "VOLVER":
    case "volver":
    case "atrás":
    case "atras":
      return sendMainMenu(to);

    case "hola":
    case "inicio":
    case "start":
    case "":
      return sendMainMenu(to);

    default:
      await sendText(to, "Recibí tu mensaje. Usa los botones para navegar.");
      return sendMainMenu(to);
  }
}

export default async function handler(req, res) {
  // Meta usa GET para verificar que la URL del webhook te pertenece.
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Token de verificación incorrecto");
  }

  // Meta envía mensajes y estados mediante POST.
  if (req.method === "POST") {
    // Respondemos 200 incluso cuando solo llega un cambio de estado.
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
      // Devolver 200 evita reintentos infinitos durante la demostración.
      return res.status(200).json({ received: true, bot_error: true });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Método no permitido");
}
