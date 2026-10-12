export function reservationGroup(row,today){
 if(row.status==='cancelled')return 'cancelled';
 return row.visit_on<today?'past':'upcoming';
}
export function filterReservations(rows,filter,today){
 return rows.filter(row=>filter==='all'||reservationGroup(row,today)===filter).sort((a,b)=>
  filter==='upcoming'?a.visit_on.localeCompare(b.visit_on):b.visit_on.localeCompare(a.visit_on));
}
