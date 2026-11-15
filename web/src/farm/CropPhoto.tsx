/**
 * Foto real de cada cultivo, para las tarjetas del formulario de My Farm
 * ("What did you plant?" y "What are you thinking of planting next?").
 *
 * Son fotos de Wikimedia Commons, de dominio público o CC0. Autor y fuente de cada una:
 * public/img/cultivos/CREDITOS.md. "other" es tierra arada: sirve para cualquier cultivo.
 */
import { dataUrl } from "../data/load";
import type { FarmCrop } from "./farm";

export interface CropPhotoProps {
  crop: FarmCrop;
  className?: string;
}

export function CropPhoto({ crop, className }: CropPhotoProps) {
  // decorativa, como la ilustración: el chip de al lado ya dice qué cultivo es
  return (
    <img
      className={className}
      src={dataUrl(`img/cultivos/${crop}.webp`)}
      alt=""
      decoding="async"
    />
  );
}
