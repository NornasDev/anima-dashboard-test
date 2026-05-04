// ==========================================
// VARIABLES DE ESTADO Y MEMORIA
// ==========================================
let registroViaje = [];
let grabando = false;
let gpsWatchId = null;
let intervaloGrabacion = null;

let velocidadActual = 0;
let inclinacionActual = 0;
let velocidadMsActual = 0;
let latitudActual = null;
let longitudActual = null;
let precisionGpsActual = null;
let altitudActual = null;
let headingActual = null;

let orientacionPantalla = 0;
let betaActual = null;
let gammaActual = null;

let accelX = 0;
let accelY = 0;
let accelZ = 0;
let accelGX = 0;
let accelGY = 0;
let accelGZ = 0;
let tiempo060 = null;
let tiempo0100 = null;

// Variables de métricas adicionales
let distanciaTotal = 0; // km
let velocidadMax = 0;
let maxLeanAngle = 0;
let tiempoInicioViaje = 0;
let gForceActual = 0;
let ultimoRegistro = null;
let velocidadAnteriorGPS = 0;
let wakeLock = null;

const AUTOSAVE_KEY = 'anima.telemetry.autosave.v1';
const SERVER_URL_KEY = 'anima.telemetry.server-url.v1';
const LAUNCH_MIN_SPEED_KMH = 15;
const LAUNCH_MIN_DELTA_KMH = 4;
const LAUNCH_MIN_MOTION_MS2 = 6.5;

// Variables de Drag Race (Launch Control)
let midiendoAceleracion = false;
let tiempoInicioLanzamiento = 0;
let meta60Alcanzada = false;
let meta100Alcanzada = false;
let maxVelocidadLanzamiento = 0;

// Variable para no repetir el mismo audio del semáforo mil veces
let semaforoAnunciado = false;

// Referencias HTML - Page 1
const displayVel = document.getElementById('display-velocidad');
const displayAngulo = document.getElementById('display-angulo');
const display0_60 = document.getElementById('display-0-60');
const display0_100 = document.getElementById('display-0-100');
const btnIniciar = document.getElementById('btn-iniciar');
const btnDetener = document.getElementById('btn-detener');
const btnStopFab = document.getElementById('btn-stop-fab');
const statusBadge = document.getElementById('status-badge');
const luzRoja = document.getElementById('luz-roja');
const luzVerde = document.getElementById('luz-verde');
const textoSemaforo = document.getElementById('texto-semaforo');

// Referencias HTML - Page 2 (Stats)
const btnIniciar2 = document.getElementById('btn-iniciar-2');
const btnDetener2 = document.getElementById('btn-detener-2');
const btnEnviarServidor = document.getElementById('btn-enviar-servidor');
const statDistancia = document.getElementById('stat-distancia');
const statVelMax = document.getElementById('stat-vel-max');
const statGForce = document.getElementById('stat-gforce');
const statLeanMax = document.getElementById('stat-lean-max');
const statVelProm = document.getElementById('stat-vel-prom');
const statTiempo = document.getElementById('stat-tiempo');

// Referencias de navegación
const pagesContainer = document.getElementById('pages');
const page0 = document.getElementById('page-0');
const page1 = document.getElementById('page-1');
const dot0 = document.getElementById('dot-0');
const dot1 = document.getElementById('dot-1');
const btnTogglePage = document.getElementById('btn-toggle-page');

let currentPage = 0;
let touchStartX = 0;
let touchEndX = 0;
let launchConfidenceTicks = 0;

function setText(el, value) {
    if (!el) return;
    el.innerText = value;
}

function setDisplay(el, value) {
    if (!el) return;
    el.style.display = value;
}

function addClass(el, className) {
    if (!el?.classList) return;
    el.classList.add(className);
}

function removeClass(el, className) {
    if (!el?.classList) return;
    el.classList.remove(className);
}

function toggleClass(el, className, force) {
    if (!el?.classList) return;
    el.classList.toggle(className, force);
}

