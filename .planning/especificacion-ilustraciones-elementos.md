# Especificación de estilo — ilustraciones de elementos

Guía para generar las ~343 ilustraciones de "Archivo de Misterios" con un
generador de imágenes por IA (externo a este repo). El objetivo es un set
visualmente coherente: todas las piezas deben sentirse parte del mismo
grimorio, no una colección de estilos distintos.

## Prompt base (reutilizar para cada concepto, cambiando solo el sujeto)

```
Grabado ocultista circular sobre fondo negro, estilo lámina de alquimista
victoriano. [SUJETO] representado como un ícono central simple y reconocible,
línea fina dorada/latón envejecido sobre negro, sin relleno de color plano,
con textura sutil de placa de cobre grabada. Composición centrada, simétrica,
encerrada implícitamente en un círculo. Sin texto, sin marco visible (el
marco lo añade la interfaz). Iluminación cálida ámbar, alto contraste,
atmósfera de misterio y ritual. Nada de personajes reconocibles ni de marcas
registradas — solo el concepto abstracto u objeto representado de forma
simbólica y genérica.
```

Reemplaza `[SUJETO]` por una descripción breve y genérica del concepto —
nunca por el nombre propio de un personaje o término exacto de la novela.
Ejemplos:
- "Ojo" → "un ojo abierto rodeado de rayos finos, como un sol pequeño"
- "Fortuna" → "una moneda en el aire junto a un dado, congelados a medio girar"
- "Misticismo" → "una vela cuya llama forma una espiral"

## Formato de archivo

- Cuadrado, mínimo 512×512 px (el componente los recorta en círculo con
  `object-cover`, así que el sujeto debe estar centrado con margen).
- PNG o WebP con fondo — no necesita transparencia, el marco circular de la
  interfaz ya recorta la imagen.
- Nombra cada archivo con el **slug** exacto del elemento en la base de datos
  (ej. `ojo.png`, `misticismo.webp`) — así el script de importación los
  empareja automáticamente. Los slugs se ven en el panel admin de cada
  elemento.

## Flujo para incorporarlas

1. Genera y cura las imágenes con el nombre de archivo = slug.
2. Ponlas todas en una carpeta local, ej. `data/ilustraciones-elementos/`.
3. Corre: `node --import tsx scripts/importarIlustracionesElementos.ts data/ilustraciones-elementos`
4. El script busca cada slug en la base, copia la imagen al almacén
   gestionado (mismo mecanismo que las imágenes de cartas) y actualiza
   `Element.imageUrl`. Elementos sin archivo coincidente se quedan con su
   icono genérico — no hace falta tener las 343 de una vez, se puede correr
   el script varias veces según vayan estando listas.
5. También puedes subir una imagen individual desde el panel admin de cada
   elemento (`/admin/elementos/[id]`) con el nuevo campo de "Subir archivo".

## Por qué este enfoque

- No compite con el marco/medallón que ya envuelve cada icono en el juego —
  la ilustración reemplaza solo el símbolo interior.
- Al no incluir texto ni nombres propios de LOTM en la imagen misma, las
  ilustraciones son reutilizables aunque algún día haya que reemplazar
  nombres (la arquitectura desacoplada sigue intacta: el arte tampoco
  depende de la IP).
- Generarlas de a poco (no las 343 de golpe) permite ver cómo se sienten en
  el juego real antes de invertir en el resto.
