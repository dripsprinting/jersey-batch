import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">Drips Printing</span>
        </Link>
        <nav className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden sm:flex border-primary/20 text-primary hover:bg-primary/5">
              <Link to="/reseller">Reseller</Link>
            </Button>
            <Button asChild variant="default" className="shadow-sm">
              <Link to="/admin">Admin</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
