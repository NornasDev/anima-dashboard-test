// ==========================================
// VARIABLES DE ESTADO Y MEMORIA
// ==========================================
let registroViaje = [];
let grabando = false;
let gpsWatchId = null;
let intervaloGrabacion = null;

let velocidadActual = 0;
let inclinacionActual = 0;

// Variables de Drag Race (Launch Control)
let midiendoAceleracion = false;
let tiempoInicioLanzamiento = 0;
let meta60Alcanzada = false;
let meta100Alcanzada = false;
let maxVelocidadLanzamiento = 0; // NUEVO: Para saber cuál fue el pico antes de frenar

// Referencias HTML
const displayVel = document.getElementById('display-velocidad');
const displayAngulo = document.getElementById('display-angulo');
const display0_60 = document.getElementById('display-0-60');
const display0_100 = document.getElementById('display-0-100');
const btnIniciar = document.getElementById('btn-iniciar');
const btnDetener = document.getElementById('btn-detener');
const estadoGrabacion = document.getElementById('estado');

// Semáforo UI
const luzRoja = document.getElementById('luz-roja');
const luzVerde = document.getElementById('luz-verde');
const textoSemaforo = document.getElementById('texto-semaforo');

// Pantalla Completa
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
    
    btnIniciar.style.display = 'none';
    btnDetener.style.display = 'block';
    estadoGrabacion.style.visibility = 'visible';
    
    grabando = true;
    registroViaje = []; 

    window.addEventListener('deviceorientation', manejarInclinacion);
    window.addEventListener('devicemotion', manejarAcelerometro); 

    if ("geolocation" in navigator) {
        gpsWatchId = navigator.geolocation.watchPosition(
            manejarGPS, manejarErrorGPS, 
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    } else { alert("Tu navegador no soporta GPS."); }

    intervaloGrabacion = setInterval(() => {
        registroViaje.push({
            tiempo: new Date().toISOString(),
            velocidad_kmh: velocidadActual,
            inclinacion_grados: inclinacionActual
        });
    }, 1000); 
}

// ==========================================
// LÓGICA DE LANZAMIENTO Y ABORTO
// ==========================================
function dispararLaunchControl() {
    midiendoAceleracion = true;
    meta60Alcanzada = false;
    meta100Alcanzada = false;
    maxVelocidadLanzamiento = 0; // Reiniciamos el pico para el nuevo intento
    tiempoInicioLanzamiento = performance.now(); 

    // UI: Semáforo Verde
    luzRoja.classList.remove('rojo-on');
    luzVerde.classList.add('verde-on');
    textoSemaforo.innerText = "¡LAUNCH!";
    textoSemaforo.style.color = "#00ff00";
    
    display0_60.innerText = "Midiendo...";
    display0_100.innerText = "Midiendo...";
    display0_60.style.color = "#ffaa00";
    display0_100.style.color = "#ffaa00";
}

function abortarLaunchControl(motivo) {
    midiendoAceleracion = false;

    // UI: Semáforo Apagado/Abortado
    luzVerde.classList.remove('verde-on');
    textoSemaforo.innerText = "ABORTO";
    textoSemaforo.style.color = "#ff3366";

    // Limpiamos los textos de las metas que no se alcanzaron
    if (!meta60Alcanzada) {
        display0_60.innerText = "-- s";
        display0_60.style.color = "#ffaa00";
    }
    if (!meta100Alcanzada) {
        display0_100.innerText = "-- s";
        display0_100.style.color = "#ffaa00";
    }
    
    console.log("Intento descartado por:", motivo);
}

function manejarAcelerometro(evento) {
    if (!grabando) return;

    if (velocidadActual === 0 && !midiendoAceleracion && textoSemaforo.innerText === "ARMADO") {
        let acc = evento.acceleration; 
        if (!acc || acc.x === null) return; 

        let fuerzaMovimiento = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);

        if (fuerzaMovimiento > 2.5) {
            dispararLaunchControl();
        }
    }
}

