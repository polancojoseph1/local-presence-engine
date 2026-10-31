import twilio from 'twilio';import {admin} from '@/lib/supabase';
export async function POST(req:Request){const values=Object.fromEntries(await req.formData()) as Record<string,string>;const url=`${process.env.APP_URL}/api/webhooks/twilio`;if(!process.env.TWILIO_AUTH_TOKEN||!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN,req.headers.get('x-twilio-signature')||'',url,values))return new Response('Invalid signature',{status:403});const db=admin();
if(values.OptOutType==='STOP'||/^\s*(stop|unsubscribe|cancel|end|quit)\s*$/i.test(values.Body||'')){// Shared messaging service: suppress this number across tenants.
await db.from('suppressions').upsert({destination:values.From});await db.from('customers').update({opted_out:true}).eq('phone',values.From);}
if(values.MessageStatus){const status=['delivered','failed','undelivered'].includes(values.MessageStatus)?(values.MessageStatus==='delivered'?'delivered':'failed'):null;if(status)await db.from('messages').update({status,error:values.ErrorCode||null}).eq('provider_id',values.MessageSid)}
return new Response('<Response/>',{headers:{'Content-Type':'text/xml'}})}
