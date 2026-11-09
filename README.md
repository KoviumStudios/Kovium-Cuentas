# Cuentas y cupos de Kovium

Servicio de autorización de Discord para Kovium Launcher. Comprueba el rol CUPO y conserva las sesiones cifradas en almacenamiento persistente. No modifica Authmod ni sustituye /login.

## Despliegue

Usar Dockerfile y railway.json. Requiere una sola instancia, dominio HTTPS y volumen persistente montado en /data. En Railway configurar RAILWAY_RUN_UID=0: el inicio prepara permisos y ejecuta después el servicio como node.

Configurar PUBLIC_URL con el origen HTTPS real y DISCORD_CLIENT_ID con 1569204071867613185. Guardar DISCORD_CLIENT_SECRET, SESSION_ENCRYPTION_KEY (32 bytes aleatorios en base64) y ADMIN_TOKEN (otra credencial aleatoria de al menos 32 caracteres) únicamente en las variables privadas del alojamiento. Nunca subir .env ni claves a GitHub.

Registrar en Discord el origen HTTPS real seguido de /oauth/discord/callback. Comprobar /health y un acceso real antes de activar el servicio en el catálogo del launcher. Los permisos OAuth son identify y guilds.members.read; no necesita un bot.

## Estado y límites

Código preparado; alojar estos archivos no autoriza ninguna cuenta por sí solo. El plan gratuito de Railway tiene cuota de uso y 0.5 GB de disco: puede detenerse al agotar su cuota y no es adecuado para packs grandes. No se contrata un plan de pago automáticamente.
