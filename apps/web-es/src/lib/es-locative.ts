/**
 * "en Madrid", "en Castilla y León", "en Cataluña".
 * En español la preposición es siempre "en" (no hay contracciones como en
 * portugués: no/na/nos), por eso esta función es trivial. Se mantiene como
 * punto único para poder ajustar excepciones si alguna comunidad lo necesita.
 */
export function enLugar(place: string) {
  return `en ${place}`;
}
