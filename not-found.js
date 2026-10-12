export const metadata = { title: "Page not found" };
export default function NotFound() {
  return (<main className="pg" style={{ textAlign: "center", padding: "72px 18px" }}><div className="dh" style={{ fontSize: "clamp(100px,26vw,240px)", color: "var(--au)" }}>404</div>
    <h2 className="s">Page not found</h2><p className="mu">The page you are looking for does not exist or was moved.</p><a className="btn" href="/">Back to home</a></main>);
}
