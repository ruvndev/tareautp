const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL ||
  "https://tareautp.vercel.app/menu.jpg";

const SHEETS_URL =
  process.env.GOOGLE_SHEETS_WEBHOOK_URL;

const SHEETS_SECRET =
  process.env.GOOGLE_SHEETS_SECRET;

/* =========================================================
   CATÁLOGO
========================================================= */

const MAKIS = [
  {
    id: "maki_acevichado",
    name: "Acevichado"
  },
  {
    id: "maki_acevichado_classic",
    name: "Acevichado Classic"
  },
  {
    id: "maki_nikumaki",
    name: "Nikumaki"
  },
  {
    id: "maki_korean_bbq",
    name: "Korean BBQ"
  },
  {
    id: "maki_umimaki",
    name: "Umimaki"
  },
  {
    id: "maki_sakura",
    name: "Sakura"
  },
  {
    id: "maki_furai",
    name: "Furai"
  },
  {
    id: "maki_midori",
    name: "Midori"
  },
  {
    id: "maki_nami",
    name: "Nami"
  },
  {
    id: "maki_otra_cosita",
    name: "Otra Cosita"
  },
  {
    id: "maki_kraken",
    name: "Kraken"
  }
];

const ALITAS = [
  {
    id: "alitas_acevichadas",
    name: "Acevichadas"
  },
  {
    id: "alitas_panko_wings",
    name: "Panko Wings"
  },
  {
    id: "alitas_korean_bbq",
    name: "Korean BBQ"
  },
  {
    id: "alitas_orientales",
    name: "Orientales"
  },
  {
    id: "alitas_sakura",
    name: "Sakura"
  },
  {
    id: "alitas_buffalo",
    name: "Buffalo"
  }
];

const BEBIDAS = [
  {
    id: "bebida_inka_cola",
    name: "Inca Cola"
  },
  {
    id: "bebida_coca_cola",
    name: "Coca Cola"
  },
  {
    id: "bebida_chicha_morada",
    name: "Chicha Morada"
  }
];

const MAKI_SIZES = {
  12: {
    price: 20.90,
    flavors: 1
  },
  24: {
    price: 35.90,
    flavors: 2
  },
  36: {
    price: 49.90,
    flavors: 3
  },
  48: {
    price: 65.90,
    flavors: 4
  }
};

const WINGS_PRICE = 24.90;
const DRINK_PRICE = 5.00;
const MAX_CART_ITEMS = 8;

/*
 * Protección temporal contra webhooks duplicados.
 */
const processedMessageIds =
  globalThis.__otraCositaProcessedMessages ||
  new Set();

globalThis.__otraCositaProcessedMessages =
  processedMessageIds;

/* =========================================================
   UTILIDADES
========================================================= */

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

function makeAction(...parts) {
  const id = parts.join("|");

  if (id.length > 190) {
    throw new Error(
      "El carrito es demasiado grande para continuar."
    );
  }

  return id;
}

/* =========================================================
   CODIFICACIÓN DEL CARRITO
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
      let match;

      match = token.match(
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

function parseSelectedFlavors(value) {
  if (!value || value === "-") {
    return [];
  }

  return value
    .split(",")
    .map(Number)
    .filter(Number.isInteger);
}

function encodeSelectedFlavors(values) {
  return values.length
    ? values.join(",")
    : "-";
}

/* =========================================================
   CÁLCULOS Y RESUMEN
========================================================= */

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
        item.portions *
          WINGS_PRICE
      );
    }

    if (item.type === "drink") {
      return (
        total +
        item.quantity *
          DRINK_PRICE
      );
    }

    return total;
  }, 0);
}

