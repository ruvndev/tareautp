const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v25.0";
const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL || "https://tareautp.vercel.app/menu.jpg";

const MAKIS = {
  sizes: {
    12: { price: 20.9, flavors: 1 },
    24: { price: 35.9, flavors: 2 },
    36: { price: 49.9, flavors: 3 },
    48: { price: 65.9, flavors: 4 }
  },
  flavors: [
    { id: "ACEVICHADO", name: "Acevichado" },
    { id: "ACEV_CLASSIC", name: "Acevichado Classic" },
    { id: "NIKUMAKI", name: "Nikumaki" },
    { id: "KOREAN_BBQ", name: "Korean BBQ" },
    { id: "UMIMAKI", name: "Umimaki" },
    { id: "SAKURA", name: "Sakura" },
    { id: "FURAI", name: "Furai" },
    { id: "MIDORI", name: "Midori" },
    { id: "NAMI", name: "Nami" },
    { id: "OTRA_COSITA", name: "Otra Cosita" },
    { id: "KRAKEN", name: "Kraken" }
  ]
};

const WINGS = {
  pricePerPortion: 24.9,
  unitsPerPortion: 6,
  flavors: [
    { id: "ACEVICHADAS", name: "Acevichadas" },
    { id: "PANKO", name: "Panko Wings" },
    { id: "KOREAN_BBQ", name: "Korean BBQ" },
    { id: "ORIENTALES", name: "Orientales" },
    { id: "SAKURA", name: "Sakura" },
    { id: "BUFFALO", name: "Buffalo" }
  ]
};

const DRINKS = {
  INKA_COLA: { name: "Inka Cola", price: 5 },
  COCA_COLA: { name: "Coca Cola", price: 5 },
  CHICHA_MORADA: { name: "Chicha Morada", price: 5 }
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function freshSession(phone) {
  return {
    phone,
    state: "IDLE",
    cart: [],
    pending: null,
    customer: {
      name: "",
      modality: "",
      address: "",
      payment: ""
    },
    updatedAt: new Date().toISOString()
  };
}

function calculateTotal(cart = []) {
  return cart.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
}

function extractAction(message) {
  return (
    message?.interactive?.button_reply?.id ||
    message?.interactive?.list_reply?.id ||
    ""
  );
}

function extractText(message) {
  return message?.text?.body?.trim() || "";
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
    console.error(
      "Error de Meta:",
      JSON.stringify({ status: response.status, data, payloadType: payload.type })
    );
    throw new Error(data?.error?.message || `Meta respondió ${response.status}`);
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

async function sendText(to, body) {
  return sendWhatsApp({
    to,
    type: "text",
    text: { body, preview_url: false }
  });
}

async function sendButtons(to, body, buttons, footer) {
  const interactive = {
    type: "button",
    body: { text: body },
    action: {
      buttons: buttons.slice(0, 3).map((button) => ({
        type: "reply",
        reply: {
          id: button.id,
          title: button.title
        }
      }))
    }
  };

  if (footer) interactive.footer = { text: footer };

  return sendWhatsApp({
    to,
    type: "interactive",
    interactive
  });
}

async function sendList(to, body, buttonText, rows, sectionTitle = "Opciones") {
  return sendWhatsApp({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonText,
        sections: [
          {
            title: sectionTitle,
            rows: rows.slice(0, 10)
          }
        ]
      }
    }
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
        image: { link: MENU_IMAGE_URL }
      },
      body: {
        text: "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n*¿Qué se te antoja hoy?*"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "HACER_PEDIDO", title: "Hacer Pedido" }
          }
        ]
      }
    }
  });
}

async function sendCategories(to) {
  return sendButtons(
    to,
    "🍽️ *¿Qué deseas agregar a tu pedido?*",
    [
      { id: "CAT_MAKIS", title: "Makis" },
      { id: "CAT_ALITAS", title: "Alitas" },
      { id: "CAT_BEBIDAS", title: "Bebidas" }
    ]
  );
}

