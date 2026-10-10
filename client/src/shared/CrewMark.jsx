import './crew-mark.css';

const palettes = {running:['#e8f1e9','#24523d'],walking:['#f3eddb','#6f5829'],cycling:['#e4edf8','#31557b'],swimming:['#ddf3f1','#226665'],gym:['#f3e7e2','#7a4331'],other:['#eee9f5','#64507c']};
export default function CrewMark({name='크루',sport,large=false}) {
  const [background,color]=palettes[sport] || palettes.other;
  return <span className={`crew-mark${large?' crew-mark-large':''}`} style={{background,color}} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></svg><span className="crew-mark-lines" />
  </span>;
}
