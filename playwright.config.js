import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:60_000,
 reporter:'list',use:{baseURL:'http://127.0.0.1:5175',headless:true,trace:'off'},
 webServer:[
  {command:'npm run start -w backend',url:'http://127.0.0.1:4005/api/health',reuseExistingServer:false,env:{PORT:'4005',CLIENT_URL:'http://127.0.0.1:5175',SMTP_HOST:'127.0.0.1',SMTP_PORT:'4026',SMTP_SECURE:'false',SMTP_FROM:'EcoTurismo <noreply@example.test>',SMTP_USER:'',SMTP_PASS:'',SMTP_PASSWORD:''}},
  {command:'npm run dev -w frontend -- --host 127.0.0.1 --port 5175 --strictPort',url:'http://127.0.0.1:5175',reuseExistingServer:false,env:{API_PROXY_TARGET:'http://127.0.0.1:4005'}}
 ]
});
