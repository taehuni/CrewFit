const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s·_-]+/g,'');
// The product name AND its specific category must describe the requested item.
const rules=[
 {terms:/닭가슴살/,code:'50013800',path:/닭가슴살$/,exclude:/소스|드레싱|육수|삼계|곰탕|너겟/},
 {terms:/오트밀|귀리/,code:'50013420',path:/오트밀|귀리|시리얼/,exclude:/소스|드레싱/},
 {terms:/견과|아몬드|호두/,path:/견과류|아몬드|호두/,exclude:/망치|까기|도구|포장|스푼/},
 {terms:/두부/,path:/두부/,exclude:/모래|틀|도구/},
 {terms:/잡곡밥/,path:/즉석밥|잡곡/,exclude:/용기|도시락통/},
 {terms:/요가매트/,path:/요가매트|매트$/,exclude:/가방|파우치|양말|상의|보관|스트랩|케이스/},
 {terms:/덤벨|아령/,path:/덤벨|아령/,exclude:/장식|키링|열쇠|거치대|보관|랙|가방/},
 {terms:/폼롤러/,path:/폼롤러/,exclude:/보관|가방|케이스/},
 {terms:/러닝|런닝/,path:/러닝|마라톤/,exclude:/장식|키링|열쇠/},
 {terms:/밴드/,path:/헬스|요가|필라테스/,exclude:/머리|헤어|시계|밴드형마스크/},
];
export function searchCategory(category,search){
 return (category==='foods'&&rules.find(r=>r.terms.test(compact(search)))?.code)||(category==='foods'?'50000006':'50000007');
}
export function matchesSearch(item,search){
 const name=compact(item.name),term=compact(search),path=item.category?.fullName||'';
 const applicable=rules.filter(r=>r.terms.test(term));
 if(applicable.some(r=>!r.path.test(path)||r.exclude?.test(name)))return false;
 // Spaces may separate modifiers; require all of them, never supplier hidden tags.
 const tokens=search.trim().split(/\s+/).map(compact);
 return name.includes(term)||tokens.every(token=>name.includes(token));
}
