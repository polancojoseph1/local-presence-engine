import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
export const configured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export async function sessionClient() {
 const jar = await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {cookies:{getAll:()=>jar.getAll(),setAll: items=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Server-rendered sessions are refreshed by proxy.ts. */}}}});
}
export function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function owner(){
 if(!configured()) throw new Error('Connect Supabase to use live data.');
 const db=await sessionClient(); const {data:{user}}=await db.auth.getUser();
 if(!user) throw new Error('Unauthorized');
 const {data:member}=await db.from('memberships').select('org_id').eq('user_id',user.id).single();
 if(!member) throw new Error('Create your organization first.');
 return {db,user,orgId:member.org_id as string};
}
