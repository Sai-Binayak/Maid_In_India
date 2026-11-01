// ALL DATA BELOW IS FICTIONAL. Demo password for every account: Demo@12345
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const p = new PrismaClient();
const cities = [["Bhubaneswar",20.2961,85.8245],["Mumbai",19.076,72.8777],["Delhi",28.6139,77.209],["Bengaluru",12.9716,77.5946],["Kolkata",22.5726,88.3639]] as const;
const cats = ["House Cleaning","Cooking","Babysitting","Elderly Care","Laundry","Housekeeping"];
const langs = ["Hindi","English","Odia","Bengali","Kannada","Marathi"];
const names = ["Sunita","Lakshmi","Meena","Rina","Kavita","Anita","Geeta","Pooja","Radha","Savita","Durga","Mamata","Parvati","Sarita","Rekha","Usha","Bimala","Champa","Nirmala","Padma","Sita","Tara","Uma","Vimala","Zoya"];
const hash = await bcrypt.hash("Demo@12345", 10);
const C = await Promise.all(cats.map(name => p.serviceCategory.upsert({ where:{ name }, update:{}, create:{ name } })));
const L = await Promise.all(langs.map(name => p.language.upsert({ where:{ name }, update:{}, create:{ name } })));
await p.user.upsert({ where:{ email:"admin@maidinindia.demo" }, update:{}, create:{ role:"ADMIN", name:"Demo Admin", phone:"9000000000", email:"admin@maidinindia.demo", passwordHash:hash, isDemo:true } });
for (let i=0;i<10;i++) { const c = cities[i%5]; await p.user.upsert({ where:{ phone:`91000000${10+i}` }, update:{}, create:{ role:"CLIENT", name:`Demo Client ${i+1}`, phone:`91000000${10+i}`, email:i===0?"client@maidinindia.demo":undefined, passwordHash:hash, isDemo:true, client:{ create:{ city:c[0] } }, addresses:{ create:{ line:"Fictional Apt, Sector 1", city:c[0], lat:c[1]+.01, lng:c[2]+.01 } } } }); }
for (let i=0;i<25;i++) { const c = cities[i%5];
  await p.user.upsert({ where:{ phone:`92000000${10+i}` }, update:{}, create:{ role:"MAID", name:`${names[i]} (demo)`, phone:`92000000${10+i}`, email:i===0?"maid@maidinindia.demo":undefined, passwordHash:hash, isDemo:true,
    maid:{ create:{ city:c[0], lat:c[1]+(i%7)*.004, lng:c[2]+(i%5)*.004, experienceYears:1+i%12, expectedSalary:6000+(i%9)*1000, availableDays:[1,2,3,4,5,6], fullTime:i%3===0, rating:3.5+(i%15)/10, completedJobs:i*2, verification:i%4===3?"PENDING":"VERIFIED", verifiedAt:new Date(),
      skills:{ create:[C[i%6],C[(i+2)%6]].map(k=>({ categoryId:k.id })) }, languages:{ connect:[{ id:L[i%6].id },{ id:L[0].id }].filter((v,j,a)=>a.findIndex(x=>x.id===v.id)===j) } } } } }); }
console.log("Seeded (fictional). Password: Demo@12345");
