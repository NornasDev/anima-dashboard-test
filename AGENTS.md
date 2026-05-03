# Proyecto Ánima: Roadmap hacia Jarvis (Agentes y Arquitectura)

Este documento define la evolución del software de telemetría hacia un asistente inteligente basado en agentes, utilizando una arquitectura modular, escalable y extrapolable a cualquier vehículo.

## 1. Arquitectura de Agentes Especializados
Para evitar un sistema monolítico, dividiremos la inteligencia en "Agentes" que corren en paralelo y se comunican a través de un bus de datos (originalmente simulado en un servidor, luego local en la Raspberry Pi).

### A. Agente de Telemetría Dinámica (The Collector)
- **Función:** Captura y normaliza datos de GPS, Acelerómetro y Giroscopio.
- **Innovación:** Fusión de sensores. Si el GPS pierde señal (túnel), usa el acelerómetro para estimar la posición (Dead Reckoning).

### B. Agente Acústico de Diagnóstico (The Listener)
- **Sensor:** Micrófono del teléfono/casco.
- **Función:** Analiza el espectro de audio mediante Transformadas de Fourier (FFT).
- **Métricas:** - Estimación de RPM basada en la frecuencia dominante del motor.
    - Detección de "cascabeleo" o vibraciones anómalas (Pre-fallo mecánico).
    - Detección de cambios en la nota del escape (mezcla rica/pobre).

### C. Agente de Seguridad y Contexto (The Guardian)
- **Función:** Analiza el entorno.
- **Innovación:** Si detecta una desaceleración brusca (frenado de emergencia) seguido de una inclinación de 90° (caída), activa automáticamente el protocolo de emergencia (envío de ubicación por SMS/API).

### D. Agente Jarvis (The Orchestrator)
- **Cerebro:** Integración con LLM (Gemini/Groq) a través de una API.
- **Función:** Traduce los datos técnicos a lenguaje humano natural. No solo dice "Inclinación 30°", dice "Estás mejorando tu técnica en curvas a la izquierda respecto al viaje anterior".

---

## 2. Roadmap Evolutivo (Software-First)

### Fase 1: El Espejo Digital (Simulación en Servidor)
- **Objetivo:** Mover el almacenamiento del teléfono a un servidor central.
- **Acción:** Crear un backend (Node.js/Python) que reciba los datos del teléfono vía WebSockets en tiempo real.
- **Raspberry Pi:** La Pi actúa como el servidor (conectada al hotspot del teléfono).

### Fase 2: Visión Acústica y Análisis de Datos
- **Objetivo:** Implementar el Agente Listener.
- **Acción:** Desarrollar el script de procesamiento de audio en el navegador (Web Audio API) para extraer las RPM del motor sin necesidad de cables.
- **Métricas:** Historial de revoluciones por minuto para sugerir cambios de marcha óptimos.

### Fase 3: La Caja Negra Local (Pi-Native)
- **Objetivo:** Independencia total de la nube.
- **Acción:** Instalar una base de datos de series temporales (InfluxDB) en la Raspberry Pi.
- **Dashboard:** Grafana corriendo en la Pi para visualizar los datos en el garaje desde cualquier dispositivo.

### Fase 4: Inteligencia Conversacional (Jarvis Live)
- **Objetivo:** Interacción fluida por voz.
- **Acción:** Implementar un sistema de "Context Buffer". El sistema envía los últimos 30 segundos de telemetría a Jarvis para que cuando preguntes "¿Cómo voy?", él sepa exactamente qué pasó en la última curva.

---

## 3. Ideas Innovadoras para Escalar
- **Intercomunicación de Flota:** Si otro amigo usa Ánima, los Jarvis se comunican entre sí: "Tu compañero de ruta está 500 metros atrás y ha bajado el ritmo".
- **Modo Reconocimiento de Terreno:** Usar la API de mapas para predecir curvas: "Curva cerrada a la derecha en 200 metros, reduce velocidad".
- **Gamificación de Conducción:** Puntuación de eficiencia y seguridad (Estilo 'Eco-Score' o 'Safety-Score').