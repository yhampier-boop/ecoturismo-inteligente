import {createHash, randomBytes} from 'node:crypto';
import nodemailer from 'nodemailer';

export const RESET_TTL = 30 * 60_000;
export const resetHash = token => createHash('sha256').update(token).digest('hex');
export const validResetToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function newResetToken() {
 const token = randomBytes(32).toString('hex');
 return {token, hash: resetHash(token), expiresAt: Date.now() + RESET_TTL};
}

export function smtpSettings(env=process.env) {
 const host=String(env.SMTP_HOST||'smtp.gmail.com').trim();
 const gmail=host.toLowerCase()==='smtp.gmail.com';
 const user=String(env.SMTP_USER||'').trim();
 const password=String(env.SMTP_PASS||env.SMTP_PASSWORD||'');
 const pass=gmail?password.replace(/\s+/g,''):password;
 const port=gmail?465:Number(env.SMTP_PORT||465);
 const secure=gmail||env.SMTP_SECURE==='true'||(!env.SMTP_SECURE&&port===465);
 const from=String(env.SMTP_FROM||user).trim();
 const clientUrl=String(env.CLIENT_URL||(env.NODE_ENV!=='production'?'http://localhost:5173':'')).split(',')[0].trim();
 return {host,port,secure,from,clientUrl,gmail,user,pass,requireTLS:!secure&&(env.SMTP_REQUIRE_TLS==='true'||env.NODE_ENV==='production')};
}

export function mailConfigured(env=process.env) {
 const s=smtpSettings(env);
 let validUrl=false;try{validUrl=['http:','https:'].includes(new URL(s.clientUrl).protocol);}catch{}
 return Boolean(s.host&&Number.isInteger(s.port)&&s.port>0&&s.port<=65535&&s.from&&validUrl&&(!s.gmail||(s.user&&s.pass))&&(!s.user||s.pass));
}

export function mailTransport(settings=smtpSettings()) {
 return nodemailer.createTransport({
  host:settings.host,port:settings.port,secure:settings.secure,requireTLS:settings.requireTLS,
  ...(settings.user?{auth:{user:settings.user,pass:settings.pass}}:{}),
  connectionTimeout:10_000,greetingTimeout:10_000,socketTimeout:15_000,
  logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true
 });
}

export async function verifyMail() {
 if(!mailConfigured())throw new Error('Correo no configurado');
 const transport=mailTransport();
 try {await transport.verify();}finally{transport.close();}
}

export async function sendResetEmail(email, token) {
 if (!mailConfigured()) throw new Error('Correo no configurado');
 // Nunca construir el enlace con Host/Origin enviados por el cliente.
 const settings=smtpSettings();
 const url = new URL('/restablecer-contrasena', settings.clientUrl);
 if (!['http:', 'https:'].includes(url.protocol)) throw new Error('CLIENT_URL inválida');
 url.hash = new URLSearchParams({token}).toString();
 const transport = mailTransport(settings);
 try {
  const result = await transport.sendMail({
    from: settings.from, to: email,
   subject: 'Restablece tu contraseña · EcoTurismo Inteligente',
   text: `Solicitaste cambiar tu contraseña. Abre este enlace en los próximos 30 minutos:\n\n${url}\n\nSolo se puede usar una vez. Si no lo solicitaste, ignora este correo.`
  });
  if (!result.accepted?.length) throw new Error('Correo no aceptado');
 } finally { transport.close(); }
}
