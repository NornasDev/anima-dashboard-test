// ==========================================
// VARIABLES DE ESTADO Y MEMORIA
// ==========================================
let registroViaje = [];
let grabando = false;
let gpsWatchId = null;
let intervaloGrabacion = null;

let velocidadActual = 0;
let inclinacionActual = 0;

// Variables de métricas adicionales
let distanciaTotal = 0; // km
let velocidadMax = 0;
let maxLeanAngle = 0;
let tiempoInicioViaje = 0;
let gForceActual = 0;
let ultimoRegistro = null;

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
const statusBadge = document.getElementById('status-badge');
const luzRoja = document.getElementById('luz-roja');
const luzVerde = document.getElementById('luz-verde');
const textoSemaforo = document.getElementById('texto-semaforo');

// Referencias HTML - Page 2 (Stats)
const btnIniciar2 = document.getElementById('btn-iniciar-2');
const btnDetener2 = document.getElementById('btn-detener-2');
const statDistancia = document.getElementById('stat-distancia');
const statVelMax = document.getElementById('stat-vel-max');
const statGForce = document.getElementById('stat-gforce');
const statLeanMax = document.getElementById('stat-lean-max');
const statVelProm = document.getElementById('stat-vel-prom');
const statTiempo = document.getElementById('stat-tiempo');

// Referencias de navegación
const pagesContainer = document.getElementById('pages');
const dot0 = document.getElementById('dot-0');
const dot1 = document.getElementById('dot-1');
const btnTogglePage = document.getElementById('btn-toggle-page');

let currentPage = 0;
let touchStartX = 0;
let touchEndX = 0;

// ==========================================
// NAVEGACIÓN POR SWIPE
// ==========================================
function setupSwipe() {
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
    currentPage = pageNum;
    pagesContainer.style.transform = `translateX(-${pageNum * 100}%)`;

    // Update dots
    dot0.classList.toggle('active', pageNum === 0);
    dot1.classList.toggle('active', pageNum === 1);

    if (btnTogglePage) {
        btnTogglePage.innerText = pageNum === 0 ? 'Métricas' : 'Velocímetro';
    }
}

function togglePage() {
    goToPage(currentPage === 0 ? 1 : 0);
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

// ==========================================
// INICIO DE TELEMETRÍA
// ==========================================
function iniciarTelemetria() {
    activarPantallaCompleta();
    hablar("Sistemas en línea. Grabando telemetría.");

    btnIniciar.style.display = 'none';
    btnDetener.style.display = 'block';
    btnIniciar2.style.display = 'none';
    btnDetener2.style.display = 'block';
    statusBadge.classList.add('active');

    // Reset métricas
    grabando = true;
    registroViaje = [];
    semaforoAnunciado = false;
    distanciaTotal = 0;
    velocidadMax = 0;
    maxLeanAngle = 0;
    gForceActual = 0;
    ultimoRegistro = null;
    tiempoInicioViaje = Date.now();

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
        velocidad_kmh: velocidadActual,
        inclinacion_grados: inclinacionActual,
        gforce: gForceActual
    });

    actualizarStats();
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
    statDistancia.innerText = distanciaTotal.toFixed(2);
    statVelMax.innerText = velocidadMax;
    statGForce.innerText = gForceActual.toFixed(1);
    statLeanMax.innerText = Math.round(Math.abs(maxLeanAngle)) + "°";
    statVelProm.innerText = velProm;
    statTiempo.innerText = tiempoStr;
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

    luzRoja.classList.remove('active');
    luzVerde.classList.add('active');
    textoSemaforo.innerText = "¡LAUNCH!";
    textoSemaforo.style.color = "#00ff00";

    display0_60.innerText = "Midiendo...";
    display0_100.innerText = "Midiendo...";
    display0_60.style.color = "#ffaa00";
    display0_100.style.color = "#ffaa00";
}

function abortarLaunchControl(motivo) {
    midiendoAceleracion = false;

    if (motivo === "Detención total" || motivo === "Pérdida de aceleración detectada") {
        hablar("Abortado");
    } else {
        hablar("Tiempo excedido");
    }

    luzVerde.classList.remove('active');
    textoSemaforo.innerText = "ABORTO";
    textoSemaforo.style.color = "#ff3366";

    if (!meta60Alcanzada) {
        display0_60.innerText = "-- s";
        display0_60.style.color = "#ffaa00";
    }
    if (!meta100Alcanzada) {
        display0_100.innerText = "-- s";
        display0_100.style.color = "#ffaa00";
    }
}

