export function failure(e:unknown){const message=e instanceof Error?e.message:'Request failed';return Response.json({error:message},{status:message==='Unauthorized'?401:400})}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(process.env.APP_URL||req.url).origin)throw new Error('Invalid origin')}
