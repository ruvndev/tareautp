# Bot de WhatsApp para Vercel

Bot de demostración construido con WhatsApp Cloud API y Vercel Functions.

## Variables de entorno

- `VERIFY_TOKEN`: frase elegida por ti para validar el webhook.
- `WHATSAPP_TOKEN`: token temporal mostrado por Meta.
- `PHONE_NUMBER_ID`: identificador del número de prueba.
- `GRAPH_API_VERSION`: opcional; por defecto `v25.0`.

## Endpoints

- Salud: `/api`
- Webhook: `/api/webhook`

## Despliegue

1. Sube estos archivos a un repositorio de GitHub.
2. Importa el repositorio en Vercel.
3. Configura las variables de entorno.
4. Despliega.
5. En Meta configura como callback: `https://TU-PROYECTO.vercel.app/api/webhook`.
6. Usa el mismo valor de `VERIFY_TOKEN` y suscríbete al campo `messages`.
7. Escribe `hola` al número de prueba.

Nota: el token temporal de Meta caduca. Cuando ocurra, reemplázalo en Vercel y vuelve a desplegar.
