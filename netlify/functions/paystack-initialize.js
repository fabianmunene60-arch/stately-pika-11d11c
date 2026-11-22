const {createClient}=require("@supabase/supabase-js");
exports.handler=async(event)=>{
 if(event.httpMethod!=="POST")return{statusCode:405,body:"Method not allowed"};
 try{
  if(!process.env.PAYSTACK_SECRET_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_ANON_KEY||!process.env.SITE_URL)return{statusCode:503,body:JSON.stringify({error:"Payments are not fully configured yet."})};
  const token=(event.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!token)return{statusCode:401,body:JSON.stringify({error:"Log in first."})};
  const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
  const {data:{user},error}=await sb.auth.getUser(token);if(error||!user)return{statusCode:401,body:JSON.stringify({error:"Invalid session."})};
  const origin=process.env.SITE_URL.replace(/\/$/,"");
  const resp=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{"Authorization":`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,amount:5000,currency:"KES",callback_url:`${origin}/?payment=success`,metadata:{user_id:user.id,product:"StudyBuddy Premium",billing_period:"7 days"}})});
  const data=await resp.json();if(!resp.ok||!data.status)throw new Error(data.message||"Paystack could not initialise payment.");
  return{statusCode:200,headers:{"Content-Type":"application/json"},body:JSON.stringify({authorization_url:data.data.authorization_url,reference:data.data.reference})};
 }catch(e){return{statusCode:500,body:JSON.stringify({error:e.message||"Payment setup failed."})};}
};