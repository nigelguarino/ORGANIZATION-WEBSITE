"use client";
import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { sb, upload } from "../lib/sb";
import { TEAMS, WHO, WHY, SOC } from "../lib/content";
import { PRIVACY, TERMS } from "../lib/legal";
import QRCode from "qrcode";
import { parseSheet, parseRows } from "../lib/sheet";
import { drawId } from "../lib/idcard";
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const can = (me, ...r) => r.includes(me?.admin_role);
const ICON = <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="13" cy="12" r="6" /><path d="M13 6a6 6 0 0 1 0 12z" fill="currentColor" stroke="none" /><path d="M13 1.5v2M13 20.5v2M2.5 12h2M5.7 4.7l1.4 1.4M5.7 19.3l1.4-1.4" /></svg>;
const Ctx = createContext(); const useC = () => useContext(Ctx);
const EM = ["❤️", "🔥", "👏", "😮"];
const parse = () => { const h = location.hash || "#/"; if (!h.startsWith("#/")) return { v: "home" }; const [v, a] = h.slice(2).split("/"); return { v: v || "home", a }; };
const Av = ({ x, s = 64 }) => <div className="av" style={{ width: s, height: s, fontSize: Math.round(s * .45), margin: "0 auto 8px" }}>{(x?.avatar_url || x?.photo_url) ? <img src={x.avatar_url || x.photo_url} alt="" /> : (x?.name || "?")[0]}</div>;
const Cd = ({ ic, t, d, on }) => <div className="card click" onClick={on}><div className="ic">{ic}</div><h3>{t}</h3><p className="mu">{d}</p></div>;
function Sec({ eb, t, to, children }) { const { go } = useC(); return <section><div className="eb">{eb}</div><div className="sh"><h2 className="s">{t}</h2><button className="btn sm o" onClick={() => go(...to)}>Show more →</button></div><div className="grid3">{children}</div></section>; }

export default function App() {
  const [r, setR] = useState({ v: "home" }), [me, setMe] = useState(null), [M, setM] = useState({}), [th, setTh] = useState("dark"), [toast, setToast] = useState("");
  const go = (v, a) => { location.hash = `#/${v}${a ? "/" + a : ""}`; scrollTo(0, 0); };
  const say = m => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const loadMe = useCallback(async () => { const { data: { user } } = await sb.auth.getUser(); if (!user) return setMe(null); const { data } = await sb.from("profiles").select("*").eq("id", user.id).single(); setMe(data); }, []);
  const reloadM = useCallback(async () => { const { data } = await sb.from("member_directory").select("*"); setM(Object.fromEntries((data || []).map(x => [x.id, x]))); }, []);
  useEffect(() => {
    if (location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(location.hostname)) location.replace(location.href.replace("http:", "https:"));
    const on = () => setR(parse()); on(); addEventListener("hashchange", on);
    loadMe(); reloadM(); const { data: s } = sb.auth.onAuthStateChange(() => { loadMe(); reloadM(); });
    setTh(localStorage.getItem("th") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
    return () => { removeEventListener("hashchange", on); s.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = th; try { localStorage.setItem("th", th); } catch { } }, [th]);
  const V = { home: Home, explore: Explore, events: Events, about: About, login: LoginPage, signup: Signup, prof: Profile, team: Team, legacy: Legacy, privacy: () => <Legal t="Privacy Policy" d={PRIVACY} />, terms: () => <Legal t="Terms and Conditions" d={TERMS} />, roster: Roster }[r.v] || NotFound;
  return (<Ctx.Provider value={{ me, go, say, loadMe, reloadM, M, r }}>
    <nav><div className="logo" onClick={() => go("home")}><img src="/logo.png" alt="" />JMRSP-PnCSC</div><div className="l">
      {[["home", "Home"], ["explore", "Explore"], ["events", "Events"], ["about", "About us"]].map(([v, t]) => <a key={v} className={r.v === v ? "on" : ""} onClick={() => go(v)}>{t}</a>)}
      {can(me, "creator", "editor") && <a className={r.v === "roster" ? "on" : ""} onClick={() => go("roster")}>Members data</a>}<a className="ti" title="Dark / light mode" aria-label="Switch dark / light mode" onClick={() => setTh(th === "dark" ? "light" : "dark")}>{ICON}</a>
      {me ? <a className="pf" onClick={() => go("prof", me.id)}>Profile</a> : <a className="pf" onClick={() => go("login")}>Login</a>}</div></nav>
    <V key={r.v + (r.a || "")} a={r.a} />
    <footer><div className="eb" style={{ marginBottom: 10 }}>Follow JMRSP-PnCSC</div>{Object.entries(SOC).map(([k, u]) => <a key={k} href={u} target="_blank" rel="noreferrer">{k}</a>)}<p><a onClick={() => go("privacy")}>Privacy Policy</a><a onClick={() => go("terms")}>Terms and Conditions</a></p><p className="mu">© Junior Mechatronics and Robotics Society of the Philippines – Pamantasan ng Cabuyao Student Chapter</p></footer>
    {toast && <div className="toast">{toast}</div>}</Ctx.Provider>);
}

/* ---------- auth ---------- */
function LoginCard() {
  const { go, loadMe } = useC(); const [f, setF] = useState({}), [err, setErr] = useState(""), [mfa, setMfa] = useState(null), [code, setCode] = useState(""), [tok, setTok] = useState("");
  const done = async () => { await loadMe(); const { data: { user } } = await sb.auth.getUser(); go("prof", user.id); };
  const login = async () => {
    if (SITEKEY && !tok) return setErr("Please complete the bot check."); const { error } = await sb.auth.signInWithPassword({ email: f.email || "", password: f.password || "", options: { captchaToken: tok } }); if (error) return setErr(error.message);
    const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (a.nextLevel === "aal2" && a.currentLevel !== "aal2") { const { data: fs } = await sb.auth.mfa.listFactors(); const fac = fs.totp[0]; const { data: ch } = await sb.auth.mfa.challenge({ factorId: fac.id }); return setMfa({ id: fac.id, ch: ch.id }); }
    done();
  };
  const verify = async () => { const { error } = await sb.auth.mfa.verify({ factorId: mfa.id, challengeId: mfa.ch, code }); if (error) return setErr("Incorrect code"); done(); };
  if (mfa) return <div className="card lg"><h3 style={{ marginTop: 0 }}>Two-step verification</h3><p className="mu">Enter the 6-digit code from your authenticator app.</p><input className="w" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && verify()} autoFocus /><button className="btn w" onClick={verify}>Verify &amp; login</button><p className="mu">{err}</p></div>;
  return <div className="card lg"><h3 style={{ marginTop: 0 }}>Login</h3><input className="w" placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} /><input className="w" type="password" placeholder="Password" onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === "Enter" && login()} /><Captcha onToken={setTok} /><button className="btn w" onClick={login}>Login</button><p className="mu">{err}</p><a className="tg" onClick={() => go("signup")}>No account? Sign up →</a></div>;
}
const LoginPage = () => <main className="pg"><div style={{ margin: "30px auto", maxWidth: 380 }}><LoginCard /></div></main>;
function Signup() {
  const [f, setF] = useState({ team: "v" }), [msg, setMsg] = useState(""), [sent, setSent] = useState(false), [tok, setTok] = useState(""), [scan, setScan] = useState(false); const s = k => e => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const go = async () => {
    if (["email", "password", "username", "birthday", "student_no", "qr"].some(k => !f[k])) return setMsg("Please fill in every field.");
    if (f.password.length < 8) return setMsg("Password must be at least 8 characters."); if (!f.consent) return setMsg("Please allow data use to continue."); if (!f.tc) return setMsg("Please agree to the Terms and Conditions and Privacy Policy."); if (f.hp) return; if (SITEKEY && !tok) return setMsg("Please complete the bot check.");
    const { error } = await sb.auth.signUp({ email: f.email, password: f.password, options: { captchaToken: tok, emailRedirectTo: location.origin, data: { username: f.username.toLowerCase(), birthday: f.birthday, student_no: f.student_no, qr: f.qr.trim().toUpperCase(), team: f.team, consent: true } } });
    error ? setMsg(/Database error/i.test(error.message) ? "Check your QR number and student number. They must match your member record." : error.message) : setSent(true);
  };
  if (sent) return <main className="pg"><div className="card" style={{ maxWidth: 480, margin: "30px auto", textAlign: "center" }}><div className="ic"></div><h2 className="s">Check your email</h2><p className="mu">We sent a verification link to {f.email}. Click it to activate your account, then log in.</p></div></main>;
  return <main className="pg"><div className="card" style={{ maxWidth: 520, margin: "20px auto" }}><div className="eb">Join us</div><h2 className="s">Create account</h2>
    <input className="w" type="email" placeholder="Email" onChange={s("email")} /><input className="w" type="password" placeholder="Password (min 8)" onChange={s("password")} /><input className="w" placeholder="Username" onChange={s("username")} /><p className="mu">Only members listed by the chapter can sign up. Enter the QR number from your member ID.</p><div className="row"><input className="w" style={{ flex: 1 }} placeholder="QR number on your member ID" value={f.qr || ""} onChange={s("qr")} autoComplete="off" />{typeof BarcodeDetector !== "undefined" && <button className="btn sm o" onClick={() => setScan(true)}>Scan QR</button>}</div>{scan && <QRScanner onCode={c => { setF(x => ({ ...x, qr: c })); setScan(false); }} onClose={() => setScan(false)} />}
    <label className="mu">Birthday <input type="date" onChange={s("birthday")} /></label><input className="w" placeholder="Student number" onChange={s("student_no")} />
    <select className="w" value={f.team} onChange={s("team")}>{Object.entries(TEAMS).map(([k, t]) => <option key={k} value={k}>{t.n}</option>)}</select>
    <label className="mu" style={{ display: "block", margin: "8px 0" }}><input type="checkbox" onChange={s("consent")} /> I allow JMRSP-PnCSC to use my data for organization purposes.</label>
    <label className="mu" style={{ display: "block", margin: "8px 0" }}><input type="checkbox" onChange={s("tc")} /> I agree to the <a className="tg" onClick={() => location.hash = "#/terms"}>Terms and Conditions</a> and <a className="tg" onClick={() => location.hash = "#/privacy"}>Privacy Policy</a>.</label><input style={{ position: "absolute", left: -9999 }} tabIndex={-1} autoComplete="off" onChange={s("hp")} /><Captcha onToken={setTok} /><button className="btn" onClick={go}>Done</button><p className="mu">{msg}</p></div></main>;
}

