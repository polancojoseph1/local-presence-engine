import {z} from 'zod';
export const customerSchema=z.object({name:z.string().trim().min(1).max(100),email:z.union([z.email(),z.literal('')]).optional(),phone:z.union([z.string().regex(/^\+[1-9]\d{7,14}$/),z.literal('')]).optional(),email_consent:z.boolean().default(false),sms_consent:z.boolean().default(false)}).refine(x=>x.email||x.phone,'Email or phone is required');
export function renderTemplate(template:string,name:string,business:string,link:string){return template.replace(/{{(name|business|link)}}/g,(_,key:string)=>({name,business,link}[key as 'name'|'business'|'link']))}
export const defaultTemplate='Hi {{name}}, thanks for visiting {{business}}! Share your experience: {{link}}';
export function eligible(c:{opted_out:boolean;sms_consent:boolean;email_consent:boolean;phone?:string|null;email?:string|null},channel:string){return !c.opted_out && (channel==='sms'?!!c.phone&&c.sms_consent:!!c.email&&c.email_consent)}
export function googleLink(value:string){try{const u=new URL(value);return u.protocol==='https:'&&['search.google.com','g.page','www.google.com','maps.google.com'].includes(u.hostname)}catch{return false}}
