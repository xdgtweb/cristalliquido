const root = document.documentElement;
const glassWrapper = document.getElementById('mini-glass-wrapper');
const interactiveContent = document.getElementById('interactive-content');
const clickLayer = document.getElementById('click-layer');

// --- 2D DRAG & DROP Y FÍSICAS BLOB ---
let isDragging = false;
let wasDragged = false;
let dragStartX = 0;
let dragStartY = 0;
let startX = 0;
let startY = 0;
let currentX = 0; // px
let currentY = 0; // px
let targetCol = 0;
let targetRow = 0;

let physicsTargetX = 0;
let physicsTargetY = 0;
let physicsVX = 0;
let physicsVY = 0;
let impactTriggered = false;
let ripples = [];
let springStiffness = 0.15;
let springDamping = 0.70;
let deformMultiplier = 0.5;
let waveAmplitude = 6.5;
let waveFreq = 4;

// Nuevas dimensiones: Grid es 400x160, Glass es 200x80
const tabWidth = 200; 
const tabHeight = 200;

let baseRadius = 50;
let distortionPadding = 100;
let lastX = 0;
let lastY = 0;
let smoothedDx = 0;
let smoothedDy = 0;

let currentPower = 9;
let intensityLeft = 0.5;
let intensityRight = 0.5;
let intensityTop = 0.5;
let intensityBottom = 0.5;

// --- CONTROL PANEL LOGIC ---

document.getElementById('sl-shine').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('val-shine').textContent = val + '%';
    document.documentElement.style.setProperty('--glass-shine', val / 100);
});

document.getElementById('sl-radius').addEventListener('input', (e) => {
    baseRadius = parseFloat(e.target.value);
    document.getElementById('val-radius').textContent = baseRadius + 'px';
    if (!isDragging) {
        root.style.setProperty('--br-tl', baseRadius + 'px');
        root.style.setProperty('--br-tr', baseRadius + 'px');
        root.style.setProperty('--br-bl', baseRadius + 'px');
        root.style.setProperty('--br-br', baseRadius + 'px');
    }
});

document.getElementById('sl-padding').addEventListener('input', (e) => {
    distortionPadding = parseFloat(e.target.value);
    document.getElementById('val-padding').textContent = distortionPadding + 'px';
    updateLensMap();
});

document.getElementById('sl-power').addEventListener('input', (e) => {
    currentPower = parseFloat(e.target.value);
    document.getElementById('val-power').textContent = currentPower;
    updateLensMap();
});

let currentRefract = -58;
let currentChroma = 5;

function updateDisplacement(r, g, b) {
    document.getElementById('disp-r').setAttribute('scale', r);
    document.getElementById('disp-g').setAttribute('scale', g);
    document.getElementById('disp-b').setAttribute('scale', b);
}

function syncRGBFromMaster() {
    const r = currentRefract + currentChroma;
    const g = currentRefract;
    const b = currentRefract - currentChroma;
    
    // Update individual sliders UI
    if (document.getElementById('sl-r')) document.getElementById('sl-r').value = r;
    if (document.getElementById('sl-g')) document.getElementById('sl-g').value = g;
    if (document.getElementById('sl-b')) document.getElementById('sl-b').value = b;
    
    if (document.getElementById('val-r')) document.getElementById('val-r').textContent = r;
    if (document.getElementById('val-g')) document.getElementById('val-g').textContent = g;
    if (document.getElementById('val-b')) document.getElementById('val-b').textContent = b;
    
    updateDisplacement(r, g, b);
}

const chromaSlider = document.getElementById('sl-chroma');
if (chromaSlider) {
    chromaSlider.addEventListener('input', (e) => {
        currentChroma = parseFloat(e.target.value);
        document.getElementById('val-chroma').textContent = currentChroma;
        syncRGBFromMaster();
    });
}

// Individual overrides
['r', 'g', 'b'].forEach(color => {
    const slider = document.getElementById(`sl-${color}`);
    if (slider) {
        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById(`val-${color}`).textContent = val;
            document.getElementById(`disp-${color}`).setAttribute('scale', val);
        });
    }
});

document.getElementById('sl-blur').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('val-blur').textContent = val + 'px';
    document.documentElement.style.setProperty('--glass-blur', val + 'px');
});

