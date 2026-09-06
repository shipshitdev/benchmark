import Link from "next/link";
import type { ReactNode } from "react";

export default function Home(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold">Shipcut</h1>
      <p className="text-base leading-relaxed">
        Shipcut is a CLI that turns a livestream recording into a
        long-form recap video and a batch of shorts, ready to publish,
        so you can spend less time editing and more time streaming.
      </p>
      <Link href="/pricing" className="text-base font-medium underline">
        View pricing
      </Link>
    </main>
  );
}