async function sendMakiSizes(to) {
  return sendList(
    to,
    "🍣 *Selecciona el tamaño de tus makis:*",
    "Elegir tamaño",
    [
      {
        id: "MAKI_SIZE_12",
        title: "12 cortes — S/ 20.90",
        description: "Escoge 1 sabor"
      },
      {
        id: "MAKI_SIZE_24",
        title: "24 cortes — S/ 35.90",
        description: "Escoge 2 sabores"
      },
      {
        id: "MAKI_SIZE_36",
        title: "36 cortes — S/ 49.90",
        description: "Escoge 3 sabores"
      },
      {
        id: "MAKI_SIZE_48",
        title: "48 cortes — S/ 65.90",
        description: "Escoge 4 sabores"
      },
      {
        id: "VOLVER_CATEGORIAS",
        title: "Volver",
        description: "Regresar a las categorías"
      }
    ],
    "Tamaños"
  );
}

function selectedFlavorText(session) {
  const selected = session?.pending?.flavors || [];
  if (!selected.length) return "Todavía no elegiste sabores.";
  return `Elegidos: ${selected.join(", ")}`;
}

async function sendMakiFlavors(to, session, page = 1) {
  const selected = session?.pending?.flavors || [];
  const required = session?.pending?.requiredFlavors || 1;
  const remaining = required - selected.length;

  const pageOne = MAKIS.flavors.slice(0, 8).map((flavor) => ({
    id: `MAKI_FLAVOR_${flavor.id}`,
    title: flavor.name,
    description: "Agregar este sabor"
  }));

  const pageTwo = MAKIS.flavors.slice(8).map((flavor) => ({
    id: `MAKI_FLAVOR_${flavor.id}`,
    title: flavor.name,
    description: "Agregar este sabor"
  }));

  if (page === 1) {
    pageOne.push({
      id: "MAKI_FLAVORS_PAGE_2",
      title: "Ver más sabores",
      description: "Nami, Otra Cosita y Kraken"
    });
  } else {
    pageTwo.push({
      id: "MAKI_FLAVORS_PAGE_1",
      title: "Volver a sabores",
      description: "Regresar a la primera lista"
    });
  }

  return sendList(
    to,
    `🍣 *Escoge un sabor.*\nTe ${remaining === 1 ? "falta" : "faltan"} ${remaining}.\n${selectedFlavorText(
      session
    )}`,
    "Ver sabores",
    page === 1 ? pageOne : pageTwo,
    page === 1 ? "Sabores 1 de 2" : "Sabores 2 de 2"
  );
}

async function sendWingFlavors(to) {
  return sendList(
    to,
    "🍗 *Selecciona el sabor de tus alitas:*\nCada porción trae 6 unidades y cuesta S/ 24.90.",
    "Ver sabores",
    [
      ...WINGS.flavors.map((flavor) => ({
        id: `WING_FLAVOR_${flavor.id}`,
        title: flavor.name,
        description: "6 unidades por porción"
      })),
      {
        id: "VOLVER_CATEGORIAS",
        title: "Volver",
        description: "Regresar a las categorías"
      }
    ],
    "Sabores de alitas"
  );
}

async function sendQuantityList(to, prefix, title, description) {
  const rows = [];
  for (let quantity = 1; quantity <= 6; quantity += 1) {
    rows.push({
      id: `${prefix}_${quantity}`,
      title: `${quantity} ${quantity === 1 ? "unidad" : "unidades"}`,
      description
    });
  }
  rows.push({
    id: "VOLVER_CATEGORIAS",
    title: "Volver",
    description: "Regresar a las categorías"
  });

  return sendList(to, title, "Elegir cantidad", rows, "Cantidad");
}