['l', 'r', 't', 'b'].forEach(side => {
    const slider = document.getElementById(`sl-int-${side}`);
    if (slider) {
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById(`val-int-${side}`).textContent = val.toFixed(1);
            if (side === 'l') intensityLeft = val;
            if (side === 'r') intensityRight = val;
            if (side === 't') intensityTop = val;
            if (side === 'b') intensityBottom = val;
            updateLensMap();
        });
    }
});

document.getElementById('sl-spring').addEventListener('input', (e) => {
    springDamping = parseFloat(e.target.value);
    document.getElementById('val-spring').textContent = springDamping.toFixed(2);
});
document.getElementById('sl-deform').addEventListener('input', (e) => {
    deformMultiplier = parseFloat(e.target.value);
    document.getElementById('val-deform').textContent = deformMultiplier.toFixed(1);
});
document.getElementById('sl-wave-amp').addEventListener('input', (e) => {
    waveAmplitude = parseFloat(e.target.value);
    document.getElementById('val-wave-amp').textContent = waveAmplitude.toFixed(1);
});
document.getElementById('sl-wave-freq').addEventListener('input', (e) => {
    waveFreq = parseFloat(e.target.value);
    document.getElementById('val-wave-freq').textContent = waveFreq;
});

const bgTextBtns = document.querySelectorAll('.mini-text-layer .mini-btn');
const textCenters = [
    { x: tabWidth / 2, y: tabHeight / 2 },
    { x: tabWidth * 1.5, y: tabHeight / 2 },
    { x: tabWidth / 2, y: tabHeight * 1.5 },
    { x: tabWidth * 1.5, y: tabHeight * 1.5 }
];

const bgSelector = document.getElementById('bg-selector');
if (bgSelector) {
    bgSelector.addEventListener('change', (e) => {
        const bg = document.getElementById('main-bg');
        if (bg) {
            bg.className = `mesh-bg ${e.target.value}`;
        }
    });
}

function setPosition(x, y, animate = false) {
    physicsTargetX = Math.max(0, Math.min(x, tabWidth));
    physicsTargetY = Math.max(0, Math.min(y, tabHeight));
    
    if (animate) {
        impactTriggered = false;
        glassWrapper.classList.add('animated');
        if (interactiveContent) interactiveContent.classList.add('animated');
    } else {
        glassWrapper.classList.remove('animated');
        if (interactiveContent) interactiveContent.classList.remove('animated');
        
        currentX = physicsTargetX;
        currentY = physicsTargetY;
        physicsVX = 0;
        physicsVY = 0;
        root.style.setProperty('--glass-x', currentX);
        root.style.setProperty('--glass-y', currentY);
    }
}

