import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSessions,ADMIN_IDLE_MS} from '../src/adminSessions.js';

test('sesión opaca aleatoria, solo en memoria, y expiración exacta a los 15 minutos',()=>{
 let clock=0;const store=createAdminSessions({now:()=>clock});
 const session=store.create({id:'admin',auth_version:2});
 assert.match(session.token,/^[a-f0-9]{64}$/);assert.equal(store.get(session.token).version,2);
 clock=ADMIN_IDLE_MS-1;assert.ok(store.get(session.token));
 clock=ADMIN_IDLE_MS;assert.equal(store.get(session.token),null);
 assert.equal(store.get(session.token,{touch:true}),null);
});

test('actividad renueva el plazo; consultar sin actividad no lo renueva',()=>{
 let clock=0;const store=createAdminSessions({now:()=>clock});const session=store.create({id:'admin',auth_version:0});
 clock=10*60_000;store.get(session.token,{touch:true});
 clock=20*60_000;assert.ok(store.get(session.token));
 clock=25*60_000;assert.equal(store.get(session.token),null);
});

test('revocación individual, por usuario y aislamiento entre procesos',()=>{
 const store=createAdminSessions(),other=createAdminSessions();
 const a=store.create({id:'a',auth_version:0}),b=store.create({id:'b',auth_version:0});
 assert.equal(other.get(a.token),null);store.revoke(a.token);assert.equal(store.get(a.token),null);
 assert.ok(store.get(b.token));store.revokeUser('b');assert.equal(store.get(b.token),null);
 assert.equal(store.get('token-inválido'),null);
});

test('almacén acotado y límite absoluto aun con actividad continua',()=>{
 let clock=0;const store=createAdminSessions({now:()=>clock,maxSessions:1});const a=store.create({id:'a',auth_version:0});
 assert.equal(store.create({id:'b',auth_version:0}),null);
 for(clock=10*60_000;clock<8*60*60_000;clock+=10*60_000)assert.ok(store.get(a.token,{touch:true}));
 clock=8*60*60_000;assert.equal(store.get(a.token,{touch:true}),null);
 assert.ok(store.create({id:'b',auth_version:0}));
});
