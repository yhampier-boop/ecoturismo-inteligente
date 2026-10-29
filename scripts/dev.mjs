import {spawn} from 'node:child_process';
const windows=process.platform==='win32';
const cmd=windows?'npm.cmd':'npm';
const processes=[
 {name:'BACKEND',args:['run','dev','-w','backend']},
 {name:'FRONTEND',args:['run','dev','-w','frontend']}
].map(({name,args})=>{
 const p=spawn(cmd,args,{stdio:'inherit',shell:windows,env:process.env});
 p.on('error',e=>console.error(`[${name}] ${e.message}`));
 return p;
});
console.log('\nEcoTurismo Inteligente');
console.log('Sitio web: http://localhost:5173');
console.log('Servidor : http://localhost:4000/api/health');
console.log('APIs externas: se activan si sus claves están en backend/.env.\n');
function stop(){processes.forEach(p=>{if(!p.killed)p.kill('SIGTERM')});}
process.on('SIGINT',()=>{stop();process.exit(0)});
process.on('SIGTERM',()=>{stop();process.exit(0)});