// ==========================================
// ACELERÓMETRO Y G-FORCE
// ==========================================
function manejarAcelerometro(evento) {
    // Calcular G-Force
    let acc = evento.accelerationIncludingGravity;
    if (acc && acc.x !== null) {
        let gx = acc.x / 9.81;
        let gy = acc.y / 9.81;
        let gz = acc.z / 9.81;
        gForceActual = Math.sqrt(gx*gx + gy*gy + gz*gz) - 1; // Restar gravedad
        gForceActual = Math.abs(gForceActual);
    }

    // Launch control por movimiento
    if (!grabando) return;
    if (velocidadActual === 0 && !midiendoAceleracion && textoSemaforo.innerText === "ARMADO") {
        let accel = evento.acceleration;
        if (!accel || accel.x === null) return;
        let fuerzaMovimiento = Math.sqrt(accel.x*accel.x + accel.y*accel.y + accel.z*accel.z);
        if (fuerzaMovimiento > 2.5) {
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
    let roll = (orientacion === 90 || orientacion === -90) ? evento.beta : evento.gamma;
    if (roll !== null) {
        inclinacionActual = Math.round(roll);
        displayAngulo.innerText = inclinacionActual + "°";
    }
}

// ==========================================
// GPS
// ==========================================
function manejarGPS(posicion) {
    if (!grabando) return;

    let velocidad_ms = posicion.coords.speed;
    if (velocidad_ms === null || velocidad_ms < 0) velocidad_ms = 0;
    velocidadActual = Math.round(velocidad_ms * 3.6);
    displayVel.innerText = velocidadActual;

    // Estado de reposo
    if (velocidadActual === 0) {
        if (midiendoAceleracion) abortarLaunchControl("Detención total");
        midiendoAceleracion = false;

        luzVerde.classList.remove('active');
        luzRoja.classList.add('active');
        textoSemaforo.innerText = "ARMADO";
        textoSemaforo.style.color = "#ff0000";

        if (!semaforoAnunciado) {
            hablar("Armado");
            semaforoAnunciado = true;
        }
    }
    // Movimiento
    else if (velocidadActual > 0) {
        semaforoAnunciado = false;

        if (!midiendoAceleracion && textoSemaforo.innerText === "ARMADO") {
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
            display0_60.innerText = transcurrido + "s";
            display0_60.style.color = "#00ff00";
            hablar("Sesenta en " + transcurrido + " segundos");
        }

        if (velocidadActual >= 100 && !meta100Alcanzada) {
            meta100Alcanzada = true;
            display0_100.innerText = transcurrido + "s";
            display0_100.style.color = "#00ff00";

            hablar("Cien kilómetros por hora alcanzados");

            midiendoAceleracion = false;
            luzVerde.classList.remove('active');
            textoSemaforo.innerText = "COMPLETADO";
            textoSemaforo.style.color = "#888";
        }
    }
}

function manejarErrorGPS(error) { displayVel.innerText = "ERR"; }

// ==========================================
// EXPORTACIÓN DE DATOS
// ==========================================
function descargarCSV() {
    salirPantallaCompleta();
    grabando = false;

    hablar("Telemetría finalizada. Exportando caja negra.");

    window.removeEventListener('deviceorientation', manejarInclinacion);
    window.removeEventListener('devicemotion', manejarAcelerometro);
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    clearInterval(intervaloGrabacion);

    btnIniciar.style.display = 'block';
    btnDetener.style.display = 'none';
    btnIniciar2.style.display = 'block';
    btnDetener2.style.display = 'none';
    statusBadge.classList.remove('active');

    if (registroViaje.length === 0) return;

    let contenidoCSV = "Tiempo,Velocidad_KMH,Inclinacion_Grados,G-Force\n";
    registroViaje.forEach(fila => {
        contenidoCSV += `${fila.tiempo},${fila.velocidad_kmh},${fila.inclinacion_grados},${fila.gforce || 0}\n`;
    });

    const blob = new Blob([contenidoCSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `ruta_NKD_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Inicializar swipe al cargar
setupSwipe();