async function sendDrinkOptions(to) {
  return sendButtons(
    to,
    "🥤 *Selecciona una bebida:*\nTodas cuestan S/ 5.00.",
    [
      { id: "DRINK_INKA_COLA", title: "Inka Cola" },
      { id: "DRINK_COCA_COLA", title: "Coca Cola" },
      { id: "DRINK_CHICHA_MORADA", title: "Chicha Morada" }
    ]
  );
}

function itemSummary(item) {
  if (item.kind === "makis") {
    return `• Makis ${item.cuts} cortes (${item.flavors.join(", ")}) — S/ ${money(
      item.subtotal
    )}`;
  }

  if (item.kind === "alitas") {
    return `• ${item.portions} ${item.portions === 1 ? "porción" : "porciones"} de alitas ${
      item.flavor
    } (${item.units} unidades) — S/ ${money(item.subtotal)}`;
  }

  if (item.kind === "bebida") {
    return `• ${item.quantity} × ${item.name} — S/ ${money(item.subtotal)}`;
  }

  return "• Producto";
}

function cartSummary(cart = []) {
  if (!cart.length) return "Tu carrito está vacío.";
  const lines = cart.map(itemSummary);
  lines.push(`\n*Subtotal: S/ ${money(calculateTotal(cart))}*`);
  return lines.join("\n");
}

async function sendCartActions(to, session, addedText) {
  return sendButtons(
    to,
    `✅ *${addedText}*\n\n${cartSummary(session.cart)}\n\n¿Qué deseas hacer ahora?`,
    [
      { id: "AGREGAR_MAS", title: "Agregar más" },
      { id: "FINALIZAR_PEDIDO", title: "Finalizar" },
      { id: "CANCELAR_PEDIDO", title: "Cancelar" }
    ]
  );
}

async function sendModality(to) {
  return sendButtons(
    to,
    "🛵 *¿Cómo deseas recibir tu pedido?*",
    [
      { id: "MOD_DELIVERY", title: "Delivery" },
      { id: "MOD_RECOJO", title: "Recojo" },
      { id: "CANCELAR_PEDIDO", title: "Cancelar" }
    ]
  );
}

async function sendPaymentMethods(to) {
  return sendButtons(
    to,
    "💳 *Selecciona tu método de pago:*",
    [
      { id: "PAY_YAPE", title: "Yape" },
      { id: "PAY_EFECTIVO", title: "Efectivo" },
      { id: "PAY_TARJETA", title: "Tarjeta" }
    ]
  );
}

function finalSummary(session) {
  const customer = session.customer || {};
  const locationLine =
    customer.modality === "Delivery"
      ? `Dirección: ${customer.address}`
      : "Entrega: Recojo en tienda";

  return (
    `🧾 *Resumen:*\n\n` +
    `${cartSummary(session.cart)}\n\n` +
    `Modalidad: ${customer.modality}\n` +
    `Nombre: ${customer.name}\n` +
    `${locationLine}\n` +
    `Pago: ${customer.payment}\n\n` +
    `*Total: S/ ${money(calculateTotal(session.cart))}*\n\n` +
    "¿Confirmas tu pedido?"
  );
}

async function sendConfirmation(to, session) {
  return sendButtons(
    to,
    finalSummary(session),
    [
      { id: "CONFIRMAR_PEDIDO", title: "Confirmar pedido" },
      { id: "CANCELAR_PEDIDO", title: "Cancelar pedido" }
    ],
    "Revisa todos los datos antes de confirmar"
  );
}

async function sendCancelled(to) {
  return sendButtons(
    to,
    "❌ *Pedido cancelado.*\nNo se registró ninguna orden.",
    [{ id: "NUEVO_PEDIDO", title: "Nuevo pedido" }]
  );
}

