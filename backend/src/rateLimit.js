// Límite local por IP; en despliegues con varios procesos usar un almacén compartido.
export function rateLimit({limit = 10, windowMs = 15 * 60_000} = {}) {
 const entries = new Map();
 return (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of entries) if (value.until <= now) entries.delete(key);
  const key = req.ip;
  const entry = entries.get(key) || {count:0, until:now + windowMs};
  if (!entries.has(key) && entries.size >= 10_000) return res.status(429).json({error:'Demasiadas consultas. Inténtalo más tarde.'});
  entry.count++;
  entries.set(key, entry);
  if (entry.count > limit) {
   res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
   return res.status(429).json({error:'Demasiadas consultas. Espera unos minutos antes de intentarlo de nuevo.'});
  }
  next();
 };
}
