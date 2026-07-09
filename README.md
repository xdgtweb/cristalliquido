# Efecto "Liquid Glass" Slider

[🔗 Ver Demostración en Vivo (GitHub Pages)](https://xdgtweb.github.io/cristalliquido/)

---

## Documentación de Referencia

Este repositorio contiene todo lo necesario para entender y replicar de manera robusta y profesional el efecto "Liquid Glass" con máscara invertida, arrastre físico y centrado óptico.

## Archivos
1. `index.html`: Estructura HTML básica necesaria para el efecto.
2. `style.css`: Todo el CSS, incluyendo la matemática de las máscaras CSS, variables de transición elástica, y corrección de centrado óptico.
3. `script.js`: La lógica JavaScript para soportar interacción física (arrastrar la pastilla con el dedo/ratón) y cómo evitar bugs comunes (como el doble rebote).

## Conceptos Core del Efecto

Para lograr que el texto que está debajo de la pastilla adquiera un color distinto sin duplicar el DOM innecesariamente y sin que el texto gris "se asome" de fondo de manera fea, empleamos el truco de la **Máscara Invertida**.

### 1. La Arquitectura de las 3 Capas
Para que el efecto se vea limpio, necesitamos apilar 3 elementos usando `position: absolute`:

*   **Capa Base (Texto Activo):** Esta es la capa que se encuentra al fondo del todo. Contiene los iconos y textos con el color "activo" (ej. Rosa/Azul). Se dibuja por completo.
*   **Capa Intermedia (Pastilla de Cristal):** Elemento estético que tiene los bordes, el blur (`backdrop-filter`) y la semi-transparencia. Refracta lo que tiene detrás (la capa base activa). Se mueve usando `transform: translateY()`.
*   **Capa Superior (Interactiva & Máscara Invertida):** Esta es la botonera real que recibe los clicks. Contiene el texto inactivo (Gris). **La Magia:** Esta capa superior tiene un agujero transparente ("máscara invertida") que se mueve en sincronía con la pastilla de cristal. Por este "agujero", vemos asomarse la pastilla de cristal refractando el texto de la Capa Base.

### 2. La Máscara Invertida (`mask-composite: exclude`)
Para hacerle un "agujero" dinámico a la capa gris superior, usamos CSS Masks combinadas:
```css
-webkit-mask-image: linear-gradient(black, black), linear-gradient(black, black);
-webkit-mask-size: 100% 100%, 100% 48px; /* Fondo completo vs Agujero del tamaño de la pastilla */
-webkit-mask-position: 0 0, 0 calc(var(--active-tab) * 60px); /* El agujero se mueve */
-webkit-mask-composite: xor; /* Crea el hueco donde se solapan */
```

### 3. El Centrado Óptico y las Matemáticas del Flexbox
Cuando usas `align-items: center` en textos o iconos, el navegador centra la "caja geométrica" de la fuente, lo cual incluye el espacio para las letras colgantes (como la 'p', 'y', 'g'). Si una palabra no tiene letras colgantes (como "Perfil"), parecerá visualmente empujada hacia arriba.

**La Solución Robusta:** 
Nunca confíes ciegamente en `align-items: center`. Asegura las dimensiones de la caja:
1.  Usa `height: 48px !important;`
2.  Desactiva los paddings inferiores naturales y empuja el texto hacia su centro óptico con un padding asimétrico fijo, por ejemplo: `padding: 6px 16px 0 16px !important;` (Esto empuja todo 6 píxeles hacia abajo, eliminando el espacio visual arriba).

### 4. El "Doble Rebote" y el Scroll Debounce
Un bug muy común al unir este efecto con un comportamiento tipo scroll "Snap" (como deslizar el contenido de la derecha para cambiar de pestaña) es el efecto "Yo-Yo" o doble rebote:
- El usuario hace clic.
- La pastilla vuela al destino instatáneamente.
- El panel de contenido hace un smooth scroll hacia su destino.
- Si el scroll es lento, un "scroll event listener" en el contenido cree erróneamente que el usuario se paró a mitad de camino.
- Fuerza a la pastilla a retroceder, y luego la empuja hacia delante de nuevo.

**Solución (Implementada en script.js):**
No uses un `setTimeout` rígido de 600ms para volver a activar la lectura del scroll. Usa un "Scroll Debounce": Un `setTimeout` de 150ms que se reinicia CADA VEZ que salta el evento `scroll`. Solo cuando el navegador deja totalmente de emitir eventos de scroll, asumimos que ha llegado a su destino.
