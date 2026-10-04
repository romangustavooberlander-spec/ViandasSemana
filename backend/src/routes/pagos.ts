import { Router } from 'express';
import { z } from 'zod';
import { procesarPago } from '../lib/pagos';

export const pagosRouter = Router();

const esquemaId = z.coerce.string().regex(/^\d+$/, 'Id de pago inválido');

// Webhook de Mercado Pago. También lo llama el frontend cuando el cliente vuelve de pagar
// (en local Mercado Pago no puede llegar al webhook). En los dos casos sólo se recibe el id
// del pago: el estado real se le consulta a Mercado Pago, así que no hace falta autenticación.
// Mercado Pago manda { type, data: { id } } en el cuerpo o ?type=payment&data.id=... en la URL.
pagosRouter.post('/notificacion', async (req, res) => {
  const tipo = req.body?.type ?? req.query.type ?? req.query.topic;
  if (tipo !== 'payment') {
    // Otros avisos (por ejemplo merchant_order) no cambian nada: se responde 200 para que no se repitan.
    res.json({ ignorado: true });
    return;
  }
  const id = esquemaId.parse(req.body?.data?.id ?? req.query['data.id'] ?? req.query.id);
  const pedido = await procesarPago(id);
  res.json({ pedidoId: pedido.id, estadoPedido: pedido.estado, estadoPago: pedido.pago?.estado });
});
