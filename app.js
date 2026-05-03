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

// Variables para Lógica del Cronómetro 0-60
let midiendo0_60 = false;
let tiempoInicio0_60 = 0;

// Referencias HTML
const displayVel = document.getElementById('display-velocidad');
const displayAngulo = document.getElementById('display-angulo');
const display0_60 = document.getElementById('display-0-60');
const estado0_60 = document.getElementById('estado-0-60');
const btnIniciar = document.getElementById('btn-iniciar');
const btnDetener = document.getElementById('btn-detener');
const estadoGrabacion = document.getElementById('estado');

// ==========================================
// 2. INICIO DE TELEMETRÍA
// ==========================================
function iniciarTelemetria() {
    // Cambio visual de la interfaz
    btnIniciar.style.display = 'none';
    btnDetener.style.display = 'block';
    estadoGrabacion.style.visibility = 'visible';
    
    grabando = true;
    registroViaje = []; // Reiniciamos la memoria 

    // Activar giroscopio
    window.addEventListener('deviceorientation', manejarInclinacion);

    // Activar GPS con máxima precisión
    if ("geolocation" in navigator) {
        gpsWatchId = navigator.geolocation.watchPosition(
            manejarGPS, 
            manejarErrorGPS, 
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    } else { 
        alert("Tu navegador no soporta geolocalización GPS."); 
    }

    // Arrancar el motor de grabación a 1 Hz (1 vez por segundo)
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
// 3. PROCESAMIENTO MATEMÁTICO DE SENSORES
// ==========================================
function manejarInclinacion(evento) {
    if (!grabando) return;
    
    // Detectamos si el teléfono está en vertical u horizontal
    let orientacion = (screen.orientation || {}).angle || window.orientation || 0;
    
    let roll;
    if (orientacion === 90 || orientacion === -90) {
        // En horizontal (acostado), el ángulo de tumbe se lee en el eje X (beta)
        roll = evento.beta; 
    } else {
        // En vertical, el ángulo de tumbe se lee en el eje Y (gamma)
        roll = evento.gamma;
    }
    
    if (roll !== null) {
        inclinacionActual = Math.round(roll);
        displayAngulo.innerText = inclinacionActual + "°";
    }
}

function manejarGPS(posicion) {
    if (!grabando) return;

    // Actualizamos Coordenadas para el mapa
    latitudActual = posicion.coords.latitude;
    longitudActual = posicion.coords.longitude;

    // Cálculo de Velocidad (m/s a km/h)
    let velocidad_ms = posicion.coords.speed;
    if (velocidad_ms === null || velocidad_ms < 0) {
        velocidad_ms = 0;
    }
    velocidadActual = Math.round(velocidad_ms * 3.6);
    displayVel.innerText = velocidadActual;

    // ==========================================
    // LÓGICA DEL CRONÓMETRO 0 - 60 KM/H
    // ==========================================
    if (velocidadActual === 0) {
        // Moto detenida: rearmamos el sistema
        midiendo0_60 = false;
        estado0_60.innerText = "¡Armado, acelera!";
        estado0_60.style.color = "#00ffcc";
        display0_60.innerText = "-- s";
    } 
    else if (velocidadActual > 0 && velocidadActual < 60 && !midiendo0_60) {
        // Moto en movimiento hacia los 60km/h: arrancamos reloj
        midiendo0_60 = true;
        tiempoInicio0_60 = performance.now(); // Cronómetro interno de alta precisión
        estado0_60.innerText = "Midiendo...";
        estado0_60.style.color = "#ffaa00";
    } 
    else if (velocidadActual >= 60 && midiendo0_60) {
        // Meta cruzada: paramos reloj y calculamos
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
// 4. EXPORTACIÓN DEL MAPA Y DATOS
// ==========================================
function descargarCSV() {
    // 1. Apagamos sistemas para ahorrar batería y detener procesos
    grabando = false;
    window.removeEventListener('deviceorientation', manejarInclinacion);
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    clearInterval(intervaloGrabacion);

    // 2. Restauramos la UI visual
    btnIniciar.style.display = 'block';
    btnDetener.style.display = 'none';
    estadoGrabacion.style.visibility = 'hidden';

    // 3. Verificamos que existan datos
    if (registroViaje.length === 0) {
        alert("No se grabaron datos de telemetría.");
        return;
    }

    // 4. Formateamos el texto del CSV
    let contenidoCSV = "Tiempo,Latitud,Longitud,Velocidad_KMH,Inclinacion_Grados\n";
    registroViaje.forEach(fila => {
        contenidoCSV += `${fila.tiempo},${fila.latitud},${fila.longitud},${fila.velocidad_kmh},${fila.inclinacion_grados}\n`;
    });

    // 5. Truco del Blob para descargar en el teléfono
    const blob = new Blob([contenidoCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `ruta_NKD_${new Date().getTime()}.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}