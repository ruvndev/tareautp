const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL ||
  "https://tareautp.vercel.app/menu.jpg";

const SHEETS_URL =
  process.env.GOOGLE_SHEETS_WEBHOOK_URL;

const SHEETS_SECRET =
  process.env.GOOGLE_SHEETS_SECRET;

const MAKIS = [
  ["maki_acevichado", "Acevichado"],
  ["maki_acevichado_classic", "Acevichado Classic"],
  ["maki_nikumaki", "Nikumaki"],
  ["maki_korean_bbq", "Korean BBQ"],
  ["maki_umimaki", "Umimaki"],
  ["maki_sakura", "Sakura"],
  ["maki_furai", "Furai"],
  ["maki_midori", "Midori"],
  ["maki_nami", "Nami"],
  ["maki_otra_cosita", "Otra Cosita"],
  ["maki_kraken", "Kraken"]
].map(([id, name]) => ({ id, name }));

const ALITAS = [
  ["alitas_acevichadas", "Acevichadas"],
  ["alitas_panko_wings", "Panko Wings"],
  ["alitas_korean_bbq", "Korean BBQ"],
  ["alitas_orientales", "Orientales"],
  ["alitas_sakura", "Sakura"],
  ["alitas_buffalo", "Buffalo"]
].map(([id, name]) => ({ id, name }));

const BEBIDAS = [
  ["bebida_inka_cola", "Inca Cola"],
  ["bebida_coca_cola", "Coca Cola"],
  ["bebida_chicha_morada", "Chicha Morada"]
].map(([id, name]) => ({ id, name }));

const MAKI_SIZES = {
  12: {
    price: 20.9,
    flavors: 1
  },
  24: {
    price: 35.9,
    flavors: 2
  },
  36: {
    price: 49.9,
    flavors: 3
  },
  48: {
    price: 65.9,
    flavors: 4
  }
};

const WINGS_PRICE = 24.9;
const DRINK_PRICE = 5;
const MAX_CART_ITEMS = 8;

const processedMessageIds =
  globalThis.__otraCositaProcessedMessages ||
  new Set();

