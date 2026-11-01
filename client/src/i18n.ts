const d:any = {
  en:{ title:"A Helping Hand, Just Around the Corner.", login:"Login", accept:"Accept", reject:"Reject" },
  hi:{ title:"आपके पास ही, मदद का हाथ।", login:"लॉगिन", accept:"स्वीकार करें", reject:"अस्वीकार करें" },
  or:{ title:"ଆପଣଙ୍କ ପାଖରେ ସହାୟତାର ହାତ।", login:"ଲଗଇନ୍", accept:"ଗ୍ରହଣ କରନ୍ତୁ", reject:"ପ୍ରତ୍ୟାଖ୍ୟାନ" },
  // bn:{ title:"কাছেই সাহায্যের হাত।", login:"লগইন", accept:"গ্রহণ", reject:"প্রত্যাখ্যান" } 
  };
let lang = localStorage.getItem("lang") ?? "en";
export const setLang = (l:string) => { lang = l; localStorage.setItem("lang", l); location.reload(); };
export const t = (k:string) => d[lang]?.[k] ?? d.en[k] ?? k;