async function sheetsApi(action, payload = {}) {
  const url = requiredEnv("SHEETS_API_URL");
  const secret = requiredEnv("SHEETS_API_SECRET");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, action, ...payload })
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Sheets devolvió una respuesta inválida: ${raw.slice(0, 180)}`);
  }

  if (!data.ok) {
    throw new Error(data.error || "Error desconocido en Google Sheets");
  }

  return data;
}

async function getSession(phone) {
  const result = await sheetsApi("get_session", { phone });
  return result.session || freshSession(phone);
}

async function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  await sheetsApi("save_session", { session });
}

async function deleteSession(phone) {
  await sheetsApi("delete_session", { phone });
}

async function claimMessage(messageId) {
  const result = await sheetsApi("claim_message", { messageId });
  return Boolean(result.claimed);
}

async function createOrder(session, messageId) {
  const order = {
    confirmationMessageId: messageId,
    phone: session.phone,
    customerName: session.customer.name,
    modality: session.customer.modality,
    address: session.customer.address || "",
    payment: session.customer.payment,
    items: session.cart,
    total: calculateTotal(session.cart),
    status: "Nuevo"
  };

  const result = await sheetsApi("create_order", { order });
  return result.orderId;
}

function findMakiFlavor(id) {
  return MAKIS.flavors.find((flavor) => flavor.id === id);
}

function findWingFlavor(id) {
  return WINGS.flavors.find((flavor) => flavor.id === id);
}

async function resendCurrentStep(to, session) {
  switch (session.state) {
    case "CATEGORY":
      return sendCategories(to);
    case "MAKI_SIZE":
      return sendMakiSizes(to);
    case "MAKI_FLAVOR":
      return sendMakiFlavors(to, session, 1);
    case "WING_FLAVOR":
      return sendWingFlavors(to);
    case "WING_QTY":
      return sendQuantityList(
        to,
        "WING_QTY",
        `🍗 ¿Cuántas porciones de *${session.pending?.flavor || "alitas"}* deseas?`,
        "Cada porción contiene 6 unidades"
      );
    case "DRINK":
      return sendDrinkOptions(to);
    case "DRINK_QTY":
      return sendQuantityList(
        to,
        "DRINK_QTY",
        `🥤 ¿Cuántas unidades de *${session.pending?.name || "la bebida"}* deseas?`,
        "S/ 5.00 por unidad"
      );
    case "CART":
      return sendCartActions(to, session, "Carrito actual");
    case "MODALITY":
      return sendModality(to);
    case "ASK_NAME":
      return sendText(to, "👤 Escribe el nombre de la persona que recibirá el pedido:");
    case "ASK_ADDRESS":
      return sendText(to, "📍 Escribe tu dirección completa y una referencia:");
    case "PAYMENT":
      return sendPaymentMethods(to);
    case "CONFIRM":
      return sendConfirmation(to, session);
    default:
      return sendWelcomeMenu(to);
  }
}

async function routeMessage(to, message) {
  const action = extractAction(message);
  const text = extractText(message);
  const normalizedText = text.toLowerCase();
  let session = await getSession(to);

  if (["cancelar", "cancel", "anular"].includes(normalizedText)) {
    await deleteSession(to);
    return sendCancelled(to);
  }

  if (["menu", "menú", "inicio"].includes(normalizedText)) {
    await deleteSession(to);
    return sendWelcomeMenu(to);
  }

  if (action === "HACER_PEDIDO" || action === "NUEVO_PEDIDO") {
    session = freshSession(to);
    session.state = "CATEGORY";
    await saveSession(session);
    return sendCategories(to);
  }

  if (action === "CANCELAR_PEDIDO") {
    await deleteSession(to);
    return sendCancelled(to);
  }

  if (action === "VOLVER_CATEGORIAS" || action === "AGREGAR_MAS") {
    session.state = "CATEGORY";
    session.pending = null;
    await saveSession(session);
    return sendCategories(to);
  }

  if (action === "CAT_MAKIS") {
    session.state = "MAKI_SIZE";
    session.pending = null;
    await saveSession(session);
    return sendMakiSizes(to);
  }

  if (action.startsWith("MAKI_SIZE_")) {
    const cuts = Number(action.replace("MAKI_SIZE_", ""));
    const size = MAKIS.sizes[cuts];

    if (!size) return sendMakiSizes(to);

    session.state = "MAKI_FLAVOR";
    session.pending = {
      kind: "makis",
      cuts,
      price: size.price,
      requiredFlavors: size.flavors,
      flavors: []
    };
    await saveSession(session);
    return sendMakiFlavors(to, session, 1);
  }

  if (action === "MAKI_FLAVORS_PAGE_1") {
    return sendMakiFlavors(to, session, 1);
  }

  if (action === "MAKI_FLAVORS_PAGE_2") {
    return sendMakiFlavors(to, session, 2);
  }

  if (action.startsWith("MAKI_FLAVOR_")) {
    const flavorId = action.replace("MAKI_FLAVOR_", "");
    const flavor = findMakiFlavor(flavorId);

    if (!flavor || session.state !== "MAKI_FLAVOR" || !session.pending) {
      return sendMakiSizes(to);
    }

    session.pending.flavors.push(flavor.name);

    if (session.pending.flavors.length < session.pending.requiredFlavors) {
      await saveSession(session);
      return sendMakiFlavors(to, session, 1);
    }

    session.cart.push({
      kind: "makis",
      cuts: session.pending.cuts,
      flavors: session.pending.flavors,
      quantity: 1,
      subtotal: session.pending.price
    });
    session.pending = null;
    session.state = "CART";
    await saveSession(session);
    return sendCartActions(to, session, "Makis agregados");
  }

  if (action === "CAT_ALITAS") {
    session.state = "WING_FLAVOR";
    session.pending = null;
    await saveSession(session);
    return sendWingFlavors(to);
  }

  if (action.startsWith("WING_FLAVOR_")) {
    const flavorId = action.replace("WING_FLAVOR_", "");
    const flavor = findWingFlavor(flavorId);

    if (!flavor) return sendWingFlavors(to);

    session.pending = {
      kind: "alitas",
      flavor: flavor.name
    };
    session.state = "WING_QTY";
    await saveSession(session);
    return sendQuantityList(
      to,
      "WING_QTY",
      `🍗 ¿Cuántas porciones de *${flavor.name}* deseas?`,
      "Cada porción contiene 6 unidades"
    );
  }

  if (action.startsWith("WING_QTY_")) {
    const portions = Number(action.replace("WING_QTY_", ""));

    if (!Number.isInteger(portions) || portions < 1 || portions > 6 || !session.pending) {
      return resendCurrentStep(to, session);
    }

    session.cart.push({
      kind: "alitas",
      flavor: session.pending.flavor,
      portions,
      units: portions * WINGS.unitsPerPortion,
      subtotal: portions * WINGS.pricePerPortion
    });
    session.pending = null;
    session.state = "CART";
    await saveSession(session);
    return sendCartActions(to, session, "Alitas agregadas");
  }

  if (action === "CAT_BEBIDAS") {
    session.state = "DRINK";
    session.pending = null;
    await saveSession(session);
    return sendDrinkOptions(to);
  }

  if (action.startsWith("DRINK_") && !action.startsWith("DRINK_QTY_")) {
    const drinkId = action.replace("DRINK_", "");
    const drink = DRINKS[drinkId];

    if (!drink) return sendDrinkOptions(to);

    session.pending = {
      kind: "bebida",
      id: drinkId,
      name: drink.name,
      price: drink.price
    };
    session.state = "DRINK_QTY";
    await saveSession(session);
    return sendQuantityList(
      to,
      "DRINK_QTY",
      `🥤 ¿Cuántas unidades de *${drink.name}* deseas?`,
      "S/ 5.00 por unidad"
    );
  }

  if (action.startsWith("DRINK_QTY_")) {
    const quantity = Number(action.replace("DRINK_QTY_", ""));

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 6 || !session.pending) {
      return resendCurrentStep(to, session);
    }

    session.cart.push({
      kind: "bebida",
      name: session.pending.name,
      quantity,
      subtotal: quantity * session.pending.price
    });
    session.pending = null;
    session.state = "CART";
    await saveSession(session);
    return sendCartActions(to, session, "Bebida agregada");
  }

  if (action === "FINALIZAR_PEDIDO") {
    if (!session.cart?.length) {
      session.state = "CATEGORY";
      await saveSession(session);
      await sendText(to, "Tu carrito está vacío. Agrega al menos un producto.");
      return sendCategories(to);
    }

    session.state = "MODALITY";
    await saveSession(session);
    return sendModality(to);
  }

  if (action === "MOD_DELIVERY" || action === "MOD_RECOJO") {
    session.customer.modality = action === "MOD_DELIVERY" ? "Delivery" : "Recojo";
    session.state = "ASK_NAME";
    await saveSession(session);
    return sendText(to, "👤 Escribe el nombre de la persona que recibirá el pedido:");
  }

  if (session.state === "ASK_NAME") {
    if (!text || text.length < 2 || text.length > 80) {
      return sendText(to, "Escribe un nombre válido de entre 2 y 80 caracteres:");
    }

    session.customer.name = text;

    if (session.customer.modality === "Delivery") {
      session.state = "ASK_ADDRESS";
      await saveSession(session);
      return sendText(to, "📍 Escribe tu dirección completa y una referencia:");
    }

    session.customer.address = "";
    session.state = "PAYMENT";
    await saveSession(session);
    return sendPaymentMethods(to);
  }

  if (session.state === "ASK_ADDRESS") {
    if (!text || text.length < 5 || text.length > 220) {
      return sendText(to, "Escribe una dirección válida y una referencia:");
    }

    session.customer.address = text;
    session.state = "PAYMENT";
    await saveSession(session);
    return sendPaymentMethods(to);
  }

  if (["PAY_YAPE", "PAY_EFECTIVO", "PAY_TARJETA"].includes(action)) {
    const payments = {
      PAY_YAPE: "Yape",
      PAY_EFECTIVO: "Efectivo",
      PAY_TARJETA: "Tarjeta"
    };

    session.customer.payment = payments[action];
    session.state = "CONFIRM";
    await saveSession(session);
    return sendConfirmation(to, session);
  }

  if (action === "CONFIRMAR_PEDIDO") {
    if (session.state !== "CONFIRM" || !session.cart?.length) {
      return sendWelcomeMenu(to);
    }

    const orderId = await createOrder(session, message.id);
    const total = calculateTotal(session.cart);
    await deleteSession(to);

    return sendText(
      to,
      `✅ *Pedido confirmado*\n\nCódigo: *${orderId}*\nTotal: *S/ ${money(
        total
      )}*\n\nTu pedido fue registrado y ya aparece en Google Sheets.`
    );
  }

  if (session.state !== "IDLE") {
    return resendCurrentStep(to, session);
  }

  return sendWelcomeMenu(to);
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
      const entries = req.body?.entry || [];

      for (const entry of entries) {
        for (const change of entry?.changes || []) {
          for (const message of change?.value?.messages || []) {
            const from = message?.from;
            const messageId = message?.id;

            if (!from || !messageId) continue;

            const claimed = await claimMessage(messageId);
            if (!claimed) {
              console.log("Mensaje duplicado ignorado:", messageId);
              continue;
            }

            console.log(
              "Mensaje recibido:",
              JSON.stringify({
                from,
                type: message?.type || null,
                messageId,
                text: message?.text?.body || null,
                action: extractAction(message) || null
              })
            );

            await routeMessage(from, message);
          }
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error procesando webhook:", error?.stack || error);
      return res.status(200).json({
        received: true,
        bot_error: true,
        error: error?.message || "Error desconocido"
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Método no permitido");
}