globalThis.__otraCositaProcessedMessages =
  processedMessageIds;

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}`
    );
  }

  return value;
}

function money(value) {
  return Number(value).toFixed(2);
}

function actionId(...parts) {
  const id = parts.join("|");

  if (id.length > 190) {
    throw new Error(
      "El carrito es demasiado grande."
    );
  }

  return id;
}

/* =========================================================
   CARRITO
========================================================= */

function encodeCart(cart) {
  if (!cart.length) {
    return "-";
  }

  return cart
    .map((item) => {
      if (item.type === "maki") {
        return (
          `m${item.cuts}-` +
          item.flavors.join(",")
        );
      }

      if (item.type === "wings") {
        return (
          `a${item.flavor}-` +
          item.portions
        );
      }

      if (item.type === "drink") {
        return (
          `b${item.drink}-` +
          item.quantity
        );
      }

      throw new Error(
        "Producto de carrito desconocido"
      );
    })
    .join(".");
}

function decodeCart(encoded) {
  if (!encoded || encoded === "-") {
    return [];
  }

  return encoded
    .split(".")
    .map((token) => {
      let match = token.match(
        /^m(12|24|36|48)-([0-9,]+)$/
      );

      if (match) {
        return {
          type: "maki",
          cuts: Number(match[1]),
          flavors: match[2]
            .split(",")
            .map(Number)
        };
      }

      match = token.match(
        /^a(\d+)-(\d+)$/
      );

      if (match) {
        return {
          type: "wings",
          flavor: Number(match[1]),
          portions: Number(match[2])
        };
      }

      match = token.match(
        /^b(\d+)-(\d+)$/
      );

      if (match) {
        return {
          type: "drink",
          drink: Number(match[1]),
          quantity: Number(match[2])
        };
      }

      return null;
    })
    .filter(Boolean);
}

function parseSelected(value) {
  if (!value || value === "-") {
    return [];
  }

  return value
    .split(",")
    .map(Number)
    .filter(Number.isInteger);
}

function encodeSelected(values) {
  return values.length
    ? values.join(",")
    : "-";
}

function cartTotal(cart) {
  return cart.reduce((total, item) => {
    if (item.type === "maki") {
      return (
        total +
        MAKI_SIZES[item.cuts].price
      );
    }

    if (item.type === "wings") {
      return (
        total +
        item.portions * WINGS_PRICE
      );
    }

    if (item.type === "drink") {
      return (
        total +
        item.quantity * DRINK_PRICE
      );
    }

    return total;
  }, 0);
}

function formatCart(
  cart,
  includeTotal = true
) {
  const lines = cart.map(
    (item, index) => {
      if (item.type === "maki") {
        const flavors = item.flavors
          .map(
            (flavorIndex) =>
              MAKIS[flavorIndex]?.name
          )
          .filter(Boolean)
          .join(" + ");

        return (
          `${index + 1}. 🍣 ` +
          `*${item.cuts} cortes de maki*\n` +
          `   ${flavors}\n` +
          `   S/ ${money(
            MAKI_SIZES[item.cuts].price
          )}`
        );
      }

      if (item.type === "wings") {
        return (
          `${index + 1}. 🍗 ` +
          `*Alitas ${
            ALITAS[item.flavor]?.name || ""
          }*\n` +
          `   ${item.portions} porción(es)` +
          ` · ${item.portions * 6} unidades\n` +
          `   S/ ${money(
            item.portions * WINGS_PRICE
          )}`
        );
      }

      return (
        `${index + 1}. 🥤 ` +
        `*${
          BEBIDAS[item.drink]?.name || ""
        }*\n` +
        `   ${item.quantity} unidad(es)\n` +
        `   S/ ${money(
          item.quantity * DRINK_PRICE
        )}`
      );
    }
  );

  if (includeTotal) {
    lines.push(
      "━━━━━━━━━━━━━━\n" +
      `*TOTAL: S/ ${money(
        cartTotal(cart)
      )}*`
    );
  }

  return lines.join("\n\n");
}

function cartProductIds(cart) {
  const ids = [];

  for (const item of cart) {
    if (item.type === "maki") {
      item.flavors.forEach(
        (index) => {
          if (MAKIS[index]) {
            ids.push(MAKIS[index].id);
          }
        }
      );
    }

    if (
      item.type === "wings" &&
      ALITAS[item.flavor]
    ) {
      ids.push(
        ALITAS[item.flavor].id
      );
    }

    if (
      item.type === "drink" &&
      BEBIDAS[item.drink]
    ) {
      ids.push(
        BEBIDAS[item.drink].id
      );
    }
  }

  return [...new Set(ids)];
}

/* =========================================================
   GOOGLE SHEETS
========================================================= */

async function callSheets(
  action,
  extra = {}
) {
  if (!SHEETS_URL || !SHEETS_SECRET) {
    throw new Error(
      "Faltan las variables de Google Sheets."
    );
  }

  const separator =
    SHEETS_URL.includes("?")
      ? "&"
      : "?";

  /*
   * El timestamp impide que alguna capa
   * intermedia reutilice una respuesta anterior.
   */
  const url =
    `${SHEETS_URL}${separator}` +
    `t=${Date.now()}`;

  const response = await fetch(url, {
    method: "POST",
    redirect: "follow",

    headers: {
      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store"
    },

    body: JSON.stringify({
      secret:
        SHEETS_SECRET,

      action,

      ...extra
    })
  });

  const responseText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    throw new Error(
      "Apps Script no devolvió JSON: " +
      responseText.slice(0, 160)
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      `Apps Script respondió ${response.status}`
    );
  }

  return data;
}

/*
 * Ya no existe un fallback que considere
 * todos los productos disponibles.
 */
async function getStock() {
  const result =
    await callSheets("get_stock");

  if (
    !result?.ok ||
    !result.products
  ) {
    throw new Error(
      result?.error ||
      "No se pudo consultar el stock."
    );
  }

  console.log(
    "Stock consultado:",
    JSON.stringify(
      Object.fromEntries(
        Object.entries(
          result.products
        ).map(
          ([id, product]) => [
            id,
            product.available
          ]
        )
      )
    )
  );

  return result.products;
}

function available(
  stock,
  productId
) {
  return (
    stock?.[productId]?.available ===
    true
  );
}

async function createOrder({
  messageId,
  phone,
  customerName,
  cart
}) {
  return callSheets(
    "create_order",
    {
      order: {
        messageId,

        phone,

        customerName:
          customerName ||
          "Cliente WhatsApp",

        detailText:
          formatCart(cart)
            .replace(/\*/g, ""),

        total:
          cartTotal(cart),

        productIds:
          cartProductIds(cart)
      }
    }
  );
}

/* =========================================================
   WHATSAPP
========================================================= */

async function sendWhatsApp(payload) {
  const token =
    requiredEnv("WHATSAPP_TOKEN");

  const phoneNumberId =
    requiredEnv("PHONE_NUMBER_ID");

  const response = await fetch(
    `https://graph.facebook.com/` +
    `${GRAPH_API_VERSION}/` +
    `${phoneNumberId}/messages`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${token}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        messaging_product:
          "whatsapp",

        recipient_type:
          "individual",

        ...payload
      })
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    console.error(
      "Error de Meta:",
      JSON.stringify(
        {
          status:
            response.status,

          data
        },
        null,
        2
      )
    );

    throw new Error(
      data?.error?.message ||
      `Meta respondió ${response.status}`
    );
  }

  return data;
}

