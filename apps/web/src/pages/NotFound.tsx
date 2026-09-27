import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "../Layout";
import { btn } from "../ui";

export function NotFound() {
  return (
    <Layout wide>
      <div className="mx-auto flex max-w-md flex-col items-center pt-24 text-center sm:pt-32">
        <p className="font-mono text-7xl font-semibold tracking-tighter text-muted-foreground/40 sm:text-8xl">
          404
        </p>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link to="/" className={btn.secondary}>
            <ArrowLeft className="size-4" aria-hidden />
            Home
          </Link>
          <Link to="/components" className={btn.primary}>
            Browse components
          </Link>
        </div>
      </div>
    </Layout>
  );
}
