import {runQueue} from '@/lib/messaging';import {syncReviews} from '@/lib/google';
export const maxDuration=300;
export async function GET(req:Request){if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new Response('Unauthorized',{status:401});try{return Response.json({messages:await runQueue(),reviews:await syncReviews()})}catch{return Response.json({error:'Scheduled processing failed. Check server logs and provider configuration.'},{status:500})}}
