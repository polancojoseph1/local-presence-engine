import {sessionClient} from '@/lib/supabase';
export async function GET(req:Request){const url=new URL(req.url);const code=url.searchParams.get('code');if(code){const db=await sessionClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return Response.redirect(new URL('/',req.url))}return Response.redirect(new URL('/login?error=expired',req.url))}
