import type {Metadata} from 'next';
import type {ReactNode} from 'react';

export const metadata: Metadata = {title: 'Claim your Real Capita account', referrer: 'no-referrer', robots: {index: false, follow: false}};
export default function ClaimLayout({children}: {children: ReactNode}) {return children;}