/* ---------- posts ---------- */
function useExtras(ids, tick) {
  const [x, setX] = useState({ rx: [], cm: [], fv: [], rp: [] });
  useEffect(() => { if (!ids.length) return setX({ rx: [], cm: [], fv: [], rp: [] }); (async () => { const q = t => sb.from(t).select("*").in("post_id", ids); const [rx, cm, fv, rp] = await Promise.all([q("reactions"), q("comments"), q("favorites"), q("reposts")]); setX({ rx: rx.data || [], cm: cm.data || [], fv: fv.data || [], rp: rp.data || [] }); })(); }, [ids.join(), tick]);
  return x;
}
function Feed({ k, build, empty = "No posts yet.", rb }) {
  const [ps, setPs] = useState([]), [tick, setTick] = useState(0);
  useEffect(() => { (async () => { const { data } = await build(sb.from("post_feed").select("*").order("created_at", { ascending: false })); setPs(data || []); })(); }, [k, tick]);
  const x = useExtras(ps.map(p => p.id), tick);
  return ps.length ? ps.map(p => <div key={p.id}>{rb && <div className="mu" style={{ marginTop: 10 }}>Reposted by {rb}</div>}<PostCard p={p} x={x} reload={() => setTick(t => t + 1)} /></div>) : <p className="mu">{empty}</p>;
}
function PostCard({ p, x, reload }) {
  const { me, go, say, M } = useC(); const [open, setOpen] = useState(false), [more, setMore] = useState(false), [t, setT] = useState("");
  const a = M[p.user_id] || {}, rx = x.rx.filter(r => r.post_id === p.id), cm = x.cm.filter(c => c.post_id === p.id), fv = x.fv.filter(f => f.post_id === p.id), rp = x.rp.filter(r => r.post_id === p.id);
  const mineR = me && rx.find(r => r.user_id === me.id), hid = Math.max(0, p.fav_count - fv.length), cnt = e => rx.filter(r => r.emoji === e).length;
  const need = () => { if (!me) { go("login"); return false; } return true; };
  const react = async e => { if (!need()) return; if (mineR) await sb.from("reactions").delete().eq("id", mineR.id); if (!mineR || mineR.emoji !== e) await sb.from("reactions").insert({ post_id: p.id, user_id: me.id, emoji: e }); reload(); };
  const fav = async () => { if (!need()) return; fv.some(f => f.user_id === me.id) ? await sb.from("favorites").delete().match({ post_id: p.id, user_id: me.id }) : await sb.from("favorites").insert({ post_id: p.id, user_id: me.id }); reload(); };
  const repost = async () => {
    if (!need()) return; if (p.user_id === me.id) return say("You can’t repost your own post"); if (!p.is_public) return say("Private posts can’t be reposted");
    if (rp.some(r => r.user_id === me.id)) { await sb.from("reposts").delete().match({ post_id: p.id, user_id: me.id }); return reload(); }
    await sb.from("reposts").insert({ post_id: p.id, user_id: me.id }); say("Reposted to your profile"); go("prof", me.id + ":rp");
  };
  const send = async () => { if (!need() || !t.trim()) return; await sb.from("comments").insert({ post_id: p.id, user_id: me.id, body: t.trim() }); setT(""); reload(); };
  const names = l => l.map(f => M[f.user_id]?.name).filter(Boolean).join(", ");
  return (<div className="card"><div className="ph" onClick={() => go("prof", p.user_id)}><div className="av s">{a.avatar_url ? <img src={a.avatar_url} alt="" /> : (a.name || "?")[0]}</div><b>{a.name}</b> <span className="mu">@{a.username} · {p.is_public ? " Public" : " Private"}</span></div>
    <p>{p.caption}</p>{p.image_url && <img className="pi" src={p.image_url} alt="" />}
    <div>{(p.tags || []).map(t => <a key={t} className="tg" onClick={() => go("explore")}>{t}</a>)}</div>
    <div className="rx">{["⚙️", ...EM.filter(e => more || cnt(e))].map(e => <button key={e} title={e === "⚙️" ? "Gear (main react)" : "React"} className={(mineR?.emoji === e ? "on" : "") + (e === "⚙️" ? " mn" : "")} onClick={() => react(e)}>{e} {cnt(e) || ""}</button>)}
      {!more && <button title="More reactions" onClick={() => setMore(true)}>＋</button>}
      <button onClick={() => setOpen(!open)}>Comment {cm.length}</button><button className={me && fv.some(f => f.user_id === me.id) ? "on" : ""} onClick={fav}>Favorite {p.fav_count}</button><button className={me && rp.some(r => r.user_id === me.id) ? "on" : ""} onClick={repost}>Repost {rp.length}</button></div>
    {p.fav_count > 0 && <div className="mu" style={{ marginTop: 6 }}>Favorited by {names(fv)}{hid ? `${fv.length ? " and " : ""}${hid} private user${hid > 1 ? "s" : ""}` : ""}</div>}
    {rp.length > 0 && <div className="mu">Reposted by {names(rp)}</div>}{can(me, "creator", "checker") && p.user_id !== me.id && <div style={{ marginTop: 8 }}><span className="tag">Moderator</span> <button className="btn sm o" onClick={async () => { await sb.from("posts").delete().eq("id", p.id); reload(); }}>Remove post</button></div>}
    {open && <div style={{ marginTop: 8 }}>{cm.map(c => <div className="cmt" key={c.id}><b>{M[c.user_id]?.name}</b> {c.body}</div>)}<div className="row"><input style={{ width: "70%" }} placeholder="Write a comment…" value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} /><button className="btn sm" onClick={send}>Post</button></div></div>}</div>);
}

