import { createClient } from "@supabase/supabase-js";
export const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// uploads to the public "media" bucket inside the user's own folder
export async function upload(file, uid) {
  const img = /^image\/(jpeg|png|webp|gif)$/.test(file.type), vid = /^video\/(mp4|webm)$/.test(file.type);
  if (!img && !vid) { alert("File not allowed. Use JPG, PNG, WEBP, GIF, MP4 or WEBM."); return null; }
  if (file.size > (vid ? 25 : 5) * 1048576) { alert(`File too large. Max ${vid ? 25 : 5} MB.`); return null; }
  const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.]/g, "_")}`;
  const { error } = await sb.storage.from("media").upload(path, file);
  if (error) { alert(error.message); return null; }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}