async function sendButtons(
  to,
  body,
  buttons,
  header = null
) {
  const interactive = {
    type: "button",

    body: {
      text: body
    },

    action: {
      buttons: buttons
        .slice(0, 3)
        .map((button) => ({
          type: "reply",

          reply: {
            id: button.id,
            title: button.title
          }
        }))
    }
  };

  if (header) {
    interactive.header = header;
  }

  return sendWhatsApp({
    to,

    type: "interactive",

    interactive
  });
}

async function sendList(
  to,
  body,
  button,
  rows,
  section = "Opciones"
) {
  return sendWhatsApp({
    to,

    type: "interactive",

    interactive: {
      type: "list",

      body: {
        text: body
      },

      action: {
        button,

        sections: [
          {
            title: section,

            rows:
              rows.slice(0, 10)
          }
        ]
      }
    }
  });
}

async function sendText(to, body) {
  return sendWhatsApp({
    to,

    type: "text",

    text: {
      body,
      preview_url: false
    }
  });
}

/* =========================================================
   MENÚ
========================================================= */

async function welcome(to) {
  return sendButtons(
    to,

    "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n" +
    "*¿Qué se te antoja hoy?*",

    [
      {
        id: "START",
        title: "Hacer Pedido"
      }
    ],

    {
      type: "image",

      image: {
        link:
          MENU_IMAGE_URL
      }
    }
  );
}

async function categories(
  to,
  cart
) {
  const encodedCart =
    encodeCart(cart);

  const info =
    cart.length
      ? (
        "\n\nCarrito: " +
        `${cart.length} producto(s)` +
        ` · S/ ${money(
          cartTotal(cart)
        )}`
      )
      : "";

  return sendButtons(
    to,

    "🍽️ *¿Qué deseas agregar?*" +
    info,

    [
      {
        id: actionId(
          "CAT_MAKIS",
          encodedCart
        ),

        title: "Makis"
      },

      {
        id: actionId(
          "CAT_ALITAS",
          encodedCart
        ),

        title: "Alitas"
      },

      {
        id: actionId(
          "CAT_BEBIDAS",
          encodedCart
        ),

        title: "Bebidas"
      }
    ]
  );
}

/* =========================================================
   MAKIS
========================================================= */

