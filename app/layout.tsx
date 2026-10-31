import './globals.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'LocalLoop · Review & Local Presence',description:'A thoughtful review workflow for local businesses.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
