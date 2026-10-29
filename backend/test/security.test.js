import test from 'node:test';
import assert from 'node:assert/strict';
import {newResetToken,resetHash,validResetToken,RESET_TTL} from '../src/passwordReset.js';
import {rateLimit} from '../src/rateLimit.js';
import {airGeometry} from '../../frontend/src/data/airGeometry.js';

test('tokens aleatorios: 256 bits, hash distinto, TTL de 30 minutos',()=>{
 const a=newResetToken(),b=newResetToken();
 assert.ok(validResetToken(a.token));assert.notEqual(a.token,b.token);
 assert.notEqual(a.hash,a.token);assert.equal(a.hash,resetHash(a.token));
 assert.ok(Math.abs(a.expiresAt-Date.now()-RESET_TTL)<1000);
 assert.equal(validResetToken('abc'),false);
});

test('límite por IP responde 429 con Retry-After',()=>{
 const limiter=rateLimit({limit:1});let next=0,status;
 const res={set(key,value){assert.equal(key,'Retry-After');assert.ok(Number(value)>0);},status(value){status=value;return this;},json(body){assert.ok(body.error);}};
 limiter({ip:'local'},res,()=>next++);limiter({ip:'local'},res,()=>next++);
 assert.equal(next,1);assert.equal(status,429);
 limiter({ip:'otra'},res,()=>next++);assert.equal(next,2);
});

test('arcos aéreos finitos, con extremos correctos y sin salto de antimeridiano',()=>{
 const {stops,arcs}=airGeometry([{lat:35.68,lon:139.76},{lat:37.77,lon:-122.42}]);
 assert.equal(arcs.length,1);assert.deepEqual(arcs[0][0],stops[0]);assert.deepEqual(arcs[0].at(-1),stops[1]);
 for(let i=1;i<arcs[0].length;i++){
  assert.ok(arcs[0][i].every(Number.isFinite));
  assert.ok(Math.abs(arcs[0][i][1]-arcs[0][i-1][1])<10);
 }
 assert.equal(airGeometry([]).arcs.length,0);
 assert.ok(airGeometry([{lat:0,lon:0},{lat:0,lon:0}]).arcs.flat(2).every(Number.isFinite));
});