async function makiSizes(
  to,
  cart
) {
  const encodedCart =
    encodeCart(cart);

  return sendList(
    to,

    "🍣 *Selecciona el tamaño de tus makis:*",

    "Elegir tamaño",

    [
      {
        id: actionId(
          "MAKI_SIZE",
          "12",
          encodedCart
        ),

        title: "12 cortes",
        description:
          "1 sabor · S/ 20.90"
      },

      {
        id: actionId(
          "MAKI_SIZE",
          "24",
          encodedCart
        ),

        title: "24 cortes",
        description:
          "2 sabores · S/ 35.90"
      },

      {
        id: actionId(
          "MAKI_SIZE",
          "36",
          encodedCart
        ),

        title: "36 cortes",
        description:
          "3 sabores · S/ 49.90"
      },

      {
        id: actionId(
          "MAKI_SIZE",
          "48",
          encodedCart
        ),

        title: "48 cortes",
        description:
          "4 sabores · S/ 65.90"
      },

      {
        id: actionId(
          "BACK",
          encodedCart
        ),

        title: "Volver",
        description:
          "Regresar a las categorías"
      }
    ],

    "Tamaños"
  );
}

async function makiFlavors(
  to,
  cart,
  cuts,
  selected = [],
  page = 1
) {
  const size =
    MAKI_SIZES[cuts];

  if (!size) {
    return makiSizes(
      to,
      cart
    );
  }

  const stock =
    await getStock();

  const availableIndexes =
    MAKIS
      .map(
        (product, index) => ({
          product,
          index
        })
      )
      .filter(
        ({ product }) =>
          available(
            stock,
            product.id
          )
      )
      .map(
        ({ index }) => index
      );

  const encodedCart =
    encodeCart(cart);

  if (!availableIndexes.length) {
    return sendButtons(
      to,

      "😕 Todos los makis están agotados.",

      [
        {
          id: actionId(
            "BACK",
            encodedCart
          ),

          title: "Volver"
        }
      ]
    );
  }

  const pageSize = 8;

  const totalPages =
    Math.ceil(
      availableIndexes.length /
      pageSize
    );

  const safePage =
    Math.min(
      Math.max(page, 1),
      totalPages
    );

  const selectedCode =
    encodeSelected(selected);

  const rows =
    availableIndexes
      .slice(
        (safePage - 1) *
          pageSize,

        safePage *
          pageSize
      )
      .map((index) => ({
        id: actionId(
          "MAKI_FLAVOR",
          String(cuts),
          selectedCode,
          String(index),
          encodedCart
        ),

        title:
          MAKIS[index].name,

        description:
          `Seleccionar ${MAKIS[index].name}`
      }));

  if (safePage < totalPages) {
    rows.push({
      id: actionId(
        "MAKI_PAGE",
        String(cuts),
        selectedCode,
        String(safePage + 1),
        encodedCart
      ),

      title:
        "Más sabores",

      description:
        "Siguiente página"
    });
  } else if (safePage > 1) {
    rows.push({
      id: actionId(
        "MAKI_PAGE",
        String(cuts),
        selectedCode,
        String(safePage - 1),
        encodedCart
      ),

      title:
        "Sabores anteriores",

      description:
        "Página anterior"
    });
  }

  rows.push({
    id: actionId(
      "BACK",
      encodedCart
    ),

    title:
      "Cancelar selección",

    description:
      "Volver a categorías"
  });

  const remaining =
    size.flavors -
    selected.length;

  const chosen =
    selected.length
      ? (
        "\nElegidos: " +
        selected
          .map(
            (index) =>
              MAKIS[index]?.name
          )
          .filter(Boolean)
          .join(", ")
      )
      : "";

  return sendList(
    to,

    `🍣 *${cuts} cortes*\n` +
    (
      remaining === 1
        ? "Elige el último sabor."
        : `Elige ${remaining} sabores más.`
    ) +
    chosen,

    "Ver sabores",

    rows,

    "Sabores disponibles"
  );
}

/* =========================================================
   ALITAS Y BEBIDAS
========================================================= */

