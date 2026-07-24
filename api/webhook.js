const GRAPH_API_VERSION =
  process.env.GRAPH_API_VERSION || "v25.0";

const MENU_IMAGE_URL =
  process.env.MENU_IMAGE_URL ||
  "https://tareautp.vercel.app/menu.jpg";

/* =========================================================
   CATÁLOGO
========================================================= */

const MAKIS = [
  "Acevichado",
  "Acevichado Classic",
  "Nikumaki",
  "Korean BBQ",
  "Umimaki",
  "Sakura",
  "Furai",
  "Midori",
  "Nami",
  "Otra Cosita",
  "Kraken"
];

const ALITAS = [
  "Acevichadas",
  "Panko Wings",
  "Korean BBQ",
  "Orientales",
  "Sakura",
  "Buffalo"
];

const BEBIDAS = [
  "Inca Cola",
  "Coca Cola",
  "Chicha Morada"
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

/*
 * Como todavía no usamos una base de datos,
 * se limita el carrito para que los IDs de WhatsApp
 * no sean demasiado largos.
 */
const MAX_CART_ITEMS = 8;

/*
 * Evita responder dos veces al mismo webhook
 * cuando Meta reintenta un mensaje.
 *
 * Es solo una protección temporal dentro de cada
 * instancia activa de Vercel.
 */
const processedMessageIds =
  globalThis.__otraCositaProcessedMessages || new Set();

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

/*
 * Crea los IDs internos que viajan dentro
 * de botones y opciones de listas.
 */
function makeAction(...parts) {
  const id = parts.join("|");

  if (id.length > 190) {
    throw new Error(
      "El carrito es demasiado grande para continuar sin una base de datos."
    );
  }

  return id;
}

/* =========================================================
   CODIFICAR Y DECODIFICAR CARRITO
========================================================= */

/*
 * Ejemplos:
 *
 * m24-0,6  = 24 makis, sabores 0 y 6
 * a5-2     = alitas Buffalo, 2 porciones
 * b1-3     = Coca Cola, 3 unidades
 */
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

      /*
       * Makis
       */
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

      /*
       * Alitas
       */
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

      /*
       * Bebidas
       */
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
   CÁLCULOS DEL CARRITO
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

function formatCart(cart, includeTotal = true) {
  if (!cart.length) {
    return "Tu carrito está vacío.";
  }

  const lines = cart.map(
    (item, index) => {
      /*
       * Makis
       */
      if (item.type === "maki") {
        const flavors = item.flavors
          .map(
            (flavorIndex) =>
              MAKIS[flavorIndex]
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

      /*
       * Alitas
       */
      if (item.type === "wings") {
        const units =
          item.portions * 6;

        const subtotal =
          item.portions *
          WINGS_PRICE;

        return (
          `${index + 1}. 🍗 ` +
          `*Alitas ${ALITAS[item.flavor]}*\n` +
          `   ${item.portions} porción(es)` +
          ` · ${units} unidades\n` +
          `   S/ ${money(subtotal)}`
        );
      }

      /*
       * Bebidas
       */
      const subtotal =
        item.quantity *
        DRINK_PRICE;

      return (
        `${index + 1}. 🥤 ` +
        `*${BEBIDAS[item.drink]}*\n` +
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

/* =========================================================
   CONEXIÓN CON WHATSAPP
========================================================= */

async function sendWhatsApp(payload) {
  const token =
    requiredEnv("WHATSAPP_TOKEN");

  const phoneNumberId =
    requiredEnv("PHONE_NUMBER_ID");

  const url =
    `https://graph.facebook.com/` +
    `${GRAPH_API_VERSION}/` +
    `${phoneNumberId}/messages`;

  const response = await fetch(url, {
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
  });

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

          data,

          payloadType:
            payload.type
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
      type:
        payload.type,

      messageId:
        data?.messages?.[0]?.id ||
        null
    })
  );

  return data;
}

/* =========================================================
   TIPOS DE MENSAJES
========================================================= */

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
        button: buttonText,

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
  const body =
    "*¡Hola! Bienvenido a Otra Cosita 🍔.*\n" +
    "*¿Qué se te antoja hoy?*";

  const buttons = [
    {
      id: "START",
      title: "Hacer Pedido"
    }
  ];

  /*
   * Primero intenta enviar la imagen,
   * texto y botón en un solo mensaje.
   */
  try {
    return await sendButtons(
      to,
      body,
      buttons,
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
  } catch (error) {
    console.error(
      "No se pudo enviar el menú con imagen:",
      error.message
    );

    /*
     * Si la imagen falla,
     * envía igualmente la bienvenida.
     */
    return sendButtons(
      to,
      body,
      buttons
    );
  }
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

  const cartInfo = cart.length
    ? (
      "\n\nCarrito actual: " +
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
   MAKIS: TAMAÑO
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

/* =========================================================
   MAKIS: SABORES
========================================================= */

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

  const encodedCart =
    encodeCart(cart);

  const selectedEncoded =
    encodeSelectedFlavors(selected);

  const remaining =
    size.flavors -
    selected.length;

  const selectedText =
    selected.length
      ? (
        "\nElegidos: " +
        selected
          .map(
            (index) =>
              MAKIS[index]
          )
          .join(", ")
      )
      : "";

  /*
   * La lista se divide en páginas
   * para no sobrecargar un mensaje.
   */
  const firstPageIndexes = [
    0, 1, 2, 3,
    4, 5, 6, 7
  ];

  const secondPageIndexes = [
    8, 9, 10
  ];

  const indexes =
    page === 2
      ? secondPageIndexes
      : firstPageIndexes;

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
          MAKIS[flavorIndex],

        description:
          `Seleccionar ${MAKIS[flavorIndex]}`
      })
    );

  if (page === 1) {
    rows.push({
      id: makeAction(
        "MAKI_PAGE",
        String(cuts),
        selectedEncoded,
        "2",
        encodedCart
      ),

      title:
        "Más sabores",

      description:
        "Nami, Otra Cosita y Kraken"
    });
  } else {
    rows.push({
      id: makeAction(
        "MAKI_PAGE",
        String(cuts),
        selectedEncoded,
        "1",
        encodedCart
      ),

      title:
        "Sabores anteriores",

      description:
        "Volver a la primera página"
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

  let instruction;

  if (remaining === 1) {
    instruction =
      "Elige el último sabor.";
  } else {
    instruction =
      `Elige ${remaining} sabores más.`;
  }

  return sendList(
    to,

    `🍣 *${cuts} cortes*\n` +
    instruction +
    selectedText,

    "Ver sabores",

    rows,

    page === 2
      ? "Más sabores"
      : "Sabores"
  );
}

/* =========================================================
   ALITAS
========================================================= */

async function sendWingsFlavorList(
  to,
  cart
) {
  const encodedCart =
    encodeCart(cart);

  const rows =
    ALITAS.map(
      (flavor, index) => ({
        id: makeAction(
          "WINGS_FLAVOR",
          String(index),
          encodedCart
        ),

        title:
          flavor,

        description:
          "6 unidades por porción · S/ 24.90"
      })
    );

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

    "Alitas"
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

    `🍗 Elegiste *${flavor}*.\n` +
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
  const encodedCart =
    encodeCart(cart);

  const rows =
    BEBIDAS.map(
      (drink, index) => ({
        id: makeAction(
          "DRINK_TYPE",
          String(index),
          encodedCart
        ),

        title:
          drink,

        description:
          "S/ 5.00"
      })
    );

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

    "Bebidas"
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

    `🥤 Elegiste *${drink}*.\n` +
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
   CARRITO
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
          "Hacer pedido"
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
  cart
) {
  const orderCode =
    "OC-" +
    Date.now()
      .toString()
      .slice(-6);

  return sendButtons(
    to,

    "✅ *Pedido confirmado*\n\n" +
    `Código: *${orderCode}*\n` +
    `Total: *S/ ${money(
      cartTotal(cart)
    )}*\n\n` +
    "El flujo del pedido quedó completado.",

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
   PROCESAR ACCIONES
========================================================= */

async function routeMessage(
  to,
  message
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
   * Cualquier texto, imagen, audio o sticker
   * vuelve a mostrar la bienvenida.
   */
  if (!actionId) {
    return sendWelcomeMenu(to);
  }

  const parts =
    actionId.split("|");

  const action =
    parts[0];

  switch (action) {
    /*
     * Inicio
     */
    case "START":
      return sendCategoryMenu(
        to,
        []
      );

    /*
     * Categorías
     */
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

    /*
     * Tamaño de makis
     */
    case "MAKI_SIZE": {
      const cuts =
        Number(parts[1]);

      const cart =
        decodeCart(parts[2]);

      return sendMakiFlavorList(
        to,
        cart,
        cuts,
        [],
        1
      );
    }

    /*
     * Cambiar página de sabores
     */
    case "MAKI_PAGE": {
      const cuts =
        Number(parts[1]);

      const selected =
        parseSelectedFlavors(
          parts[2]
        );

      const page =
        Number(parts[3]);

      const cart =
        decodeCart(parts[4]);

      return sendMakiFlavorList(
        to,
        cart,
        cuts,
        selected,
        page
      );
    }

    /*
     * Seleccionar sabor de maki
     */
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

      const updatedSelected = [
        ...selected,
        flavorIndex
      ];

      /*
       * Todavía faltan sabores.
       */
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

      /*
       * Todos los sabores fueron elegidos.
       */
      const item = {
        type: "maki",

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
              MAKIS[index]
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

    /*
     * Seleccionar sabor de alitas
     */
    case "WINGS_FLAVOR": {
      const flavorIndex =
        Number(parts[1]);

      const cart =
        decodeCart(parts[2]);

      return sendWingsQuantity(
        to,
        cart,
        flavorIndex
      );
    }

    /*
     * Seleccionar cantidad de alitas
     */
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
        type: "wings",
        flavor: flavorIndex,
        portions
      };

      return addItemOrFinish(
        to,
        cart,
        item,

        `🍗 ${portions} porción(es) ` +
        `de ${ALITAS[flavorIndex]}\n` +
        `${portions * 6} unidades\n` +
        `S/ ${money(
          portions *
          WINGS_PRICE
        )}`
      );
    }

    /*
     * Seleccionar bebida
     */
    case "DRINK_TYPE": {
      const drinkIndex =
        Number(parts[1]);

      const cart =
        decodeCart(parts[2]);

      return sendDrinkQuantity(
        to,
        cart,
        drinkIndex
      );
    }

    /*
     * Seleccionar cantidad de bebida
     */
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
        type: "drink",
        drink: drinkIndex,
        quantity
      };

      return addItemOrFinish(
        to,
        cart,
        item,

        `🥤 ${quantity} × ` +
        `${BEBIDAS[drinkIndex]}\n` +
        `S/ ${money(
          quantity *
          DRINK_PRICE
        )}`
      );
    }

    /*
     * Ver resumen
     */
    case "CART_SUMMARY":
      return sendOrderSummary(
        to,
        decodeCart(parts[1])
      );

    /*
     * Confirmar
     */
    case "CART_CONFIRM":
      return sendConfirmedOrder(
        to,
        decodeCart(parts[1])
      );

    /*
     * Cancelar
     */
    case "CART_CANCEL":
      return sendCancelledOrder(
        to
      );

    default:
      return sendWelcomeMenu(to);
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
   * Meta verifica el webhook mediante GET.
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
   * Meta entrega mensajes mediante POST.
   */
  if (req.method === "POST") {
    try {
      const entries =
        req.body?.entry || [];

      for (
        const entry of entries
      ) {
        const changes =
          entry?.changes || [];

        for (
          const change of changes
        ) {
          const messages =
            change
              ?.value
              ?.messages || [];

          for (
            const message of messages
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

            /*
             * Ignorar reintentos duplicados.
             */
            if (
              processedMessageIds
                .has(messageId)
            ) {
              console.log(
                "Mensaje duplicado ignorado:",
                messageId
              );

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

            console.log(
              "Mensaje recibido:",
              JSON.stringify({
                from,

                type:
                  message?.type ||
                  null,

                messageId,

                action:
                  message
                    ?.interactive
                    ?.button_reply
                    ?.id ||

                  message
                    ?.interactive
                    ?.list_reply
                    ?.id ||

                  null
              })
            );

            await routeMessage(
              from,
              message
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

      /*
       * Se devuelve 200 para evitar que Meta
       * repita indefinidamente el webhook.
       */
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
