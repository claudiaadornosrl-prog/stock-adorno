# Stock · Claudia Adorno

PWA para consultar stock, precio y descripción de artículos por SKU o texto,
en los 3 locales (Alcorta, Unicenter, Oficina). Sin login.

- Snapshot: tabla `stock_articulos` en Supabase, actualizada cada 10 min por
  los daemons `sync_ventas_local` de cada server (jobs tipo 'stock' encolados
  por pg_cron).
- Verificación en vivo: la PWA crea jobs 'stock_sku' y los daemons responden
  con el stock real del momento en ~5-15 segundos.

Deploy: `deploy.ps1` → GitHub Pages (repo stock-adorno).