async function productList(
  to,
  cart,
  type
) {
  const stock =
    await getStock();

  const encodedCart =
    encodeCart(cart);

  const isWings =
    type === "wings";

  const products =
    isWings
      ? ALITAS
      : BEBIDAS;

  const action =
    isWings
      ? "WINGS_TYPE"
      : "DRINK_TYPE";

  const rows =
    products
      .map(
        (product, index) => ({
          product,
          index
        })
      )
      .filter(
        ({ product }) =>
          available(
            stock,
            product.id
          )
      )
      .map(
        ({ product, index }) => ({
          id: actionId(
            action,
            String(index),
            encodedCart
          ),

          title:
            product.name,

          description:
            isWings
              ? "6 unidades · S/ 24.90"
              : "S/ 5.00"
        })
      );

  if (!rows.length) {
    return sendButtons(
      to,

      `😕 Todas las ${
        isWings
          ? "alitas"
          : "bebidas"
      } están agotadas.`,

      [
        {
          id: actionId(
            "BACK",
            encodedCart
          ),

          title: "Volver"
        }
      ]
    );
  }

  rows.push({
    id: actionId(
      "BACK",
      encodedCart
    ),

    title: "Volver",

    description:
      "Regresar a categorías"
  });

  return sendList(
    to,

    isWings
      ? "🍗 *Selecciona el sabor:*"
      : "🥤 *Selecciona una bebida:*",

    isWings
      ? "Ver sabores"
      : "Ver bebidas",

    rows,

    isWings
      ? "Alitas disponibles"
      : "Bebidas disponibles"
  );
}

async function quantityButtons(
  to,
  cart,
  type,
  index
) {
  const encodedCart =
    encodeCart(cart);

  const isWings =
    type === "wings";

  const product =
    (
      isWings
        ? ALITAS
        : BEBIDAS
    )[index];

  if (!product) {
    return productList(
      to,
      cart,
      type
    );
  }

  const stock =
    await getStock();

  if (
    !available(
      stock,
      product.id
    )
  ) {
    return sendButtons(
      to,

      `⚠️ ${product.name} acaba de agotarse.`,

      [
        {
          id: actionId(
            isWings
              ? "CAT_ALITAS"
              : "CAT_BEBIDAS",

            encodedCart
          ),

          title: "Elegir otro"
        }
      ]
    );
  }

  const body =
    `${isWings ? "🍗" : "🥤"} ` +
    `Elegiste *${product.name}*.\n` +
    (
      isWings
        ? (
          "¿Cuántas porciones deseas?\n\n" +
          "Cada porción contiene 6 unidades " +
          "y cuesta S/ 24.90."
        )
        : "¿Cuántas deseas?"
    );

  return sendButtons(
    to,

    body,

    [1, 2, 3].map(
      (quantity) => ({
        id: actionId(
          isWings
            ? "WINGS_QTY"
            : "DRINK_QTY",

          String(index),
          String(quantity),
          encodedCart
        ),

        title:
          `${quantity} ` +
          (
            isWings
              ? (
                quantity === 1
                  ? "porción"
                  : "porciones"
              )
              : (
                quantity === 1
                  ? "unidad"
                  : "unidades"
              )
          )
      })
    )
  );
}

/* =========================================================
   CONFIRMACIÓN
========================================================= */

async function cartActions(
  to,
  cart,
  added
) {
  const encodedCart =
    encodeCart(cart);

  return sendButtons(
    to,

    "✅ *Agregado al pedido*\n\n" +
    `${added}\n\n` +
    `Total actual: *S/ ${money(
      cartTotal(cart)
    )}*\n\n` +
    "¿Qué deseas hacer?",

    [
      {
        id: actionId(
          "MORE",
          encodedCart
        ),

        title:
          "Agregar más"
      },

      {
        id: actionId(
          "SUMMARY",
          encodedCart
        ),

        title:
          "Ver resumen"
      },

      {
        id: "CANCEL",
        title: "Cancelar"
      }
    ]
  );
}

