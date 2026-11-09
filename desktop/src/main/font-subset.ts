// Recorte de fuentes con harfbuzz-subset (WASM del paquete harfbuzzjs, MIT; HarfBuzz es "Old
// MIT"). El .wasm no importa nada: se instancia directo y se llaman sus funciones de C.
//
// Se recorta conservando los índices de glifo (RETAIN_GIDS): el PDF propio escribe los glifos con
// el mismo índice que les dio el motor al conformar, y la fuente recortada tiene sólo esos
// contornos (los demás quedan vacíos). Una fuente variable se fija en la instancia pedida (los
// ejes que no se nombran, en su valor por defecto): el PDF lleva una fuente estática.
//
// El .wasm lo copia desktop/scripts/build.mjs a LibroStudio/v3/app/build/ (va en el instalador);
// las pruebas lo leen de node_modules/harfbuzzjs.

const HB_MEMORY_MODE_READONLY = 1;
const HB_SUBSET_FLAGS_NO_HINTING = 1;
const HB_SUBSET_FLAGS_RETAIN_GIDS = 2;

/** Lo que se usa del módulo de C. */
interface SubsetExports {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  malloc(size: number): number;
  free(pointer: number): void;
  hb_blob_create(data: number, length: number, mode: number, user: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, value: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_glyph_set(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_input_pin_all_axes_to_default(input: number, face: number): number;
  hb_subset_input_pin_axis_location(
    input: number,
    face: number,
    tag: number,
    value: number,
  ): number;
  hb_subset_or_fail(face: number, input: number): number;
}

export interface SubsetOptions {
  /** Cara dentro de una colección (.ttc). */
  index?: number;
  /** Ejes de la instancia (wght, wdth, opsz…); con alguno, la fuente queda estática. */
  variations?: Record<string, number>;
}

export type Subsetter = (
  font: Uint8Array,
  glyphs: Iterable<number>,
  options?: SubsetOptions,
) => Uint8Array;

const tag = (name: string) =>
  ((name.charCodeAt(0) << 24) |
    (name.charCodeAt(1) << 16) |
    (name.charCodeAt(2) << 8) |
    name.charCodeAt(3)) >>>
  0;

/** Instancia el WASM y devuelve la función de recorte. */
export async function createSubsetter(wasm: Uint8Array): Promise<Subsetter> {
  const { instance } = (await WebAssembly.instantiate(
    wasm,
    {},
  )) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
  const hb = instance.exports as unknown as SubsetExports;
  hb._initialize?.();
  const heap = () => new Uint8Array(hb.memory.buffer);
  return (font, glyphs, options = {}) => {
    const data = hb.malloc(font.length);
    const lengthAt = hb.malloc(4);
    heap().set(font, data);
    const blob = hb.hb_blob_create(data, font.length, HB_MEMORY_MODE_READONLY, 0, 0);
    const face = hb.hb_face_create(blob, options.index ?? 0);
    hb.hb_blob_destroy(blob);
    const input = hb.hb_subset_input_create_or_fail();
    let result = 0;
    try {
      if (!input) throw new Error('No se pudo preparar el recorte de la fuente.');
      const set = hb.hb_subset_input_glyph_set(input);
      hb.hb_set_add(set, 0);
      for (const glyph of glyphs) hb.hb_set_add(set, glyph);
      hb.hb_subset_input_set_flags(input, HB_SUBSET_FLAGS_RETAIN_GIDS | HB_SUBSET_FLAGS_NO_HINTING);
      const variations = Object.entries(options.variations ?? {});
      if (variations.length) {
        hb.hb_subset_input_pin_all_axes_to_default(input, face);
        for (const [axis, value] of variations)
          hb.hb_subset_input_pin_axis_location(input, face, tag(axis), value);
      }
      result = hb.hb_subset_or_fail(face, input);
      if (!result) throw new Error('No se pudo recortar la fuente.');
      const out = hb.hb_face_reference_blob(result);
      const pointer = hb.hb_blob_get_data(out, lengthAt);
      const length = new DataView(hb.memory.buffer).getUint32(lengthAt, true);
      const bytes = heap().slice(pointer, pointer + length);
      hb.hb_blob_destroy(out);
      if (!length) throw new Error('El recorte de la fuente quedó vacío.');
      return bytes;
    } finally {
      if (result) hb.hb_face_destroy(result);
      if (input) hb.hb_subset_input_destroy(input);
      hb.hb_face_destroy(face);
      hb.free(data);
      hb.free(lengthAt);
    }
  };
}