function formatCart(
  cart,
  includeTotal = true
) {
  if (!cart.length) {
    return "Tu carrito está vacío.";
  }

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
        const subtotal =
          item.portions *
          WINGS_PRICE;

        return (
          `${index + 1}. 🍗 ` +
          `*Alitas ${
            ALITAS[item.flavor]?.name || ""
          }*\n` +
          `   ${item.portions} porción(es)` +
          ` · ${item.portions * 6} unidades\n` +
          `   S/ ${money(subtotal)}`
        );
      }

      const subtotal =
        item.quantity *
        DRINK_PRICE;

      return (
        `${index + 1}. 🥤 ` +
        `*${
          BEBIDAS[item.drink]?.name || ""
        }*\n` +
        `   ${item.quantity} unidad(es)\n` +
        `   S/ ${money(subtotal)}`
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

/*
 * Convierte los productos del carrito
 * a los Product ID de la pestaña Stock.
 */
function cartProductIds(cart) {
  const ids = [];

  for (const item of cart) {
    if (item.type === "maki") {
      for (
        const flavorIndex
        of item.flavors
      ) {
        const product =
          MAKIS[flavorIndex];

        if (product) {
          ids.push(product.id);
        }
      }
    }

    if (item.type === "wings") {
      const product =
        ALITAS[item.flavor];

      if (product) {
        ids.push(product.id);
      }
    }

    if (item.type === "drink") {
      const product =
        BEBIDAS[item.drink];

      if (product) {
        ids.push(product.id);
      }
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
  if (
    !SHEETS_URL ||
    !SHEETS_SECRET
  ) {
    throw new Error(
      "Faltan GOOGLE_SHEETS_WEBHOOK_URL o GOOGLE_SHEETS_SECRET"
    );
  }

  const response = await fetch(
    SHEETS_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        secret:
          SHEETS_SECRET,

        action,

        ...extra
      })
    }
  );

  const responseText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(responseText);
  } catch {
    throw new Error(
      "Apps Script no devolvió JSON válido: " +
      responseText.slice(0, 200)
    );
  }

  if (!response.ok) {
    throw new Error(
      `Apps Script respondió ${response.status}: ` +
      (
        data?.error ||
        responseText
      )
    );
  }

  return data;
}

/*
 * Si Sheets falla temporalmente, el menú
 * sigue funcionando mostrando el catálogo.
 *
 * La comprobación definitiva vuelve a
 * realizarse al confirmar.
 */
async function getStockSafe() {
  try {
    const result =
      await callSheets("get_stock");

    if (!result?.ok) {
      throw new Error(
        result?.error ||
        "No se pudo consultar el stock"
      );
    }

    return result.products || {};
  } catch (error) {
    console.error(
      "No se pudo consultar el stock:",
      error.message
    );

    return null;
  }
}

function productIsAvailable(
  stock,
  productId
) {
  /*
   * Si Sheets está caído, se muestra
   * el catálogo y se comprueba al confirmar.
   */
  if (!stock) {
    return true;
  }

  return (
    stock[productId]?.available ===
    true
  );
}

async function createOrderInSheets({
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

        /*
         * Quitamos los asteriscos de
         * formato antes de guardarlo.
         */
        detailText:
          formatCart(cart, true)
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
   WHATSAPP CLOUD API
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
  options = {}
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

  if (options.header) {
    interactive.header =
      options.header;
  }

  if (options.footer) {
    interactive.footer = {
      text: options.footer
    };
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
  buttonText,
  rows,
  sectionTitle = "Opciones"
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
        button:
          buttonText,

        sections: [
          {
            title:
              sectionTitle,

            rows:
              rows.slice(0, 10)
          }
        ]
      }
    }
  });
}

/* =========================================================
   BIENVENIDA
========================================================= */

async function sendWelcomeMenu(to) {
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
      header: {
        type: "image",

        image: {
          link:
            MENU_IMAGE_URL
        }
      }
    }
  );
}

/* =========================================================
   CATEGORÍAS
========================================================= */

