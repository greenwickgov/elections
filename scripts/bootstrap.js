import {randomUUID} from 'node:crypto';
import {pool} from '../db.js';
import {passwordHash} from '../security.js';
try {
 const password=process.env.INITIAL_ADMIN_PASSWORD;
 if(password){
  if(password.length<14||password.length>256)throw Error('INITIAL_ADMIN_PASSWORD must contain 14–256 characters.');
  // Serialise simultaneous first-deploy bootstraps. Never rotate an existing account.
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(726451203)');
   const {rows}=await client.query('SELECT count(*)::int AS n FROM admins');
   if(rows[0].n===0){await client.query('INSERT INTO admins VALUES($1,$2,$3)',[randomUUID(),'admin',passwordHash(password)]);console.log('Initial administrator created. Username: admin');}
   else console.log('Administrator already exists; bootstrap skipped.');
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
}finally{await pool.end();}
