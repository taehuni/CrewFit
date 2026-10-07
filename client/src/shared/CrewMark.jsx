import './crew-mark.css';

const palettes = {running:['#e8f1e9','#24523d'],walking:['#f3eddb','#6f5829'],cycling:['#e4edf8','#31557b'],swimming:['#ddf3f1','#226665'],gym:['#f3e7e2','#7a4331'],other:['#eee9f5','#64507c']};
export default function CrewMark({name='크루',sport,large=false}) {
  const [background,color]=palettes[sport] || palettes.other;
  return <span className={`crew-mark${large?' crew-mark-large':''}`} style={{background,color}} aria-hidden="true">
    <span>{Array.from(name.trim())[0] || 'C'}</span><span className="crew-mark-lines" />
  </span>;
}
