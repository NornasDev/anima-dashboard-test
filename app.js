// ==========================================
// 1. VARIABLES DE ESTADO Y MEMORIA
// ==========================================
let registroViaje = [];
let grabando = false;
let gpsWatchId = null;
let intervaloGrabacion = null;

// Variables Físicas Actuales
let velocidadActual = 0;
let inclinacionActual = 0;
let latitudActual = 0;
let longitudActual = 0;

// Variables para Nuevas Métricas
let velocidadMaxima = 0;
let distanciaTotal = 0; // En Kilómetros
let latitudAnterior = null;
let longitudAnterior = null;

// Variables para Lógica del Cronómetro 0-60
let midiendo0_60 = false;
let tiempoInicio0_60 = 0;

// Referencias HTML
const displayVel = document.getElementById('display-velocidad');
const displayAngulo = document.getElementById('display-angulo');
const displayVelMax = document.getElementById('display-vel-max');
const displayDistancia = document.getElementById('display-distancia');
const display0_60 = document.getElementById('display-0-60');
const estado0_60 = document.getElementById('estado-0-60');
const btnIniciar = document.getElementById('btn-iniciar');
const btnDetener = document.getElementById('btn-detener');
const estadoGrabacion = document.getElementById('estado');

// ==========================================
// PANTALLA COMPLETA
// ==========================================
function activarPantallaCompleta() {
    let elemento = document.documentElement;
    if (elemento.requestFullscreen) elemento.requestFullscreen();
    else if (elemento.webkitRequestFullscreen) elemento.webkitRequestFullscreen();
}

function salirPantallaCompleta() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

// ==========================================
// MATEMÁTICAS GEOLOCALES (Haversine)
// ==========================================
// Calcula la distancia exacta en la curvatura de la Tierra
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
    
    // Reiniciar contadores para un viaje nuevo
    velocidadMaxima = 0;
    distanciaTotal = 0;
    latitudAnterior = null;
    longitudAnterior = null;
    displayVelMax.innerText = "0";
    displayDistancia.innerText = "0.00";

    window.addEventListener('deviceorientation', manejarInclinacion);

    if ("geolocation" in navigator) {
        gpsWatchId = navigator.geolocation.watchPosition(
            manejarGPS, manejarErrorGPS, 
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    } else { alert("Tu navegador no soporta geolocalización GPS."); }

    intervaloGrabacion = setInterval(() => {
        registroViaje.push({
            tiempo: new Date().toISOString(),
            latitud: latitudActual,
            longitud: longitudActual,
            velocidad_kmh: velocidadActual,
            inclinacion_grados: inclinacionActual
        });
    }, 1000); 
}

// ==========================================
// PROCESAMIENTO MATEMÁTICO DE SENSORES
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

function manejarGPS(posicion) {
    if (!grabando) return;

    latitudActual = posicion.coords.latitude;
    longitudActual = posicion.coords.longitude;

    let velocidad_ms = posicion.coords.speed;
    if (velocidad_ms === null || velocidad_ms < 0) velocidad_ms = 0;
    velocidadActual = Math.round(velocidad_ms * 3.6);
    displayVel.innerText = velocidadActual;

    // 1. Lógica de Velocidad Máxima
    if (velocidadActual > velocidadMaxima) {
        velocidadMaxima = velocidadActual;
        displayVelMax.innerText = velocidadMaxima;
    }

    // 2. Lógica de Distancia Recorrida
    if (latitudAnterior !== null && longitudAnterior !== null) {
        // Filtro: Solo sumamos distancia si la moto se mueve a más de 2 km/h (evita deriva GPS en semáforos)
        if (velocidadActual > 2) {
            let tramo = calcularDistanciaHaversine(latitudAnterior, longitudAnterior, latitudActual, longitudActual);
            distanciaTotal += tramo;
            displayDistancia.innerText = distanciaTotal.toFixed(2);
        }
    }
    // Guardamos la coordenada actual para compararla en el siguiente latido del GPS
    latitudAnterior = latitudActual;
    longitudAnterior = longitudActual;

    // 3. Lógica del Cronómetro 0-60 KM/H
    if (velocidadActual === 0) {
        midiendo0_60 = false;
        estado0_60.innerText = "¡Armado, acelera!";
        estado0_60.style.color = "#00ffcc";
        display0_60.innerText = "-- s";
    } 
    else if (velocidadActual > 0 && velocidadActual < 60 && !midiendo0_60) {
        midiendo0_60 = true;
        tiempoInicio0_60 = performance.now(); 
        estado0_60.innerText = "Midiendo...";
        estado0_60.style.color = "#ffaa00";
    } 
    else if (velocidadActual >= 60 && midiendo0_60) {
        midiendo0_60 = false;
        let tiempoFinal = performance.now();
        let segundos = ((tiempoFinal - tiempoInicio0_60) / 1000).toFixed(2);
        display0_60.innerText = segundos + "s";
        estado0_60.innerText = "¡Tiempo registrado!";
        estado0_60.style.color = "#00ff00";
    }
}

function manejarErrorGPS(error) { 
    console.warn('Advertencia GPS:', error.message); 
    displayVel.innerText = "ERR";
}

// ==========================================
// EXPORTACIÓN DE DATOS
// ==========================================
function descargarCSV() {
    salirPantallaCompleta();
    grabando = false;
    window.removeEventListener('deviceorientation', manejarInclinacion);
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    clearInterval(intervaloGrabacion);

    btnIniciar.style.display = 'block';
    btnDetener.style.display = 'none';
    estadoGrabacion.style.visibility = 'hidden';

    if (registroViaje.length === 0) {
        alert("No se grabaron datos de telemetría.");
        return;
    }

    let contenidoCSV = "Tiempo,Latitud,Longitud,Velocidad_KMH,Inclinacion_Grados\n";
    registroViaje.forEach(fila => {
        contenidoCSV += `${fila.tiempo},${fila.latitud},${fila.longitud},${fila.velocidad_kmh},${fila.inclinacion_grados}\n`;
    });

    const blob = new Blob([contenidoCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruta_NKD_${new Date().getTime()}.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}