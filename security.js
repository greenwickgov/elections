import {randomBytes,scryptSync,timingSafeEqual,createHash,createHmac,createCipheriv,createDecipheriv} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const codeHash=(id,code)=>createHmac('sha256',process.env.SESSION_SECRET).update(id+':'+code).digest('hex');
export function passwordHash(p){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');}
export function verify(p,h){const [s,v]=h.split(':');return timingSafeEqual(scryptSync(p,s,64),Buffer.from(v,'hex'));}
export function encrypt(v,id){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from(process.env.BALLOT_KEY,'hex'),iv);c.setAAD(Buffer.from(id));const body=Buffer.concat([c.update(JSON.stringify(v)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');}
export function decrypt(v,id){const b=Buffer.from(v,'base64'),c=createDecipheriv('aes-256-gcm',Buffer.from(process.env.BALLOT_KEY,'hex'),b.subarray(0,12));c.setAAD(Buffer.from(id));c.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]).toString());}