// ==========================================
// NAVEGACIÓN POR SWIPE
// ==========================================
function setupSwipe() {
    if (!pagesContainer) return;

    pagesContainer.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    pagesContainer.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentPage === 0) {
            goToPage(1); // Swipe left -> go to page 2
        } else if (diff < 0 && currentPage === 1) {
            goToPage(0); // Swipe right -> go back to page 1
        }
    }
}

function goToPage(pageNum) {
    currentPage = pageNum === 1 ? 1 : 0;

    toggleClass(page0, 'active', currentPage === 0);
    toggleClass(page1, 'active', currentPage === 1);

    // Update dots
    toggleClass(dot0, 'active', currentPage === 0);
    toggleClass(dot1, 'active', currentPage === 1);

    if (btnTogglePage) {
        btnTogglePage.innerText = currentPage === 0 ? 'Métricas' : 'Velocímetro';
    }
}

function togglePage() {
    goToPage(currentPage === 0 ? 1 : 0);
}

function getServerUrl() {
    try {
        return localStorage.getItem(SERVER_URL_KEY) || '';
    } catch (_) {
        return '';
    }
}

function setServerUrl(url) {
    try {
        localStorage.setItem(SERVER_URL_KEY, url);
    } catch (_) {
        // noop
    }
}

// ==========================================
// EL MÓDULO DE VOZ (JARVIS)
// ==========================================
function hablar(texto) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let mensaje = new SpeechSynthesisUtterance(texto);
        mensaje.lang = 'es-MX';
        mensaje.rate = 1.3;
        mensaje.pitch = 1.0;
        window.speechSynthesis.speak(mensaje);
    }
}

// ==========================================
// CONTROL DE PANTALLA
// ==========================================
function activarPantallaCompleta() {
    let el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}

function salirPantallaCompleta() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

async function activarWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        }
    } catch (_) {
        // Algunos navegadores bloquean Wake Lock según contexto/gesto.
    }
}

async function liberarWakeLock() {
    try {
        if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch (_) {
        wakeLock = null;
    }
}

function guardarRespaldoLocal() {
    try {
        if (!registroViaje.length) return;

        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            registroViaje,
            resumen: {
                distanciaTotal,
                velocidadMax,
                maxLeanAngle,
                tiempoInicioViaje
            }
        }));
    } catch (_) {
        // Si falla storage, no rompemos la app.
    }
}

function limpiarRespaldoLocal() {
    try {
        localStorage.removeItem(AUTOSAVE_KEY);
    } catch (_) {
        // noop
    }
}

