import "./globals.css";
export const metadata = { title: "JMRSP-PnCSC", description: "Junior Mechatronics and Robotics Society of the Philippines – Pamantasan ng Cabuyao Student Chapter" };
export default function Layout({ children }) {
  return (<html lang="en"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Oswald:wght@500;700&family=Orbitron:wght@800&display=swap" /></head><body>{children}</body></html>);
}
