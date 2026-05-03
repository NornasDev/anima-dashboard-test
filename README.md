# Ánima Telemetry V2 (anima-dashboard-test)

Mini dashboard **web (HTML + JS vanilla)** pensado para correr en el **teléfono** y registrar telemetría básica de un viaje:

- **Velocidad** estimada por GPS (km/h)
- **Inclinación / roll** usando `deviceorientation` (grados)
- **Cronómetro 0 → 60 km/h** (cuando detecta que pasaste de 0 a 60)
- **Exportación a CSV** (descarga local al finalizar)

## Estructura

- `index.html` — UI responsive (portrait/landscape)
- `app.js` — lógica de sensores + registro + exportación CSV

## Cómo correrlo

Por restricciones del navegador (sensores / GPS), no alcanza con abrir el archivo con `file://`. Servilo con un servidor estático.

### Opción A: Python (simple)

```bash
python3 -m http.server 5173
```

Abrí:

- En tu PC: `http://localhost:5173`

### Opción B: cualquier servidor estático

Sirve también con cualquier alternativa equivalente (p. ej. un server estático de tu editor).

## Uso

1. Abrí la página.
2. Tocá **Iniciar Viaje**.
3. Aceptá permisos (ubicación y/o sensores si el navegador los pide).
4. Al terminar, tocá **Finalizar y Descargar** para bajar el CSV.

## CSV generado

Se descarga un archivo con este encabezado:

```csv
Tiempo,Latitud,Longitud,Velocidad_KMH,Inclinacion_Grados
```

Notas:

- Se registra a **1 Hz** (una fila por segundo).
- `Tiempo` se guarda como ISO (`new Date().toISOString()`).

## Requisitos / compatibilidad (importante)

- **Geolocation** y varios sensores requieren **secure context** (HTTPS) o `localhost`.
  - En un **teléfono**, normalmente necesitás servirlo por **HTTPS** (por ejemplo, publicándolo).
- En **iOS Safari** (iOS 13+), `deviceorientation` suele requerir pedir permiso explícito con `DeviceOrientationEvent.requestPermission()`.
  - Este repo hoy **no** hace esa petición, así que puede que en iPhone el ángulo quede en 0.
- La velocidad de GPS (`coords.speed`) puede venir `null` o con mucho ruido a baja velocidad; el código la fuerza a 0 si no hay dato.

## Privacidad

Los datos quedan en memoria mientras grabás y se exportan a un **CSV local** cuando finalizás.

## Roadmap (ideas)

- Permisos explícitos para iOS (DeviceOrientation / Motion)
- Visualización de ruta en mapa (Leaflet/Mapbox) usando `lat/long`
- Exportar también a JSON + métricas (máxima inclinación, velocidad máx, etc.)