async function addItem(
  to,
  cart,
  item,
  added
) {
  if (
    cart.length >=
    MAX_CART_ITEMS
  ) {
    return summary(
      to,
      cart
    );
  }

  return cartActions(
    to,
    [...cart, item],
    added
  );
}

async function summary(
  to,
  cart
) {
  if (!cart.length) {
    return categories(
      to,
      []
    );
  }

  const encodedCart =
    encodeCart(cart);

  return sendButtons(
    to,

    "🧾 *RESUMEN DE TU PEDIDO*\n\n" +
    `${formatCart(cart)}\n\n` +
    "¿Confirmas tu pedido?",

    [
      {
        id: actionId(
          "CONFIRM",
          encodedCart
        ),

        title:
          "Confirmar pedido"
      },

      {
        id: "CANCEL",
        title:
          "Cancelar pedido"
      }
    ]
  );
}

async function confirm(
  to,
  cart,
  customerName,
  messageId
) {
  const result =
    await createOrder({
      messageId,
      phone: to,
      customerName,
      cart
    });

  if (!result?.ok) {
    if (
      result?.error ===
      "PRODUCTS_UNAVAILABLE"
    ) {
      const names =
        (
          result
            .unavailableProducts ||
          []
        )
          .map(
            (product) =>
              `• ${product.name}`
          )
          .join("\n");

      return sendButtons(
        to,

        "⚠️ Se agotaron estos productos:\n\n" +
        `${names || "Uno o más productos"}\n\n` +
        "Realiza un pedido nuevo.",

        [
          {
            id: "START",
            title: "Nuevo pedido"
          }
        ]
      );
    }

    throw new Error(
      result?.error ||
      "Google Sheets rechazó el pedido."
    );
  }

  return sendButtons(
    to,

    "✅ *Pedido confirmado*\n\n" +
    `Código: *${result.orderId}*\n` +
    `Total: *S/ ${money(
      cartTotal(cart)
    )}*\n` +
    `Estado: *${
      result.status ||
      "En preparación"
    }*\n\n` +
    "Tu pedido ya apareció en cocina.",

    [
      {
        id: "START",
        title: "Nuevo pedido"
      }
    ]
  );
}

async function cancel(to) {
  return sendButtons(
    to,

    "❌ *Pedido cancelado.*\n\n" +
    "El carrito fue descartado.",

    [
      {
        id: "START",
        title:
          "Volver al menú"
      }
    ]
  );
}

/* =========================================================
   ENRUTAMIENTO
========================================================= */

