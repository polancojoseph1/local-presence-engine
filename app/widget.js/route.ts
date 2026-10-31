export async function GET(req: Request) {
  const origin = new URL(process.env.APP_URL || req.url).origin;
  const js = `(()=>{const script=document.currentScript;const slug=script.dataset.organization||script.dataset.slug;if(!slug)return;const frame=document.createElement('iframe');frame.src=${JSON.stringify(origin)}+'/widget/'+encodeURIComponent(slug);frame.title='Google customer reviews';frame.loading='lazy';frame.style.cssText='border:0;width:100%;height:640px;max-width:100%';script.insertAdjacentElement('afterend',frame)})();`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
    },
  });
}
