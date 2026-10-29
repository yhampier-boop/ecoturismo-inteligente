import {createContext,useContext,useEffect,useState} from 'react';
import {request} from '../api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [token,setToken]=useState(()=>localStorage.getItem('eco_token')||'');
 const [user,setUser]=useState(null);
 const [loading,setLoading]=useState(Boolean(token));
 useEffect(()=>{
  let cancel=false;
  if(!token){setUser(null);setLoading(false);return;}
  setLoading(true);
  request('/auth/me',{token}).then(({user})=>{if(!cancel)setUser(user)}).catch(()=>{
   if(!cancel){setToken('');setUser(null);localStorage.removeItem('eco_token')}
  }).finally(()=>{if(!cancel)setLoading(false)});
  return()=>{cancel=true};
 },[token]);
 const finish=(data)=>{localStorage.setItem('eco_token',data.token);setToken(data.token);setUser(data.user);setLoading(false)};
 const login=async(email,password)=>finish(await request('/auth/login',{method:'POST',body:{email,password}}));
 const register=async(name,email,password)=>finish(await request('/auth/register',{method:'POST',body:{name,email,password}}));
 const logout=()=>{localStorage.removeItem('eco_token');setToken('');setUser(null)};
 return <AuthContext.Provider value={{token,user,loading,login,register,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){return useContext(AuthContext)}
