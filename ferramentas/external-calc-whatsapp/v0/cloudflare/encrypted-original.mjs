// Worker-only AES-GCM encryption of provider message before storage.
// Key is a Cloudflare secret (64 hex digits, 256 bits), never a public env var.
export async function encryptOriginal(message,secret){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/i.test(secret))throw Error('ENCRYPTION_KEY_NOT_CONFIGURED');
 const bytes=Uint8Array.from(secret.match(/.{2}/g),h=>parseInt(h,16));
 const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new TextEncoder().encode(JSON.stringify(message));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data);
 return {ciphertext:Buffer.from(ciphertext),iv:Buffer.from(iv)};
}
