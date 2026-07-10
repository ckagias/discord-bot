import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const STYLES = {
  page: "flex flex-col flex-1 items-center justify-center bg-[var(--bg-dark)] font-sans",
  card: "flex flex-col items-center gap-6 text-center px-8 py-16 max-w-md",
  title: "text-3xl font-semibold tracking-tight text-[var(--text)]",
  subtitle: "text-base text-[var(--text-muted)]",
  loginButton:
    "flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[var(--primary)] px-6 text-base font-medium text-[var(--bg-dark)] transition-colors hover:opacity-90",
};

export default async function Home() {
  const session = await getSession();
  if (session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className={STYLES.page}>
      <div className={STYLES.card}>
        <h1 className={STYLES.title}>Bot Dashboard</h1>
        <p className={STYLES.subtitle}>
          Manage your self-hosted Discord bot&apos;s settings from the browser.
        </p>
        <a href="/api/auth/login" className={STYLES.loginButton}>
          Login with Discord
        </a>
      </div>
    </div>
  );
}