async function route(
  to,
  message,
  customerName
) {
  const raw =
    message
      ?.interactive
      ?.button_reply
      ?.id ||

    message
      ?.interactive
      ?.list_reply
      ?.id ||

    "";

  if (!raw) {
    return welcome(to);
  }

  const parts =
    raw.split("|");

  switch (parts[0]) {
    case "START":
      return categories(
        to,
        []
      );

    case "CAT_MAKIS":
      return makiSizes(
        to,
        decodeCart(parts[1])
      );

    case "CAT_ALITAS":
      return productList(
        to,
        decodeCart(parts[1]),
        "wings"
      );

    case "CAT_BEBIDAS":
      return productList(
        to,
        decodeCart(parts[1]),
        "drinks"
      );

    case "BACK":
    case "MORE":
      return categories(
        to,
        decodeCart(parts[1])
      );

    case "MAKI_SIZE":
      return makiFlavors(
        to,
        decodeCart(parts[2]),
        Number(parts[1]),
        [],
        1
      );

    case "MAKI_PAGE":
      return makiFlavors(
        to,
        decodeCart(parts[4]),
        Number(parts[1]),
        parseSelected(parts[2]),
        Number(parts[3])
      );

    case "MAKI_FLAVOR": {
      const cuts =
        Number(parts[1]);

      const selected =
        parseSelected(
          parts[2]
        );

      const flavorIndex =
        Number(parts[3]);

      const cart =
        decodeCart(parts[4]);

      const size =
        MAKI_SIZES[cuts];

      if (
        !size ||
        !MAKIS[flavorIndex]
      ) {
        return makiSizes(
          to,
          cart
        );
      }

      const stock =
        await getStock();

      if (
        !available(
          stock,
          MAKIS[flavorIndex].id
        )
      ) {
        return sendButtons(
          to,

          `⚠️ ${
            MAKIS[flavorIndex].name
          } acaba de agotarse.`,

          [
            {
              id: actionId(
                "CAT_MAKIS",
                encodeCart(cart)
              ),

              title:
                "Elegir otro"
            }
          ]
        );
      }

      const updated = [
        ...selected,
        flavorIndex
      ];

      if (
        updated.length <
        size.flavors
      ) {
        return makiFlavors(
          to,
          cart,
          cuts,
          updated,
          1
        );
      }

      const flavors =
        updated.slice(
          0,
          size.flavors
        );

      return addItem(
        to,
        cart,

        {
          type: "maki",
          cuts,
          flavors
        },

        `🍣 ${cuts} cortes\n` +
        `${flavors
          .map(
            (index) =>
              MAKIS[index].name
          )
          .join(" + ")}\n` +
        `S/ ${money(size.price)}`
      );
    }

    case "WINGS_TYPE":
      return quantityButtons(
        to,
        decodeCart(parts[2]),
        "wings",
        Number(parts[1])
      );

    case "DRINK_TYPE":
      return quantityButtons(
        to,
        decodeCart(parts[2]),
        "drinks",
        Number(parts[1])
      );

    case "WINGS_QTY": {
      const index =
        Number(parts[1]);

      const quantity =
        Number(parts[2]);

      const cart =
        decodeCart(parts[3]);

      if (
        !ALITAS[index] ||
        ![1, 2, 3].includes(
          quantity
        )
      ) {
        return productList(
          to,
          cart,
          "wings"
        );
      }

      const stock =
        await getStock();

      if (
        !available(
          stock,
          ALITAS[index].id
        )
      ) {
        return sendButtons(
          to,

          `⚠️ ${
            ALITAS[index].name
          } acaba de agotarse.`,

          [
            {
              id: actionId(
                "CAT_ALITAS",
                encodeCart(cart)
              ),

              title:
                "Elegir otro"
            }
          ]
        );
      }

      return addItem(
        to,
        cart,

        {
          type: "wings",
          flavor: index,
          portions: quantity
        },

        `🍗 ${quantity} porción(es) ` +
        `de ${ALITAS[index].name}\n` +
        `${quantity * 6} unidades\n` +
        `S/ ${money(
          quantity * WINGS_PRICE
        )}`
      );
    }

    case "DRINK_QTY": {
      const index =
        Number(parts[1]);

      const quantity =
        Number(parts[2]);

      const cart =
        decodeCart(parts[3]);

      if (
        !BEBIDAS[index] ||
        ![1, 2, 3].includes(
          quantity
        )
      ) {
        return productList(
          to,
          cart,
          "drinks"
        );
      }

      const stock =
        await getStock();

      if (
        !available(
          stock,
          BEBIDAS[index].id
        )
      ) {
        return sendButtons(
          to,

          `⚠️ ${
            BEBIDAS[index].name
          } acaba de agotarse.`,

          [
            {
              id: actionId(
                "CAT_BEBIDAS",
                encodeCart(cart)
              ),

              title:
                "Elegir otra"
            }
          ]
        );
      }

      return addItem(
        to,
        cart,

        {
          type: "drink",
          drink: index,
          quantity
        },

        `🥤 ${quantity} × ` +
        `${BEBIDAS[index].name}\n` +
        `S/ ${money(
          quantity * DRINK_PRICE
        )}`
      );
    }

    case "SUMMARY":
      return summary(
        to,
        decodeCart(parts[1])
      );

    case "CONFIRM":
      return confirm(
        to,
        decodeCart(parts[1]),
        customerName,
        message.id
      );

    case "CANCEL":
      return cancel(to);

    default:
      return welcome(to);
  }
}

/* =========================================================
   NOTIFICACIÓN DESDE GOOGLE SHEETS
========================================================= */

