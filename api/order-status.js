const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }

  return value;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

async function sendWhatsAppText(to, body) {
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
        to,

        type: "text",

        text: {
          body,
          preview_url: false
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(
      "Meta rechazó la notificación:",
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

  return data;
}

export default async function handler(req, res) {
  /*
   * Permite comprobar que el endpoint está activo.
   */
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Notificaciones de pedidos"
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");

    return res
      .status(405)
      .json({
        ok: false,
        error: "Método no permitido"
      });
  }

  try {
    const expectedSecret =
      requiredEnv("STATUS_WEBHOOK_SECRET");

    const {
      secret,
      phone,
      orderId,
      status
    } = req.body || {};

    if (!secret || secret !== expectedSecret) {
      return res.status(401).json({
        ok: false,
        error: "Clave incorrecta"
      });
    }

    if (status !== "Listo") {
      return res.status(400).json({
        ok: false,
        error: "El estado debe ser Listo"
      });
    }

    const normalizedPhone = normalizePhone(phone);
    const normalizedOrderId = String(orderId || "").trim();

    if (!normalizedPhone || !normalizedOrderId) {
      return res.status(400).json({
        ok: false,
        error: "Faltan el teléfono o el código del pedido"
      });
    }

    await sendWhatsAppText(
      normalizedPhone,

      `✅ *Su pedido ${normalizedOrderId} está listo.*\n\n` +
      "Será enviado dentro de poco.\n\n" +
      "Gracias por pedir en *Otra Cosita* 🍔"
    );

    return res.status(200).json({
      ok: true,
      phone: normalizedPhone,
      orderId: normalizedOrderId,
      notified: true
    });
  } catch (error) {
    console.error(
      "Error enviando notificación:",
      error?.stack || error
    );

    return res.status(500).json({
      ok: false,
      error: error?.message || "Error desconocido"
    });
  }
}