function descargarCSVDesdeRegistros(registros, prefijo = 'ruta_NKD') {
    if (!Array.isArray(registros) || !registros.length) return;

    let contenidoCSV = [
        "Tiempo",
        "Latitud",
        "Longitud",
        "Precision_GPS_M",
        "Altitud_M",
        "Heading_Deg",
        "Velocidad_MS",
        "Velocidad_KMH",
        "Orientacion_Pantalla_Deg",
        "Beta",
        "Gamma",
        "Inclinacion_Grados",
        "Accel_X_MS2",
        "Accel_Y_MS2",
        "Accel_Z_MS2",
        "Accel_GX_MS2",
        "Accel_GY_MS2",
        "Accel_GZ_MS2",
        "G_Force",
        "Estado_Semaforo",
        "Midiendo_Lanzamiento",
        "Tiempo_0_60_S",
        "Tiempo_0_100_S"
    ].join(',') + "\n";

    registros.forEach(fila => {
        contenidoCSV += [
            fila.tiempo,
            fila.latitud,
            fila.longitud,
            fila.precision_gps_m,
            fila.altitud_m,
            fila.heading_deg,
            fila.velocidad_ms,
            fila.velocidad_kmh,
            fila.orientacion_pantalla_deg,
            fila.beta,
            fila.gamma,
            fila.inclinacion_grados,
            fila.accel_x_ms2,
            fila.accel_y_ms2,
            fila.accel_z_ms2,
            fila.accel_gx_ms2,
            fila.accel_gy_ms2,
            fila.accel_gz_ms2,
            fila.gforce,
            `"${String(fila.estado_semaforo || '').replace(/"/g, '""')}"`,
            fila.midiendo_lanzamiento,
            fila.tiempo_0_60_s,
            fila.tiempo_0_100_s
        ].join(',') + "\n";
    });

    const blob = new Blob([contenidoCSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `${prefijo}_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function recuperarRespaldoSiExiste() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return;

        const backup = JSON.parse(raw);
        const registros = backup?.registroViaje;
        if (!Array.isArray(registros) || !registros.length) return;

        const ok = window.confirm(
            `Encontré un viaje sin exportar (${registros.length} registros). ¿Querés descargar el rescate ahora?`
        );

        if (ok) {
            descargarCSVDesdeRegistros(registros, 'ruta_rescate_NKD');
            limpiarRespaldoLocal();
        }
    } catch (_) {
        // noop
    }
}

function construirPayloadViaje() {
    const tiempoFin = new Date().toISOString();
    const tiempoInicioISO = tiempoInicioViaje ? new Date(tiempoInicioViaje).toISOString() : null;

    return {
        source: 'anima-dashboard-test',
        created_at: new Date().toISOString(),
        trip: {
            started_at: tiempoInicioISO,
            ended_at: tiempoFin,
            duration_ms: tiempoInicioViaje ? Date.now() - tiempoInicioViaje : null,
            summary: {
                distancia_km: Number(distanciaTotal.toFixed(3)),
                velocidad_max_kmh: velocidadMax,
                velocidad_promedio_kmh: registroViaje.length
                    ? Math.round(registroViaje.reduce((acc, r) => acc + (r.velocidad_kmh || 0), 0) / registroViaje.length)
                    : 0,
                lean_max_grados: Math.round(Math.abs(maxLeanAngle)),
                gforce_max: registroViaje.reduce((acc, r) => Math.max(acc, Number(r.gforce || 0)), 0),
                tiempo_0_60_s: tiempo060,
                tiempo_0_100_s: tiempo0100
            }
        },
        records: registroViaje
    };
}

async function enviarDatosServidor() {
    if (!registroViaje.length) {
        alert('Todavía no hay datos para enviar.');
        return;
    }

    const saved = getServerUrl();
    const input = window.prompt('URL del endpoint (POST JSON):', saved || 'https://tu-servidor.com/api/telemetria');
    if (!input) return;

    const url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
        alert('La URL debe empezar con http:// o https://');
        return;
    }

    setServerUrl(url);

    if (btnEnviarServidor) {
        btnEnviarServidor.disabled = true;
        btnEnviarServidor.innerText = 'Enviando...';
    }

    try {
        const payload = construirPayloadViaje();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        alert('Datos enviados al servidor con éxito.');
    } catch (error) {
        alert(`No se pudo enviar al servidor: ${error.message}`);
    } finally {
        if (btnEnviarServidor) {
            btnEnviarServidor.disabled = false;
            btnEnviarServidor.innerText = 'Enviar';
        }
    }
}

// ==========================================
// INICIO DE TELEMETRÍA
// ==========================================
function iniciarTelemetria() {
    activarPantallaCompleta();
    activarWakeLock();
    hablar("Sistemas en línea. Grabando telemetría.");

    setDisplay(btnIniciar, 'none');
    setDisplay(btnDetener, 'block');
    setDisplay(btnIniciar2, 'none');
    setDisplay(btnDetener2, 'block');
    setDisplay(btnStopFab, 'block');
    addClass(statusBadge, 'active');

    // Reset métricas
    grabando = true;
    registroViaje = [];
    semaforoAnunciado = false;
    distanciaTotal = 0;
    velocidadMax = 0;
    maxLeanAngle = 0;
    gForceActual = 0;
    ultimoRegistro = null;
    velocidadAnteriorGPS = 0;
    velocidadMsActual = 0;
    latitudActual = null;
    longitudActual = null;
    precisionGpsActual = null;
    altitudActual = null;
    headingActual = null;
    orientacionPantalla = 0;
    betaActual = null;
    gammaActual = null;
    accelX = 0;
    accelY = 0;
    accelZ = 0;
    accelGX = 0;
    accelGY = 0;
    accelGZ = 0;
    tiempo060 = null;
    tiempo0100 = null;
    launchConfidenceTicks = 0;
    tiempoInicioViaje = Date.now();

    limpiarRespaldoLocal();

    window.addEventListener('deviceorientation', manejarInclinacion);
    window.addEventListener('devicemotion', manejarAcelerometro);

    if ("geolocation" in navigator) {
        gpsWatchId = navigator.geolocation.watchPosition(
            manejarGPS, manejarErrorGPS,
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    } else { alert("Tu navegador no soporta GPS."); }

    intervaloGrabacion = setInterval(() => {
        registrarDato();
    }, 1000);
}

function registrarDato() {
    registroViaje.push({
        tiempo: new Date().toISOString(),
        latitud: latitudActual,
        longitud: longitudActual,
        precision_gps_m: precisionGpsActual,
        altitud_m: altitudActual,
        heading_deg: headingActual,
        velocidad_ms: Number(velocidadMsActual.toFixed(3)),
        velocidad_kmh: velocidadActual,
        orientacion_pantalla_deg: orientacionPantalla,
        beta: betaActual,
        gamma: gammaActual,
        inclinacion_grados: inclinacionActual,
        accel_x_ms2: Number(accelX.toFixed(3)),
        accel_y_ms2: Number(accelY.toFixed(3)),
        accel_z_ms2: Number(accelZ.toFixed(3)),
        accel_gx_ms2: Number(accelGX.toFixed(3)),
        accel_gy_ms2: Number(accelGY.toFixed(3)),
        accel_gz_ms2: Number(accelGZ.toFixed(3)),
        gforce: Number(gForceActual.toFixed(3)),
        estado_semaforo: textoSemaforo.innerText,
        midiendo_lanzamiento: midiendoAceleracion,
        tiempo_0_60_s: tiempo060,
        tiempo_0_100_s: tiempo0100
    });

    actualizarStats();
    guardarRespaldoLocal();
}

function actualizarStats() {
    // Distancia (aproximada usando velocidad promedio)
    if (registroViaje.length > 1) {
        let velAnterior = registroViaje[registroViaje.length - 2].velocidad_kmh;
        let velActual = velocidadActual;
        let distanciaTramo = ((velAnterior + velActual) / 2) / 3600; // km en 1 segundo
        distanciaTotal += distanciaTramo;
    }

    // Velocidad máxima
    if (velocidadActual > velocidadMax) {
        velocidadMax = velocidadActual;
    }

    // Lean máximo
    if (Math.abs(inclinacionActual) > Math.abs(maxLeanAngle)) {
        maxLeanAngle = inclinacionActual;
    }

    // Velocidad promedio
    let velProm = 0;
    if (registroViaje.length > 0) {
        let suma = registroViaje.reduce((acc, r) => acc + r.velocidad_kmh, 0);
        velProm = Math.round(suma / registroViaje.length);
    }

    // Tiempo total
    let tiempoMs = Date.now() - tiempoInicioViaje;
    let horas = Math.floor(tiempoMs / 3600000);
    let minutos = Math.floor((tiempoMs % 3600000) / 60000);
    let tiempoStr = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;

    // Actualizar UI
    setText(statDistancia, distanciaTotal.toFixed(2));
    setText(statVelMax, velocidadMax);
    setText(statGForce, gForceActual.toFixed(1));
    setText(statLeanMax, Math.round(Math.abs(maxLeanAngle)) + "°");
    setText(statVelProm, velProm);
    setText(statTiempo, tiempoStr);
}

// ==========================================
// LÓGICA DE LANZAMIENTO Y ABORTO
// ==========================================
function dispararLaunchControl() {
    midiendoAceleracion = true;
    meta60Alcanzada = false;
    meta100Alcanzada = false;
    maxVelocidadLanzamiento = 0;
    tiempoInicioLanzamiento = performance.now();

    hablar("¡Vamos!");

    removeClass(luzRoja, 'active');
    addClass(luzVerde, 'active');
    setText(textoSemaforo, "¡LAUNCH!");
    if (textoSemaforo) textoSemaforo.style.color = "#00ff00";

    setText(display0_60, "Midiendo...");
    setText(display0_100, "Midiendo...");
    if (display0_60) display0_60.style.color = "#ffaa00";
    if (display0_100) display0_100.style.color = "#ffaa00";
}

function abortarLaunchControl(motivo) {
    midiendoAceleracion = false;

    if (motivo === "Detención total" || motivo === "Pérdida de aceleración detectada") {
        hablar("Abortado");
    } else {
        hablar("Tiempo excedido");
    }

    removeClass(luzVerde, 'active');
    setText(textoSemaforo, "ABORTO");
    if (textoSemaforo) textoSemaforo.style.color = "#ff3366";

    if (!meta60Alcanzada) {
        setText(display0_60, "-- s");
        if (display0_60) display0_60.style.color = "#ffaa00";
    }
    if (!meta100Alcanzada) {
        setText(display0_100, "-- s");
        if (display0_100) display0_100.style.color = "#ffaa00";
    }
}

// ==========================================
// ACELERÓMETRO Y G-FORCE
// ==========================================
function manejarAcelerometro(evento) {
    // Calcular G-Force
    const acc = evento.accelerationIncludingGravity;
    const accelLineal = evento.acceleration;

    if (acc && acc.x !== null) {
        accelGX = Number(acc.x || 0);
        accelGY = Number(acc.y || 0);
        accelGZ = Number(acc.z || 0);

        let gx = accelGX / 9.81;
        let gy = accelGY / 9.81;
        let gz = accelGZ / 9.81;
        gForceActual = Math.sqrt(gx*gx + gy*gy + gz*gz) - 1; // Restar gravedad
        gForceActual = Math.abs(gForceActual);
    }

    if (accelLineal && accelLineal.x !== null) {
        accelX = Number(accelLineal.x || 0);
        accelY = Number(accelLineal.y || 0);
        accelZ = Number(accelLineal.z || 0);
    }

    // Launch control por movimiento
    if (!grabando) return;
    if (velocidadActual === 0 && !midiendoAceleracion && textoSemaforo?.innerText === "ARMADO") {
        if (!accelLineal || accelLineal.x === null) return;
        let fuerzaMovimiento = Math.sqrt(accelLineal.x*accelLineal.x + accelLineal.y*accelLineal.y + accelLineal.z*accelLineal.z);
        if (fuerzaMovimiento > LAUNCH_MIN_MOTION_MS2) {
            dispararLaunchControl();
        }
    }
}

// ==========================================
// INCLINACIÓN
// ==========================================
function manejarInclinacion(evento) {
    if (!grabando) return;
    let orientacion = (screen.orientation || {}).angle || window.orientation || 0;
    orientacionPantalla = Number(orientacion || 0);
    betaActual = evento.beta !== null ? Number(evento.beta) : null;
    gammaActual = evento.gamma !== null ? Number(evento.gamma) : null;

    let roll = (orientacion === 90 || orientacion === -90) ? evento.beta : evento.gamma;
    if (roll !== null) {
        inclinacionActual = Math.round(roll);
        setText(displayAngulo, inclinacionActual + "°");
    }
}

// ==========================================
// GPS
// ==========================================
function manejarGPS(posicion) {
    if (!grabando) return;

    latitudActual = Number(posicion.coords.latitude);
    longitudActual = Number(posicion.coords.longitude);
    precisionGpsActual = posicion.coords.accuracy !== null ? Number(posicion.coords.accuracy) : null;
    altitudActual = posicion.coords.altitude !== null ? Number(posicion.coords.altitude) : null;
    headingActual = posicion.coords.heading !== null ? Number(posicion.coords.heading) : null;

    let velocidad_ms = posicion.coords.speed;
    if (velocidad_ms === null || velocidad_ms < 0) velocidad_ms = 0;
    velocidadMsActual = Number(velocidad_ms);
    velocidadActual = Math.round(velocidad_ms * 3.6);
    setText(displayVel, velocidadActual);

    // Estado de reposo
    if (velocidadActual === 0) {
        if (midiendoAceleracion) abortarLaunchControl("Detención total");
        midiendoAceleracion = false;

        removeClass(luzVerde, 'active');
        addClass(luzRoja, 'active');
        setText(textoSemaforo, "ARMADO");
        if (textoSemaforo) textoSemaforo.style.color = "#ff0000";
        launchConfidenceTicks = 0;

        if (!semaforoAnunciado) {
            hablar("Armado");
            semaforoAnunciado = true;
        }
    }
    // Movimiento
    else if (velocidadActual > 0) {
        semaforoAnunciado = false;

        const deltaVelocidad = velocidadActual - velocidadAnteriorGPS;
        const salidaReal = (
            velocidadActual >= LAUNCH_MIN_SPEED_KMH &&
            (deltaVelocidad >= LAUNCH_MIN_DELTA_KMH || gForceActual >= 0.2)
        );

        launchConfidenceTicks = salidaReal ? launchConfidenceTicks + 1 : 0;
        const lanzamientoConfirmado = launchConfidenceTicks >= 2;

        if (!midiendoAceleracion && textoSemaforo?.innerText === "ARMADO" && lanzamientoConfirmado) {
            dispararLaunchControl();
        }
    }

    // Evaluación durante el jalón
    if (midiendoAceleracion) {
        let tiempoActual = performance.now();
        let transcurrido = ((tiempoActual - tiempoInicioLanzamiento) / 1000).toFixed(2);

        if (velocidadActual > maxVelocidadLanzamiento) {
            maxVelocidadLanzamiento = velocidadActual;
        }

        if (velocidadActual <= maxVelocidadLanzamiento - 3) {
            abortarLaunchControl("Pérdida de aceleración detectada");
            return;
        }

        if (transcurrido > 12 && velocidadActual < 40) {
            abortarLaunchControl("Aceleración insuficiente");
            return;
        }

        if (transcurrido > 40 && !meta100Alcanzada) {
            abortarLaunchControl("Tiempo límite de pista excedido");
            return;
        }

        // Tiempos
        if (velocidadActual >= 60 && !meta60Alcanzada) {
            meta60Alcanzada = true;
            tiempo060 = Number(transcurrido);
            setText(display0_60, transcurrido + "s");
            if (display0_60) display0_60.style.color = "#00ff00";
            hablar("Sesenta en " + transcurrido + " segundos");
        }

        if (velocidadActual >= 100 && !meta100Alcanzada) {
            meta100Alcanzada = true;
            tiempo0100 = Number(transcurrido);
            setText(display0_100, transcurrido + "s");
            if (display0_100) display0_100.style.color = "#00ff00";

            hablar("Cien kilómetros por hora alcanzados");

            midiendoAceleracion = false;
            removeClass(luzVerde, 'active');
            setText(textoSemaforo, "COMPLETADO");
            if (textoSemaforo) textoSemaforo.style.color = "#888";
        }
    }

    velocidadAnteriorGPS = velocidadActual;
}

function manejarErrorGPS(error) { setText(displayVel, "ERR"); }

// ==========================================
// EXPORTACIÓN DE DATOS
// ==========================================
function descargarCSV() {
    salirPantallaCompleta();
    liberarWakeLock();
    grabando = false;

    hablar("Telemetría finalizada. Exportando caja negra.");

    window.removeEventListener('deviceorientation', manejarInclinacion);
    window.removeEventListener('devicemotion', manejarAcelerometro);
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    clearInterval(intervaloGrabacion);

    setDisplay(btnIniciar, 'block');
    setDisplay(btnDetener, 'none');
    setDisplay(btnIniciar2, 'block');
    setDisplay(btnDetener2, 'none');
    setDisplay(btnStopFab, 'none');
    removeClass(statusBadge, 'active');

    if (registroViaje.length === 0) return;

    descargarCSVDesdeRegistros(registroViaje);
    limpiarRespaldoLocal();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && grabando) {
        activarWakeLock();
    }
});

window.addEventListener('beforeunload', () => {
    if (grabando) {
        guardarRespaldoLocal();
    }
});

window.addEventListener('error', () => {
    // Fail-safe: mantener control de parada visible si algo rompe en runtime.
    if (grabando) setDisplay(btnStopFab, 'block');
});

window.addEventListener('unhandledrejection', () => {
    if (grabando) setDisplay(btnStopFab, 'block');
});

// Inicialización
setupSwipe();
goToPage(0);
recuperarRespaldoSiExiste();
