import {pool} from './database.js';

const USER_FIELDS='id,name,email,role,is_active,created_at';
const NOTICE_FIELDS='CAST(id AS CHAR) AS id,title,content,is_active,created_at,updated_at';

export async function adminStats() {
 const [[row]]=await pool.query(`SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM trips) AS trips,
  (SELECT COUNT(*) FROM site_notices) AS notices`);
 return row;
}

export async function adminUsers(search,page) {
 const pattern=`%${search.replace(/[\\%_]/g,'\\$&')}%`;
 const where='WHERE name LIKE ? OR email LIKE ?';
 const [[count]]=await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`,[pattern,pattern]);
 const [users]=await pool.query(`SELECT ${USER_FIELDS} FROM users ${where} ORDER BY created_at DESC,id LIMIT 20 OFFSET ?`,[pattern,pattern,(page-1)*20]);
 return {users,total:count.total,page,pageSize:20};
}

export async function setUserActive(id,active,actorId) {
 const conn=await pool.getConnection();
 try {
  await conn.beginTransaction();
  // Serializa cambios sobre administradores y evita desactivaciones cruzadas.
  const [admins]=await conn.query("SELECT id FROM users WHERE role='admin' AND is_active=1 ORDER BY id FOR UPDATE");
  if(!admins.some(user=>user.id===actorId)){await conn.rollback();return {status:403,error:'Tu cuenta ya no tiene permisos administrativos.'};}
  const [[user]]=await conn.query(`SELECT ${USER_FIELDS} FROM users WHERE id=? FOR UPDATE`,[id]);
  if(!user){await conn.rollback();return {status:404,error:'Cuenta no encontrada.'};}
  if(!active&&user.id===actorId){await conn.rollback();return {status:409,error:'No puedes desactivar tu propia cuenta administradora.'};}
  if(Number(user.is_active)!==Number(active)) {
   await conn.query('UPDATE users SET is_active=?,auth_version=auth_version+1 WHERE id=?',[Number(active),id]);
   if(!active)await conn.query('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL',[id]);
  }
  await conn.commit();return {user:{...user,is_active:Number(active)}};
 } catch(error){await conn.rollback();throw error;}
 finally {conn.release();}
}

export async function listNotices({publishedOnly=false,page=1}={}) {
 const where=publishedOnly?'WHERE is_active=1':'';
 const [[count]]=await pool.query(`SELECT COUNT(*) AS total FROM site_notices ${where}`);
 const [notices]=await pool.query(`SELECT ${NOTICE_FIELDS} FROM site_notices ${where} ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`,[publishedOnly?10:20,publishedOnly?0:(page-1)*20]);
 return {notices,total:count.total,page,pageSize:publishedOnly?10:20};
}

export async function writeNotice({id,title,content,active}) {
 const conn=await pool.getConnection();
 try {
  if(id){
   const [result]=await conn.query('UPDATE site_notices SET title=?,content=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[title,content,Number(active),id]);
   if(!result.affectedRows)return null;
  }else{
   await conn.query('INSERT INTO site_notices(title,content,is_active) VALUES(?,?,?)',[title,content,Number(active)]);
   const [[row]]=await conn.query('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');id=row.id;
  }
  const [[notice]]=await conn.query(`SELECT ${NOTICE_FIELDS} FROM site_notices WHERE id=?`,[id]);return notice;
 } finally {conn.release();}
}
