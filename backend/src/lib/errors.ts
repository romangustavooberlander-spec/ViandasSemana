// Errores con código HTTP explícito. El manejador central los traduce a la respuesta.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Violación de una regla de negocio (cupo completo, horario de corte, etc.) → 409 Conflict.
export class ReglaNegocioError extends HttpError {
  constructor(codigo: string, message: string) {
    super(409, message, codigo);
    this.name = 'ReglaNegocioError';
  }
}