/* ---------- pages ---------- */
const FC = ({ img, t, d, on, x }) => <div className="fc" onClick={on}><img className="fi" src={img || "/logo.png"} alt="" /><div className="ft"><h3>{t}</h3><p>{d}</p></div>{x}</div>;
function Row({ title, to, children }) { const { go } = useC(); return <section className="dsec"><h2 className="dh">{title}</h2><div className="drow">{children}<div className="more" onClick={() => go(...to)}><div className="mc"><svg viewBox="0 0 64 40" width="62" height="40" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h56M42 3l17 17-17 17" /></svg></div><span>SHOW MORE</span></div></div></section>; }
function useSitePics() {
  const { me, say } = useC(); const [pics, setPics] = useState({});
  const load = async () => { const { data } = await sb.from("site_pics").select("*"); setPics(Object.fromEntries((data || []).map(x => [x.key, x.url]))); }; useEffect(() => { load(); }, []);
  const change = k => async e => { const f = e.target.files[0]; if (!f) return; const u = await upload(f, me.id); if (!u) return; const { error } = await sb.from("site_pics").upsert({ key: k, url: u }); error ? say(error.message) : load(); };
  return { pics, change, can: can(me, "creator", "editor") };
}
const Chg = ({ k, p }) => p.can ? <label className="fcb" onClick={e => e.stopPropagation()}>Change photo<input hidden type="file" accept="image/*" onChange={p.change(k)} /></label> : null;
const Circ = ({ k, p }) => <div className="circw"><img className="circ" src={p.pics[k] || "/logo.png"} alt="" />{p.can && <label className="btn sm">Change photo<input hidden type="file" accept="image/*" onChange={p.change(k)} /></label>}</div>;
function Home() {
  const { me, go } = useC(); const sp = useSitePics(); const [ev, setEv] = useState([]), [lg, setLg] = useState([]), [tm, setTm] = useState([]);
  useEffect(() => { (async () => { setEv((await sb.from("events").select("*").order("event_date", { ascending: false }).limit(3)).data || []); setLg((await sb.from("legacy_people").select("*").order("sort").order("id")).data || []); setTm((await sb.from("terms").select("*").order("created_at", { ascending: false }).limit(3)).data || []); })(); }, []);
  return (<><header className="hero"><div className="vid" /><video className="vv" src="/hero.mp4" autoPlay muted loop playsInline onError={e => e.target.style.display = "none"} />
    <div className="in"><div className="blob"><img className="hl" src="/logo.png" alt="" /></div><h1 className="hd hn">Junior Mechatronics<br />and Robotics Society<br />of the Philippines</h1><h2 className="hc">– Pamantasan ng Cabuyao Student Chapter</h2>
      <div className="glass">The student chapter of the Junior Mechatronics and Robotics Society of the Philippines at Pamantasan ng Cabuyao — a community for learning, building and serving through technology.</div>
      {me ? <><p className="sub">Welcome back, {me.name}!</p><button className="btn" onClick={() => go("prof", me.id)}>Go to my profile</button></> : <><LoginCard /><div style={{ marginTop: 14 }}><button className="btn sm" onClick={() => go("signup")}>Get started</button><button className="btn sm o" onClick={() => go("about", "who")}>Learn more</button></div></>}</div></header>
    <main>
      <Row title="About us" to={["about", "who"]}><FC img={sp.pics.who} t="Who we are" d="A non-political, non-sectarian and non-profit student academic society, recognized by JMRSP National and accredited by Pamantasan ng Cabuyao." on={() => go("about", "who")} x={<Chg k="who" p={sp} />} /><FC img={sp.pics.mv} t="Mission" d="Integrate technology across fields through training, certifications and events to build future-ready student leaders." on={() => go("about", "who")} x={<Chg k="mv" p={sp} />} /><FC img={sp.pics.why} t="Why join us" d="Learn, build, compete and lead with a community that grows with you." on={() => go("about", "why")} x={<Chg k="why" p={sp} />} /></Row>
      <Row title="Events" to={["events"]}>{ev.map(e => <FC key={e.id} img={e.image_url} t={e.title} d={`${e.event_date} · ${e.location || ""} ${e.details || ""}`} on={() => go("events")} />)}</Row>
      <Row title="Legacies" to={["legacy"]}>{lg.filter(x => x.kind === "founder").slice(0, 3).map(f => <FC key={f.id} img={f.photo_url} t={f.name} d={f.position + (f.bio ? " · " + f.bio : "")} on={() => go("legacy")} />)}</Row>
      <Row title="Officers" to={["legacy"]}>{tm.map(t => <FC key={t.name} img={lg.find(x => x.term === t.name && x.photo_url)?.photo_url} t={t.name + (t.is_current ? " (current)" : "")} d={lg.filter(x => x.term === t.name).slice(0, 3).map(x => x.position).join(" · ")} on={() => go("legacy")} />)}</Row>
      <section className="dsec"><h2 className="dh">Latest posts</h2><div style={{ marginTop: 24 }}><Feed k="home" build={b => b.eq("is_public", true).limit(3)} /></div><p><button className="btn sm o" onClick={() => go("explore")}>Show more →</button></p></section></main></>);
}
function Captcha({ onToken }) {
  const ref = useRef();
  useEffect(() => { if (!SITEKEY) return; const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = () => window.turnstile.render(ref.current, { sitekey: SITEKEY, callback: onToken }); document.body.appendChild(s); return () => s.remove(); }, []);
  return SITEKEY ? <div ref={ref} style={{ margin: "8px 0" }} /> : <p className="mu">Bot protection is off (no Turnstile site key set).</p>;
}
const Legal = ({ t, d }) => <main className="pg"><div className="eb">Legal</div><h2 className="s">{t}</h2><div className="note">Draft for the chapter. Have your adviser or the university review it before publishing. Last updated October 2026.</div>{d.map(([h, p]) => <div key={h}><h3 className="lh">{h}</h3><p className="lp">{p}</p></div>)}</main>;
const NotFound = () => { const { go } = useC(); return <main className="pg" style={{ textAlign: "center", padding: "72px 0" }}><div className="dh" style={{ fontSize: "clamp(100px,26vw,240px)", color: "var(--au)" }}>404</div><h2 className="s">Page not found</h2><p className="mu">The page you are looking for does not exist or was moved.</p><button className="btn" onClick={() => go("home")}>Back to home</button></main>; };
function AdminPanel({ M, reload }) {
  const { me, say, reloadM, loadMe } = useC(); const [reqs, setReqs] = useState([]), [n, setN] = useState(0), [sel, setSel] = useState(""), [role, setRole] = useState("editor"), [nt, setNt] = useState("");
  useEffect(() => { sb.from("removal_requests").select("*").eq("status", "pending").then(({ data }) => setReqs(data || [])); }, [n]);
  const act = async (fn, args) => { const { error } = await sb.rpc(fn, args); if (error) return say(error.message); say("Done"); setN(x => x + 1); reloadM(); loadMe(); reload(); };
  const L = { creator: "Creator", editor: "Editor", checker: "Content checker" }, adm = Object.values(M).filter(m => m.admin_role), mine = reqs.filter(r => r.target === me.id);
  return (<div className="card"><h3>Admin settings</h3><p className="mu" style={{ color: "var(--tx)" }}>Creator: full control, manages admins. Editor: posts events, changes photos and team covers. Content checker: reviews and removes posts. A creator can only be removed after a removal request is approved.</p>
    {mine.map(r => <div className="note" key={r.id}>{M[r.requested_by]?.name} asked to remove you as creator. <button className="btn sm" onClick={() => act("answer_removal", { req: r.id, ok: true })}>Approve</button><button className="btn sm o" onClick={() => act("answer_removal", { req: r.id, ok: false })}>Decline</button></div>)}
    {adm.map(m => <div className="row" key={m.id} style={{ justifyContent: "space-between", alignItems: "center" }}><span><b>{m.name}</b> <span className="tag">{L[m.admin_role]}</span>{reqs.some(r => r.target === m.id) && <span className="mu"> removal requested</span>}</span>
      <span>{m.admin_role === "creator" ? (m.id === me.id ? <button className="btn sm o" onClick={() => act("step_down", {})}>Step down</button> : <button className="btn sm o" onClick={() => act("request_creator_removal", { target: m.id })}>Request removal</button>) : <button className="btn sm o" onClick={() => act("remove_admin", { target: m.id })}>Remove</button>}</span></div>)}
    <div className="row" style={{ marginTop: 16 }}><select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select member…</option>{Object.values(M).filter(m => !m.admin_role).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <select value={role} onChange={e => setRole(e.target.value)}><option value="creator">Creator</option><option value="editor">Editor</option><option value="checker">Content checker</option></select><button className="btn sm" onClick={() => sel && act("add_admin", { target: sel, r: role })}>Add admin</button></div>
    <div className="row" style={{ marginTop: 16 }}><input placeholder="New term e.g. 2027–2028" value={nt} onChange={e => setNt(e.target.value)} /><button className="btn sm" onClick={() => nt && act("start_term", { nm: nt })}>Start new term</button></div></div>);
}
const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const matrix = t => { const q = QRCode.create(t, { errorCorrectionLevel: "M" }), n = q.modules.size; return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, k) => !!q.modules.get(r, k))); };
function MyId() {
  const { me } = useC(); const [r, setR] = useState(), [done, setDone] = useState(false), f = useRef(), b = useRef();
  useEffect(() => { sb.rpc("my_id").then(({ data }) => { setR((data || [])[0]); setDone(true); }); }, []);
  useEffect(() => { if (!r) return; (async () => { const { data: bk } = await sb.from("site_pics").select("url").eq("key", "idback_" + r.team).maybeSingle(); const [fr, back, photo] = await Promise.all([loadImg("/id/front.jpg"), loadImg(bk?.url || "/id/back.jpg"), loadImg(me.avatar_url)]); const o = { qr: r.qr_number, nick: r.nickname, pos: r.position, name: r.full_name }, A = { front: fr, back }; await drawId(f.current, "front", { ...o, photo }, A, matrix); await drawId(b.current, "back", o, A, matrix); })(); }, [r, me.avatar_url]);
  const dl = (ref, side) => ref.current.toBlob(bl => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `JMRSP-ID-${side}-${r.nickname}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  if (!done) return <p className="mu">Loading…</p>;
  if (!r) return <div className="note">No member ID is linked to this account. Admins do not need one.</div>;
  return <><div className="note">Only you can see this ID. Show the back QR code to verify your membership. Keep your QR number private.{!me.avatar_url && " Add a profile picture (Profile picture button) to show your photo on the front."}</div>
    <div className="idpair"><canvas ref={f} /><canvas ref={b} /></div>
    <div style={{ marginTop: 16 }}><button className="btn" onClick={() => dl(f, "front")}>Download front</button><button className="btn o" onClick={() => dl(b, "back")}>Download back</button></div></>;
}
function QRScanner({ onCode, onClose }) {
  const ref = useRef();
  useEffect(() => { let stop = false, stream; (async () => { try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); ref.current.srcObject = stream; await ref.current.play(); const det = new BarcodeDetector({ formats: ["qr_code"] }); const loop = async () => { if (stop) return; const r = await det.detect(ref.current).catch(() => []); if (r[0]) return onCode(r[0].rawValue.trim().toUpperCase()); setTimeout(loop, 250); }; loop(); } catch { onClose(); alert("Camera not available. Type the QR number instead."); } })(); return () => { stop = true; stream && stream.getTracks().forEach(t => t.stop()); }; }, []);
  return <div className="card"><video ref={ref} muted playsInline style={{ width: "100%", borderRadius: 12 }} /><button className="btn sm o" onClick={onClose}>Cancel</button></div>;
}
function Roster() {
  const { me, say } = useC(); const [rows, setRows] = useState([]), [txt, setTxt] = useState(""), [q, setQ] = useState(""), [msg, setMsg] = useState(""), [n, setN] = useState(0), [st, setSt] = useState({ total: 0, claimed: 0 }), [prog, setProg] = useState(""), ok = can(me, "creator", "editor");
  useEffect(() => { if (!ok) return; const t = setTimeout(() => { sb.rpc("roster_list", { q, lim: 200 }).then(({ data }) => setRows(data || [])); sb.rpc("roster_stats").then(({ data }) => setSt((data || [])[0] || { total: 0, claimed: 0 })); }, 250); return () => clearTimeout(t); }, [n, ok, q]);
  if (!ok) return <main className="pg"><p className="mu">Admins only.</p></main>;
  const add = async list => {
    if (!list.length) { setProg(""); return setMsg("No rows found. Columns: Student ID, Full name, Nickname."); } let made = 0;
    for (let i = 0; i < list.length; i += 500) { setProg(`Saving ${Math.min(i + 500, list.length)} of ${list.length}…`); const { data, error } = await sb.rpc("import_roster", { rows: list.slice(i, i + 500).map(r => ({ student_no: r.sid, full_name: r.name, nickname: r.nick, position: r.pos })) }); if (error) { setProg(""); return say(error.message); } made += data; }
    setProg(""); setMsg(`Generated ${made} new QR number${made === 1 ? "" : "s"}${list.length - made ? `, skipped ${list.length - made} already in the list` : ""}.`); setTxt(""); setN(x => x + 1);
  };
  const file = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return; if (f.size > 209715200) return setMsg("File too large. The limit is 200 MB."); const nm = f.name.toLowerCase();
    try { if (nm.endsWith(".xlsx")) { setProg("Reading the spreadsheet…"); const { default: readXlsxFile } = await import("read-excel-file"); add(parseRows(await readXlsxFile(f))); } else if (/\.(csv|tsv|txt)$/.test(nm)) { setProg("Reading the file…"); add(parseSheet(await f.text())); } else setMsg("Use an XLSX, CSV, TSV or TXT file."); }
    catch { setProg(""); setMsg("Could not read that file. Check that it is a valid spreadsheet."); }
  };
  const save = (r, k) => e => { const x = { full_name: r.full_name, nickname: r.nickname, position: r.position || "", [k]: e.target.value }; sb.rpc("update_roster", { rid: r.id, fn: x.full_name, nn: x.nickname, pos: x.position }).then(({ error }) => error ? say(error.message) : setN(c => c + 1)); };
  const exp = async () => { const { data } = await sb.rpc("roster_list", { q: "", lim: 100000 }); const csv = [["Student ID", "Full name", "Nickname", "Position", "QR number", "Status"], ...(data || []).map(r => [r.student_no, r.full_name, r.nickname, r.position, r.qr_number, r.claimed ? "Signed up" : "Waiting"])].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "member-qr-numbers.csv"; a.click(); };
  const setBack = (k) => async e => { const f = e.target.files[0]; if (!f) return; const u = await upload(f, me.id); if (!u) return; const { error } = await sb.from("site_pics").upsert({ key: "idback_" + k, url: u }); say(error ? error.message : "ID back design updated"); };
  const cell = (r, k, v) => r.claimed ? v : <input key={r.id + k + v} defaultValue={v || ""} onBlur={save(r, k)} />;
  return (<main className="pg"><div className="eb">Admin</div><h2 className="s">Members data</h2>
    <div className="grid"><div className="card"><h3>1. Add the member sheet</h3><p className="mu" style={{ color: "var(--tx)" }}>Columns: Student ID number, Full name, Nickname (and an optional Position). Upload an XLSX, CSV, TSV or TXT file up to 200 MB, or paste rows copied from Excel or Google Sheets.</p><input type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={file} /><textarea className="w" rows={5} placeholder="2026-0301,Maria Clara Santos,Clara,Member" value={txt} onChange={e => setTxt(e.target.value)} /><button className="btn" onClick={() => add(parseSheet(txt))}>Generate members &amp; QR numbers</button><p className="mu" style={{ color: "var(--au)" }}>{prog || msg}</p></div>
      <div className="card"><h3>2. Status</h3><p style={{ fontSize: 34, margin: 0, fontWeight: 700 }}>{st.total} <span className="mu" style={{ fontSize: 14 }}>members in the sheet</span></p><p className="mu" style={{ color: "var(--tx)" }}>{st.claimed} signed up · {st.total - st.claimed} waiting</p><p className="mu" style={{ color: "var(--tx)" }}>Each record gets a permanent QR number. It can never be changed or regenerated. Members enter it with their student number to sign up, and after signing in only they can see and download their own ID.</p></div></div>
    <div className="card"><h3>3. ID back design per team</h3><p className="mu" style={{ color: "var(--tx)" }}>The default back (Verdant Logic Core) is used until you upload a design for a team. Use a JPG or PNG of 1545 × 1999 px. The QR code is placed in the white box automatically.</p>{Object.entries(TEAMS).map(([k, t]) => <label key={k} className="btn sm o">{t.n}<input hidden type="file" accept="image/png,image/jpeg" onChange={setBack(k)} /></label>)}</div>
    <h2 className="s" style={{ marginTop: 48 }}>QR numbers</h2><input className="w" placeholder="Search name, nickname, student ID or QR number" value={q} onChange={e => setQ(e.target.value)} />
    <div className="tw" style={{ marginTop: 24 }}><table className="tb"><thead><tr><th>Student ID</th><th>Full name</th><th>Nickname</th><th>Position</th><th>QR number</th><th>Status</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.student_no}</td><td>{cell(r, "full_name", r.full_name)}</td><td>{cell(r, "nickname", r.nickname)}</td><td>{cell(r, "position", r.position)}</td><td><code>{r.qr_number}</code></td><td><span className="tag">{r.claimed ? "Signed up" : "Waiting"}</span></td></tr>)}{!rows.length && <tr><td colSpan="6" className="mu">No records yet.</td></tr>}</tbody></table></div>
    <p className="mu">Showing up to 200 matches. The CSV has every record. Keep it private: it contains the QR numbers.</p><p><button className="btn o" onClick={exp}>Download QR list (CSV)</button></p></main>);
}
function Explore() {
  const { M, go } = useC(); const [q, setQ] = useState(""), [k, setK] = useState("");
  useEffect(() => { const t = setTimeout(() => setK(q.trim().replace(/[,()]/g, "")), 250); return () => clearTimeout(t); }, [q]);
  const s = k.toLowerCase(), all = Object.values(M), ms = all.filter(m => !s || (m.name + " " + m.username).toLowerCase().includes(s)), ts = Object.entries(TEAMS).filter(([, t]) => !s || (t.n + " " + t.f).toLowerCase().includes(s));
  return (<main className="pg"><div className="eb">Explore</div><h2 className="s">Search</h2><input className="w" autoFocus placeholder="Search posts, #hashtags, member names or teams…" value={q} onChange={e => setQ(e.target.value)} />
    <h2 className="s" style={{ marginTop: 22 }}>Members</h2><div className="grid">{ms.map(m => <div key={m.id} className="card click" onClick={() => go("prof", m.id)}><Av x={m} s={56} /><h3>{m.name}</h3><span className="tag" style={{ borderColor: TEAMS[m.team]?.c }}>{TEAMS[m.team]?.n}</span></div>)}</div>
    <h2 className="s" style={{ marginTop: 22 }}>Teams</h2><div className="grid">{ts.map(([i, t]) => <div key={i} className="card click trect" style={{ "--c": t.c }} onClick={() => go("team", i)}><h3>{t.n}</h3><p className="mu">{t.f}</p></div>)}</div>
    <h2 className="s" style={{ marginTop: 22 }}>Posts</h2><Feed k={"x" + k} empty="No posts found." build={b => { b = b.eq("is_public", true); if (!s) return b.limit(30); const f = [`caption.ilike.%${s}%`]; if (s.startsWith("#")) f.push(`tags.cs.{${s}}`); if (ms.length && ms.length < all.length) f.push(`user_id.in.(${ms.map(m => m.id).join(",")})`); return b.or(f.join(",")).limit(30); }} /></main>);
}
function Events() {
  const { me, say } = useC(); const sp = useSitePics(); const [ev, setEv] = useState([]), [n, setN] = useState(0);
  useEffect(() => { (async () => setEv((await sb.from("events").select("*").order("event_date", { ascending: false })).data || []))(); }, [n]);
  const add = async e => { e.preventDefault(); const f = new FormData(e.target), file = f.get("img"); const image_url = file && file.size ? await upload(file, me.id) : null; const { error } = await sb.from("events").insert({ title: f.get("t"), event_date: f.get("d"), location: f.get("l"), details: f.get("x"), image_url }); if (error) return say(error.message); e.target.reset(); setN(n + 1); };
  return (<main className="pg"><div className="split"><Circ k="events" p={sp} /><div><div className="eb">Events</div><h2 className="s">JMRSP events</h2><p className="mu">Everything the chapter has organized, and what is coming next.</p></div></div>
    {can(me, "creator", "editor") ? <form className="card" onSubmit={add}><b>Admin · post an event</b><br /><input name="t" placeholder="Title" required /><input name="d" type="date" required /><input name="l" placeholder="Location" /><input name="x" placeholder="Details" /><input name="img" type="file" accept="image/*" /><button className="btn sm">+ Post event</button></form> : <div className="note">Only the admin can post events.</div>}
    <div className="grid">{ev.map(e => <div className="card" key={e.id}>{e.image_url && <img className="pi" src={e.image_url} alt="" />}<div className="eb au">{e.event_date}{new Date(e.event_date) > new Date() ? " · UPCOMING" : ""}</div><h3>{e.title}</h3><p className="mu"> {e.location} — {e.details}</p>{can(me, "creator", "editor") && <button className="btn sm o" onClick={async () => { await sb.from("events").delete().eq("id", e.id); setN(n + 1); }}>Delete</button>}</div>)}</div></main>);
}
function About({ a }) {
  const { go } = useC(); const sp = useSitePics(); const t = a || "who";
  return (<><div className="cover"><Circ k="about" p={sp} /><div style={{ flex: 1, minWidth: 240 }}><div className="eb">Pamantasan ng Cabuyao</div><h1 className="hd" style={{ fontSize: 56 }}>About us</h1><p className="sub">JMRSP-PnCSC is the student chapter of the Junior Mechatronics and Robotics Society of the Philippines at Pamantasan ng Cabuyao — a community for learning, building and serving through technology.</p></div></div>
    <main className="pg"><div className="tabs">{[["who", "Who we are"], ["why", "Why join us"], ["leg", "Legacies"]].map(([k, l]) => <button key={k} className={t === k ? "on" : ""} onClick={() => go("about", k)}>{l}</button>)}</div>
      {t === "who" && <div dangerouslySetInnerHTML={{ __html: WHO }} />}
      {t === "why" && <><div dangerouslySetInnerHTML={{ __html: WHY }} /><h2 className="s" style={{ marginTop: 26 }}>Member teams</h2><p className="mu">Every regular member may voluntarily affiliate with one team at a time, based on their interest and specialization.</p><div className="grid">{Object.entries(TEAMS).map(([k, x]) => <div key={k} className="card click trect" style={{ "--c": x.c }} onClick={() => go("team", k)}><span className="dot" style={{ background: x.c }} /><h3>{x.n}</h3><div className="eb au">{x.f}</div><p className="mu">{x.o}</p><span className="mu">Open community →</span></div>)}</div></>}
      {t === "leg" && <LegBody />}</main></>);
}
function Team({ a }) {
  const { M, go, me, say } = useC(); const [cov, setCov] = useState(""); useEffect(() => { sb.from("team_covers").select("url").eq("team", a).maybeSingle().then(({ data }) => setCov(data?.url || "")); }, [a]); const t = TEAMS[a] || TEAMS.v, ms = Object.values(M).filter(m => m.team === a);
  return (<><div className="cover" style={{ background: cov ? `linear-gradient(rgba(5,3,10,.45),rgba(5,3,10,.72)),url(${cov}) center/cover` : `linear-gradient(120deg,${t.c},#07040d 70%)` }}><div><div className="eb" style={{ color: "#fff" }}>Team community</div><h1 className="hd" style={{ fontSize: 52 }}>{t.n}</h1><p className="sub">{t.f} · {t.s}</p>{can(me, "creator", "editor") && <div><label className="btn sm">Change cover photo<input hidden type="file" accept="image/*" onChange={async e => { const f = e.target.files[0]; if (!f) return; const u = await upload(f, me.id); if (!u) return; const { error } = await sb.from("team_covers").upsert({ team: a, url: u }); error ? say(error.message) : setCov(u); }} /></label>{cov && <button className="btn sm o" onClick={async () => { await sb.from("team_covers").delete().eq("team", a); setCov(""); }}>Reset</button>}</div>}</div></div>
    <main className="pg"><button className="btn sm o" onClick={() => go("about", "why")}>← All teams</button><div className="card"><p>{t.d}</p><p className="mu">Handled by: {t.by}</p></div>
      <h2 className="s">Members</h2><div className="grid">{ms.map(m => <div key={m.id} className="card click" onClick={() => go("prof", m.id)}><Av x={m} s={56} /><h3>{m.name}</h3><span className="mu">@{m.username}</span></div>)}</div>
      <h2 className="s" style={{ marginTop: 22 }}>Public posts</h2><Feed k={a + ms.length} empty="No public posts yet." build={b => b.eq("is_public", true).in("user_id", ms.map(m => m.id))} /></main></>);
}

/* ---------- legacies ---------- */
function Person({ r, ed, cur, reload }) {
  const { me } = useC();
  if (!ed) return <div className="card" style={{ textAlign: "center" }}><Av x={r} s={84} /><h3>{r.name}</h3><span className="tag">{r.position}</span><p className="mu">{r.bio}</p></div>;
  const f = k => ({ defaultValue: r[k] || "", onBlur: e => sb.from("legacy_people").update({ [k]: e.target.value }).eq("id", r.id) });
  const pic = async e => { const file = e.target.files[0]; if (!file) return; const u = await upload(file, me.id); if (u) { await sb.from("legacy_people").update({ photo_url: u }).eq("id", r.id); reload(); } };
  return <div className="card"><div style={{ textAlign: "center" }}><Av x={r} s={84} /><label className="btn sm o"> Picture<input hidden type="file" accept="image/*" onChange={pic} /></label></div>
    <input className="w" placeholder="Name" {...f("name")} /><input className="w" placeholder="Position" {...f("position")} /><textarea className="w" rows={2} placeholder="Bio" {...f("bio")} />
    {r.kind === "officer" && (r.added_term !== cur ? <span className="mu"> Locked: added in a previous term</span> : <button className="btn sm o" onClick={async () => { await sb.from("legacy_people").delete().eq("id", r.id); reload(); }}>Remove</button>)}</div>;
}
function LegBody() {
  const { me, M, say } = useC(); const [rows, setRows] = useState([]), [terms, setTerms] = useState([]), [n, setN] = useState(0), [nt, setNt] = useState(""), [ta, setTa] = useState(""), [pr, setPr] = useState("");
  useEffect(() => { (async () => { setRows((await sb.from("legacy_people").select("*").order("sort").order("id")).data || []); setTerms((await sb.from("terms").select("*").order("created_at", { ascending: false })).data || []); })(); }, [n]);
  const ed = me?.role === "officer", cur = terms.find(t => t.is_current)?.name, reload = () => setN(x => x + 1);
  const rpc = async (fn, args) => { const { error } = await sb.rpc(fn, args); error ? say(error.message) : (say("Done"), reload()); };
  const mem = Object.values(M);
  return (<><div className="eb">Hierarchy</div><h2 className="s">Legacies</h2><div className="note">{ed ? "Officer mode: the current term and the term before it can be edited. When the next term is added, both lock automatically so history stays intact." : "Only officers can update the hierarchy."}</div>
    <div className="eb au">Fixed positions</div><div className="grid3" style={{ margin: "8px 0 22px" }}>{rows.filter(r => r.kind === "founder").map(r => <div key={r.id} className="pin"><Person r={r} ed={ed} cur={cur} reload={reload} /></div>)}</div>
    <div className="eb au">Officers by year (scroll)</div><div className="scr" style={{ marginTop: 8 }}>{terms.map(t => <div className="term" key={t.name}><h3 className="s" style={{ fontSize: 24 }}>{t.name}{t.is_current ? " · current" : t.is_editable ? " · editable until the next term starts" : " · locked"}</h3><div className="grid">{rows.filter(r => r.kind === "officer" && r.term === t.name).map(r => <Person key={r.id} r={r} ed={ed && t.is_editable} cur={cur} reload={reload} />)}</div>
      {ed && t.is_editable && <button className="btn sm" style={{ marginTop: 10 }} onClick={async () => { const { error } = await sb.from("legacy_people").insert({ kind: "officer", term: t.name, added_term: cur, name: "New officer", position: "Position" }); error ? say(error.message) : reload(); }}>+ Add officer</button>}</div>)}</div>
    {can(me, "creator") && <AdminPanel M={M} reload={reload} />}</>);
}
const Legacy = () => <main className="pg"><LegBody /></main>;

/* ---------- profile ---------- */
function Composer({ onDone }) {
  const { me, say } = useC(); const [c, setC] = useState(""), [tg, setTg] = useState(""), [pub, setPub] = useState("1"), [f, setF] = useState(null), [busy, setBusy] = useState(false);
  const post = async () => { if (!c.trim() && !f) return; setBusy(true); const image_url = f ? await upload(f, me.id) : null; const tags = tg.split(/[\s,]+/).filter(Boolean).map(x => x[0] === "#" ? x : "#" + x); const { error } = await sb.from("posts").insert({ user_id: me.id, caption: c, tags, image_url, is_public: pub === "1" }); setBusy(false); if (error) return say(error.message); setC(""); setTg(""); setF(null); onDone(); };
  return <div className="card"><b>New post</b><br /><textarea className="w" rows={2} placeholder="Caption" value={c} onChange={e => setC(e.target.value)} /><input placeholder="#hashtags" value={tg} onChange={e => setTg(e.target.value)} style={{ width: "50%" }} /><select value={pub} onChange={e => setPub(e.target.value)}><option value="1"> Public</option><option value="0"> Private</option></select><br /><label className="btn sm o"> Photo{f ? " " : ""}<input hidden type="file" accept="image/*" onChange={e => setF(e.target.files[0])} /></label><button className="btn sm" disabled={busy} onClick={post}>Post</button></div>;
}
function Profile({ a }) {
  const { me, go, say, M, loadMe, reloadM } = useC(); const [id, tq] = (a || "").split(":"); const [tab, setTab] = useState(tq || "posts"), [n, setN] = useState(0), [bio, setBio] = useState(""), [lk, setLk] = useState("");
  const mine = me?.id === id, m = mine ? { ...M[id], ...me } : M[id]; useEffect(() => { setBio(m?.bio || ""); }, [m?.bio]);
  if (!m) return <main className="pg"><p className="mu">Loading… or member not found.</p></main>;
  const t = TEAMS[m.team] || TEAMS.v, links = m.links || [];
  const patch = async o => { const { error } = await sb.from("profiles").update(o).eq("id", id); if (error) say(error.message); await loadMe(); reloadM(); };
  const pic = k => async e => { const f = e.target.files[0]; if (!f) return; const u = await upload(f, id); u && patch({ [k]: u }); };
  const ids = k => async b => { const { data } = await sb.from(k).select("post_id").eq("user_id", id); return b.in("id", (data || []).map(x => x.post_id)); };
  const tabs = [["posts", "Posts"], ["fav", "Favorites"], ["rp", "Reposts"], ...(mine ? [["chat", "Chatbox "], ["id", "My ID"], ["set", "Settings"]] : [])];
  return (<main className="pg"><div className="cv" style={{ background: m.cover_url ? `url(${m.cover_url}) center/cover` : `linear-gradient(120deg,${t.c},#2e1065 60%,#07040d)` }} />
    {mine && <label className="btn sm o" style={{ marginTop: 8 }}>Change cover<input hidden type="file" accept="image/*" onChange={pic("cover_url")} /></label>}
    <div className="card" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}><Av x={m} s={84} /><div style={{ flex: 1, minWidth: 230 }}>
      <h2 className="s" style={{ margin: 0 }}>{m.name}</h2><span className="mu">@{m.username}</span> <span className="tag" style={{ borderColor: t.c, cursor: "pointer" }} onClick={() => go("team", m.team)}>{t.n}</span>{m.role === "officer" && <> <span className="tag">Officer</span></>}
      {mine ? <><br /><label className="btn sm o">Profile picture<input hidden type="file" accept="image/*" onChange={pic("avatar_url")} /></label><textarea className="w" rows={2} placeholder="Add a bio" value={bio} onChange={e => setBio(e.target.value)} /><button className="btn sm" onClick={() => patch({ bio })}>Save bio</button> <button className="btn sm o" onClick={async () => { await sb.auth.signOut(); go("home"); }}>Log out</button></>
        : <><p>{m.bio}</p>{me && <button className="btn sm o" onClick={() => { sessionStorage.setItem("dm", id); go("prof", me.id + ":chat"); }}> Message</button>}</>}
      <div>{links.map(l => <span key={l}><a className="tg" href={l} target="_blank" rel="noreferrer"> {l.replace(/^https?:\/\//, "")}</a>{mine && <a className="link" onClick={() => patch({ links: links.filter(x => x !== l) })}> remove</a>}</span>)}</div>
      {mine && <><input placeholder="https://your-website" style={{ width: "60%" }} value={lk} onChange={e => setLk(e.target.value)} /><button className="btn sm o" onClick={() => { if (lk.trim()) { patch({ links: [...links, lk.trim()] }); setLk(""); } }}>Add link</button></>}</div></div>
    <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "posts" && <>{mine && <Composer onDone={() => setN(n + 1)} />}<Feed k={id + "p" + n} build={b => b.eq("user_id", id)} /></>}
    {tab === "fav" && <>{mine && <div className="note">Favorites are <b>{m.fav_public ? "public — your name shows on posts you favorite" : "private — nobody can see you favorited a post"}</b>. <button className="btn sm o" onClick={() => patch({ fav_public: !m.fav_public })}>Make {m.fav_public ? "private" : "public"}</button></div>}
      {mine || m.fav_public ? <Feed k={id + "f"} empty="No favorites yet." build={ids("favorites")} /> : <p className="mu"> Favorites are private.</p>}</>}
    {tab === "rp" && <>{mine && <div className="note">Posts you repost from other members appear here on your profile.</div>}<Feed k={id + "r"} empty="No reposts yet." rb={m.name} build={ids("reposts")} /></>}
    {mine && tab === "chat" && <Chat />}{mine && tab === "set" && <Settings />}{mine && tab === "id" && <MyId />}</main>);
}
function Chat() {
  const { me, M, say } = useC(); const others = Object.values(M).filter(x => x.id !== me.id); const [w, setW] = useState(() => sessionStorage.getItem("dm") || others[0]?.id), [ms, setMs] = useState([]), [t, setT] = useState("");
  const load = useCallback(async () => { if (!w) return; const { data } = await sb.from("messages").select("*").or(`and(sender.eq.${me.id},receiver.eq.${w}),and(sender.eq.${w},receiver.eq.${me.id})`).order("id"); setMs(data || []); }, [w, me.id]);
  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, [load]);
  const send = async file => { let media_url = null, media_type = null; if (file) { media_url = await upload(file, me.id); media_type = file.type.startsWith("video") ? "video" : "image"; } if (!t.trim() && !media_url) return; const { error } = await sb.from("messages").insert({ sender: me.id, receiver: w, body: t.trim(), media_url, media_type }); if (error) return say(error.message); setT(""); load(); };
  return <div className="chat card"><div>{others.map(x => <div key={x.id} className={"ci" + (x.id === w ? " on" : "")} onClick={() => setW(x.id)}>{x.name}</div>)}</div>
    <div><div className="ms">{ms.map(m => <div key={m.id} className={"bub " + (m.sender === me.id ? "u" : "a")}>{m.media_url && (m.media_type === "video" ? <video src={m.media_url} controls style={{ maxWidth: "100%" }} /> : <img src={m.media_url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />)}{m.body}</div>)}{!ms.length && <p className="mu">Private chat. No messages yet.</p>}</div>
      <div className="row"><input style={{ flex: 1 }} placeholder="Message…" value={t} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} /><label className="btn sm o"> Photo/Video<input hidden type="file" accept="image/*,video/*" onChange={e => e.target.files[0] && send(e.target.files[0])} /></label><button className="btn sm" onClick={() => send()}>Send</button></div></div></div>;
}
function Settings() {
  const { say } = useC(); const [p, setP] = useState({ a: "", b: "", c: "" }), [fac, setFac] = useState(null), [en, setEn] = useState(null), [code, setCode] = useState("");
  const loadF = async () => { const { data } = await sb.auth.mfa.listFactors(); setFac((data?.totp || [])[0] || null); }; useEffect(() => { loadF(); }, []);
  const chPw = async () => {
    const { data: { user } } = await sb.auth.getUser(); const ok = await sb.auth.signInWithPassword({ email: user.email, password: p.a }); if (ok.error) return say("Current password is incorrect");
    if (p.b.length < 8) return say("New password must be at least 8 characters"); if (p.b !== p.c) return say("Passwords do not match");
    const { error } = await sb.auth.updateUser({ password: p.b }); say(error ? error.message : " Password updated"); setP({ a: "", b: "", c: "" });
  };
  const enroll = async () => { const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "JMRSP-" + Date.now() }); error ? say(error.message) : setEn(data); };
  const confirm = async () => { const { data: ch } = await sb.auth.mfa.challenge({ factorId: en.id }); const { error } = await sb.auth.mfa.verify({ factorId: en.id, challengeId: ch.id, code }); if (error) return say("Incorrect code"); setEn(null); setCode(""); say(" Two-step verification is ON"); loadF(); };
  const off = async () => { const { error } = await sb.auth.mfa.unenroll({ factorId: fac.id }); error ? say(error.message) : (say("Two-step verification turned off"), loadF()); };
  const set = k => e => setP({ ...p, [k]: e.target.value });
  return <div className="grid"><div className="card"><h3>Change password</h3><input className="w" type="password" placeholder="Current password" value={p.a} onChange={set("a")} /><input className="w" type="password" placeholder="New password (min 8 characters)" value={p.b} onChange={set("b")} /><input className="w" type="password" placeholder="Confirm new password" value={p.c} onChange={set("c")} /><button className="btn sm" onClick={chPw}>Update password</button></div>
    <div className="card"><h3>Two-step verification</h3><p className="mu">Adds a 6-digit code from an authenticator app (Google Authenticator, Authy…) after your password. Status: <b>{fac?.status === "verified" ? "ON" : "OFF"}</b></p>
      {fac?.status === "verified" ? <button className="btn sm o" onClick={off}>Turn off</button> : en ? <><img src={en.totp.qr_code} alt="QR" style={{ width: 170, background: "#fff", borderRadius: 8 }} /><p className="mu">Scan the QR, then enter the code. Secret: {en.totp.secret}</p><input placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value)} /><button className="btn sm" onClick={confirm}>Confirm</button></> : <button className="btn sm" onClick={enroll}>Turn on</button>}</div></div>;
}