async function sendCategoryMenu(
  to,
  cart
) {
  const encodedCart =
    encodeCart(cart);

  const cartInfo =
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
    cartInfo,

    [
      {
        id: makeAction(
          "CAT_MAKIS",
          encodedCart
        ),

        title: "Makis"
      },

      {
        id: makeAction(
          "CAT_ALITAS",
          encodedCart
        ),

        title: "Alitas"
      },

      {
        id: makeAction(
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

async function sendMakiSizeList(
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
        id: makeAction(
          "MAKI_SIZE",
          "12",
          encodedCart
        ),

        title: "12 cortes",

        description:
          "1 sabor · S/ 20.90"
      },

      {
        id: makeAction(
          "MAKI_SIZE",
          "24",
          encodedCart
        ),

        title: "24 cortes",

        description:
          "2 sabores · S/ 35.90"
      },

      {
        id: makeAction(
          "MAKI_SIZE",
          "36",
          encodedCart
        ),

        title: "36 cortes",

        description:
          "3 sabores · S/ 49.90"
      },

      {
        id: makeAction(
          "MAKI_SIZE",
          "48",
          encodedCart
        ),

        title: "48 cortes",

        description:
          "4 sabores · S/ 65.90"
      },

      {
        id: makeAction(
          "BACK_CATEGORIES",
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

async function sendMakiFlavorList(
  to,
  cart,
  cuts,
  selected = [],
  page = 1
) {
  const size =
    MAKI_SIZES[cuts];

  if (!size) {
    return sendMakiSizeList(
      to,
      cart
    );
  }

  const stock =
    await getStockSafe();

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
          productIsAvailable(
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

      "😕 En este momento todos los sabores de maki están agotados.",

      [
        {
          id: makeAction(
            "BACK_CATEGORIES",
            encodedCart
          ),

          title: "Volver"
        }
      ]
    );
  }

  /*
   * Ocho sabores por página:
   * 8 productos + navegación + volver.
   */
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

  const indexes =
    availableIndexes.slice(
      (safePage - 1) *
        pageSize,

      safePage *
        pageSize
    );

  const selectedEncoded =
    encodeSelectedFlavors(
      selected
    );

  const remaining =
    size.flavors -
    selected.length;

  const rows =
    indexes.map(
      (flavorIndex) => ({
        id: makeAction(
          "MAKI_FLAVOR",
          String(cuts),
          selectedEncoded,
          String(flavorIndex),
          encodedCart
        ),

        title:
          MAKIS[flavorIndex].name,

        description:
          "Seleccionar " +
          MAKIS[flavorIndex].name
      })
    );

  if (safePage < totalPages) {
    rows.push({
      id: makeAction(
        "MAKI_PAGE",
        String(cuts),
        selectedEncoded,
        String(safePage + 1),
        encodedCart
      ),

      title:
        "Más sabores",

      description:
        "Ver la siguiente página"
    });
  } else if (safePage > 1) {
    rows.push({
      id: makeAction(
        "MAKI_PAGE",
        String(cuts),
        selectedEncoded,
        String(safePage - 1),
        encodedCart
      ),

      title:
        "Sabores anteriores",

      description:
        "Volver a la página anterior"
    });
  }

  rows.push({
    id: makeAction(
      "BACK_CATEGORIES",
      encodedCart
    ),

    title:
      "Cancelar selección",

    description:
      "Volver a las categorías"
  });

  const selectedText =
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
    selectedText,

    "Ver sabores",

    rows,

    "Sabores disponibles"
  );
}

/* =========================================================
   ALITAS
========================================================= */

async function sendWingsFlavorList(
  to,
  cart
) {
  const stock =
    await getStockSafe();

  const encodedCart =
    encodeCart(cart);

  const rows =
    ALITAS
      .map(
        (product, index) => ({
          product,
          index
        })
      )
      .filter(
        ({ product }) =>
          productIsAvailable(
            stock,
            product.id
          )
      )
      .map(
        ({ product, index }) => ({
          id: makeAction(
            "WINGS_FLAVOR",
            String(index),
            encodedCart
          ),

          title:
            product.name,

          description:
            "6 unidades por porción · S/ 24.90"
        })
      );

  if (!rows.length) {
    return sendButtons(
      to,

      "😕 En este momento todas las alitas están agotadas.",

      [
        {
          id: makeAction(
            "BACK_CATEGORIES",
            encodedCart
          ),

          title: "Volver"
        }
      ]
    );
  }

  rows.push({
    id: makeAction(
      "BACK_CATEGORIES",
      encodedCart
    ),

    title: "Volver",

    description:
      "Regresar a las categorías"
  });

  return sendList(
    to,

    "🍗 *Selecciona el sabor de tus alitas:*",

    "Ver sabores",

    rows,

    "Alitas disponibles"
  );
}

async function sendWingsQuantity(
  to,
  cart,
  flavorIndex
) {
  const encodedCart =
    encodeCart(cart);

  const flavor =
    ALITAS[flavorIndex];

  if (!flavor) {
    return sendWingsFlavorList(
      to,
      cart
    );
  }

  return sendButtons(
    to,

    `🍗 Elegiste *${flavor.name}*.\n` +
    "¿Cuántas porciones deseas?\n\n" +
    "Cada porción contiene 6 unidades " +
    "y cuesta S/ 24.90.",

    [1, 2, 3].map(
      (quantity) => ({
        id: makeAction(
          "WINGS_QTY",
          String(flavorIndex),
          String(quantity),
          encodedCart
        ),

        title:
          `${quantity} ` +
          (
            quantity === 1
              ? "porción"
              : "porciones"
          )
      })
    )
  );
}

/* =========================================================
   BEBIDAS
========================================================= */

async function sendDrinkList(
  to,
  cart
) {
  const stock =
    await getStockSafe();

  const encodedCart =
    encodeCart(cart);

  const rows =
    BEBIDAS
      .map(
        (product, index) => ({
          product,
          index
        })
      )
      .filter(
        ({ product }) =>
          productIsAvailable(
            stock,
            product.id
          )
      )
      .map(
        ({ product, index }) => ({
          id: makeAction(
            "DRINK_TYPE",
            String(index),
            encodedCart
          ),

          title:
            product.name,

          description:
            "S/ 5.00"
        })
      );

  if (!rows.length) {
    return sendButtons(
      to,

      "😕 En este momento todas las bebidas están agotadas.",

      [
        {
          id: makeAction(
            "BACK_CATEGORIES",
            encodedCart
          ),

          title: "Volver"
        }
      ]
    );
  }

  rows.push({
    id: makeAction(
      "BACK_CATEGORIES",
      encodedCart
    ),

    title: "Volver",

    description:
      "Regresar a las categorías"
  });

  return sendList(
    to,

    "🥤 *Selecciona una bebida:*",

    "Ver bebidas",

    rows,

    "Bebidas disponibles"
  );
}

async function sendDrinkQuantity(
  to,
  cart,
  drinkIndex
) {
  const encodedCart =
    encodeCart(cart);

  const drink =
    BEBIDAS[drinkIndex];

  if (!drink) {
    return sendDrinkList(
      to,
      cart
    );
  }

  return sendButtons(
    to,

    `🥤 Elegiste *${drink.name}*.\n` +
    "¿Cuántas deseas?",

    [1, 2, 3].map(
      (quantity) => ({
        id: makeAction(
          "DRINK_QTY",
          String(drinkIndex),
          String(quantity),
          encodedCart
        ),

        title:
          `${quantity} ` +
          (
            quantity === 1
              ? "unidad"
              : "unidades"
          )
      })
    )
  );
}

/* =========================================================
   CARRITO Y CONFIRMACIÓN
========================================================= */

async function sendCartActions(
  to,
  cart,
  addedText
) {
  const encodedCart =
    encodeCart(cart);

  return sendButtons(
    to,

    "✅ *Agregado al pedido*\n\n" +
    addedText +
    "\n\nTotal actual: " +
    `*S/ ${money(
      cartTotal(cart)
    )}*\n\n` +
    "¿Qué deseas hacer?",

    [
      {
        id: makeAction(
          "CART_MORE",
          encodedCart
        ),

        title:
          "Agregar más"
      },

      {
        id: makeAction(
          "CART_SUMMARY",
          encodedCart
        ),

        title:
          "Ver resumen"
      },

      {
        id:
          "CART_CANCEL",

        title:
          "Cancelar"
      }
    ]
  );
}

async function sendOrderSummary(
  to,
  cart
) {
  if (!cart.length) {
    return sendCategoryMenu(
      to,
      []
    );
  }

  const encodedCart =
    encodeCart(cart);

  return sendButtons(
    to,

    "🧾 *RESUMEN DE TU PEDIDO*\n\n" +
    formatCart(cart, true) +
    "\n\n¿Confirmas tu pedido?",

    [
      {
        id: makeAction(
          "CART_CONFIRM",
          encodedCart
        ),

        title:
          "Confirmar pedido"
      },

      {
        id:
          "CART_CANCEL",

        title:
          "Cancelar pedido"
      }
    ]
  );
}

async function sendConfirmedOrder(
  to,
  cart,
  customerName,
  messageId
) {
  const result =
    await createOrderInSheets({
      messageId,
      phone: to,
      customerName,
      cart
    });

  /*
   * Apps Script detectó productos agotados
   * durante la comprobación final.
   */
  if (!result?.ok) {
    if (
      result?.error ===
      "PRODUCTS_UNAVAILABLE"
    ) {
      const unavailableText =
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

        "⚠️ No se pudo confirmar porque " +
        "estos productos se agotaron:\n\n" +
        (
          unavailableText ||
          "Uno o más productos"
        ) +
        "\n\nRealiza un pedido nuevo con " +
        "los productos disponibles.",

        [
          {
            id:
              "START",

            title:
              "Nuevo pedido"
          }
        ]
      );
    }

    throw new Error(
      result?.error ||
      "Google Sheets rechazó el pedido"
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
    "Tu pedido ya apareció en la " +
    "pantalla de cocina.",

    [
      {
        id:
          "START",

        title:
          "Nuevo pedido"
      }
    ]
  );
}

async function sendCancelledOrder(
  to
) {
  return sendButtons(
    to,

    "❌ *Pedido cancelado.*\n\n" +
    "El carrito fue descartado.",

    [
      {
        id:
          "START",

        title:
          "Volver al menú"
      }
    ]
  );
}

async function addItemOrFinish(
  to,
  cart,
  item,
  addedText
) {
  if (
    cart.length >=
    MAX_CART_ITEMS
  ) {
    return sendOrderSummary(
      to,
      cart
    );
  }

  const updatedCart = [
    ...cart,
    item
  ];

  return sendCartActions(
    to,
    updatedCart,
    addedText
  );
}

/* =========================================================
   ENRUTAMIENTO
========================================================= */

async function routeMessage(
  to,
  message,
  customerName
) {
  const actionId =
    message
      ?.interactive
      ?.button_reply
      ?.id ||

    message
      ?.interactive
      ?.list_reply
      ?.id ||

    "";

  /*
   * Cualquier texto o archivo inicia el menú.
   */
  if (!actionId) {
    return sendWelcomeMenu(to);
  }

  const parts =
    actionId.split("|");

  const action =
    parts[0];

  switch (action) {
    case "START":
      return sendCategoryMenu(
        to,
        []
      );

    case "CAT_MAKIS":
      return sendMakiSizeList(
        to,
        decodeCart(parts[1])
      );

    case "CAT_ALITAS":
      return sendWingsFlavorList(
        to,
        decodeCart(parts[1])
      );

    case "CAT_BEBIDAS":
      return sendDrinkList(
        to,
        decodeCart(parts[1])
      );

    case "BACK_CATEGORIES":
    case "CART_MORE":
      return sendCategoryMenu(
        to,
        decodeCart(parts[1])
      );

    case "MAKI_SIZE":
      return sendMakiFlavorList(
        to,
        decodeCart(parts[2]),
        Number(parts[1]),
        [],
        1
      );

    case "MAKI_PAGE":
      return sendMakiFlavorList(
        to,
        decodeCart(parts[4]),
        Number(parts[1]),
        parseSelectedFlavors(
          parts[2]
        ),
        Number(parts[3])
      );

    case "MAKI_FLAVOR": {
      const cuts =
        Number(parts[1]);

      const selected =
        parseSelectedFlavors(
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
        return sendMakiSizeList(
          to,
          cart
        );
      }

      /*
       * Comprobación de stock al tocar
       * la opción.
       */
      const stock =
        await getStockSafe();

      if (
        !productIsAvailable(
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
              id: makeAction(
                "CAT_MAKIS",
                encodeCart(cart)
              ),

              title:
                "Elegir otro"
            }
          ]
        );
      }

      const updatedSelected = [
        ...selected,
        flavorIndex
      ];

      if (
        updatedSelected.length <
        size.flavors
      ) {
        return sendMakiFlavorList(
          to,
          cart,
          cuts,
          updatedSelected,
          1
        );
      }

      const item = {
        type:
          "maki",

        cuts,

        flavors:
          updatedSelected.slice(
            0,
            size.flavors
          )
      };

      const flavorText =
        item.flavors
          .map(
            (index) =>
              MAKIS[index].name
          )
          .join(" + ");

      return addItemOrFinish(
        to,
        cart,
        item,

        `🍣 ${cuts} cortes\n` +
        `${flavorText}\n` +
        `S/ ${money(
          size.price
        )}`
      );
    }

    case "WINGS_FLAVOR":
      return sendWingsQuantity(
        to,
        decodeCart(parts[2]),
        Number(parts[1])
      );

    case "WINGS_QTY": {
      const flavorIndex =
        Number(parts[1]);

      const portions =
        Number(parts[2]);

      const cart =
        decodeCart(parts[3]);

      if (
        !ALITAS[flavorIndex] ||
        ![1, 2, 3].includes(
          portions
        )
      ) {
        return sendWingsFlavorList(
          to,
          cart
        );
      }

      const item = {
        type:
          "wings",

        flavor:
          flavorIndex,

        portions
      };

      return addItemOrFinish(
        to,
        cart,
        item,

        `🍗 ${portions} porción(es) ` +
        `de ${ALITAS[flavorIndex].name}\n` +
        `${portions * 6} unidades\n` +
        `S/ ${money(
          portions *
          WINGS_PRICE
        )}`
      );
    }

    case "DRINK_TYPE":
      return sendDrinkQuantity(
        to,
        decodeCart(parts[2]),
        Number(parts[1])
      );

    case "DRINK_QTY": {
      const drinkIndex =
        Number(parts[1]);

      const quantity =
        Number(parts[2]);

      const cart =
        decodeCart(parts[3]);

      if (
        !BEBIDAS[drinkIndex] ||
        ![1, 2, 3].includes(
          quantity
        )
      ) {
        return sendDrinkList(
          to,
          cart
        );
      }

      const item = {
        type:
          "drink",

        drink:
          drinkIndex,

        quantity
      };

      return addItemOrFinish(
        to,
        cart,
        item,

        `🥤 ${quantity} × ` +
        `${BEBIDAS[drinkIndex].name}\n` +
        `S/ ${money(
          quantity *
          DRINK_PRICE
        )}`
      );
    }

    case "CART_SUMMARY":
      return sendOrderSummary(
        to,
        decodeCart(parts[1])
      );

    case "CART_CONFIRM":
      return sendConfirmedOrder(
        to,
        decodeCart(parts[1]),

        /*
         * Nombre visible del perfil
         * de WhatsApp.
         */
        customerName,

        /*
         * Identificador único del clic
         * en Confirmar pedido.
         */
        message.id
      );

    case "CART_CANCEL":
      return sendCancelledOrder(
        to
      );

    default:
      return sendWelcomeMenu(
        to
      );
  }
}

/* =========================================================
   WEBHOOK DE META
========================================================= */

export default async function handler(
  req,
  res
) {
  /*
   * Verificación del webhook.
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
   * Mensajes entrantes.
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

          /*
           * Meta incluye el nombre visible
           * del usuario en contacts.
           */
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
            const from =
              message?.from;

            const messageId =
              message?.id;

            if (
              !from ||
              !messageId
            ) {
              continue;
            }

            if (
              processedMessageIds
                .has(messageId)
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
              .add(messageId);

            await routeMessage(
              from,
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

        error?.stack ||
        error?.message ||
        error
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
