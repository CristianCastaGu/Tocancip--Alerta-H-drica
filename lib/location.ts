/* Punto de referencia único del sistema — casco urbano de Tocancipá (IGAC).
   Lo usan las 4 APIs meteorológicas y el mapa, para que el dato consultado
   corresponda exactamente al punto mostrado. */
export const TOCANCIPA_LAT = 4.9653;
export const TOCANCIPA_LON = -73.9144;
export const TOCANCIPA_ASL = 2585; // m s.n.m.

/* Open-Meteo entrega la hora local sin desfase; Colombia no tiene horario de verano. */
export const BOGOTA_UTC_OFFSET = '-05:00';
