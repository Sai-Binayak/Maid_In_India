export const km = (a:{lat:number;lng:number}, b:{lat:number;lng:number}) => {
  const r = (d:number)=>d*Math.PI/180, R=6371;
  const x = Math.sin(r(b.lat-a.lat)/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
};
