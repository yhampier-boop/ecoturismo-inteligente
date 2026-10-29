import test from 'node:test';
import assert from 'node:assert/strict';
import {smtpSettings,mailConfigured,mailTransport} from '../src/passwordReset.js';

test('Gmail usa 465/TLS y acepta SMTP_USER/SMTP_PASS sin exigir remitente duplicado',()=>{
 const env={SMTP_USER:'cuenta@example.test',SMTP_PASS:'abcd efgh ijkl mnop'};
 const settings=smtpSettings(env);
 assert.equal(settings.host,'smtp.gmail.com');assert.equal(settings.port,465);assert.equal(settings.secure,true);
 assert.equal(settings.pass,'abcdefghijklmnop');assert.equal(settings.from,env.SMTP_USER);assert.equal(mailConfigured(env),true);
 const transport=mailTransport(settings);
 assert.equal(transport.options.secure,true);assert.equal(transport.options.logger,false);assert.equal(transport.options.debug,false);transport.close();
});

test('Gmail no permite degradar TLS; alias antiguo y servidores SMTP de pruebas compatibles',()=>{
 const settings=smtpSettings({SMTP_USER:'cuenta@example.test',SMTP_PASSWORD:'aplicacion',SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'587',SMTP_SECURE:'false'});
 assert.equal(settings.port,465);assert.equal(settings.secure,true);assert.equal(settings.pass,'aplicacion');
 const local={SMTP_HOST:'127.0.0.1',SMTP_PORT:'4026',SMTP_SECURE:'false',SMTP_FROM:'test@example.test',CLIENT_URL:'http://localhost:5173'};
 assert.equal(mailConfigured(local),true);assert.equal(smtpSettings(local).secure,false);
});

test('sin credenciales no se simula configuración ni envío; CLIENT_URL seguro en producción',()=>{
 assert.equal(mailConfigured({}),false);assert.equal(mailConfigured({SMTP_USER:'correo@example.test'}),false);
 assert.equal(mailConfigured({SMTP_USER:'correo@example.test',SMTP_PASS:'aplicacion',NODE_ENV:'production'}),false);
 assert.equal(mailConfigured({SMTP_USER:'correo@example.test',SMTP_PASS:'aplicacion',CLIENT_URL:'javascript:alert(1)'}),false);
});
