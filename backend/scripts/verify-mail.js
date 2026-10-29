import 'dotenv/config';
import {mailConfigured,mailTransport,smtpSettings,verifyMail} from '../src/passwordReset.js';

const send=process.argv.includes('--send');
if(!mailConfigured()){
 console.error('PENDIENTE: configura SMTP_USER y SMTP_PASS (contraseña de aplicación). Gmail usa smtp.gmail.com:465/TLS. No se realizó ningún envío.');
 process.exitCode=1;
}else{
 try{
  await verifyMail();console.log('OK: conexión y autenticación SMTP verificadas.');
  if(send){
   const to=String(process.env.SMTP_TEST_TO||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw Object.assign(new Error(),{code:'TEST_RECIPIENT_MISSING'});
   const settings=smtpSettings(),transport=mailTransport(settings);
   try{
    const result=await transport.sendMail({from:settings.from,to,subject:'Prueba de correo · EcoTurismo Inteligente',text:'Este es un correo de comprobación solicitado desde EcoTurismo Inteligente. No contiene contraseñas ni enlaces de recuperación.'});
    if(!result.accepted?.length)throw new Error();
    console.log('OK: servidor SMTP aceptó el correo de prueba. Confirma su recepción y revisa spam.');
   }finally{transport.close();}
  }
 }catch(error){
  console.error(error.code==='EAUTH'?'PENDIENTE: Gmail rechazó la autenticación. Revisa la verificación en dos pasos y la contraseña de aplicación.':error.code==='TEST_RECIPIENT_MISSING'?'PENDIENTE: configura SMTP_TEST_TO para autorizar el destinatario de prueba.':'PENDIENTE: no se pudo verificar o enviar el correo. Revisa configuración, TLS y conectividad.');
  process.exitCode=1;
 }
}
