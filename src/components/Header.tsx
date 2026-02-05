import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shirt, Shield } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Shirt className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">JerseyPro</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Button asChild variant="ghost">
            <Link to="/">Order</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
