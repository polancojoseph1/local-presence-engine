import {admin} from './supabase';import {eligible,renderTemplate} from './core';import twilio from 'twilio';import {Resend} from 'resend';
export async function runQueue(){const db=admin();const {data:jobs,error}=await db.rpc('claim_messages');if(error)throw error;let sent=0;
for(const job of jobs||[]){try{const {data:r}=await db.from('requests').select('*').eq('id',job.request_id).single();const {data:c}=await db.from('customers').select('*').eq('id',r.customer_id).single();const {data:o}=await db.from('organizations').select('*').eq('id',job.org_id).single();
const {data:suppressed}=await db.from('suppressions').select('destination').eq('destination',r.channel==='sms'?c.phone:c.email).maybeSingle();
if(suppressed||!eligible(c,r.channel)||(job.step>0&&r.clicked_at)){await db.from('messages').update({status:'cancelled'}).eq('id',job.id);continue}
const link=`${process.env.APP_URL}/r/${o.slug}?t=${r.token}`;const stop=`${process.env.APP_URL}/unsubscribe?t=${r.token}`;const body=renderTemplate(o.template,c.name,o.name,link);
if((r.channel==='sms'&&!process.env.TWILIO_MESSAGING_SERVICE_SID)||(r.channel==='email'&&!process.env.RESEND_API_KEY)){await db.from('messages').update({status:'failed',error:'Messaging provider not configured'}).eq('id',job.id);continue}
// Mark before network I/O. Ambiguous provider failures stay unknown and are never blindly retried.
await db.from('messages').update({status:'unknown'}).eq('id',job.id);
let id:string;
if(r.channel==='sms'){if(!process.env.TWILIO_MESSAGING_SERVICE_SID)throw new Error('Twilio not configured');const result=await twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN,{timeout:15000}).messages.create({messagingServiceSid:process.env.TWILIO_MESSAGING_SERVICE_SID,to:c.phone,body:`${body}\nReply STOP to opt out.`,statusCallback:`${process.env.APP_URL}/api/webhooks/twilio`});id=result.sid}
else {if(!process.env.RESEND_API_KEY)throw new Error('Resend not configured');const result=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.EMAIL_FROM!,to:c.email,subject:`Share your experience at ${o.name}`,text:`${body}\n\nUnsubscribe: ${stop}`,headers:{'List-Unsubscribe':`<${stop}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}},{idempotencyKey:job.id});if(result.error)throw new Error(result.error.message);id=result.data!.id}
await db.from('messages').update({status:'sent',provider_id:id,error:null}).eq('id',job.id).eq('status','unknown');sent++;
}catch(e){await db.from('messages').update({error:e instanceof Error?e.message:'Provider error'}).eq('id',job.id)}}return {sent,claimed:jobs?.length||0}}