function physicsLoop() {
    let rawDx = 0;
    let rawDy = 0;

    if (!isDragging) {
        let ax = (physicsTargetX - currentX) * springStiffness;
        let ay = (physicsTargetY - currentY) * springStiffness;
        physicsVX += ax;
        physicsVY += ay;
        physicsVX *= springDamping;
        physicsVY *= springDamping;
        
        currentX += physicsVX;
        currentY += physicsVY;
        
        root.style.setProperty('--glass-x', currentX);
        root.style.setProperty('--glass-y', currentY);
        
        rawDx = physicsVX;
        rawDy = physicsVY;
        
        // Detectar choque e inyectar onda
        let distToTarget = Math.sqrt((physicsTargetX - currentX)**2 + (physicsTargetY - currentY)**2);
        if (!impactTriggered && distToTarget < 15) {
            let speed = Math.sqrt(physicsVX*physicsVX + physicsVY*physicsVY);
            if (speed > 2.0) { // Fuerza mínima para generar onda
                impactTriggered = true;
                let dirX = physicsVX / speed;
                let dirY = physicsVY / speed;
                ripples.push({
                    cx: (tabWidth / 2) + dirX * (tabWidth / 2), // Origen corregido al borde exacto de colisión
                    cy: (tabHeight / 2) + dirY * (tabHeight / 2),
                    startTime: Date.now(),
                    force: Math.min(speed / 15, 1.5)
                });
            }
        }
    } else {
        rawDx = currentX - lastX;
        rawDy = currentY - lastY;
        physicsVX = rawDx;
        physicsVY = rawDy;
    }
    
    lastX = currentX;
    lastY = currentY;
    
    // Lerp smoothing (Merge Rate 0.05)
    smoothedDx = smoothedDx * 0.90 + rawDx * 0.10;
    smoothedDy = smoothedDy * 0.90 + rawDy * 0.10;
    
    const absDx = Math.abs(smoothedDx);
    const absDy = Math.abs(smoothedDy);
    const velocity = Math.sqrt(smoothedDx*smoothedDx + smoothedDy*smoothedDy);
    
    if (velocity < 0.1 && !isDragging) {
        // IDLE
        root.style.setProperty('--squash-x', 1);
        root.style.setProperty('--squash-y', 1);
        root.style.setProperty('--br-tl', baseRadius + 'px');
        root.style.setProperty('--br-tr', baseRadius + 'px');
        root.style.setProperty('--br-bl', baseRadius + 'px');
        root.style.setProperty('--br-br', baseRadius + 'px');
    } else {
        // MOVIMIENTO (Física Blob / Metaballs elástica)
        const stretchX = 1 + (absDx * 0.02 * deformMultiplier) - (absDy * 0.01 * deformMultiplier);
        const stretchY = 1 + (absDy * 0.02 * deformMultiplier) - (absDx * 0.01 * deformMultiplier);
        
        root.style.setProperty('--squash-x', Math.max(0.6, stretchX));
        root.style.setProperty('--squash-y', Math.max(0.6, stretchY));
        
        // Teardrop dinámico en 4 direcciones
        let tl = baseRadius;
        let tr = baseRadius;
        let bl = baseRadius;
        let br = baseRadius;
        
        // Cola afilada
        if (smoothedDx > 0) { tl -= absDx * 1.5 * deformMultiplier; bl -= absDx * 1.5 * deformMultiplier; }
        if (smoothedDx < 0) { tr -= absDx * 1.5 * deformMultiplier; br -= absDx * 1.5 * deformMultiplier; }
        if (smoothedDy > 0) { tl -= absDy * 1.5 * deformMultiplier; tr -= absDy * 1.5 * deformMultiplier; }
        if (smoothedDy < 0) { bl -= absDy * 1.5 * deformMultiplier; br -= absDy * 1.5 * deformMultiplier; }
        
        root.style.setProperty('--br-tl', Math.max(8, tl) + 'px');
        root.style.setProperty('--br-tr', Math.max(8, tr) + 'px');
        root.style.setProperty('--br-bl', Math.max(8, bl) + 'px');
        root.style.setProperty('--br-br', Math.max(8, br) + 'px');
    }
    
    // --- FADE OUT BACKGROUND TEXT ---
    if (bgTextBtns.length === 4) {
        const glassCx = currentX + tabWidth / 2;
        const glassCy = currentY + tabHeight / 2;
        bgTextBtns.forEach((btn, index) => {
            const dist = Math.sqrt(Math.pow(glassCx - textCenters[index].x, 2) + Math.pow(glassCy - textCenters[index].y, 2));
            let opacity = Math.min(1, Math.max(0, (dist - 40) / 60));
            btn.style.opacity = opacity;
        });
    }

    // Limpiar ondas viejas y renderizar SVG si hay ondas
    let hasRipples = ripples.length > 0;
    if (hasRipples) {
        let now = Date.now();
        ripples = ripples.filter(r => (now - r.startTime) / 1000.0 <= 1.5);
        if (ripples.length > 0) {
            updateLensMap();
        }
    }

    requestAnimationFrame(physicsLoop);
}

if (clickLayer) {
    clickLayer.addEventListener('pointerdown', (e) => {
        isDragging = true;
        wasDragged = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        clickLayer.setPointerCapture(e.pointerId);
    });

    clickLayer.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        if (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3) {
            wasDragged = true;
        }
        setPosition(e.clientX - startX, e.clientY - startY, false);
    });

    clickLayer.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        clickLayer.releasePointerCapture(e.pointerId);
        
        targetCol = currentX > tabWidth / 2 ? 1 : 0;
        targetRow = currentY > tabHeight / 2 ? 1 : 0;
        setPosition(targetCol * tabWidth, targetRow * tabHeight, true);
    });

    clickLayer.addEventListener('pointercancel', () => {
        if (!isDragging) return;
        isDragging = false;
        wasDragged = false;
        setPosition(targetCol * tabWidth, targetRow * tabHeight, true);
    });

    clickLayer.addEventListener('click', (e) => {
        if (wasDragged) {
            wasDragged = false;
            return;
        }
        const rect = clickLayer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        targetCol = clickX > tabWidth ? 1 : 0;
        targetRow = clickY > tabHeight ? 1 : 0;
        setPosition(targetCol * tabWidth, targetRow * tabHeight, true);
    });
}

