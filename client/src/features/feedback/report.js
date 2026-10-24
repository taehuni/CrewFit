export function readReport(content) {
  try {
    const value=JSON.parse(content);
    if(value?.format==='crewfit-report-v1' && typeof value.analysis==='string' && Array.isArray(value.summary?.sports)) return {content:value.analysis,report:value.summary};
  } catch { /* Existing text reports are supported. */ }
  return {content:typeof content==='string'?content:'',report:null};
}
export function reportSections(content) {
  const parts=content.split(/(?:[①②③④]\s*)?(현재 상태|잘한 점|개선할 점|다음 행동)\s*[:：]\s*/);
  return parts.length===9&&!parts[0].trim()?[1,3,5,7].map(i=>({title:parts[i],text:parts[i+1].trim()})):null;
}
