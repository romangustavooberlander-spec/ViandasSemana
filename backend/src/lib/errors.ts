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
