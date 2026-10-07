import './sport-icon.css';
const paths={
 running:<><circle cx="16" cy="4" r="2"/><path d="m7 10 4-3 4 3 4 1M12 8l-2 6 5 3 1 5M10 14l-3 5H3"/></>,
 walking:<><circle cx="13" cy="4" r="2"/><path d="m7 11 4-3 4 4 4 1M11 8l-1 7 4 7M10 15l-4 7"/></>,
 cycling:<><circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><circle cx="15" cy="4" r="2"/><path d="m12 8-4 4 5 3v5m-1-12 4 4h4"/></>,
 swimming:<><circle cx="18" cy="8" r="2"/><path d="m4 13 5-6 7 6M9 7l-4-3M2 17q2-3 5 0t5 0 5 0 5 0M2 21q2-3 5 0t5 0 5 0 5 0"/></>,
 gym:<><path d="M7 12h10M3 8v8m4-10v12M17 6v12m4-10v8M3 12H1m20 0h2"/></>,
 other:<><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/><circle cx="12" cy="12" r="4"/></>,
};
export default function SportIcon({sport='other',className=''}){return <span className={`sport-symbol ${className}`} data-sport={sport} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[sport]||paths.other}</svg></span>;}