// --- GENERADOR DE NORMAL MAP 3D PARA LENTE PERFECTA ---
// Precomputar la curva sRGB para rendimiento (LUT de 1024 valores)
const srgbLUT = new Uint8Array(1024);
for(let i = 0; i < 1024; i++) {
    let l = i / 1023;
    if (l <= 0.0031308) srgbLUT[i] = Math.round(l * 12.92 * 255);
    else srgbLUT[i] = Math.round((1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255);
}

function updateLensMap() {
    const wrapper = document.getElementById('mini-glass-base');
    if (!wrapper) return;
    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;
    if (width === 0 || height === 0) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const power = currentPower; 
    const max_d = Math.min(cx, cy);

    // Caché de ondas activas para no calcular Date.now() 200.000 veces
    const now = Date.now();
    const activeRipples = ripples.filter(r => (now - r.startTime) / 1000.0 <= 1.5);
    const hasRipples = activeRipples.length > 0;

    const getZ = (x, y) => {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        
        const cornerCX = Math.max(0, cx - baseRadius);
        const cornerCY = Math.max(0, cy - baseRadius);
        
        let physical_d_edge = 0;
        if (dx > cornerCX && dy > cornerCY) {
            let distToCornerCenter = Math.sqrt((dx - cornerCX)**2 + (dy - cornerCY)**2);
            physical_d_edge = baseRadius - distToCornerCenter;
        } else if (dx > cornerCX) {
            physical_d_edge = cx - dx;
        } else if (dy > cornerCY) {
            physical_d_edge = cy - dy;
        } else {
            physical_d_edge = Math.min(cx - dx, cy - dy);
        }
        
        if (physical_d_edge <= 0) return 0;
        
        let pad = Math.max(0.1, distortionPadding);
        let nd = 1 - (physical_d_edge / pad);
        if (nd < 0) nd = 0;
        
        let z_total = Math.pow(1 - Math.pow(nd, power), 1/power) * pad;
        
        // Añadir ondas de inercia de forma OPTIMIZADA
        if (hasRipples) {
            for (let r of activeRipples) {
                let age = (now - r.startTime) / 1000.0;
                let dxRipple = x - r.cx;
                let dyRipple = y - r.cy;
                
                // Fast box check (optimización brutal)
                let maxDist = age * 250 + 40;
                if (Math.abs(dxRipple) > maxDist || Math.abs(dyRipple) > maxDist) continue;
                
                let dist = Math.sqrt(dxRipple*dxRipple + dyRipple*dyRipple);
                let waveRad = age * 250; // Velocidad de onda 250px/s
                let distFromWave = dist - waveRad;
                
                // Si el píxel está fuera del anillo de la ola, no calculamos Math.cos ni Math.exp
                if (distFromWave < -40 || distFromWave > 40) continue;
                
                // Función de onda fluida ultra rápida (Decaimiento lineal en vez de exponencial)
                let waveEffect = Math.cos(distFromWave * (waveFreq * 0.05)) 
                               * Math.max(0, 1 - Math.abs(distFromWave) / 40) 
                               * Math.max(0, 1 - age / 1.5) 
                               * (waveAmplitude * r.force);
                z_total += waveEffect;
            }
        }
        
        return Math.max(0, z_total);
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const z0 = getZ(x, y);
            let nx = 0, ny = 0;
            if (z0 > 0) {
                // Diferencia central para calcular el vector normal simétrico
                const zx1 = getZ(x - 1, y);
                const zx2 = getZ(x + 1, y);
                const zy1 = getZ(x, y - 1);
                const zy2 = getZ(x, y + 1);
                
                // Multiplicador óptico
                let vx = zx1 - zx2;
                if (x < cx) vx *= intensityLeft;
                else vx *= intensityRight;
                
                let vy = zy1 - zy2;
                if (y < cy) vy *= intensityTop;
                else vy *= intensityBottom;
                
                let vz = 2; // Porque la distancia de x-1 a x+1 es 2 píxeles
                
                const len = Math.sqrt(vx*vx + vy*vy + vz*vz);
                nx = vx / len;
                ny = vy / len;
            }
            
            // L is the desired linear color value (0 to 1) where 0.5 is exactly flat
            let lx = (nx + 1) / 2;
            let ly = (ny + 1) / 2;
            
            // Encode to sRGB usando el LUT rápido
            let sx = srgbLUT[Math.max(0, Math.min(1023, Math.round(lx * 1023)))];
            let sy = srgbLUT[Math.max(0, Math.min(1023, Math.round(ly * 1023)))];
            
            const index = (y * width + x) * 4;
            data[index] = sx;
            data[index+1] = sy;
            data[index+2] = 255;
            data[index+3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    const feImg = document.getElementById('svg-lens-image');
    if (feImg) {
        // Usar image/jpeg con máxima calidad es hasta 5 veces más rápido de codificar que PNG 
        // y como el alpha siempre es 255, no necesitamos transparencia.
        let dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        feImg.setAttribute('href', dataUrl);
    }
}

window.addEventListener('resize', updateLensMap);
setTimeout(updateLensMap, 50);

// Inicializar el loop de físicas
physicsLoop();

// --- LOCAL STORAGE & RESET ---
const panelInputs = document.querySelectorAll('.control-panel input, .control-panel select');

function saveSettings() {
    let settings = {};
    panelInputs.forEach(input => {
        settings[input.id] = input.value;
    });
    localStorage.setItem('liquidGlassSettings', JSON.stringify(settings));
}

function loadSettings() {
    let saved = localStorage.getItem('liquidGlassSettings');
    if (saved) {
        let settings = JSON.parse(saved);
        panelInputs.forEach(input => {
            if (settings[input.id] !== undefined) {
                input.value = settings[input.id];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                if (input.tagName === 'SELECT') {
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }
}

panelInputs.forEach(input => {
    input.addEventListener('input', saveSettings);
    if (input.tagName === 'SELECT') input.addEventListener('change', saveSettings);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    localStorage.removeItem('liquidGlassSettings');
    location.reload();
});

// Cargar ajustes guardados al iniciar
loadSettings();

// --- MOBILE RESPONSIVE PANEL SWIPE ---
const panel = document.querySelector('.control-panel');
let panelStartY = 0;
let panelOpen = false;

panel.addEventListener('pointerdown', (e) => {
    if (window.innerWidth > 768) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
    panelStartY = e.clientY;
    panel.style.transition = 'none';
    panel.setPointerCapture(e.pointerId);
});

panel.addEventListener('pointermove', (e) => {
    if (!panel.hasPointerCapture(e.pointerId) || window.innerWidth > 768) return;
    let delta = e.clientY - panelStartY;
    if (panelOpen && delta > 0) {
        panel.style.transform = `translateY(${delta}px)`;
    } else if (!panelOpen && delta < 0) {
        panel.style.transform = `translateY(calc(100% - 60px + ${delta}px))`;
    }
});

panel.addEventListener('pointerup', (e) => {
    if (!panel.hasPointerCapture(e.pointerId) || window.innerWidth > 768) return;
    panel.releasePointerCapture(e.pointerId);
    panel.style.transition = ''; 
    panel.style.transform = ''; 
    
    let delta = e.clientY - panelStartY;
    if (panelOpen && delta > 50) {
        panel.classList.remove('open');
        panelOpen = false;
    } else if (!panelOpen && delta < -50) {
        panel.classList.add('open');
        panelOpen = true;
    } else if (Math.abs(delta) < 10) {
        panel.classList.toggle('open');
        panelOpen = panel.classList.contains('open');
    }
});

// --- BACKGROUND SELECTOR ---
const bgSelector = document.getElementById('bg-selector');
if (bgSelector) {
    bgSelector.addEventListener('change', (e) => {
        document.getElementById('main-bg').className = `mesh-bg ${e.target.value}`;
    });
}
