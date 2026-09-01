import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <h1 className="mt-2 text-lg font-medium">Page not found</h1>
        <p className="mt-1 text-sm text-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg"
        >
          Back to your dashboard
        </Link>
      </div>
    </main>
  );
}
