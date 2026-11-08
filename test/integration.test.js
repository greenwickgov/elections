import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {randomBytes,randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
test('Postgres API lifecycle: authentication, ballots, concurrency, receipts and closure',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/greenwick_test','Integration tests require local greenwick_test database');
 process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
 const {pool}=await import('../db.js'),{passwordHash}=await import('../security.js');
 await pool.query(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 const bootstrapPassword=randomBytes(24).toString('hex');
 const boot=spawnSync(process.execPath,['scripts/bootstrap.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,INITIAL_ADMIN_PASSWORD:bootstrapPassword},encoding:'utf8'});assert.equal(boot.status,0,boot.stderr);
 const original=(await pool.query("SELECT password_hash FROM admins WHERE username='admin'")).rows[0].password_hash;
 const bootAgain=spawnSync(process.execPath,['scripts/bootstrap.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,INITIAL_ADMIN_PASSWORD:randomBytes(24).toString('hex')},encoding:'utf8'});assert.equal(bootAgain.status,0,bootAgain.stderr);assert.equal((await pool.query("SELECT password_hash FROM admins WHERE username='admin'")).rows[0].password_hash,original,'Restart cannot reset administrator');
 const username=randomUUID(),password=randomBytes(24).toString('hex');await pool.query('INSERT INTO admins VALUES($1,$2,$3)',[randomUUID(),username,passwordHash(password)]);
 const origin='http://localhost:3187';const server=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,APP_ORIGIN:origin,PORT:'3187',NODE_ENV:'test',SESSION_SECRET:randomBytes(48).toString('hex'),BALLOT_KEY:randomBytes(32).toString('hex')},stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(origin+'/api/health')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Server starts');
  let cookie='';async function request(path,body,authenticated=true,requestOrigin=origin){const res=await fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:requestOrigin}),...(authenticated&&cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};}
  assert.equal((await request('/admin/elections')).status,401);
  assert.equal((await request('/login',{username,password},true,'https://wrong.example')).status,403);
  const login=await request('/login',{username,password});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
  for(const method of ['fptp','preferential','referendum']){
   const created=await request('/admin/elections',{title:'Integration '+method,description:'Test ballot',method,options:['A','B'],opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+600000).toISOString()});assert.equal(created.status,200);const id=created.data.id;
   const codes=await request('/admin/elections/'+id+'/codes',{count:2});assert.equal(codes.status,200);const vote=method==='preferential'?[0,1]:[0];
   assert.equal((await request('/vote/'+id,{code:codes.data.codes[0],vote},false)).status,400,'Draft vote rejected');
   assert.equal((await request('/admin/elections/'+id+'/status',{status:'published'})).status,200);
   assert.equal((await request('/results/'+id)).status,403);
   const parallel=await Promise.all([request('/vote/'+id,{code:codes.data.codes[0],vote},false),request('/vote/'+id,{code:codes.data.codes[0],vote},false)]);assert.deepEqual(parallel.map(x=>x.status).sort(),[200,400]);const receipt=parallel.find(x=>x.status===200).data.receipt;
   assert.equal((await request('/receipt',{receipt},false)).data.recorded,true);
   assert.equal((await request('/admin/elections/'+id+'/status',{status:'closed'})).status,200);
   const result=await request('/results/'+id,undefined,false);assert.equal(result.data.total,1);assert.equal(result.data.winner,0);
   assert.equal((await request('/vote/'+id,{code:codes.data.codes[1],vote},false)).status,400);
   assert.equal((await request('/admin/elections/'+id+'/status',{status:'published'})).status,400);
  }
  await request('/logout',{});assert.equal((await request('/admin/elections')).status,401);
 }finally{server.kill();await pool.end();}
});