// ==========================================
// LÓGICA DEL GPS Y VALIDACIÓN
// ==========================================
function manejarInclinacion(evento) {
    if (!grabando) return;
    let orientacion = (screen.orientation || {}).angle || window.orientation || 0;
    let roll = (orientacion === 90 || orientacion === -90) ? evento.beta : evento.gamma;
    if (roll !== null) displayAngulo.innerText = Math.round(roll) + "°";
}

function manejarGPS(posicion) {
    if (!grabando) return;

    let velocidad_ms = posicion.coords.speed;
    if (velocidad_ms === null || velocidad_ms < 0) velocidad_ms = 0;
    velocidadActual = Math.round(velocidad_ms * 3.6);
    displayVel.innerText = velocidadActual;

    // 1. ESTADO DE REPOSO: Armar el semáforo
    if (velocidadActual === 0) {
        if (midiendoAceleracion) abortarLaunchControl("Detención total");
        midiendoAceleracion = false;
        
        luzVerde.classList.remove('verde-on');
        luzRoja.classList.add('rojo-on');
        textoSemaforo.innerText = "ARMADO";
        textoSemaforo.style.color = "#ff0000";
    } 
    // 2. DISPARO POR GPS (Si el acelerómetro no lo captó)
    else if (velocidadActual > 0 && !midiendoAceleracion && textoSemaforo.innerText === "ARMADO") {
        dispararLaunchControl();
    }

    // 3. EVALUACIÓN CONSTANTE DURANTE EL JALÓN
    if (midiendoAceleracion) {
        let tiempoActual = performance.now();
        let transcurrido = ((tiempoActual - tiempoInicioLanzamiento) / 1000).toFixed(2);

        // Guardamos el pico máximo de velocidad de este intento
        if (velocidadActual > maxVelocidadLanzamiento) {
            maxVelocidadLanzamiento = velocidadActual;
        }

        // --- SISTEMA DE ABORTO AUTOMÁTICO ---
        
        // Regla 1: Desaceleración (Damos un margen de 3km/h por si el GPS salta un poco, pero si baja más, abortamos)
        if (velocidadActual <= maxVelocidadLanzamiento - 3) {
            abortarLaunchControl("Pérdida de aceleración detectada");
            return; 
        }

        // Regla 2: Arranque de tráfico normal (Si van 12 segs y ni siquiera pasa los 40km/h)
        if (transcurrido > 12 && velocidadActual < 40) {
            abortarLaunchControl("Aceleración insuficiente");
            return;
        }

        // Regla 3: Timeout general (Si van 40 segs y no llega a 100km/h, es porque es el límite de la moto o la vía)
        if (transcurrido > 40 && !meta100Alcanzada) {
            abortarLaunchControl("Tiempo límite de pista excedido");
            return;
        }

        // --- CRUCE DE METAS EXITOSAS ---

        // Cruce de meta 60 km/h
        if (velocidadActual >= 60 && !meta60Alcanzada) {
            meta60Alcanzada = true;
            display0_60.innerText = transcurrido + "s";
            display0_60.style.color = "#00ff00";
        }

        // Cruce de meta 100 km/h
        if (velocidadActual >= 100 && !meta100Alcanzada) {
            meta100Alcanzada = true;
            display0_100.innerText = transcurrido + "s";
            display0_100.style.color = "#00ff00";
            
            // Apagamos la medición porque ya cruzó la meta final
            midiendoAceleracion = false;
            luzVerde.classList.remove('verde-on');
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
    window.removeEventListener('deviceorientation', manejarInclinacion);
    window.removeEventListener('devicemotion', manejarAcelerometro);
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    clearInterval(intervaloGrabacion);

    btnIniciar.style.display = 'block';
    btnDetener.style.display = 'none';
    estadoGrabacion.style.visibility = 'hidden';

    if (registroViaje.length === 0) return;

    let contenidoCSV = "Tiempo,Velocidad_KMH,Inclinacion_Grados\n";
    registroViaje.forEach(fila => {
        contenidoCSV += `${fila.tiempo},${fila.velocidad_kmh},${fila.inclinacion_grados}\n`;
    });

    const blob = new Blob([contenidoCSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `ruta_NKD_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}