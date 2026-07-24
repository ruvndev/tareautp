export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  res.status(200).send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Política de privacidad</title>
      </head>
      <body style="max-width:760px;margin:40px auto;padding:0 20px;font-family:Arial;line-height:1.6">
        <h1>Política de privacidad</h1>
        <p>Última actualización: 23 de julio de 2026</p>

        <p>
          Esta aplicación es un bot de demostración para WhatsApp desarrollado
          con fines académicos.
        </p>

        <h2>Información procesada</h2>
        <p>
          El bot puede recibir el número telefónico del remitente y el contenido
          de los mensajes enviados voluntariamente por el usuario.
        </p>

        <h2>Uso de la información</h2>
        <p>
          La información se utiliza únicamente para procesar el mensaje y
          proporcionar una respuesta automática dentro de WhatsApp.
        </p>

        <h2>Almacenamiento y terceros</h2>
        <p>
          La aplicación no mantiene una base de datos propia con las
          conversaciones. Meta y el proveedor de alojamiento pueden procesar
          datos técnicos según sus propias políticas.
        </p>

        <h2>Eliminación de datos</h2>
        <p>
          Para solicitar información o eliminación de datos, escribe a:
          <strong>REEMPLAZA-CON-TU-CORREO@gmail.com</strong>.
        </p>

        <h2>Contacto</h2>
        <p>
          Correo: <strong>REEMPLAZA-CON-TU-CORREO@gmail.com</strong>
        </p>
      </body>
    </html>
  `);
}