async function notifyReady(body) {
  const expectedSecret =
    requiredEnv(
      "STATUS_WEBHOOK_SECRET"
    );

  if (
    !body?.secret ||
    body.secret !== expectedSecret
  ) {
    return {
      status: 401,

      data: {
        ok: false,
        error: "Clave incorrecta"
      }
    };
  }

  if (
    body.status !== "Listo" ||
    !body.phone ||
    !body.orderId
  ) {
    return {
      status: 400,

      data: {
        ok: false,
        error: "Datos incompletos"
      }
    };
  }

  await sendText(
    String(body.phone),

    `✅ *Tu pedido ${body.orderId} está listo.*\n\n` +
    "Será enviado en breve. " +
    "Gracias por pedir en Otra Cosita 🍔."
  );

  return {
    status: 200,

    data: {
      ok: true
    }
  };
}

async function safeRoute(
  to,
  message,
  customerName
) {
  try {
    return await route(
      to,
      message,
      customerName
    );
  } catch (error) {
    console.error(
      "Error en el flujo:",
      error?.stack || error
    );

    return sendButtons(
      to,

      "⚠️ No pude verificar el stock. " +
      "No mostraré productos sin confirmar " +
      "su disponibilidad. Intenta nuevamente.",

      [
        {
          id: "START",
          title: "Reintentar"
        }
      ]
    );
  }
}

/* =========================================================
   WEBHOOK
========================================================= */

export default async function handler(
  req,
  res
) {
  /*
   * Verificación de Meta.
   */
  if (req.method === "GET") {
    const mode =
      req.query["hub.mode"];

    const token =
      req.query[
        "hub.verify_token"
      ];

    const challenge =
      req.query[
        "hub.challenge"
      ];

    if (
      mode === "subscribe" &&
      token ===
        process.env.VERIFY_TOKEN
    ) {
      return res
        .status(200)
        .send(challenge);
    }

    return res
      .status(403)
      .send(
        "Token de verificación incorrecto"
      );
  }

  /*
   * Petición enviada por Google Sheets
   * cuando cocina cambia el estado a Listo.
   */
  if (
    req.method === "POST" &&
    req.body?.action ===
      "notify_ready"
  ) {
    try {
      const result =
        await notifyReady(
          req.body
        );

      return res
        .status(result.status)
        .json(result.data);
    } catch (error) {
      console.error(
        "Error notificando estado:",
        error?.stack || error
      );

      return res
        .status(500)
        .json({
          ok: false,

          error:
            error?.message ||
            "Error desconocido"
        });
    }
  }

  /*
   * Mensajes entrantes de WhatsApp.
   */
  if (req.method === "POST") {
    try {
      const entries =
        req.body?.entry || [];

      for (
        const entry
        of entries
      ) {
        const changes =
          entry?.changes || [];

        for (
          const change
          of changes
        ) {
          const value =
            change?.value || {};

          const customerName =
            value
              ?.contacts
              ?.[0]
              ?.profile
              ?.name ||
            "Cliente WhatsApp";

          const messages =
            value?.messages || [];

          for (
            const message
            of messages
          ) {
            if (
              !message?.from ||
              !message?.id ||
              processedMessageIds
                .has(message.id)
            ) {
              continue;
            }

            if (
              processedMessageIds
                .size >= 500
            ) {
              processedMessageIds
                .clear();
            }

            processedMessageIds
              .add(message.id);

            await safeRoute(
              message.from,
              message,
              customerName
            );
          }
        }
      }

      return res
        .status(200)
        .json({
          received: true
        });
    } catch (error) {
      console.error(
        "Error procesando webhook:",
        error?.stack || error
      );

      return res
        .status(200)
        .json({
          received: true,

          bot_error: true,

          error:
            error?.message ||
            "Error desconocido"
        });
    }
  }

  res.setHeader(
    "Allow",
    "GET, POST"
  );

  return res
    .status(405)
    .send(
      "Método no permitido"
    );
}
